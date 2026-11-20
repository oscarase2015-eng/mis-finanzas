import { catLabel, rootCat, type Store } from '../data';
import type { Transaction } from '../db';
import { shortDate } from '../dates';
import { fmt } from '../money';
import { Glyph } from './Icons';

export default function TxRow({ s, tx, onClick, showDate, perspective }: { s: Store; tx: Transaction; onClick: () => void; showDate?: boolean; perspective?: string }) {
  const acc = s.accById.get(tx.accountId);
  const to = tx.toAccountId ? s.accById.get(tx.toAccountId) : undefined;
  const root = rootCat(s, tx.categoryId);
  const cur = acc?.currency ?? 'HNL';
  let title: string;
  let amountEl: React.ReactNode;
  if (tx.type === 'transferencia') {
    title = `${acc?.name ?? '?'} → ${to?.name ?? '?'}`;
    const incoming = perspective && perspective === tx.toAccountId;
    const inAmt = tx.toAmount ?? tx.amount;
    amountEl = incoming ? (
      <span className="pos">{fmt(inAmt, to?.currency ?? cur, { sign: true })}</span>
    ) : (
      <span className="transfer">
        {fmt(tx.amount, cur)}
        {to && to.currency !== cur && <span className="muted small"> → {fmt(inAmt, to.currency)}</span>}
      </span>
    );
  } else {
    title = tx.note || catLabel(s, tx.categoryId);
    amountEl = tx.type === 'ingreso' ? <span className="pos">{fmt(tx.amount, cur, { sign: true })}</span> : <span className="neg">{fmt(-tx.amount, cur)}</span>;
  }
  const sub = [tx.type === 'transferencia' ? 'Transferencia' : tx.note ? catLabel(s, tx.categoryId) : null, tx.type !== 'transferencia' ? acc?.name : null, showDate ? shortDate(tx.date) : null, ...tx.tags.map((t) => `#${t}`)]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className="row tx clickable" onClick={onClick}>
      <span className="tx-icon" style={{ background: tx.type === 'transferencia' ? 'var(--hover)' : `${root?.color ?? '#94a3b8'}22` }}>
        <Glyph name={tx.type === 'transferencia' ? 'swap' : root?.icon} />
      </span>
      <span className="grow tx-text">
        <span className="tx-title">{title}</span>
        <span className="muted small">{sub}</span>
      </span>
      <span className="tx-amount">{amountEl}</span>
    </li>
  );
}
