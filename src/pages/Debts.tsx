import { useState } from 'react';
import { debtStatus, debtTotals, type Store } from '../data';
import { save, softDelete, type Currency, type Debt, type DebtDirection, type DebtPayment, type Transaction } from '../db';
import { monthOf, shortDate, today } from '../dates';
import { centsToInput, convert, fmt, parseAmount } from '../money';
import { PALETTE } from '../seed';
import { AccountSelect, AmountInput, Empty, Field, Modal, Progress, Segmented } from '../components/ui';

export default function Debts({ s }: { s: Store }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Debt | 'new' | null>(null);
  const [showDone, setShowDone] = useState(false);
  const open = openId ? s.debts.find((d) => d.id === openId) : undefined;

  if (open) return <DebtDetail s={s} debt={open} onBack={() => setOpenId(null)} />;

  const { owe, owed } = debtTotals(s);
  const m = monthOf(today());
  const paidMonth = s.debtPayments
    .filter((p) => p.date >= m.start && p.date <= m.end)
    .reduce((a, p) => {
      const d = s.debts.find((x) => x.id === p.debtId);
      return d && d.direction === 'debo' ? a + (convert(p.amount, d.currency, s.main, s.rate) ?? 0) : a;
    }, 0);

  const rows = s.debts.map((d) => ({ d, st: debtStatus(s, d) }));
  const active = rows.filter((r) => !r.st.done);
  const done = rows.filter((r) => r.st.done);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Deudas</h1>
        <button className="btn primary" onClick={() => setEdit('new')}>
          + Nueva deuda
        </button>
      </div>

      {s.debts.length === 0 ? (
        <Empty title="Sin deudas registradas">
          <p>Agrega préstamos, tarjetas a plazos o dinero que debes a alguien. También puedes anotar lo que otras personas te deben a ti. Cada abono que registres baja lo que falta por pagar.</p>
          <button className="btn primary" onClick={() => setEdit('new')}>
            Agregar deuda
          </button>
        </Empty>
      ) : (
        <>
          <div className="stats">
            <div className="card stat">
              <p className="muted">Lo que debes</p>
              <p className="stat-v neg">{fmt(owe, s.main)}</p>
            </div>
            <div className="card stat">
              <p className="muted">Lo que te deben</p>
              <p className="stat-v pos">{fmt(owed, s.main)}</p>
            </div>
            <div className="card stat">
              <p className="muted">Abonado este mes</p>
              <p className="stat-v">{fmt(paidMonth, s.main)}</p>
            </div>
          </div>

          <div className="goal-grid">
            {active.map(({ d, st }) => (
              <DebtCard key={d.id} d={d} st={st} onClick={() => setOpenId(d.id)} />
            ))}
          </div>
          {active.length === 0 && <p className="muted">No tienes deudas pendientes.</p>}

          {done.length > 0 && (
            <>
              <button className="link" onClick={() => setShowDone(!showDone)}>
                {showDone ? 'Ocultar' : 'Ver'} deudas pagadas ({done.length})
              </button>
              {showDone && (
                <div className="goal-grid">
                  {done.map(({ d, st }) => (
                    <DebtCard key={d.id} d={d} st={st} onClick={() => setOpenId(d.id)} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {edit && (
        <DebtForm
          s={s}
          debt={edit === 'new' ? undefined : edit}
          onClose={(id) => {
            setEdit(null);
            if (id && edit === 'new') setOpenId(id);
          }}
        />
      )}
    </div>
  );
}

function DebtCard({ d, st, onClick }: { d: Debt; st: ReturnType<typeof debtStatus>; onClick: () => void }) {
  return (
    <div className="card goal clickable" onClick={onClick} style={{ borderTopColor: d.color }}>
      <div className="row">
        <strong className="grow">{d.name}</strong>
        <span className={`badge ${d.direction === 'me_deben' ? 'badge-pos' : ''}`}>{d.direction === 'debo' ? 'Debo' : 'Me deben'}</span>
      </div>
      {d.person && <p className="muted small">{d.direction === 'debo' ? 'A' : 'De'}: {d.person}</p>}
      <p className={`big ${st.done ? 'pos' : ''}`}>{st.done ? 'Pagada' : fmt(st.left, d.currency)}</p>
      <p className="muted small">{st.done ? `Total pagado ${fmt(st.paid, d.currency)}` : `falta de ${fmt(d.total, d.currency)}`}</p>
      <Progress ratio={st.ratio} good />
      {st.last && <p className="muted small">Último abono: {shortDate(st.last.date)}</p>}
    </div>
  );
}

function DebtDetail({ s, debt, onBack }: { s: Store; debt: Debt; onBack: () => void }) {
  const [edit, setEdit] = useState(false);
  const [pay, setPay] = useState<DebtPayment | 'new' | null>(null);
  const st = debtStatus(s, debt);
  const monthsByInstallment = debt.installment && st.left > 0 ? Math.ceil(st.left / debt.installment) : null;
  let neededMonthly: number | null = null;
  if (debt.dueDate && st.left > 0) {
    const months = Math.max(1, (new Date(debt.dueDate + 'T00:00:00').getTime() - new Date(today() + 'T00:00:00').getTime()) / (864e5 * 30.4));
    neededMonthly = Math.ceil(st.left / months);
  }
  const verb = debt.direction === 'debo' ? 'Abono' : 'Cobro';

  return (
    <div className="page">
      <button className="link back" onClick={onBack}>
        ‹ Deudas
      </button>
      <div className="page-head">
        <h1>{debt.name}</h1>
        <div className="row">
          <button className="btn" onClick={() => setEdit(true)}>
            Editar
          </button>
          <button className="btn primary" onClick={() => setPay('new')}>
            + Registrar {verb.toLowerCase()}
          </button>
        </div>
      </div>

      <section className="card">
        <div className="row wrap">
          <div className="grow">
            <p className="muted">{st.done ? 'Deuda pagada' : debt.direction === 'debo' ? 'Te falta pagar' : 'Te falta cobrar'}</p>
            <p className={`big ${st.done ? 'pos' : debt.direction === 'debo' ? 'neg' : ''}`}>{fmt(st.left, debt.currency)}</p>
          </div>
        </div>
        <Progress ratio={st.ratio} good />
        <dl className="facts">
          <div>
            <dt>Monto total</dt>
            <dd>{fmt(debt.total, debt.currency)}</dd>
          </div>
          <div>
            <dt>{debt.direction === 'debo' ? 'Acreedor' : 'Deudor'}</dt>
            <dd>{debt.person || '—'}</dd>
          </div>
          <div>
            <dt>Desde</dt>
            <dd>{shortDate(debt.startDate)}</dd>
          </div>
          {debt.installment ? (
            <div>
              <dt>Cuota</dt>
              <dd>{fmt(debt.installment, debt.currency)}</dd>
            </div>
          ) : null}
          {monthsByInstallment ? (
            <div>
              <dt>Cuotas restantes</dt>
              <dd>{monthsByInstallment}</dd>
            </div>
          ) : null}
          {debt.dueDate ? (
            <div>
              <dt>Fecha límite</dt>
              <dd>{shortDate(debt.dueDate)}</dd>
            </div>
          ) : null}
          {neededMonthly ? (
            <div>
              <dt>Para terminar a tiempo</dt>
              <dd>{fmt(neededMonthly, debt.currency)} / mes</dd>
            </div>
          ) : null}
          {debt.rate ? (
            <div>
              <dt>Interés anual</dt>
              <dd>{debt.rate} %</dd>
            </div>
          ) : null}
        </dl>
        {debt.note && <p className="muted small">{debt.note}</p>}
      </section>

      <section className="card">
        <h3>
          {debt.direction === 'debo' ? 'Abonos' : 'Cobros'} ({st.payments.length})
        </h3>
        {st.payments.length === 0 ? (
          <p className="muted">Aún no hay {debt.direction === 'debo' ? 'abonos' : 'cobros'}. Registra el primero con el botón de arriba.</p>
        ) : (
          <ul className="list">
            {st.payments.map((p) => (
              <li key={p.id} className="row clickable" onClick={() => setPay(p)}>
                <span className="grow">
                  <span className="block">{shortDate(p.date)}</span>
                  <span className="muted small">
                    {[p.note, p.txId ? `desde ${s.accById.get(s.txs.find((t) => t.id === p.txId)?.accountId ?? '')?.name ?? 'una cuenta'}` : null].filter(Boolean).join(' · ') || ' '}
                  </span>
                </span>
                <span className="pos tx-amount">{fmt(p.amount, debt.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {edit && (
        <DebtForm
          s={s}
          debt={debt}
          onClose={(id) => {
            setEdit(false);
            if (id === null) onBack();
          }}
        />
      )}
      {pay && <PaymentForm s={s} debt={debt} payment={pay === 'new' ? undefined : pay} left={st.left} onClose={() => setPay(null)} />}
    </div>
  );
}

function DebtForm({ s, debt, onClose }: { s: Store; debt?: Debt; onClose: (id?: string | null) => void }) {
  const [direction, setDirection] = useState<DebtDirection>(debt?.direction ?? 'debo');
  const [name, setName] = useState(debt?.name ?? '');
  const [person, setPerson] = useState(debt?.person ?? '');
  const [currency, setCurrency] = useState<Currency>(debt?.currency ?? s.main);
  const [total, setTotal] = useState(debt ? centsToInput(debt.total) : '');
  const [paidBefore, setPaidBefore] = useState('');
  const [startDate, setStartDate] = useState(debt?.startDate ?? today());
  const [dueDate, setDueDate] = useState(debt?.dueDate ?? '');
  const [installment, setInstallment] = useState(debt?.installment ? centsToInput(debt.installment) : '');
  const [rate, setRate] = useState(debt?.rate ? String(debt.rate) : '');
  const [note, setNote] = useState(debt?.note ?? '');
  const [err, setErr] = useState('');
  const hasPayments = debt ? s.debtPayments.some((p) => p.debtId === debt.id) : false;

  const submit = async () => {
    if (!name.trim()) return setErr('Ponle un nombre, por ejemplo "Préstamo del carro".');
    const t = parseAmount(total);
    if (!t || t <= 0) return setErr('Escribe el monto total de la deuda.');
    const pb = paidBefore.trim() ? parseAmount(paidBefore) : 0;
    if (pb === null || pb < 0) return setErr('Lo ya pagado no es un número válido.');
    const inst = installment.trim() ? parseAmount(installment) : null;
    const r = rate.trim() ? Number(rate.replace(',', '.')) : null;
    const id = await save<Debt>('debts', {
      id: debt?.id,
      direction,
      name: name.trim(),
      person: person.trim(),
      currency,
      total: t,
      startDate,
      dueDate: dueDate || null,
      installment: inst,
      rate: r && Number.isFinite(r) ? r : null,
      note: note.trim(),
      color: debt?.color ?? PALETTE[(s.debts.length + 3) % PALETTE.length],
    });
    if (!debt && pb && pb > 0) await save<DebtPayment>('debtPayments', { debtId: id, date: startDate, amount: pb, note: 'Pagado antes de usar la app', txId: null });
    onClose(id);
  };

  const remove = async () => {
    if (!debt || !confirm(`¿Eliminar "${debt.name}" y todos sus abonos? Los movimientos que ya se crearon en tus cuentas se mantienen.`)) return;
    for (const p of s.debtPayments.filter((p) => p.debtId === debt.id)) await softDelete('debtPayments', p.id);
    await softDelete('debts', debt.id);
    onClose(null);
  };

  return (
    <Modal
      title={debt ? 'Editar deuda' : 'Nueva deuda'}
      onClose={() => onClose()}
      footer={
        <>
          {debt && (
            <button className="btn danger ghost" onClick={remove}>
              Eliminar
            </button>
          )}
          <span className="spacer" />
          <button className="btn" onClick={() => onClose()}>
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
        <Segmented
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'debo', label: 'Yo debo' },
            { value: 'me_deben', label: 'Me deben' },
          ]}
        />
        <Field label="Nombre">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Préstamo del carro" autoFocus={!debt} />
        </Field>
        <Field label={direction === 'debo' ? 'A quién le debes' : 'Quién te debe'}>
          <input value={person} onChange={(e) => setPerson(e.target.value)} placeholder={direction === 'debo' ? 'Ej.: Banco Atlántida' : 'Ej.: Juan'} />
        </Field>
        <Field label="Moneda" hint={hasPayments ? 'No se puede cambiar porque ya tiene abonos.' : undefined}>
          <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} disabled={hasPayments}>
            <option value="HNL">Lempiras (L)</option>
            <option value="USD">Dólares (US$)</option>
          </select>
        </Field>
        <Field label="Monto total" hint={debt ? 'Puedes cambiarlo si la deuda aumenta (intereses, cargos) o si renegociaste.' : 'El total de la deuda desde el inicio, incluyendo intereses si los sabes.'}>
          <AmountInput value={total} onChange={setTotal} currency={currency} />
        </Field>
        {!debt && (
          <Field label="¿Cuánto has pagado ya?" hint="Opcional. Se registra como un primer abono.">
            <AmountInput value={paidBefore} onChange={setPaidBefore} currency={currency} />
          </Field>
        )}
        <div className="two-col">
          <Field label="Fecha de inicio">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Fecha límite (opcional)">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>
        <div className="two-col">
          <Field label="Cuota (opcional)">
            <AmountInput value={installment} onChange={setInstallment} currency={currency} />
          </Field>
          <Field label="Interés anual % (opcional)">
            <input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Ej.: 18" />
          </Field>
        </div>
        <Field label="Nota">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
        </Field>
        {err && <p className="error">{err}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function PaymentForm({ s, debt, payment, left, onClose }: { s: Store; debt: Debt; payment?: DebtPayment; left: number; onClose: () => void }) {
  const linkedTx = payment?.txId ? s.txs.find((t) => t.id === payment.txId) : undefined;
  const [amount, setAmount] = useState(payment ? centsToInput(payment.amount) : debt.installment && debt.installment <= left ? centsToInput(debt.installment) : '');
  const [date, setDate] = useState(payment?.date ?? today());
  const [note, setNote] = useState(payment?.note ?? '');
  const [accountId, setAccountId] = useState(linkedTx?.accountId ?? '');
  const [err, setErr] = useState('');
  const acc = accountId ? s.accById.get(accountId) : undefined;
  const isDebo = debt.direction === 'debo';
  const sameCurrency = !acc || acc.currency === debt.currency;

  const submit = async () => {
    const cents = parseAmount(amount);
    if (!cents || cents <= 0) return setErr('Escribe un monto mayor que cero.');
    if (acc && !sameCurrency) return setErr(`La cuenta es en ${acc.currency === 'USD' ? 'dólares' : 'lempiras'} y la deuda en ${debt.currency === 'USD' ? 'dólares' : 'lempiras'}. Elige una cuenta en la misma moneda o no uses cuenta.`);
    let txId: string | null = payment?.txId ?? null;
    if (accountId) {
      const cat = s.catById.get(isDebo ? 'seed:gasto:finanzas:pago-de-deudas' : 'seed:ingreso:otros-ingresos');
      txId = await save<Transaction>('transactions', {
        id: txId ?? undefined,
        type: isDebo ? 'gasto' : 'ingreso',
        amount: cents,
        accountId,
        categoryId: linkedTx?.categoryId ?? cat?.id ?? null,
        date,
        note: `${isDebo ? 'Abono' : 'Cobro'}: ${debt.name}`,
        tags: linkedTx?.tags ?? ['deuda'],
        toAccountId: null,
        toAmount: null,
      });
    } else if (txId) {
      await softDelete('transactions', txId);
      txId = null;
    }
    await save<DebtPayment>('debtPayments', { id: payment?.id, debtId: debt.id, date, amount: cents, note: note.trim(), txId });
    onClose();
  };

  const remove = async () => {
    if (!payment || !confirm('¿Eliminar este abono?' + (payment.txId ? ' También se elimina el movimiento de la cuenta.' : ''))) return;
    if (payment.txId) await softDelete('transactions', payment.txId);
    await softDelete('debtPayments', payment.id);
    onClose();
  };

  const word = isDebo ? 'abono' : 'cobro';
  return (
    <Modal
      title={payment ? `Editar ${word}` : `Nuevo ${word}`}
      onClose={onClose}
      footer={
        <>
          {payment && (
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
        <p className="muted small">
          {debt.name} · falta {fmt(left, debt.currency)}
        </p>
        <Field label="Monto">
          <AmountInput value={amount} onChange={setAmount} currency={debt.currency} autoFocus={!payment} />
        </Field>
        <Field label="Fecha">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={isDebo ? '¿De qué cuenta salió el dinero?' : '¿A qué cuenta entró el dinero?'} hint={accountId ? `Se registra también como ${isDebo ? 'gasto' : 'ingreso'} en esa cuenta.` : 'Opcional. Si eliges una cuenta, su saldo se actualiza.'}>
          <AccountSelect s={s} value={accountId} onChange={setAccountId} allowEmpty="No registrar en una cuenta" />
        </Field>
        <Field label="Nota">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional, ej.: cuota de noviembre" />
        </Field>
        {err && <p className="error">{err}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
