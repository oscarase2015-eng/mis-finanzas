import { useState } from 'react';
import { merchantKey, type Store } from '../data';
import { db, save, setSetting, type InboxItem, type Transaction } from '../db';
import { shortDate } from '../dates';
import { convert, fmt } from '../money';
import { AccountSelect, CategorySelect, Empty } from '../components/ui';

/** Reglas iniciales para comercios comunes en Honduras (el usuario las mejora al confirmar) */
const RULES: [RegExp, string][] = [
  [/colonia|walmart|paiz|despensa|pricesmart|supermercado|super |dinant|mas x menos|maxi bodega/, 'seed:gasto:alimentacion:supermercado'],
  [/\buno\b|puma|texaco|shell|gasolin|combustible/, 'seed:gasto:transporte:combustible'],
  [/pizza|burger|mcdonald|kfc|wendy|little caesar|campero|popeyes|subway|domino|denny|taco bell|china wok|espresso americano|starbucks|cafe/, 'seed:gasto:alimentacion:comida-rapida'],
  [/restaurante|restaurant|grill|bar |asados/, 'seed:gasto:alimentacion:restaurantes'],
  [/uber|indrive|didi|taxi/, 'seed:gasto:transporte:taxi-bus-uber'],
  [/anthropic|claude|openai|chatgpt|google \*|icloud|netflix|spotify|disney|hbo|max\.com|youtube|prime video|apple\.com|crunchyroll|paramount/, 'seed:gasto:servicios:cable-y-streaming'],
  [/enee|energia/, 'seed:gasto:servicios:enee-luz'],
  [/tigo|claro/, 'seed:gasto:servicios:celular'],
  [/farmacia|kielsa|siman farma|punto farma|farmacenter/, 'seed:gasto:salud:medicinas'],
  [/hospital|clinica|laboratorio|medic/, 'seed:gasto:salud:consultas-medicas'],
  [/cinemark|cinepolis|cine /, 'seed:gasto:entretenimiento:salidas'],
  [/amazon|aliexpress|shein|temu|ebay/, 'seed:gasto:personal:ropa-y-calzado'],
  [/gimnasio|gym|smart fit/, 'seed:gasto:personal:gimnasio'],
];

export function guessCategory(s: Store, merchant: string): string {
  const k = merchantKey(merchant);
  if (s.merchantCats[k] && s.catById.has(s.merchantCats[k])) return s.merchantCats[k];
  for (const [re, id] of RULES) if (re.test(k + ' ') && s.catById.has(id)) return id;
  return '';
}

export function guessAccount(s: Store, item: InboxItem): string {
  const active = s.accounts.filter((a) => !a.archived);
  if (item.cardLast4) {
    const matches = active.filter((a) => a.cardLast4 && a.cardLast4 === item.cardLast4);
    const byCard = matches.find((a) => a.currency === item.currency) ?? matches[0];
    if (byCard) return byCard.id;
  }
  const sameCur = active.filter((a) => a.currency === item.currency);
  return sameCur.length === 1 ? sameCur[0].id : '';
}

/** Registra un elemento de la bandeja como movimiento y aprende la categoría del comercio */
async function confirmItem(s: Store, item: InboxItem, accountId: string, categoryId: string) {
  const acc = s.accById.get(accountId);
  if (!acc) return;
  let amount = item.amount;
  let note = item.merchant;
  if (acc.currency !== item.currency) {
    const v = convert(item.amount, item.currency, acc.currency, s.rate);
    if (v === null) throw new Error('Falta la tasa de cambio para convertir este monto.');
    amount = v;
    note = `${item.merchant} (${fmt(item.amount, item.currency)})`;
  }
  const txId = await save<Transaction>('transactions', {
    type: item.type,
    amount,
    accountId,
    categoryId: categoryId || null,
    date: item.date,
    note,
    tags: ['gmail'],
    toAccountId: null,
    toAmount: null,
  });
  await save<InboxItem>('inbox', { id: item.id, status: 'registrado', txId });
  if (categoryId && item.merchant) {
    const k = merchantKey(item.merchant);
    if (k && s.merchantCats[k] !== categoryId) await setSetting('merchantCats', { ...s.merchantCats, [k]: categoryId });
  }
}

export default function Inbox({ s }: { s: Store }) {
  const [choice, setChoice] = useState<Record<string, { acc: string; cat: string }>>({});
  const [err, setErr] = useState('');
  const items = s.inbox;
  const get = (i: InboxItem) => choice[i.id] ?? { acc: guessAccount(s, i), cat: guessCategory(s, i.merchant) };
  const set = (i: InboxItem, patch: Partial<{ acc: string; cat: string }>) => setChoice((c) => ({ ...c, [i.id]: { ...get(i), ...patch } }));
  const ready = items.filter((i) => get(i).acc && get(i).cat);

  const confirm1 = async (i: InboxItem) => {
    setErr('');
    try {
      const c = get(i);
      await confirmItem(s, i, c.acc, c.cat);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const confirmAll = async () => {
    setErr('');
    try {
      // Aprende en orden para que un mismo comercio no se guarde dos veces distinto
      for (const i of ready) await confirmItem({ ...s, merchantCats: (await db.settings.get('merchantCats'))?.value as Record<string, string> ?? {} }, i, get(i).acc, get(i).cat);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Por revisar</h1>
        {ready.length > 1 && (
          <button className="btn primary" onClick={confirmAll}>
            Confirmar {ready.length} listos
          </button>
        )}
      </div>
      <p className="muted small">Gastos detectados en las notificaciones de tu banco. Revisa la cuenta y la categoría y confírmalos. La app recuerda la categoría de cada comercio para la próxima vez.</p>
      {err && <p className="error">{err}</p>}
      {items.length === 0 ? (
        <Empty title="Todo al día">
          <p>Cuando llegue una notificación de compra a tu Gmail, aparecerá aquí lista para confirmar.</p>
        </Empty>
      ) : (
        <ul className="inbox-list">
          {items.map((i) => {
            const c = get(i);
            const acc = c.acc ? s.accById.get(c.acc) : undefined;
            return (
              <li key={i.id} className="card inbox-item">
                <div className="row">
                  <span className="grow">
                    <strong className="block">{i.merchant || 'Comercio desconocido'}</strong>
                    <span className="muted small">
                      {shortDate(i.date)}
                      {i.cardLast4 ? ` · tarjeta •••• ${i.cardLast4}` : ''}
                    </span>
                  </span>
                  <span className={`tx-amount ${i.type === 'ingreso' ? 'pos' : 'neg'}`}>{fmt(i.type === 'ingreso' ? i.amount : -i.amount, i.currency)}</span>
                </div>
                <div className="inbox-fields">
                  <AccountSelect s={s} value={c.acc} onChange={(v) => set(i, { acc: v })} allowEmpty="Elige la cuenta…" />
                  <CategorySelect s={s} kind={i.type} value={c.cat} onChange={(v) => set(i, { cat: v })} allowEmpty="Elige la categoría…" />
                </div>
                {acc && acc.currency !== i.currency && <p className="muted small">Se convertirá a {acc.currency === 'HNL' ? 'lempiras' : 'dólares'} con la tasa de referencia.</p>}
                {i.raw && (
                  <details>
                    <summary className="muted small">Ver correo</summary>
                    <p className="small raw">{i.raw}</p>
                  </details>
                )}
                <div className="row">
                  <button className="btn ghost danger" onClick={() => save<InboxItem>('inbox', { id: i.id, status: 'descartado' })}>
                    Descartar
                  </button>
                  <span className="spacer" />
                  <button className="btn primary" disabled={!c.acc} onClick={() => confirm1(i)}>
                    Confirmar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
