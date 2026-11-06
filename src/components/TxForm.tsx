import { useMemo, useState } from 'react';
import type { Store } from '../data';
import { save, softDelete, type Transaction, type TxType } from '../db';
import { centsToInput, fmt, parseAmount, SYMBOL } from '../money';
import { today } from '../dates';
import { remember } from '../theme';
import { AccountSelect, AmountInput, CategorySelect, Field, Modal, Segmented } from './ui';

export default function TxForm({ s, tx, preset, onClose }: { s: Store; tx?: Transaction; preset?: Partial<Transaction>; onClose: () => void }) {
  const init = tx ?? preset ?? {};
  const lastAcc = remember('lastAccount');
  const defaultAcc = init.accountId ?? (lastAcc && s.accById.get(lastAcc) && !s.accById.get(lastAcc)!.archived ? lastAcc : s.accounts.find((a) => !a.archived)?.id) ?? '';

  const [type, setType] = useState<TxType>(init.type ?? 'gasto');
  const [amount, setAmount] = useState(init.amount ? centsToInput(init.amount) : '');
  const [accountId, setAccountId] = useState(defaultAcc);
  const [toAccountId, setToAccountId] = useState(init.toAccountId ?? '');
  const [toAmount, setToAmount] = useState(init.toAmount ? centsToInput(init.toAmount) : '');
  const [categoryId, setCategoryId] = useState(init.categoryId ?? '');
  const [date, setDate] = useState(init.date ?? today());
  const [note, setNote] = useState(init.note ?? '');
  const [tags, setTags] = useState((init.tags ?? []).join(', '));
  const [error, setError] = useState('');

  const acc = s.accById.get(accountId);
  const toAcc = s.accById.get(toAccountId);
  const crossCurrency = type === 'transferencia' && acc && toAcc && acc.currency !== toAcc.currency;

  const impliedRate = useMemo(() => {
    if (!crossCurrency) return null;
    const a = parseAmount(amount);
    const b = parseAmount(toAmount);
    if (!a || !b) return null;
    return acc!.currency === 'USD' ? b / a : a / b;
  }, [crossCurrency, amount, toAmount, acc]);

  if (s.accounts.filter((a) => !a.archived).length === 0) {
    return (
      <Modal title="Nuevo movimiento" onClose={onClose}>
        <p>Primero crea al menos una cuenta (por ejemplo "Efectivo" o tu cuenta de banco).</p>
        <a className="btn primary" href="#cuentas" onClick={onClose}>
          Ir a Cuentas
        </a>
      </Modal>
    );
  }

  const changeType = (t: TxType) => {
    setType(t);
    if (categoryId && s.catById.get(categoryId)?.kind !== t) setCategoryId('');
  };

  const submit = async () => {
    const cents = parseAmount(amount);
    if (!cents || cents <= 0) return setError('Escribe un monto mayor que cero.');
    if (!accountId) return setError('Elige una cuenta.');
    let toCents: number | null = null;
    if (type === 'transferencia') {
      if (!toAccountId) return setError('Elige la cuenta destino.');
      if (crossCurrency) {
        toCents = parseAmount(toAmount);
        if (!toCents || toCents <= 0) return setError(`Escribe cuánto entró en ${SYMBOL[toAcc!.currency]}.`);
      } else toCents = cents;
    }
    const rec: Partial<Transaction> = {
      id: tx?.id,
      type,
      amount: cents,
      accountId,
      categoryId: type === 'transferencia' ? null : categoryId || null,
      date,
      note: note.trim(),
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      toAccountId: type === 'transferencia' ? toAccountId : null,
      toAmount: toCents,
    };
    await save<Transaction>('transactions', rec);
    remember('lastAccount', accountId);
    onClose();
  };

  const remove = async () => {
    if (tx && confirm('¿Eliminar este movimiento?')) {
      await softDelete('transactions', tx.id);
      onClose();
    }
  };

  const duplicate = async () => {
    if (!tx) return;
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = tx;
    await save<Transaction>('transactions', { ...rest, date: today() });
    onClose();
  };

  return (
    <Modal
      title={tx ? 'Editar movimiento' : 'Nuevo movimiento'}
      onClose={onClose}
      footer={
        <>
          {tx && (
            <>
              <button className="btn danger ghost" onClick={remove}>
                Eliminar
              </button>
              <button className="btn ghost" onClick={duplicate}>
                Duplicar hoy
              </button>
            </>
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
        <Segmented
          value={type}
          onChange={changeType}
          options={[
            { value: 'gasto', label: 'Gasto' },
            { value: 'ingreso', label: 'Ingreso' },
            { value: 'transferencia', label: 'Transferencia' },
          ]}
        />
        <Field label={type === 'transferencia' ? 'Monto que sale' : 'Monto'}>
          <AmountInput value={amount} onChange={setAmount} currency={acc?.currency ?? 'HNL'} autoFocus={!tx} />
        </Field>
        <Field label={type === 'transferencia' ? 'Desde la cuenta' : 'Cuenta'}>
          <AccountSelect s={s} value={accountId} onChange={setAccountId} />
        </Field>
        {type === 'transferencia' ? (
          <>
            <Field label="Hacia la cuenta">
              <AccountSelect s={s} value={toAccountId} onChange={setToAccountId} exclude={accountId} allowEmpty="Elige una cuenta…" />
            </Field>
            {crossCurrency && (
              <Field
                label={`Monto que entra en ${toAcc!.currency === 'USD' ? 'dólares' : 'lempiras'}`}
                hint={impliedRate ? `Tasa usada: L ${impliedRate.toFixed(4)} por dólar` : 'La app calcula la tasa con los dos montos.'}
              >
                <AmountInput value={toAmount} onChange={setToAmount} currency={toAcc!.currency} />
              </Field>
            )}
          </>
        ) : (
          <Field label="Categoría">
            <CategorySelect s={s} kind={type} value={categoryId} onChange={setCategoryId} allowEmpty="Sin categoría" />
          </Field>
        )}
        <Field label="Fecha">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Nota">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
        </Field>
        <Field label="Etiquetas" hint="Separadas por coma, por ejemplo: viaje, trabajo">
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Opcional" />
        </Field>
        {acc && (
          <p className="muted small">
            Saldo actual de {acc.name}: {fmt(s.balances.get(acc.id) ?? 0, acc.currency)}
          </p>
        )}
        {error && <p className="error">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
