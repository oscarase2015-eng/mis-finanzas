import type { Account, Transaction } from './db';

const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha YYYY-MM-DD con el día ajustado al último del mes (corte el 31 en febrero → 28/29) */
function dateAt(y: number, m: number, day: number) {
  while (m < 1) { m += 12; y--; }
  while (m > 12) { m -= 12; y++; }
  const last = new Date(y, m, 0).getDate();
  return `${y}-${pad(m)}-${pad(Math.min(day, last))}`;
}

function plusDays(date: string, n: number) {
  const [y, m, d] = date.split('-').map(Number);
  const x = new Date(y, m - 1, d + n);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export function daysBetween(a: string, b: string) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export interface CardCycle {
  /** Periodo que ya cerró (estado de cuenta por pagar) */
  prevStart: string;
  lastCut: string;
  payDate: string;
  /** Periodo actual, aún abierto */
  curStart: string;
  nextCut: string;
  nextPayDate: string;
}

/** El día de corte entra en el periodo que cierra ese día. */
export function cardCycle(cutDay: number, payDay: number, on: string): CardCycle {
  const [y, m] = on.split('-').map(Number);
  const cutThisMonth = dateAt(y, m, cutDay);
  const lastCut = on > cutThisMonth ? cutThisMonth : dateAt(y, m - 1, cutDay);
  const [ly, lm] = lastCut.split('-').map(Number);
  const prevCut = dateAt(ly, lm - 1, cutDay);
  const nextCut = dateAt(ly, lm + 1, cutDay);
  const payAfter = (cut: string) => {
    const [cy, cm, cd] = cut.split('-').map(Number);
    const same = dateAt(cy, cm, payDay);
    return payDay > cd && same > cut ? same : dateAt(cy, cm + 1, payDay);
  };
  return { prevStart: plusDays(prevCut, 1), lastCut, payDate: payAfter(lastCut), curStart: plusDays(lastCut, 1), nextCut, nextPayDate: payAfter(nextCut) };
}

/** Efecto de un movimiento en la deuda de la tarjeta: cargos (+) y abonos (−), en centavos */
function charge(t: Transaction, cardId: string) {
  if (t.type === 'gasto' && t.accountId === cardId) return { c: t.amount, p: 0 };
  if (t.type === 'ingreso' && t.accountId === cardId) return { c: 0, p: t.amount };
  if (t.type === 'transferencia') {
    if (t.accountId === cardId) return { c: t.amount, p: 0 }; // retiro / avance de efectivo
    if (t.toAccountId === cardId) return { c: 0, p: t.toAmount ?? t.amount }; // pago a la tarjeta
  }
  return { c: 0, p: 0 };
}

export interface CardStatus {
  cycle: CardCycle;
  /** Lo que se debía al día de corte (estado de cuenta) */
  statement: number;
  /** Pagos y devoluciones desde el corte */
  paidSinceCut: number;
  /** Falta pagar del estado de cuenta antes de la fecha de pago */
  pending: number;
  /** Compras del periodo cerrado */
  prevCharges: number;
  /** Compras del periodo actual */
  curCharges: number;
  curTxs: Transaction[];
  prevTxs: Transaction[];
  /** Deuda total hoy */
  debt: number;
}

export function cardStatus(acc: Account, txs: Transaction[], on: string): CardStatus | null {
  if (!acc.cutDay || !acc.payDay) return null;
  const cycle = cardCycle(acc.cutDay, acc.payDay, on);
  let debtAtCut = -acc.initialBalance;
  let debt = -acc.initialBalance;
  let paidSinceCut = 0;
  let prevCharges = 0;
  let curCharges = 0;
  const curTxs: Transaction[] = [];
  const prevTxs: Transaction[] = [];
  for (const t of txs) {
    const { c, p } = charge(t, acc.id);
    if (!c && !p) continue;
    debt += c - p;
    if (t.date <= cycle.lastCut) debtAtCut += c - p;
    else paidSinceCut += p;
    if (t.date >= cycle.prevStart && t.date <= cycle.lastCut) {
      prevCharges += c;
      prevTxs.push(t);
    } else if (t.date > cycle.lastCut) {
      curCharges += c;
      curTxs.push(t);
    }
  }
  const statement = Math.max(0, debtAtCut);
  return { cycle, statement, paidSinceCut, pending: Math.max(0, statement - paidSinceCut), prevCharges, curCharges, curTxs, prevTxs, debt };
}
