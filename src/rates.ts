import { db, getSetting, save, setSetting, type Rate } from './db';
import { today } from './dates';

/**
 * Tasa de cambio automática (USD → HNL), una vez al día.
 * Usa fuentes públicas y gratuitas, sin llave. Cada día se guarda con id fijo `auto:<fecha>`
 * para que dos dispositivos no creen tasas repetidas al sincronizar.
 */
const SOURCES: { url: string; pick: (j: any) => number | undefined }[] = [
  { url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json', pick: (j) => j?.usd?.hnl },
  { url: 'https://latest.currency-api.pages.dev/v1/currencies/usd.min.json', pick: (j) => j?.usd?.hnl },
  { url: 'https://open.er-api.com/v6/latest/USD', pick: (j) => j?.rates?.HNL },
];

export const AUTO_RATE_KEY = 'autoRate';
const LAST_TRY_KEY = '_autoRateTry'; // local, no se sincroniza

export async function fetchUsdHnl(): Promise<number | null> {
  for (const s of SOURCES) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch(s.url, { signal: ctl.signal, cache: 'no-store' });
      clearTimeout(t);
      if (!r.ok) continue;
      const v = Number(s.pick(await r.json()));
      if (Number.isFinite(v) && v > 10 && v < 100) return Math.round(v * 10000) / 10000;
    } catch {
      /* probar la siguiente fuente */
    }
  }
  return null;
}

/** Devuelve 'ok' si guardó la tasa de hoy, 'ya' si no hacía falta, 'error' si no la pudo obtener */
export async function updateAutoRate(force = false): Promise<'ok' | 'ya' | 'error'> {
  const d = today();
  const id = `auto:${d}`;
  if (!force) {
    if (!(await getSetting(AUTO_RATE_KEY, true))) return 'ya';
    if (await db.rates.get(id)) return 'ya'; // ya existe (aunque la hayas quitado)
    const manualHoy = await db.rates.where('date').equals(d).filter((r) => !r.deleted).count();
    if (manualHoy) return 'ya';
    const last = await getSetting(LAST_TRY_KEY, 0);
    if (Date.now() - last < 60 * 60 * 1000) return 'ya'; // reintenta como mucho cada hora
    if (!navigator.onLine) return 'error';
  }
  await setSetting(LAST_TRY_KEY, Date.now());
  const v = await fetchUsdHnl();
  if (v === null) return 'error';
  const existing = await db.rates.get(id);
  if (existing) await save<Rate>('rates', { id, usdToHnl: v, deleted: 0 });
  else await save<Rate>('rates', { id, date: d, usdToHnl: v, source: 'auto' });
  return 'ok';
}

export function startAutoRate() {
  const run = () => void updateAutoRate().catch(() => {});
  // un poco después de abrir, para dar tiempo a la sincronización
  setTimeout(run, 4000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && run());
  window.addEventListener('online', run);
  setInterval(run, 60 * 60 * 1000);
}
