import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Nav } from '../App';
import { catBudgetSpent } from './Budgets';
import { debtStatus, debtTotals, expenseByRoot, goalStatus, netWorth, totals, type Store } from '../data';
import { addMonths, monthLabel, monthOf, quincenaOf, shortDate, today, type Period } from '../dates';
import { cardAlerts } from './Cards';

const todayLabel = () => new Date().toLocaleDateString('es-HN', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
import { fmt, fmtShort } from '../money';
import { Empty, PeriodNav, Progress, RateWarning } from '../components/ui';
import TxRow from '../components/TxRow';

export default function Dashboard({ s, nav }: { s: Store; nav: Nav }) {
  const [period, setPeriod] = useState<Period>(() => quincenaOf(today()));
  const nw = netWorth(s);
  const t = totals(s, period.start, period.end);
  const byCat = [...expenseByRoot(s, period.start, period.end).entries()]
    .map(([id, v]) => ({ id, name: s.catById.get(id)?.name ?? 'Sin categoría', color: s.catById.get(id)?.color ?? '#94a3b8', value: v / 100 }))
    .sort((a, b) => b.value - a.value);

  const thisMonth = today().slice(0, 7);
  const months = Array.from({ length: 6 }, (_, i) => addMonths(thisMonth, i - 5)).map((m) => {
    const p = monthOf(`${m}-01`);
    const r = totals(s, p.start, p.end);
    return { mes: monthLabel(m, true), Ingresos: r.income / 100, Gastos: r.expense / 100 };
  });

  const budgetRows = s.budgets
    .map((b) => {
      const spent = catBudgetSpent(s, b, monthOf(today()));
      return { b, spent, ratio: b.amount ? spent / b.amount : 0 };
    })
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 4);

  const recent = s.txs.slice(0, 6);
  const dt = debtTotals(s);
  const debtRows = s.debts
    .map((d) => ({ d, st: debtStatus(s, d) }))
    .filter((r) => !r.st.done)
    .slice(0, 4);
  const goalRows = s.goals
    .filter((g) => !g.archived)
    .map((g) => ({ g, st: goalStatus(s, g, today()) }))
    .slice(0, 4);

  if (s.accounts.length === 0) {
    return (
      <div className="page">
        <h1>Bienvenido</h1>
        <Empty title="Empieza creando tus cuentas">
          <p>Agrega tus cuentas de banco, efectivo y tarjetas, en lempiras o en dólares, con su saldo actual. Después anota tus ingresos y gastos con el botón +.</p>
          <button className="btn primary" onClick={() => nav.go('cuentas')}>
            Crear mi primera cuenta
          </button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Inicio</h1>
      <RateWarning s={s} />
      {cardAlerts(s).map(({ acc, st, days }) => (
        <a key={acc.id} className={`notice inbox-banner ${days < 0 ? 'late' : ''}`} href="#tarjetas">
          💳 {days < 0 ? 'Pago vencido' : 'Pago de tarjeta'}: <strong>{fmt(st.pending, acc.currency)}</strong> de {acc.name}, {days > 1 ? `vence en ${days} días` : days === 1 ? 'vence mañana' : days === 0 ? 'vence hoy' : `venció hace ${-days} días`} ({shortDate(st.cycle.payDate)}).
        </a>
      ))}
      {s.inbox.length > 0 && (
        <a className="notice inbox-banner" href="#revisar">
          📬 Tienes <strong>{s.inbox.length}</strong> {s.inbox.length === 1 ? 'gasto' : 'gastos'} de tu banco por revisar. Toca para confirmarlos.
        </a>
      )}

      <section className="card hero">
        <div>
          <span className="today-chip">{todayLabel()}</span>
          <p className="muted" style={{ marginTop: 14 }}>Patrimonio total</p>
          <p className="big">{fmt(nw.total, s.main)}</p>
          <p className="muted small">
            {fmt(nw.byCur.HNL, 'HNL')} en lempiras · {fmt(nw.byCur.USD, 'USD')} en dólares
            {s.rate ? ` · tasa L ${s.rate.toFixed(4)}` : ''}
          </p>
          {(dt.owe > 0 || dt.owed > 0) && (
            <p className="small hero-debt">
              {dt.owe > 0 && (
                <>
                  Deudas pendientes: <span className="neg">{fmt(dt.owe, s.main)}</span> ·{' '}
                </>
              )}
              Patrimonio neto: <strong>{fmt(nw.total - dt.owe + dt.owed, s.main)}</strong>
            </p>
          )}
        </div>
      </section>

      <PeriodNav period={period} onChange={setPeriod} />

      <div className="stats">
        <div className="card stat">
          <p className="muted">Ingresos</p>
          <p className="stat-v pos">{fmt(t.income, s.main)}</p>
        </div>
        <div className="card stat">
          <p className="muted">Gastos</p>
          <p className="stat-v neg">{fmt(t.expense, s.main)}</p>
        </div>
        <div className="card stat">
          <p className="muted">Balance</p>
          <p className={`stat-v ${t.net >= 0 ? 'pos' : 'neg'}`}>{fmt(t.net, s.main, { sign: true })}</p>
        </div>
      </div>

      <div className="grid2">
        <section className="card">
          <h3>Gasto por categoría</h3>
          {byCat.length === 0 ? (
            <p className="muted">Sin gastos en este periodo.</p>
          ) : (
            <div className="donut-wrap">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie isAnimationActive={false} data={byCat} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={byCat.length > 1 ? 1 : 0} stroke="var(--surface)">
                    {byCat.map((c) => (
                      <Cell key={c.id} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(Math.round(Number(v) * 100), s.main)} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="legend">
                {byCat.slice(0, 7).map((c) => (
                  <li key={c.id}>
                    <span className="dot" style={{ background: c.color }} />
                    <span className="grow">{c.name}</span>
                    <span>{fmt(Math.round(c.value * 100), s.main)}</span>
                    <span className="muted small pct">{t.expense ? Math.round(((c.value * 100) / t.expense) * 100) : 0}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="card">
          <h3>Ingresos y gastos, últimos 6 meses</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} width={64} tick={{ fill: 'var(--muted)', fontSize: 12 }} tickFormatter={(v) => fmtShort(Number(v) * 100, s.main)} />
              <Tooltip formatter={(v) => fmt(Math.round(Number(v) * 100), s.main)} cursor={{ fill: 'var(--hover)' }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8 }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar isAnimationActive={false} dataKey="Ingresos" fill="var(--pos)" radius={[4, 4, 0, 0]} />
              <Bar isAnimationActive={false} dataKey="Gastos" fill="var(--neg)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      <div className="grid2">
        <section className="card">
          <div className="card-head">
            <h3>Cuentas</h3>
            <button className="link" onClick={() => nav.go('cuentas')}>
              Ver todas
            </button>
          </div>
          <ul className="list">
            {s.accounts
              .filter((a) => !a.archived)
              .map((a) => {
                const b = s.balances.get(a.id) ?? 0;
                return (
                  <li key={a.id} className="row clickable" onClick={() => nav.go('movimientos', { account: a.id })}>
                    <span className="dot" style={{ background: a.color }} />
                    <span className="grow">{a.name}</span>
                    <span className={b < 0 ? 'neg' : ''}>{fmt(b, a.currency)}</span>
                  </li>
                );
              })}
          </ul>
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Presupuestos de {monthLabel(thisMonth).split(' ')[0]}</h3>
            <button className="link" onClick={() => nav.go('presupuestos')}>
              Ver todos
            </button>
          </div>
          {budgetRows.length === 0 ? (
            <p className="muted">Aún no tienes presupuestos.</p>
          ) : (
            <ul className="list">
              {budgetRows.map(({ b, spent, ratio }) => (
                <li key={b.id} className="budget-mini">
                  <div className="row">
                    <span className="grow">{s.catById.get(b.categoryId)?.name}</span>
                    <span className="small">
                      {fmt(spent, b.currency)} / {fmt(b.amount, b.currency)}
                    </span>
                  </div>
                  <Progress ratio={ratio} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {(debtRows.length > 0 || goalRows.length > 0) && (
        <div className="grid2">
          <section className="card">
            <div className="card-head">
              <h3>Objetivos</h3>
              <button className="link" onClick={() => nav.go('objetivos')}>
                Ver todos
              </button>
            </div>
            {goalRows.length === 0 ? (
              <p className="muted">Crea un objetivo para empezar a ahorrar con propósito.</p>
            ) : (
              <ul className="list">
                {goalRows.map(({ g, st }) => (
                  <li key={g.id} className="budget-mini">
                    <div className="row">
                      <span>{g.icon}</span>
                      <span className="grow">{g.name}</span>
                      <span className="small">
                        {fmt(st.saved, g.currency)} / {fmt(g.target, g.currency)}
                      </span>
                    </div>
                    <Progress ratio={st.ratio} good />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card">
            <div className="card-head">
              <h3>Deudas</h3>
              <button className="link" onClick={() => nav.go('deudas')}>
                Ver todas
              </button>
            </div>
            {debtRows.length === 0 ? (
              <p className="muted">No tienes deudas pendientes.</p>
            ) : (
              <ul className="list">
                {debtRows.map(({ d, st }) => (
                  <li key={d.id} className="budget-mini">
                    <div className="row">
                      <span className="grow">{d.name}</span>
                      <span className="small">Falta {fmt(st.left, d.currency)}</span>
                    </div>
                    <Progress ratio={st.ratio} good />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <h3>Últimos movimientos</h3>
          <button className="link" onClick={() => nav.go('movimientos')}>
            Ver todos
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="muted">Aún no hay movimientos. Usa el botón + para anotar el primero.</p>
        ) : (
          <ul className="list">
            {recent.map((tx) => (
              <TxRow key={tx.id} s={s} tx={tx} onClick={() => nav.editTx(tx)} showDate />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
