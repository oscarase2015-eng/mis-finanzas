import type { Currency } from './db';

export const SYMBOL: Record<Currency, string> = { HNL: 'L', USD: 'US$' };
export const CURRENCY_NAME: Record<Currency, string> = { HNL: 'Lempiras', USD: 'Dólares' };

const nf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Formatea centavos: 123456 → "L 1,234.56" */
export function fmt(cents: number, cur: Currency, opts: { sign?: boolean } = {}) {
  const neg = cents < 0;
  const s = `${SYMBOL[cur]} ${nf.format(Math.abs(cents) / 100)}`;
  if (neg) return `−${s}`;
  return opts.sign && cents > 0 ? `+${s}` : s;
}

/** Formato corto para ejes de gráficas */
export function fmtShort(cents: number, cur: Currency) {
  const v = cents / 100;
  const a = Math.abs(v);
  const n = a >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : a >= 1e3 ? `${(v / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k` : v.toFixed(0);
  return `${SYMBOL[cur]} ${n}`;
}

/** "1,234.5" → 123450. Devuelve null si no es válido. */
export function parseAmount(text: string): number | null {
  const clean = text.replace(/[^\d.,-]/g, '').replace(/,/g, '');
  if (!clean) return null;
  const v = Number(clean);
  if (!Number.isFinite(v)) return null;
  return Math.round(v * 100);
}

export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2);
}

/**
 * Convierte centavos entre monedas con la tasa (lempiras por dólar).
 * Devuelve null si hace falta una tasa y no existe.
 */
export function convert(cents: number, from: Currency, to: Currency, usdToHnl: number | null): number | null {
  if (from === to) return cents;
  if (!usdToHnl) return null;
  return from === 'USD' ? Math.round(cents * usdToHnl) : Math.round(cents / usdToHnl);
}
