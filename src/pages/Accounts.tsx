import { useState } from 'react';
import type { Nav } from '../App';
import { netWorth, type Store } from '../data';
import { save, softDelete, type Account, type AccountType, type Currency } from '../db';
import { centsToInput, CURRENCY_NAME, fmt, parseAmount } from '../money';
import { PALETTE } from '../seed';
import { AmountInput, Empty, Field, Modal, RateWarning } from '../components/ui';

export const ACCOUNT_TYPES: { value: AccountType; label: string; icon: string }[] = [
  { value: 'banco', label: 'Cuenta bancaria', icon: '🏦' },
  { value: 'efectivo', label: 'Efectivo', icon: '💵' },
  { value: 'tarjeta', label: 'Tarjeta de crédito', icon: '💳' },
  { value: 'ahorro', label: 'Ahorro', icon: '🐷' },
  { value: 'billetera', label: 'Billetera digital', icon: '📱' },
];

export default function Accounts({ s, nav }: { s: Store; nav: Nav }) {
  const [edit, setEdit] = useState<Account | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const nw = netWorth(s);
  const visible = s.accounts.filter((a) => showArchived || !a.archived);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Cuentas</h1>
        <button className="btn primary" onClick={() => setEdit('new')}>
          + Nueva cuenta
        </button>
      </div>
      <RateWarning s={s} />

      {s.accounts.length > 0 && (
        <div className="stats">
          <div className="card stat">
            <p className="muted">Total en {CURRENCY_NAME[s.main].toLowerCase()}</p>
            <p className="stat-v">{fmt(nw.total, s.main)}</p>
          </div>
          <div className="card stat">
            <p className="muted">Cuentas en lempiras</p>
            <p className="stat-v">{fmt(nw.byCur.HNL, 'HNL')}</p>
          </div>
          <div className="card stat">
            <p className="muted">Cuentas en dólares</p>
            <p className="stat-v">{fmt(nw.byCur.USD, 'USD')}</p>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <Empty title="Aún no tienes cuentas">
          <p>Crea una cuenta por cada lugar donde tienes dinero: banco, efectivo, tarjeta de crédito, ahorro o billetera digital (Tigo Money, por ejemplo).</p>
          <button className="btn primary" onClick={() => setEdit('new')}>
            Crear cuenta
          </button>
        </Empty>
      ) : (
        ACCOUNT_TYPES.map((t) => {
          const items = visible.filter((a) => a.type === t.value);
          if (!items.length) return null;
          return (
            <section key={t.value}>
              <h4 className="day-head">
                {t.icon} {t.label}
              </h4>
              <div className="acc-grid">
                {items.map((a) => {
                  const b = s.balances.get(a.id) ?? 0;
                  const isCard = a.type === 'tarjeta';
                  return (
                    <div key={a.id} className={`card acc ${a.archived ? 'archived' : ''}`} style={{ borderTopColor: a.color }}>
                      <div className="row">
                        <strong className="grow">{a.name}</strong>
                        <span className="badge">{a.currency === 'HNL' ? 'L' : 'US$'}</span>
                      </div>
                      <p className={`big ${b < 0 ? 'neg' : ''}`}>{fmt(b, a.currency)}</p>
                      {isCard && a.creditLimit ? <p className="muted small">Disponible: {fmt(a.creditLimit + b, a.currency)} de {fmt(a.creditLimit, a.currency)}</p> : null}
                      {a.archived ? <p className="muted small">Archivada</p> : null}
                      <div className="row acc-actions">
                        <button className="link" onClick={() => nav.go('movimientos', { account: a.id })}>
                          Movimientos
                        </button>
                        <button className="link" onClick={() => nav.newTx({ accountId: a.id })}>
                          Anotar
                        </button>
                        <span className="spacer" />
                        <button className="link" onClick={() => setEdit(a)}>
                          Editar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      {s.accounts.some((a) => a.archived) && (
        <label className="check">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Mostrar cuentas archivadas
        </label>
      )}

      {edit && <AccountForm s={s} account={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function AccountForm({ s, account, onClose }: { s: Store; account?: Account; onClose: () => void }) {
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'banco');
  const [currency, setCurrency] = useState<Currency>(account?.currency ?? 'HNL');
  const isCard = type === 'tarjeta';
  const [initial, setInitial] = useState(account ? centsToInput(isCard ? -account.initialBalance : account.initialBalance) : '');
  const [limit, setLimit] = useState(account?.creditLimit ? centsToInput(account.creditLimit) : '');
  const [color, setColor] = useState(account?.color ?? PALETTE[s.accounts.length % PALETTE.length]);
  const [error, setError] = useState('');
  const used = account ? s.txs.some((t) => t.accountId === account.id || t.toAccountId === account.id) : false;

  const submit = async () => {
    if (!name.trim()) return setError('Ponle un nombre a la cuenta.');
    const ini = initial.trim() ? parseAmount(initial) : 0;
    if (ini === null) return setError('El saldo inicial no es un número válido.');
    await save<Account>('accounts', {
      id: account?.id,
      name: name.trim(),
      type,
      currency,
      initialBalance: isCard ? -ini : ini,
      creditLimit: isCard ? parseAmount(limit) ?? undefined : undefined,
      color,
      archived: account?.archived ?? 0,
    });
    onClose();
  };

  const toggleArchive = async () => {
    if (!account) return;
    await save<Account>('accounts', { id: account.id, archived: account.archived ? 0 : 1 });
    onClose();
  };

  const remove = async () => {
    if (!account) return;
    if (used) return setError('Esta cuenta tiene movimientos. Archívala en vez de eliminarla.');
    if (confirm(`¿Eliminar la cuenta ${account.name}?`)) {
      await softDelete('accounts', account.id);
      onClose();
    }
  };

  return (
    <Modal
      title={account ? 'Editar cuenta' : 'Nueva cuenta'}
      onClose={onClose}
      footer={
        <>
          {account && (
            <>
              <button className="btn danger ghost" onClick={remove}>
                Eliminar
              </button>
              <button className="btn ghost" onClick={toggleArchive}>
                {account.archived ? 'Desarchivar' : 'Archivar'}
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
        <Field label="Nombre">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: BAC cuenta de ahorro" autoFocus />
        </Field>
        <Field label="Tipo">
          <select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.icon} {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Moneda" hint={used ? 'No se puede cambiar porque la cuenta ya tiene movimientos.' : undefined}>
          <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} disabled={used}>
            <option value="HNL">Lempiras (L)</option>
            <option value="USD">Dólares (US$)</option>
          </select>
        </Field>
        <Field label={isCard ? 'Deuda actual de la tarjeta' : 'Saldo inicial'} hint={isCard ? 'Lo que debes hoy. Escribe 0 si está en cero.' : 'Lo que tiene la cuenta hoy, antes de anotar movimientos.'}>
          <AmountInput value={initial} onChange={setInitial} currency={currency} />
        </Field>
        {isCard && (
          <Field label="Límite de crédito">
            <AmountInput value={limit} onChange={setLimit} currency={currency} />
          </Field>
        )}
        <Field label="Color">
          <div className="swatches">
            {PALETTE.map((c) => (
              <button type="button" key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
            ))}
          </div>
        </Field>
        {error && <p className="error">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
