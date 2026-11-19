import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Store } from '../data';
import { db, getSetting, save, setSetting, softDelete, type Category, type CatKind, type Currency, type Rate } from '../db';
import { today, shortDate } from '../dates';
import { CURRENCY_NAME } from '../money';
import { AUTO_RATE_KEY, updateAutoRate } from '../rates';
import { PALETTE } from '../seed';
import { applyTheme, getTheme, type Theme } from '../theme';
import { Field, Modal, Segmented } from '../components/ui';
import { AccountCard } from '../components/Auth';

const SOON = [
  ['📈', 'Inversiones'],
  ['🔁', 'Pagos recurrentes y recordatorios'],
  ['📊', 'Reportes y exportar a Excel'],
];

export default function More({ s, email, onLogin }: { s: Store; email: string | null; onLogin: () => void }) {
  return (
    <div className="page">
      <h1>Más</h1>
      <div className="tiles">
        <a className="card tile" href="#tarjetas">
          <span className="tile-icon">💳</span>
          <span>
            <strong className="block">Tarjetas</strong>
            <span className="muted small">Corte, pago y gasto del periodo</span>
          </span>
        </a>
        <a className="card tile" href="#revisar">
          <span className="tile-icon">📬</span>
          <span>
            <strong className="block">Por revisar</strong>
            <span className="muted small">{s.inbox.length ? `${s.inbox.length} pendientes` : 'Gastos desde Gmail'}</span>
          </span>
        </a>
        <a className="card tile" href="#deudas">
          <span className="tile-icon">🤝</span>
          <span>
            <strong className="block">Deudas</strong>
            <span className="muted small">{s.debts.length ? `${s.debts.length} registradas` : 'Lo que debes y te deben'}</span>
          </span>
        </a>
        <a className="card tile" href="#objetivos">
          <span className="tile-icon">🎯</span>
          <span>
            <strong className="block">Objetivos</strong>
            <span className="muted small">{s.goals.length ? `${s.goals.filter((g) => !g.archived).length} activos` : 'Ahorra para tus metas'}</span>
          </span>
        </a>
      </div>
      <AccountCard email={email} onLogin={onLogin} />
      <RateCard s={s} />
      <SettingsCard s={s} />
      <CategoriesCard s={s} />
      <BackupCard />
      <section className="card">
        <h3>Próximamente</h3>
        <ul className="list">
          {SOON.map(([i, t]) => (
            <li key={t} className="row muted">
              <span>{i}</span>
              <span className="grow">{t}</span>
            </li>
          ))}
        </ul>
      </section>
      <p className="muted small center">Mis Finanzas · versión 1.9</p>
    </div>
  );
}

function RateCard({ s }: { s: Store }) {
  const [value, setValue] = useState('');
  const [date, setDate] = useState(today());
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const auto = useLiveQuery(() => getSetting(AUTO_RATE_KEY, true), [], true);
  const latest = s.rates[0];
  const refresh = async () => {
    setBusy(true);
    setMsg('');
    const r = await updateAutoRate(true);
    setBusy(false);
    setMsg(r === 'ok' ? 'Tasa actualizada.' : 'No pude obtener la tasa. Revisa tu conexión e intenta de nuevo.');
  };
  const add = async () => {
    const v = Number(value.replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) return setErr('Escribe cuántos lempiras vale un dólar, por ejemplo 26.50');
    await save<Rate>('rates', { date, usdToHnl: v, source: 'manual' });
    setValue('');
    setErr('');
  };
  return (
    <section className="card" id="tasa">
      <h3>Tasa de cambio</h3>
      <p className="muted small">Se usa para sumar cuentas en dólares y lempiras en los totales. Nunca cambia los montos que ya anotaste.</p>
      <p className="big">{s.rate ? `US$ 1 = L ${s.rate.toFixed(4)}` : 'Sin tasa todavía'}</p>
      {latest && <p className="muted small">{latest.source === 'auto' ? 'Automática' : 'Manual'} · {shortDate(latest.date)}</p>}
      <label className="row check">
        <input type="checkbox" checked={!!auto} onChange={(e) => setSetting(AUTO_RATE_KEY, e.target.checked)} />
        <span className="grow">Actualizar sola cada día (tasa de mercado de internet)</span>
      </label>
      {auto && (
        <p>
          <button className="btn ghost" disabled={busy} onClick={refresh}>
            {busy ? 'Buscando…' : 'Actualizar ahora'}
          </button>
          {msg && <span className="muted small"> {msg}</span>}
        </p>
      )}
      <p className="muted small">También puedes poner la tasa a mano, por ejemplo la de tu banco. La más reciente es la que se usa.</p>
      <div className="inline-form">
        <input inputMode="decimal" placeholder="L por dólar, ej. 26.50" value={value} onChange={(e) => setValue(e.target.value)} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn primary" onClick={add}>
          Guardar tasa
        </button>
      </div>
      {err && <p className="error">{err}</p>}
      {s.rates.length > 0 && (
        <details>
          <summary className="muted small">Historial ({s.rates.length})</summary>
          <ul className="list">
            {s.rates.map((r) => (
              <li key={r.id} className="row">
                <span className="grow">{shortDate(r.date)}{r.source === 'auto' && <span className="muted small"> · auto</span>}</span>
                <span>L {r.usdToHnl.toFixed(4)}</span>
                <button className="link danger" onClick={() => softDelete('rates', r.id)}>
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function SettingsCard({ s }: { s: Store }) {
  const [theme, setTheme] = useState<Theme>(getTheme());
  return (
    <section className="card">
      <h3>Ajustes</h3>
      <div className="form">
        <Field label="Moneda principal para los totales">
          <select value={s.main} onChange={(e) => setSetting('mainCurrency', e.target.value as Currency)}>
            <option value="HNL">{CURRENCY_NAME.HNL} (L)</option>
            <option value="USD">{CURRENCY_NAME.USD} (US$)</option>
          </select>
        </Field>
        <Field label="Tema">
          <Segmented
            value={theme}
            onChange={(t) => {
              setTheme(t);
              applyTheme(t);
            }}
            options={[
              { value: 'auto', label: 'Automático' },
              { value: 'light', label: 'Claro' },
              { value: 'dark', label: 'Oscuro' },
            ]}
          />
        </Field>
        <p className="muted small">Quincenas: del 1 al 14 y del 15 a fin de mes.</p>
      </div>
    </section>
  );
}

function CategoriesCard({ s }: { s: Store }) {
  const [kind, setKind] = useState<CatKind>('gasto');
  const [edit, setEdit] = useState<{ cat?: Category; parentId: string | null } | null>(null);
  const roots = s.categories.filter((c) => c.kind === kind && !c.parentId);
  return (
    <section className="card">
      <div className="card-head">
        <h3>Categorías</h3>
        <button className="link" onClick={() => setEdit({ parentId: null })}>
          + Nueva
        </button>
      </div>
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: 'gasto', label: 'Gastos' },
          { value: 'ingreso', label: 'Ingresos' },
        ]}
      />
      <ul className="cat-tree">
        {roots.map((r) => (
          <li key={r.id}>
            <div className="row clickable" onClick={() => setEdit({ cat: r, parentId: null })}>
              <span className="dot" style={{ background: r.color }} />
              <span>{r.icon}</span>
              <strong className="grow">{r.name}</strong>
              <button
                className="link"
                onClick={(e) => {
                  e.stopPropagation();
                  setEdit({ parentId: r.id });
                }}
              >
                + Sub
              </button>
            </div>
            <ul>
              {s.categories
                .filter((c) => c.parentId === r.id)
                .map((c) => (
                  <li key={c.id} className="row clickable sub" onClick={() => setEdit({ cat: c, parentId: r.id })}>
                    {c.name}
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
      {edit && <CategoryForm s={s} kind={kind} cat={edit.cat} parentId={edit.parentId} onClose={() => setEdit(null)} />}
    </section>
  );
}

function CategoryForm({ s, kind, cat, parentId, onClose }: { s: Store; kind: CatKind; cat?: Category; parentId: string | null; onClose: () => void }) {
  const parent = parentId ? s.catById.get(parentId) : undefined;
  const [name, setName] = useState(cat?.name ?? '');
  const [icon, setIcon] = useState(cat?.icon ?? parent?.icon ?? '📁');
  const [color, setColor] = useState(cat?.color ?? parent?.color ?? PALETTE[0]);
  const [err, setErr] = useState('');
  const submit = async () => {
    if (!name.trim()) return setErr('Escribe un nombre.');
    await save<Category>('categories', { id: cat?.id, name: name.trim(), kind: cat?.kind ?? kind, parentId, icon, color });
    if (cat && !parentId) {
      // Las subcategorías heredan el color del padre
      const kids = s.categories.filter((c) => c.parentId === cat.id);
      for (const k of kids) await save<Category>('categories', { id: k.id, color });
    }
    onClose();
  };
  const remove = async () => {
    if (!cat) return;
    const kids = s.categories.filter((c) => c.parentId === cat.id);
    const used = s.txs.filter((t) => t.categoryId === cat.id || kids.some((k) => k.id === t.categoryId)).length;
    const msg = used ? `Hay ${used} movimientos con esta categoría; quedarán como "Sin categoría". ¿Eliminarla?` : '¿Eliminar esta categoría?';
    if (!confirm(msg)) return;
    await db.transaction('rw', db.categories, db.transactions, db.budgets, async () => {
      const ids = [cat.id, ...kids.map((k) => k.id)];
      for (const id of ids) await softDelete('categories', id);
      const txs = await db.transactions.where('categoryId').anyOf(ids).toArray();
      for (const t of txs) await db.transactions.update(t.id, { categoryId: null, updatedAt: Date.now() });
      const bs = await db.budgets.where('categoryId').anyOf(ids).toArray();
      for (const b of bs) await softDelete('budgets', b.id);
    });
    onClose();
  };
  return (
    <Modal
      title={cat ? 'Editar categoría' : parent ? `Nueva subcategoría de ${parent.name}` : 'Nueva categoría'}
      onClose={onClose}
      footer={
        <>
          {cat && (
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
        <Field label="Nombre">
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        {!parentId && (
          <>
            <Field label="Ícono (un emoji)">
              <input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} />
            </Field>
            <Field label="Color">
              <div className="swatches">
                {PALETTE.map((c) => (
                  <button type="button" key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
                ))}
              </div>
            </Field>
          </>
        )}
        {err && <p className="error">{err}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function BackupCard() {
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const exportAll = async () => {
    const data = {
      app: 'mis-finanzas',
      version: 2,
      debts: await db.debts.toArray(),
      debtPayments: await db.debtPayments.toArray(),
      goals: await db.goals.toArray(),
      goalContributions: await db.goalContributions.toArray(),
      exportedAt: new Date().toISOString(),
      accounts: await db.accounts.toArray(),
      categories: await db.categories.toArray(),
      transactions: await db.transactions.toArray(),
      budgets: await db.budgets.toArray(),
      rates: await db.rates.toArray(),
      settings: await db.settings.toArray(),
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `respaldo-finanzas-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg('Respaldo descargado.');
  };
  const importAll = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      if (data.app !== 'mis-finanzas') throw new Error('formato');
      if (!confirm('Esto reemplaza TODOS los datos de este dispositivo con los del respaldo. ¿Continuar?')) return;
      await db.transaction('rw', [db.accounts, db.categories, db.transactions, db.budgets, db.rates, db.settings, db.debts, db.debtPayments, db.goals, db.goalContributions], async () => {
        for (const t of ['accounts', 'categories', 'transactions', 'budgets', 'rates', 'settings', 'debts', 'debtPayments', 'goals', 'goalContributions'] as const) {
          await db[t].clear();
          await (db[t] as unknown as { bulkAdd: (r: unknown[]) => Promise<unknown> }).bulkAdd(data[t] ?? []);
        }
      });
      setMsg('Respaldo restaurado.');
    } catch {
      setMsg('Ese archivo no es un respaldo válido de Mis Finanzas.');
    }
  };
  return (
    <section className="card">
      <h3>Respaldo</h3>
      <p className="muted small">Con la sincronización tus datos ya están en la nube. Este respaldo es una copia extra que puedes guardar donde quieras.</p>
      <div className="row wrap">
        <button className="btn" onClick={exportAll}>
          Descargar respaldo
        </button>
        <button className="btn" onClick={() => file.current?.click()}>
          Restaurar respaldo
        </button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importAll(e.target.files[0])} />
      </div>
      {msg && <p className="small">{msg}</p>}
    </section>
  );
}
