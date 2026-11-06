import { useState } from 'react';
import { catFamily, expenseByRoot, type Store } from '../data';
import { save, softDelete, type Budget, type Currency } from '../db';
import { monthOf, quincenaOf, shiftPeriod, today, type Period } from '../dates';
import { centsToInput, convert, fmt, parseAmount } from '../money';
import { AmountInput, CategorySelect, Empty, Field, Modal, Progress, RateWarning } from '../components/ui';

/** Gasto de la categoría (y sus subcategorías) dentro del periodo, en la moneda del presupuesto */
export function catBudgetSpent(s: Store, b: Budget, p: { start: string; end: string }) {
  const fam = catFamily(s, b.categoryId);
  let total = 0;
  for (const t of s.txs) {
    if (t.type !== 'gasto' || t.date < p.start || t.date > p.end || !t.categoryId || !fam.has(t.categoryId)) continue;
    const a = s.accById.get(t.accountId);
    if (!a) continue;
    total += convert(t.amount, a.currency, b.currency, s.rate) ?? 0;
  }
  return total;
}

export default function Budgets({ s }: { s: Store }) {
  const [month, setMonth] = useState<Period>(() => monthOf(today()));
  const [edit, setEdit] = useState<Budget | 'new' | null>(null);
  const q1 = quincenaOf(month.start);
  const q2 = quincenaOf(`${month.start.slice(0, 8)}15`);

  const rows = s.budgets
    .map((b) => {
      const spent = catBudgetSpent(s, b, month);
      return { b, spent, s1: catBudgetSpent(s, b, q1), s2: catBudgetSpent(s, b, q2), ratio: b.amount ? spent / b.amount : 0 };
    })
    .sort((a, b) => (s.catById.get(a.b.categoryId)?.name ?? '').localeCompare(s.catById.get(b.b.categoryId)?.name ?? '', 'es'));

  let totalBudget = 0;
  let totalSpent = 0;
  for (const r of rows) {
    totalBudget += convert(r.b.amount, r.b.currency, s.main, s.rate) ?? 0;
    totalSpent += convert(r.spent, r.b.currency, s.main, s.rate) ?? 0;
  }

  const budgeted = new Set(s.budgets.map((b) => b.categoryId));
  const unbudgeted = [...expenseByRoot(s, month.start, month.end).entries()].filter(([id]) => !budgeted.has(id));

  // Ritmo esperado: qué fracción del mes ha pasado
  const t = today();
  const isCurrent = t >= month.start && t <= month.end;
  const dayFrac = isCurrent ? Number(t.slice(8, 10)) / Number(month.end.slice(8, 10)) : null;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Presupuestos</h1>
        <button className="btn primary" onClick={() => setEdit('new')}>
          + Nuevo presupuesto
        </button>
      </div>
      <RateWarning s={s} />

      <div className="period-step standalone">
        <button className="icon-btn" onClick={() => setMonth(shiftPeriod(month, -1))} aria-label="Mes anterior">
          ‹
        </button>
        <span className="period-label">{month.label}</span>
        <button className="icon-btn" onClick={() => setMonth(shiftPeriod(month, 1))} aria-label="Mes siguiente">
          ›
        </button>
      </div>

      {rows.length === 0 ? (
        <Empty title="Sin presupuestos todavía">
          <p>Un presupuesto pone un límite mensual a una categoría, por ejemplo L 6,000 para Alimentación. Se repite cada mes y te avisa al llegar al 80 % y al 100 %.</p>
          <button className="btn primary" onClick={() => setEdit('new')}>
            Crear presupuesto
          </button>
        </Empty>
      ) : (
        <>
          <section className="card">
            <div className="row">
              <span className="grow">
                <strong className="block">Total presupuestado</strong>
                <span className="muted small">
                  {fmt(totalSpent, s.main)} de {fmt(totalBudget, s.main)}
                </span>
              </span>
              <span className={`small ${totalSpent > totalBudget ? 'neg' : 'pos'}`}>
                {totalSpent > totalBudget ? `Excedido ${fmt(totalSpent - totalBudget, s.main)}` : `Quedan ${fmt(totalBudget - totalSpent, s.main)}`}
              </span>
            </div>
            <Progress ratio={totalBudget ? totalSpent / totalBudget : 0} />
            {dayFrac !== null && <p className="muted small">Ha pasado el {Math.round(dayFrac * 100)} % del mes.</p>}
          </section>

          <ul className="budget-list">
            {rows.map(({ b, spent, s1, s2, ratio }) => {
              const c = s.catById.get(b.categoryId);
              const left = b.amount - spent;
              return (
                <li key={b.id} className="card budget clickable" onClick={() => setEdit(b)}>
                  <div className="row">
                    <span className="tx-icon" style={{ background: `${c?.color ?? '#94a3b8'}22` }}>
                      {c?.icon ?? '•'}
                    </span>
                    <span className="grow">
                      <strong>{c?.name ?? 'Categoría eliminada'}</strong>
                      <span className="muted small block">
                        {fmt(spent, b.currency)} de {fmt(b.amount, b.currency)}
                      </span>
                    </span>
                    <span className={`small ${ratio >= 1 ? 'neg' : ratio >= 0.8 ? 'warn-text' : ''}`}>
                      {ratio >= 1 ? `Excedido ${fmt(-left, b.currency)}` : `Quedan ${fmt(left, b.currency)}`}
                      <span className="block muted">{Math.round(ratio * 100)} %</span>
                    </span>
                  </div>
                  <Progress ratio={ratio} />
                  <p className="muted small">
                    1.ª quincena: {fmt(s1, b.currency)} · 2.ª quincena: {fmt(s2, b.currency)}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {unbudgeted.length > 0 && (
        <section className="card">
          <h3>Gastos sin presupuesto este mes</h3>
          <ul className="list">
            {unbudgeted.map(([id, v]) => (
              <li key={id} className="row">
                <span className="grow">{s.catById.get(id)?.name ?? 'Sin categoría'}</span>
                <span>{fmt(v, s.main)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {edit && <BudgetForm s={s} budget={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function BudgetForm({ s, budget, onClose }: { s: Store; budget?: Budget; onClose: () => void }) {
  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? '');
  const [amount, setAmount] = useState(budget ? centsToInput(budget.amount) : '');
  const [currency, setCurrency] = useState<Currency>(budget?.currency ?? s.main);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!categoryId) return setError('Elige una categoría.');
    const cents = parseAmount(amount);
    if (!cents || cents <= 0) return setError('Escribe un monto mayor que cero.');
    if (s.budgets.some((b) => b.categoryId === categoryId && b.id !== budget?.id)) return setError('Esa categoría ya tiene presupuesto.');
    await save<Budget>('budgets', { id: budget?.id, categoryId, amount: cents, currency });
    onClose();
  };

  const remove = async () => {
    if (budget && confirm('¿Eliminar este presupuesto?')) {
      await softDelete('budgets', budget.id);
      onClose();
    }
  };

  return (
    <Modal
      title={budget ? 'Editar presupuesto' : 'Nuevo presupuesto'}
      onClose={onClose}
      footer={
        <>
          {budget && (
            <button className="btn danger ghost" onClick={remove}>
              Eliminar
            </button>
          )}
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
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Categoría" hint="Incluye todas sus subcategorías.">
          <CategorySelect s={s} kind="gasto" value={categoryId} onChange={setCategoryId} allowEmpty="Elige una categoría…" />
        </Field>
        <Field label="Moneda">
          <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            <option value="HNL">Lempiras (L)</option>
            <option value="USD">Dólares (US$)</option>
          </select>
        </Field>
        <Field label="Límite mensual">
          <AmountInput value={amount} onChange={setAmount} currency={currency} />
        </Field>
        {error && <p className="error">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
