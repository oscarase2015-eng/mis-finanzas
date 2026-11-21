import { useState } from 'react';
import { investStatus, investTotals, type Store } from '../data';
import { save, softDelete, type Currency, type Investment } from '../db';
import { shortDate, today } from '../dates';
import { centsToInput, fmt, parseAmount } from '../money';
import { AmountInput, Empty, Field, Modal, Progress } from '../components/ui';
import { Glyph, GlyphPicker } from '../components/Icons';

export default function Investments({ s }: { s: Store }) {
  const [edit, setEdit] = useState<Investment | 'new' | null>(null);
  const t = investTotals(s);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Inversiones</h1>
        <button className="btn primary" onClick={() => setEdit('new')}>
          + Nueva inversión
        </button>
      </div>

      {s.investments.length === 0 ? (
        <Empty title="Sin inversiones todavía">
          <p>Registra lo que tienes de valor, como un terreno o una casa. Si lo estás pagando, enlázalo a su deuda y verás cuánto ya es tuyo. Su valor suma a tu patrimonio.</p>
          <button className="btn primary" onClick={() => setEdit('new')}>
            Agregar inversión
          </button>
        </Empty>
      ) : (
        <>
          <div className="stats">
            <div className="card stat">
              <p className="muted">Valor total</p>
              <p className="stat-v">{fmt(t.value, s.main)}</p>
            </div>
            <div className="card stat">
              <p className="muted">Ya es tuyo</p>
              <p className="stat-v">{fmt(t.own, s.main)}</p>
            </div>
          </div>

          <div className="budget-list">
            {s.investments.map((inv) => {
              const st = investStatus(s, inv);
              return (
                <div key={inv.id} className="card budget clickable" onClick={() => setEdit(inv)}>
                  <div className="row">
                    <span className="tx-icon">
                      <Glyph name={inv.icon} />
                    </span>
                    <span className="grow">
                      <strong>{inv.name}</strong>
                      <span className="muted small block">Valor {fmt(inv.value, inv.currency)}</span>
                    </span>
                    <span className="right-col">
                      <b className="key-amt">{fmt(st.own, inv.currency)}</b>
                      <span className="muted small block">tuyo</span>
                    </span>
                  </div>
                  {st.debt && <Progress ratio={st.ratio} good />}
                  <p className="muted small">{st.debt ? `Deuda: ${st.debt.name}` : `Valor al ${shortDate(inv.valuedAt)}`}</p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {edit && <InvestmentForm s={s} inv={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function InvestmentForm({ s, inv, onClose }: { s: Store; inv?: Investment; onClose: () => void }) {
  const [name, setName] = useState(inv?.name ?? '');
  const [icon, setIcon] = useState(inv?.icon ?? 'home');
  const [currency, setCurrency] = useState<Currency>(inv?.currency ?? s.main);
  const [value, setValue] = useState(inv ? centsToInput(inv.value) : '');
  const [debtId, setDebtId] = useState(inv?.debtId ?? '');
  const [note, setNote] = useState(inv?.note ?? '');
  const [err, setErr] = useState('');
  const debts = s.debts.filter((d) => d.direction === 'debo');

  const pickDebt = (id: string) => {
    setDebtId(id);
    const d = debts.find((x) => x.id === id);
    if (d && !value) {
      setValue(centsToInput(d.total));
      setCurrency(d.currency);
      if (!name) setName(d.name);
    }
  };

  const submit = async () => {
    if (!name.trim()) return setErr('Ponle un nombre, por ejemplo "Terreno Las Magnolias".');
    const v = parseAmount(value);
    if (v === null || v <= 0) return setErr('Escribe cuánto vale.');
    const changed = !inv || inv.value !== v;
    await save<Investment>('investments', {
      id: inv?.id,
      name: name.trim(),
      icon,
      currency,
      value: v,
      valuedAt: changed ? today() : inv!.valuedAt,
      debtId: debtId || null,
      note: note.trim(),
    });
    onClose();
  };

  const remove = async () => {
    if (!inv || !confirm(`¿Eliminar "${inv.name}"? La deuda enlazada no se borra.`)) return;
    await softDelete('investments', inv.id);
    onClose();
  };

  return (
    <Modal
      title={inv ? 'Editar inversión' : 'Nueva inversión'}
      onClose={onClose}
      footer={
        <>
          {inv && (
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
        <Field label="¿Se está pagando con una deuda?" hint="La parte tuya es el valor menos lo que falta pagar de esa deuda.">
          <select value={debtId} onChange={(e) => pickDebt(e.target.value)}>
            <option value="">No, ya es mía</option>
            {debts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nombre">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Terreno Las Magnolias" autoFocus={!inv} />
        </Field>
        <Field label="Ícono">
          <GlyphPicker value={icon} onChange={setIcon} />
        </Field>
        <Field label="Moneda">
          <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            <option value="HNL">Lempiras (L)</option>
            <option value="USD">Dólares (US$)</option>
          </select>
        </Field>
        <Field label="¿Cuánto vale hoy?" hint="Puedes actualizarlo cuando cambie su valor.">
          <AmountInput value={value} onChange={setValue} currency={currency} />
        </Field>
        <Field label="Nota (opcional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {err && <p className="error">{err}</p>}
      </form>
    </Modal>
  );
}
