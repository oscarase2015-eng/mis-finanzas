import { useState } from 'react';
import type { Store } from '../data';
import type { Nav } from '../App';
import { save, type Account, type Transaction } from '../db';
import { cardStatus, daysBetween, type CardStatus } from '../cards';
import { shortDate, today } from '../dates';
import { centsToInput, fmt, parseAmount } from '../money';
import { AmountInput, Empty, Field, Modal, Progress, Segmented } from '../components/ui';

export function cardAlerts(s: Store) {
  const d = today();
  const out: { acc: Account; st: CardStatus; days: number }[] = [];
  for (const acc of s.accounts) {
    if (acc.type !== 'tarjeta' || acc.archived) continue;
    const st = cardStatus(acc, s.txs, d);
    if (!st || st.pending <= 0) continue;
    const days = daysBetween(d, st.cycle.payDate);
    if (days <= 7) out.push({ acc, st, days });
  }
  return out;
}

const dueText = (days: number) => (days > 1 ? `faltan ${days} días` : days === 1 ? 'vence mañana' : days === 0 ? 'vence hoy' : `vencido hace ${-days} ${days === -1 ? 'día' : 'días'}`);
const short = (d: string) => shortDate(d).replace(/ \d{4}$/, '');
const isCharge = (t: Transaction, id: string) => (t.type === 'gasto' || t.type === 'transferencia') && t.accountId === id;

type Row = { a: Account; st: CardStatus | null };

/** Tarjetas agrupadas por sus 4 dígitos: una tarjeta bimoneda (L y US$) es un solo plástico */
function cardGroups(s: Store): Row[][] {
  const d = today();
  const groups = new Map<string, Account[]>();
  for (const a of s.accounts.filter((x) => x.type === 'tarjeta' && !x.archived)) {
    const k = a.cardLast4 || a.id;
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }
  return [...groups.values()].map((accs) =>
    accs.sort((x, y) => (x.currency === y.currency ? 0 : x.currency === 'HNL' ? -1 : 1)).map((a) => ({ a, st: cardStatus(a, s.txs, d) })),
  );
}

export default function Cards({ s, nav }: { s: Store; nav: Nav }) {
  const groups = cardGroups(s);
  const [sel, setSel] = useState(0);
  const [settings, setSettings] = useState<Account | null>(null);
  const [period, setPeriod] = useState<'actual' | 'anterior'>('actual');
  const g = groups[Math.min(sel, groups.length - 1)];

  if (!g) {
    return (
      <div className="page">
        <h1>Mis tarjetas</h1>
        <Empty title="No tienes tarjetas de crédito">
          <p>Crea una cuenta de tipo «Tarjeta de crédito» en Cuentas, con su día de corte y de pago.</p>
          <button className="btn primary" onClick={() => nav.go('cuentas')}>
            Ir a Cuentas
          </button>
        </Empty>
      </div>
    );
  }

  const main = g.find((r) => r.st && r.st.pending > 0) ?? g[0];
  const payFrom = (a: Account) => s.accounts.find((x) => !x.archived && x.type !== 'tarjeta' && x.currency === a.currency);
  const pay = (r: Row) =>
    nav.newTx({ type: 'transferencia', toAccountId: r.a.id, accountId: payFrom(r.a)?.id, amount: r.st && r.st.pending > 0 && payFrom(r.a) ? r.st.pending : undefined, note: `Pago tarjeta ${r.a.name}` });

  return (
    <div className="page">
      <div className="page-head">
        <h1>Mis tarjetas</h1>
        <button className="icon-btn" aria-label="Agregar tarjeta" title="Agregar tarjeta" onClick={() => nav.go('cuentas')}>
          +
        </button>
      </div>

      {/* 1. Tarjetas (se deslizan) */}
      <div className="cc-carousel" role="tablist">
        {groups.map((rows, i) => (
          <button key={rows[0].a.id} role="tab" aria-selected={i === sel} className={`cc-face ${i === sel ? 'on' : ''}`} onClick={() => setSel(i)}>
            <span className="cc-face-top">
              <span>{rows.length > 1 ? rows[0].a.name.replace(/\s*(L|\$|US\$|HNL|USD|lempiras|dólares)$/i, '') : rows[0].a.name}</span>
              <span className="cc-face-chip" />
            </span>
            {rows.map(({ a, st }) => {
              const debt = st?.debt ?? -a.initialBalance;
              return (
                <span key={a.id} className="cc-face-line">
                  <span className="cc-face-label">{a.creditLimit ? 'Disponible' : 'Deuda'}</span>
                  <span className="cc-face-amount">{fmt(a.creditLimit ? a.creditLimit - debt : Math.max(0, debt), a.currency)}</span>
                </span>
              );
            })}
            <span className="cc-face-num">•••• •••• •••• {rows[0].a.cardLast4 ?? '····'}</span>
            <span className="cc-face-foot">
              <span>
                <small>Corte</small>
                {rows[0].a.cutDay ? `día ${rows[0].a.cutDay}` : '—'}
              </span>
              <span>
                <small>Pago</small>
                {rows[0].a.payDay ? `día ${rows[0].a.payDay}` : '—'}
              </span>
            </span>
          </button>
        ))}
      </div>
      {groups.length > 1 && (
        <div className="cc-dots" aria-hidden="true">
          {groups.map((_, i) => (
            <span key={i} className={i === sel ? 'on' : ''} />
          ))}
        </div>
      )}

      {/* 2. Acciones rápidas */}
      <div className="cc-actions">
        <button className="card" onClick={() => pay(main)}>
          <span className="cc-act-icon">↓</span>Pagar
        </button>
        <button className="card" onClick={() => nav.newTx({ type: 'gasto', accountId: g[0].a.id })}>
          <span className="cc-act-icon">＋</span>Gasto
        </button>
        <button className="card" onClick={() => nav.go('movimientos', { account: g[0].a.id })}>
          <span className="cc-act-icon">≡</span>Movimientos
        </button>
        <button className="card" onClick={() => setSettings(g[0].a)}>
          <span className="cc-act-icon">⚙</span>Ajustes
        </button>
      </div>

      {g.every((r) => !r.st) ? (
        <section className="card">
          <p>Para ver lo que debes pagar y lo gastado por periodo, indica el día de corte y el día de pago.</p>
          <button className="btn primary" onClick={() => setSettings(g[0].a)}>
            Configurar corte y pago
          </button>
        </section>
      ) : (
        <>
          {/* 3. Por pagar y gasto del periodo */}
          {g.map((r) =>
            r.st ? <PeriodSummary key={r.a.id} r={{ a: r.a, st: r.st }} showCur={g.length > 1} onPay={() => pay(r)} /> : null,
          )}

          {/* 4. Movimientos */}
          <section>
            <div className="page-head">
              <h3 style={{ margin: 0 }}>Movimientos</h3>
              <button className="link" onClick={() => nav.go('movimientos', { account: g[0].a.id })}>
                Ver todos
              </button>
            </div>
            <div style={{ margin: '10px 0' }}>
              <Segmented
                value={period}
                onChange={setPeriod}
                options={[
                  { value: 'actual', label: 'Actual' },
                  { value: 'anterior', label: 'Anterior' },
                ]}
              />
            </div>
            <TxList s={s} rows={g} period={period} nav={nav} />
          </section>
        </>
      )}

      {settings && <CardSettings a={settings} siblings={g.map((r) => r.a)} onClose={() => setSettings(null)} />}
    </div>
  );
}

function PeriodSummary({ r, showCur, onPay }: { r: { a: Account; st: CardStatus }; showCur: boolean; onPay: () => void }) {
  const { a, st } = r;
  const days = daysBetween(today(), st.cycle.payDate);
  const paid = st.pending <= 0;
  const late = !paid && days < 0;
  const ratio = a.creditLimit ? st.curCharges / a.creditLimit : 0;
  return (
    <section className="card cc-summary">
      {showCur && <p className="cc-cur">{a.currency === 'USD' ? 'Dólares' : 'Lempiras'}</p>}
      <div className={`cc-box ${late ? 'late' : paid ? 'ok' : 'due'}`}>
        <div className="row">
          <span className="grow">
            <span className="muted small block">Por pagar · corte del {short(st.cycle.lastCut)}</span>
            <strong className="cc-amount">{paid ? 'Pagado' : fmt(st.pending, a.currency)}</strong>
          </span>
          {!paid && (
            <button className="btn primary" onClick={onPay}>
              Pagar
            </button>
          )}
        </div>
        <span className="small">
          {paid ? (st.statement > 0 ? `Pagaste ${fmt(st.statement, a.currency)} del estado de cuenta` : 'No había saldo al corte') : `Fecha límite ${short(st.cycle.payDate)} · ${dueText(days)}`}
        </span>
        {!paid && st.paidSinceCut > 0 && (
          <span className="muted small">
            Saldo al corte {fmt(st.statement, a.currency)} · ya pagaste {fmt(st.paidSinceCut, a.currency)}
          </span>
        )}
      </div>
      <div className="cc-spent">
        <span className="muted small block">Gastado este periodo · {short(st.cycle.curStart)} al {short(st.cycle.nextCut)}</span>
        <span className="cc-spent-v">
          {fmt(st.curCharges, a.currency)}
          {a.creditLimit ? <span className="muted small"> / {fmt(a.creditLimit, a.currency)}</span> : null}
        </span>
        <span className="muted small block">Se paga el {short(st.cycle.nextPayDate)}</span>
        {a.creditLimit ? (
          <>
            <Progress ratio={ratio} />
            <div className="row small muted">
              <span className="grow">{Math.round(ratio * 100)}% de tu límite</span>
              <span>Deuda total {fmt(Math.max(0, st.debt), a.currency)}</span>
            </div>
          </>
        ) : (
          <p className="small muted" style={{ marginTop: 6 }}>
            Periodo anterior: {fmt(st.prevCharges, a.currency)} · deuda total {fmt(Math.max(0, st.debt), a.currency)}
          </p>
        )}
      </div>
    </section>
  );
}

function TxList({ s, rows, period, nav }: { s: Store; rows: Row[]; period: 'actual' | 'anterior'; nav: Nav }) {
  const items = rows
    .flatMap(({ a, st }) => (st ? (period === 'actual' ? st.curTxs : st.prevTxs).map((t) => ({ t, a })) : []))
    .sort((x, y) => (x.t.date === y.t.date ? y.t.createdAt - x.t.createdAt : x.t.date < y.t.date ? 1 : -1));
  if (!items.length) return <p className="muted small">Sin movimientos en este periodo.</p>;
  return (
    <ul className="list card">
      {items.map(({ t, a }) => {
        const out = isCharge(t, a.id);
        const amt = out ? t.amount : t.type === 'transferencia' ? t.toAmount ?? t.amount : t.amount;
        const cat = t.categoryId ? s.catById.get(t.categoryId) : undefined;
        const label = t.note || cat?.name || (out ? 'Cargo' : 'Pago');
        return (
          <li key={t.id} className="row clickable" onClick={() => nav.editTx(t)}>
            <span className="tx-icon" style={{ background: 'var(--hover)' }}>
              {cat?.icon ?? (out ? '💳' : '↓')}
            </span>
            <span className="grow tx-text">
              <span className="tx-title">{label}</span>
              <span className="muted small">{short(t.date)}</span>
            </span>
            <span className="tx-text" style={{ alignItems: 'flex-end' }}>
              <span className={`tx-amount ${out ? 'neg' : 'pos'}`}>{fmt(out ? -amt : amt, a.currency)}</span>
              <span className="muted small">{out ? cat?.name ?? 'Compra' : 'Pago'}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function CardSettings({ a, siblings, onClose }: { a: Account; siblings: Account[]; onClose: () => void }) {
  const [cut, setCut] = useState(a.cutDay ? String(a.cutDay) : '');
  const [pay, setPay] = useState(a.payDay ? String(a.payDay) : '');
  const [limits, setLimits] = useState<Record<string, string>>(() => Object.fromEntries(siblings.map((x) => [x.id, x.creditLimit ? centsToInput(x.creditLimit) : ''])));
  const [err, setErr] = useState('');
  const ok = (v: string) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 31;
  const submit = async () => {
    if (!ok(cut) || !ok(pay)) return setErr('Escribe días del 1 al 31.');
    for (const x of siblings) {
      const l = limits[x.id]?.trim() ? parseAmount(limits[x.id]) : null;
      await save<Account>('accounts', { id: x.id, cutDay: Number(cut), payDay: Number(pay), creditLimit: l ?? undefined });
    }
    onClose();
  };
  return (
    <Modal
      title={`Ajustes · ${a.cardLast4 ? '•••• ' + a.cardLast4 : a.name}`}
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" onClick={submit}>
            Guardar
          </button>
        </>
      }
    >
      <div className="form">
        <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Field label="Día de corte">
            <input inputMode="numeric" maxLength={2} value={cut} onChange={(e) => setCut(e.target.value.replace(/\D/g, ''))} placeholder="3" />
          </Field>
          <Field label="Día de pago">
            <input inputMode="numeric" maxLength={2} value={pay} onChange={(e) => setPay(e.target.value.replace(/\D/g, ''))} placeholder="24" />
          </Field>
        </div>
        {siblings.map((x) => (
          <Field key={x.id} label={`Límite de crédito ${siblings.length > 1 ? (x.currency === 'USD' ? 'en dólares' : 'en lempiras') : ''}`}>
            <AmountInput value={limits[x.id] ?? ''} onChange={(v) => setLimits({ ...limits, [x.id]: v })} currency={x.currency} />
          </Field>
        ))}
        {err && <p className="error">{err}</p>}
      </div>
    </Modal>
  );
}
