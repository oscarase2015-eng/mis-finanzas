import { useEffect, useMemo, useState } from 'react';
import type { Nav } from '../App';
import { catFamily, catLabel, type Store } from '../data';
import type { TxType } from '../db';
import { dayHeader, monthOf, today, type Period } from '../dates';
import { convert, fmt } from '../money';
import { AccountSelect, CategorySelect, Empty, PeriodNav } from '../components/ui';
import TxRow from '../components/TxRow';

export default function Transactions({ s, nav, accountFilter }: { s: Store; nav: Nav; accountFilter?: string }) {
  const [period, setPeriod] = useState<Period>(() => monthOf(today()));
  const [allTime, setAllTime] = useState(false);
  const [q, setQ] = useState('');
  const [account, setAccount] = useState(accountFilter ?? '');
  const [type, setType] = useState<'' | TxType>('');
  const [cat, setCat] = useState('');
  useEffect(() => setAccount(accountFilter ?? ''), [accountFilter]);

  const list = useMemo(() => {
    const fam = cat ? catFamily(s, cat) : null;
    const text = q.trim().toLowerCase();
    return s.txs.filter((t) => {
      if (!allTime && (t.date < period.start || t.date > period.end)) return false;
      if (account && t.accountId !== account && t.toAccountId !== account) return false;
      if (type && t.type !== type) return false;
      if (fam && (!t.categoryId || !fam.has(t.categoryId))) return false;
      if (text) {
        const hay = `${t.note} ${catLabel(s, t.categoryId)} ${t.tags.join(' ')} ${s.accById.get(t.accountId)?.name ?? ''} ${(t.amount / 100).toFixed(2)}`.toLowerCase();
        if (!hay.includes(text)) return false;
      }
      return true;
    });
  }, [s, period, allTime, q, account, type, cat]);

  let inc = 0;
  let exp = 0;
  for (const t of list) {
    if (t.type === 'transferencia') continue;
    const a = s.accById.get(t.accountId);
    const v = a ? convert(t.amount, a.currency, s.main, s.rate) : null;
    if (v === null) continue;
    if (t.type === 'ingreso') inc += v;
    else exp += v;
  }

  const groups: [string, typeof list][] = [];
  for (const t of list) {
    const g = groups.at(-1);
    if (g && g[0] === t.date) g[1].push(t);
    else groups.push([t.date, [t]]);
  }

  const exportCsv = () => {
    const head = ['Fecha', 'Tipo', 'Cuenta', 'Moneda', 'Monto', 'Categoría', 'Cuenta destino', 'Monto destino', 'Nota', 'Etiquetas'];
    const rows = list.map((t) => {
      const a = s.accById.get(t.accountId);
      const to = t.toAccountId ? s.accById.get(t.toAccountId) : undefined;
      return [t.date, t.type, a?.name ?? '', a?.currency ?? '', (t.amount / 100).toFixed(2), t.type === 'transferencia' ? '' : catLabel(s, t.categoryId), to?.name ?? '', t.toAmount ? (t.toAmount / 100).toFixed(2) : '', t.note, t.tags.join(', ')];
    });
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const el = document.createElement('a');
    el.href = url;
    el.download = `movimientos-${allTime ? 'todos' : period.start}.csv`;
    el.click();
    URL.revokeObjectURL(url);
  };

  const acc = account ? s.accById.get(account) : undefined;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Movimientos{acc ? ` · ${acc.name}` : ''}</h1>
        <button className="btn" onClick={exportCsv} disabled={!list.length}>
          Exportar CSV
        </button>
      </div>

      {!allTime && <PeriodNav period={period} onChange={setPeriod} />}

      <div className="filters">
        <input type="search" placeholder="Buscar nota, categoría, monto…" value={q} onChange={(e) => setQ(e.target.value)} />
        <AccountSelect s={s} value={account} onChange={(v) => (v ? setAccount(v) : (setAccount(''), accountFilter && nav.go('movimientos')))} allowEmpty="Todas las cuentas" />
        <select value={type} onChange={(e) => setType(e.target.value as '' | TxType)}>
          <option value="">Todos los tipos</option>
          <option value="gasto">Gastos</option>
          <option value="ingreso">Ingresos</option>
          <option value="transferencia">Transferencias</option>
        </select>
        <CategorySelect s={s} kind={type === 'ingreso' ? 'ingreso' : 'gasto'} value={cat} onChange={setCat} allowEmpty="Todas las categorías" />
        <label className="check">
          <input type="checkbox" checked={allTime} onChange={(e) => setAllTime(e.target.checked)} /> Todas las fechas
        </label>
      </div>

      <div className="summary-line">
        <span>{list.length} movimientos</span>
        <span className="pos">{fmt(inc, s.main)}</span>
        <span className="neg">{fmt(-exp, s.main)}</span>
        {acc && <span>Saldo: {fmt(s.balances.get(acc.id) ?? 0, acc.currency)}</span>}
      </div>

      {groups.length === 0 ? (
        <Empty title="No hay movimientos con estos filtros">
          <button className="btn primary" onClick={() => nav.newTx(account ? { accountId: account } : undefined)}>
            Anotar un movimiento
          </button>
        </Empty>
      ) : (
        groups.map(([date, txs]) => (
          <section key={date} className="day">
            <h4 className="day-head">{dayHeader(date)}</h4>
            <ul className="list card">
              {txs.map((t) => (
                <TxRow key={t.id} s={s} tx={t} onClick={() => nav.editTx(t)} perspective={account || undefined} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
