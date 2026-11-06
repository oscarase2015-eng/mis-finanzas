export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const pad = (n: number) => String(n).padStart(2, '0');

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ym(date: string) {
  return date.slice(0, 7);
}

export function lastDay(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

export interface Period {
  kind: 'quincena' | 'mes' | 'anio';
  start: string;
  end: string;
  label: string;
}

/** Quincenas: del 1 al 14 y del 15 al fin de mes (cobro los días 1 y 15). */
export function quincenaOf(date: string): Period {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  const first = d < 15;
  const start = `${y}-${pad(m)}-${first ? '01' : '15'}`;
  const end = `${y}-${pad(m)}-${first ? '14' : pad(lastDay(y, m))}`;
  return { kind: 'quincena', start, end, label: `${first ? '1.ª' : '2.ª'} quincena de ${MONTHS[m - 1]}` };
}

export function monthOf(date: string): Period {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  return { kind: 'mes', start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(lastDay(y, m))}`, label: `${MONTHS[m - 1]} ${y}` };
}

export function yearOf(date: string): Period {
  const y = date.slice(0, 4);
  return { kind: 'anio', start: `${y}-01-01`, end: `${y}-12-31`, label: `Año ${y}` };
}

export function periodOf(kind: Period['kind'], date: string): Period {
  return kind === 'quincena' ? quincenaOf(date) : kind === 'mes' ? monthOf(date) : yearOf(date);
}

/** Mueve un periodo hacia atrás (-1) o adelante (+1) */
export function shiftPeriod(p: Period, dir: -1 | 1): Period {
  const y = Number(p.start.slice(0, 4));
  const m = Number(p.start.slice(5, 7));
  const d = Number(p.start.slice(8, 10));
  if (p.kind === 'anio') return yearOf(`${y + dir}-01-01`);
  if (p.kind === 'mes') {
    const dt = new Date(y, m - 1 + dir, 1);
    return monthOf(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-01`);
  }
  if (dir === 1) {
    if (d === 1) return quincenaOf(`${y}-${pad(m)}-15`);
    const dt = new Date(y, m, 1);
    return quincenaOf(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-01`);
  }
  if (d === 15) return quincenaOf(`${y}-${pad(m)}-01`);
  const dt = new Date(y, m - 2, 1);
  return quincenaOf(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-15`);
}

export function addMonths(yyyymm: string, n: number) {
  const y = Number(yyyymm.slice(0, 4));
  const m = Number(yyyymm.slice(5, 7));
  const dt = new Date(y, m - 1 + n, 1);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
}

export function monthLabel(yyyymm: string, short = false) {
  const m = Number(yyyymm.slice(5, 7));
  return short ? MONTHS_SHORT[m - 1] : `${MONTHS[m - 1]} ${yyyymm.slice(0, 4)}`;
}

export function dayHeader(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const t = today();
  if (date === t) return 'Hoy';
  const yd = new Date();
  yd.setDate(yd.getDate() - 1);
  if (date === `${yd.getFullYear()}-${pad(yd.getMonth() + 1)}-${pad(yd.getDate())}`) return 'Ayer';
  return `${DAYS[dt.getDay()]} ${d} de ${MONTHS[m - 1]}${String(y) !== t.slice(0, 4) ? ` ${y}` : ''}`;
}

export function shortDate(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}
