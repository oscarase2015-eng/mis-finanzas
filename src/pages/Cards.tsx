import { useState } from 'react';
import type { Store } from '../data';
import type { Nav } from '../App';
import { save, type Account, type Transaction } from '../db';
import { cardStatus, daysBetween, type CardStatus } from '../cards';
import { shortDate, today } from '../dates';
import { fmt } from '../money';
import { Empty, Progress } from '../components/ui';

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
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const short = (d: string) => shortDate(d).replace(/ \d{4}$/, '');

export default function Cards({ s, nav }: { s: Store; nav: Nav }) {
  const cards = s.accounts.filter((a) => a.type === 'tarjeta' && !a.archived);
  // Agrupa por los últimos 4 dígitos: una tarjeta bimoneda (L y US$) se ve junta
  const groups = new Map<string, Account[]>();
  for (const a of cards) {
    const k = a.cardLast4 || a.id;
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }
  return (
    <div className="page">
      <h1>Tarjetas de crédito</h1>
      <p className="muted small">Lo que debes pagar del último corte y lo que llevas gastado en el periodo actual. Si tu tarjeta tiene saldo en lempiras y en dólares, crea una cuenta por moneda con los mismos 4 dígitos y se mostrarán juntas.</p>
      {cards.length === 0 ? (
        <Empty title="No tienes tarjetas de crédito">
          <p>Crea una cuenta de tipo «Tarjeta de crédito» en Cuentas, con su día de corte y de pago.</p>
          <button className="btn primary" onClick={() => nav.go('cuentas')}>
            Ir a Cuentas
          </button>
        </Empty>
      ) : (
        [...groups.values()].map((accs) => <CardGroup key={accs[0].id} s={s} nav={nav} accs={accs} />)
      )}
    </div>
  );
}

function CardGroup({ s, nav, accs }: { s: Store; nav: Nav; accs: Account[] }) {
  const d = today();
  accs = [...accs].sort((x, y) => (x.currency === y.currency ? 0 : x.currency === 'HNL' ? -1 : 1));
  const rows = accs.map((a) => ({ a, st: cardStatus(a, s.txs, d) }));
  const first = rows.find((r) => r.st) ?? rows[0];
  const title = accs.length > 1 ? accs.map((a) => a.name).join(' · ') : accs[0].name;
  return (
    <section className="card card-cc" style={{ borderTop: `4px solid ${accs[0].color}` }}>
      <div className="row">
        <h3 className="grow">
          💳 {title} {accs[0].cardLast4 && <span className="muted small">•••• {accs[0].cardLast4}</span>}
        </h3>
        {first.st && <span className="badge">Corte día {first.a.cutDay} · Pago día {first.a.payDay}</span>}
      </div>
      {rows.map(({ a, st }) =>
        st ? <CardBody key={a.id} s={s} nav={nav} a={a} st={st} showCur={accs.length > 1} /> : <DaysSetup key={a.id} a={a} />,
      )}
    </section>
  );
}

function CardBody({ s, nav, a, st, showCur }: { s: Store; nav: Nav; a: Account; st: CardStatus; showCur: boolean }) {
  const d = today();
  const days = daysBetween(d, st.cycle.payDate);
  const paid = st.pending <= 0;
  const late = !paid && days < 0;
  const payFrom = s.accounts.find((x) => !x.archived && x.type !== 'tarjeta' && x.currency === a.currency);
  return (
    <div className="cc-body">
      {showCur && <p className="cc-cur">{a.currency === 'USD' ? 'Dólares' : 'Lempiras'}</p>}
      <div className="cc-grid">
        <div className={`cc-box ${late ? 'late' : paid ? 'ok' : 'due'}`}>
          <span className="muted small">Por pagar · corte del {short(st.cycle.lastCut)}</span>
          <strong className="cc-amount">{paid ? '✓ Pagado' : fmt(st.pending, a.currency)}</strong>
          <span className="small">
            {paid ? (st.statement > 0 ? `Pagaste ${fmt(st.statement, a.currency)} del estado de cuenta` : 'No había saldo al corte') : `Fecha límite ${short(st.cycle.payDate)} · ${dueText(days)}`}
          </span>
          {!paid && st.paidSinceCut > 0 && (
            <span className="muted small">
              Saldo al corte {fmt(st.statement, a.currency)} · ya pagaste {fmt(st.paidSinceCut, a.currency)}
            </span>
          )}
        </div>
        <div className="cc-box">
          <span className="muted small">
            Periodo actual · {short(st.cycle.curStart)} al {short(st.cycle.nextCut)}
          </span>
          <strong className="cc-amount">{fmt(st.curCharges, a.currency)}</strong>
          <span className="small">
            {plural(st.curTxs.filter((t) => charges(t, a.id)).length, 'compra', 'compras')} · se paga el {short(st.cycle.nextPayDate)}
          </span>
        </div>
      </div>
      <dl className="facts">
        <div>
          <dt>Gastado periodo anterior</dt>
          <dd>{fmt(st.prevCharges, a.currency)}</dd>
        </div>
        <div>
          <dt>Deuda total hoy</dt>
          <dd>{fmt(Math.max(0, st.debt), a.currency)}</dd>
        </div>
        {a.creditLimit ? (
          <div>
            <dt>Disponible</dt>
            <dd>{fmt(a.creditLimit - st.debt, a.currency)}</dd>
          </div>
        ) : null}
      </dl>
      {a.creditLimit ? <Progress ratio={st.debt / a.creditLimit} good={false} /> : null}
      <TxList s={s} title="Compras del periodo actual" txs={st.curTxs} cardId={a.id} cur={a.currency} />
      <TxList s={s} title={`Periodo anterior (${short(st.cycle.prevStart)} al ${short(st.cycle.lastCut)})`} txs={st.prevTxs} cardId={a.id} cur={a.currency} />
      <div className="row">
        <button className="btn ghost" onClick={() => nav.go('movimientos', { account: a.id })}>
          Ver movimientos
        </button>
        <span className="spacer" />
        <button
          className="btn primary"
          onClick={() =>
            nav.newTx({ type: 'transferencia', toAccountId: a.id, accountId: payFrom?.id, amount: !paid && payFrom ? st.pending : undefined, note: `Pago tarjeta ${a.name}` })
          }
        >
          Registrar pago
        </button>
      </div>
    </div>
  );
}

const charges = (t: Transaction, id: string) => (t.type === 'gasto' && t.accountId === id) || (t.type === 'transferencia' && t.accountId === id);

function TxList({ s, title, txs, cardId, cur }: { s: Store; title: string; txs: Transaction[]; cardId: string; cur: Account['currency'] }) {
  if (!txs.length) return null;
  return (
    <details className="cc-list">
      <summary className="small">
        {title} ({txs.length})
      </summary>
      <ul className="list">
        {txs.map((t) => {
          const out = charges(t, cardId);
          const amt = out ? t.amount : t.type === 'transferencia' ? t.toAmount ?? t.amount : t.amount;
          const label = t.note || (t.categoryId && s.catById.get(t.categoryId)?.name) || (out ? 'Cargo' : 'Pago');
          return (
            <li key={t.id} className="row small">
              <span className="muted">{short(t.date)}</span>
              <span className="grow">{label}</span>
              <span className={out ? 'neg' : 'pos'}>{fmt(out ? -amt : amt, cur)}</span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function DaysSetup({ a }: { a: Account }) {
  const [cut, setCut] = useState('');
  const [pay, setPay] = useState('');
  const [err, setErr] = useState('');
  const ok = (v: string) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 31;
  const submit = async () => {
    if (!ok(cut) || !ok(pay)) return setErr('Escribe días del 1 al 31.');
    await save<Account>('accounts', { id: a.id, cutDay: Number(cut), payDay: Number(pay) });
  };
  return (
    <div className="cc-body">
      <p className="small">
        <strong>{a.name}</strong>: ¿qué día es el corte y qué día el pago?
      </p>
      <div className="inline-form">
        <input inputMode="numeric" maxLength={2} placeholder="Día de corte, ej. 3" value={cut} onChange={(e) => setCut(e.target.value.replace(/\D/g, ''))} />
        <input inputMode="numeric" maxLength={2} placeholder="Día de pago, ej. 24" value={pay} onChange={(e) => setPay(e.target.value.replace(/\D/g, ''))} />
        <button className="btn primary" onClick={submit}>
          Guardar
        </button>
      </div>
      {err && <p className="error">{err}</p>}
    </div>
  );
}
