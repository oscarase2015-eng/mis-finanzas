import { useState } from 'react';
import { goalStatus, type Store } from '../data';
import { save, softDelete, type Currency, type Goal, type GoalContribution } from '../db';
import { shortDate, today } from '../dates';
import { centsToInput, convert, fmt, parseAmount } from '../money';
import { PALETTE } from '../seed';
import { AmountInput, Empty, Field, Modal, Progress, Segmented } from '../components/ui';
import { Glyph, GlyphPicker } from '../components/Icons';


function months(n: number) {
  if (n < 1) return 'menos de 1 mes';
  const m = Math.ceil(n);
  if (m < 12) return `${m} ${m === 1 ? 'mes' : 'meses'}`;
  const y = Math.floor(m / 12);
  const r = m % 12;
  return `${y} ${y === 1 ? 'año' : 'años'}${r ? ` y ${r} ${r === 1 ? 'mes' : 'meses'}` : ''}`;
}

export default function Goals({ s }: { s: Store }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Goal | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const t = today();
  const open = openId ? s.goals.find((g) => g.id === openId) : undefined;
  if (open) return <GoalDetail s={s} goal={open} onBack={() => setOpenId(null)} />;

  const rows = s.goals.map((g) => ({ g, st: goalStatus(s, g, t) }));
  const active = rows.filter((r) => !r.g.archived);
  const archived = rows.filter((r) => r.g.archived);
  let saved = 0;
  let target = 0;
  let perMonth = 0;
  for (const r of active) {
    saved += convert(r.st.saved, r.g.currency, s.main, s.rate) ?? 0;
    target += convert(r.g.target, r.g.currency, s.main, s.rate) ?? 0;
    perMonth += convert(r.st.perMonth, r.g.currency, s.main, s.rate) ?? 0;
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Objetivos</h1>
        <button className="btn primary" onClick={() => setEdit('new')}>
          + Nuevo objetivo
        </button>
      </div>

      {s.goals.length === 0 ? (
        <Empty title="Sin objetivos todavía">
          <p>Crea un objetivo para cada cosa por la que ahorras: fondo de emergencia, carro, viaje, casa… Anota cuánto le pones a cada uno y la app te dice cuánto falta, tu progreso y cuánto ahorrar por mes o por quincena para llegar a tiempo.</p>
          <button className="btn primary" onClick={() => setEdit('new')}>
            Crear objetivo
          </button>
        </Empty>
      ) : (
        <>
          <div className="stats">
            <div className="card stat">
              <p className="muted">Ahorrado en objetivos</p>
              <p className="stat-v pos">{fmt(saved, s.main)}</p>
            </div>
            <div className="card stat">
              <p className="muted">Falta para todos</p>
              <p className="stat-v">{fmt(Math.max(0, target - saved), s.main)}</p>
            </div>
            <div className="card stat">
              <p className="muted">Ritmo de ahorro</p>
              <p className="stat-v">{fmt(perMonth, s.main)} / mes</p>
            </div>
          </div>
          <div className="goal-grid">
            {active.map(({ g, st }) => (
              <GoalCard key={g.id} g={g} st={st} onClick={() => setOpenId(g.id)} />
            ))}
          </div>
          {archived.length > 0 && (
            <>
              <button className="link" onClick={() => setShowArchived(!showArchived)}>
                {showArchived ? 'Ocultar' : 'Ver'} objetivos logrados ({archived.length})
              </button>
              {showArchived && (
                <div className="goal-grid">
                  {archived.map(({ g, st }) => (
                    <GoalCard key={g.id} g={g} st={st} onClick={() => setOpenId(g.id)} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
      {edit && (
        <GoalForm
          s={s}
          goal={edit === 'new' ? undefined : edit}
          onClose={(id) => {
            setEdit(null);
            if (id && edit === 'new') setOpenId(id);
          }}
        />
      )}
    </div>
  );
}

function GoalCard({ g, st, onClick }: { g: Goal; st: ReturnType<typeof goalStatus>; onClick: () => void }) {
  return (
    <div className={`card goal clickable ${g.archived ? 'archived' : ''}`} onClick={onClick} style={{ borderTopColor: g.color }}>
      <div className="row">
        <span className="tx-icon" style={{ background: `${g.color}22` }}>
          <Glyph name={g.icon} />
        </span>
        <strong className="grow">{g.name}</strong>
        <strong>{Math.round(st.ratio * 100)} %</strong>
      </div>
      <p className="big">{fmt(st.saved, g.currency)}</p>
      <p className="muted small">de {fmt(g.target, g.currency)}</p>
      <Progress ratio={st.ratio} good />
      <p className="small">{st.done ? <span className="pos">¡Objetivo alcanzado!</span> : <>Faltan <b>{fmt(st.left, g.currency)}</b></>}</p>
      {!st.done && st.neededPerMonth ? (
        <p className="muted small">
          Para el {shortDate(g.targetDate!)}: {fmt(st.neededPerMonth, g.currency)} / mes
        </p>
      ) : !st.done && st.perMonth > 0 ? (
        <p className="muted small">Ahorras ~{fmt(st.perMonth, g.currency)} / mes</p>
      ) : null}
    </div>
  );
}

function GoalDetail({ s, goal, onBack }: { s: Store; goal: Goal; onBack: () => void }) {
  const [edit, setEdit] = useState(false);
  const [contrib, setContrib] = useState<{ c?: GoalContribution; withdraw?: boolean } | null>(null);
  const st = goalStatus(s, goal, today());
  const onTrack = st.neededPerMonth !== null ? st.perMonth >= st.neededPerMonth : null;

  return (
    <div className="page">
      <button className="link back" onClick={onBack}>
        ‹ Objetivos
      </button>
      <div className="page-head">
        <h1>
          {goal.name}
        </h1>
        <div className="row wrap">
          <button className="btn" onClick={() => setEdit(true)}>
            Editar
          </button>
          <button className="btn" onClick={() => setContrib({ withdraw: true })}>
            − Retirar
          </button>
          <button className="btn primary" onClick={() => setContrib({})}>
            + Aportar
          </button>
        </div>
      </div>

      <section className="card">
        <div className="row wrap">
          <div className="grow">
            <p className="muted">Ahorrado</p>
            <p className="big pos">{fmt(st.saved, goal.currency)}</p>
          </div>
          <div className="right">
            <p className="muted">Progreso</p>
            <p className="big">{Math.round(st.ratio * 100)} %</p>
          </div>
        </div>
        <Progress ratio={st.ratio} good />
        <dl className="facts">
          <div>
            <dt>Meta</dt>
            <dd>{fmt(goal.target, goal.currency)}</dd>
          </div>
          <div>
            <dt>Falta</dt>
            <dd>{fmt(st.left, goal.currency)}</dd>
          </div>
          <div>
            <dt>Ritmo actual</dt>
            <dd>{st.perMonth > 0 ? `${fmt(st.perMonth, goal.currency)} / mes` : 'Sin aportes recientes'}</dd>
          </div>
          {goal.targetDate ? (
            <div>
              <dt>Fecha meta</dt>
              <dd>{shortDate(goal.targetDate)}</dd>
            </div>
          ) : null}
          {st.neededPerMonth ? (
            <>
              <div>
                <dt>Necesitas por mes</dt>
                <dd>{fmt(st.neededPerMonth, goal.currency)}</dd>
              </div>
              <div>
                <dt>Por quincena</dt>
                <dd>{fmt(Math.ceil(st.neededPerMonth / 2), goal.currency)}</dd>
              </div>
            </>
          ) : null}
          {st.etaMonths !== null && !st.done ? (
            <div>
              <dt>A este ritmo lo logras en</dt>
              <dd>{months(st.etaMonths)}</dd>
            </div>
          ) : null}
        </dl>
        {onTrack !== null && !st.done && (
          <p className={`small ${onTrack ? 'pos' : 'warn-text'}`}>{onTrack ? 'Vas a buen ritmo para llegar a la fecha.' : `A tu ritmo actual no llegas a la fecha: te faltan ${fmt(st.neededPerMonth! - st.perMonth, goal.currency)} más por mes.`}</p>
        )}
        {st.done && !goal.archived && (
          <div className="notice ok-notice">
            ¡Lo lograste! <button className="link" onClick={() => save<Goal>('goals', { id: goal.id, archived: 1 })}>Marcar como logrado</button>
          </div>
        )}
        {goal.note && <p className="muted small">{goal.note}</p>}
      </section>

      <section className="card">
        <h3>Aportes ({st.contribs.length})</h3>
        {st.contribs.length === 0 ? (
          <p className="muted">Aún no hay aportes. Usa "+ Aportar" cada vez que apartes dinero para este objetivo.</p>
        ) : (
          <ul className="list">
            {st.contribs.map((c) => (
              <li key={c.id} className="row clickable" onClick={() => setContrib({ c })}>
                <span className="grow">
                  <span className="block tx-title">{shortDate(c.date)}</span>
                  {c.note && <span className="muted small">{c.note}</span>}
                </span>
                <span className={`tx-amount ${c.amount < 0 ? 'neg' : 'pos'}`}>{fmt(c.amount, goal.currency, { sign: true })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {edit && (
        <GoalForm
          s={s}
          goal={goal}
          onClose={(id) => {
            setEdit(false);
            if (id === null) onBack();
          }}
        />
      )}
      {contrib && <ContributionForm goal={goal} c={contrib.c} withdraw={contrib.withdraw} onClose={() => setContrib(null)} />}
    </div>
  );
}

function GoalForm({ s, goal, onClose }: { s: Store; goal?: Goal; onClose: (id?: string | null) => void }) {
  const [name, setName] = useState(goal?.name ?? '');
  const [icon, setIcon] = useState(goal?.icon ?? 'target');
  const [currency, setCurrency] = useState<Currency>(goal?.currency ?? s.main);
  const [target, setTarget] = useState(goal ? centsToInput(goal.target) : '');
  const [initial, setInitial] = useState('');
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '');
  const [note, setNote] = useState(goal?.note ?? '');
  const [err, setErr] = useState('');
  const hasContribs = goal ? s.goalContributions.some((c) => c.goalId === goal.id) : false;

  const submit = async () => {
    if (!name.trim()) return setErr('Ponle un nombre, por ejemplo "Fondo de emergencia".');
    const t = parseAmount(target);
    if (!t || t <= 0) return setErr('Escribe cuánto quieres juntar.');
    const ini = initial.trim() ? parseAmount(initial) : 0;
    if (ini === null || ini < 0) return setErr('Lo ya ahorrado no es un número válido.');
    const id = await save<Goal>('goals', {
      id: goal?.id,
      name: name.trim(),
      icon,
      color: goal?.color ?? PALETTE[s.goals.length % PALETTE.length],
      currency,
      target: t,
      targetDate: targetDate || null,
      note: note.trim(),
      archived: goal?.archived ?? 0,
    });
    if (!goal && ini > 0) await save<GoalContribution>('goalContributions', { goalId: id, date: today(), amount: ini, note: 'Ahorro inicial', initial: true });
    onClose(id);
  };

  const remove = async () => {
    if (!goal || !confirm(`¿Eliminar el objetivo "${goal.name}" y sus aportes?`)) return;
    for (const c of s.goalContributions.filter((c) => c.goalId === goal.id)) await softDelete('goalContributions', c.id);
    await softDelete('goals', goal.id);
    onClose(null);
  };

  return (
    <Modal
      title={goal ? 'Editar objetivo' : 'Nuevo objetivo'}
      onClose={() => onClose()}
      footer={
        <>
          {goal && (
            <>
              <button className="btn danger ghost" onClick={remove}>
                Eliminar
              </button>
              <button
                className="btn ghost"
                onClick={async () => {
                  await save<Goal>('goals', { id: goal.id, archived: goal.archived ? 0 : 1 });
                  onClose();
                }}
              >
                {goal.archived ? 'Reactivar' : 'Marcar logrado'}
              </button>
            </>
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
        <Field label="Nombre">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Fondo de emergencia" autoFocus={!goal} />
        </Field>
        <Field label="Ícono">
          <GlyphPicker value={icon} onChange={setIcon} />
        </Field>
        <Field label="Moneda" hint={hasContribs ? 'No se puede cambiar porque ya tiene aportes.' : undefined}>
          <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} disabled={hasContribs}>
            <option value="HNL">Lempiras (L)</option>
            <option value="USD">Dólares (US$)</option>
          </select>
        </Field>
        <Field label="¿Cuánto quieres juntar?">
          <AmountInput value={target} onChange={setTarget} currency={currency} />
        </Field>
        {!goal && (
          <Field label="¿Cuánto llevas ahorrado?" hint="Opcional. Se registra como primer aporte.">
            <AmountInput value={initial} onChange={setInitial} currency={currency} />
          </Field>
        )}
        <Field label="¿Para cuándo? (opcional)" hint="Con una fecha, la app calcula cuánto ahorrar por mes y por quincena.">
          <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </Field>
        <Field label="Nota">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
        </Field>
        {err && <p className="error">{err}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function ContributionForm({ goal, c, withdraw, onClose }: { goal: Goal; c?: GoalContribution; withdraw?: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<'aporte' | 'retiro'>(c ? (c.amount < 0 ? 'retiro' : 'aporte') : withdraw ? 'retiro' : 'aporte');
  const [amount, setAmount] = useState(c ? centsToInput(Math.abs(c.amount)) : '');
  const [date, setDate] = useState(c?.date ?? today());
  const [note, setNote] = useState(c?.note ?? '');
  const [err, setErr] = useState('');
  const submit = async () => {
    const cents = parseAmount(amount);
    if (!cents || cents <= 0) return setErr('Escribe un monto mayor que cero.');
    await save<GoalContribution>('goalContributions', { id: c?.id, goalId: goal.id, date, amount: kind === 'retiro' ? -cents : cents, note: note.trim() });
    onClose();
  };
  return (
    <Modal
      title={c ? 'Editar movimiento del objetivo' : kind === 'retiro' ? 'Retirar del objetivo' : 'Aportar al objetivo'}
      onClose={onClose}
      footer={
        <>
          {c && (
            <button
              className="btn danger ghost"
              onClick={async () => {
                if (confirm('¿Eliminar este aporte?')) {
                  await softDelete('goalContributions', c.id);
                  onClose();
                }
              }}
            >
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
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'aporte', label: 'Aporte' },
            { value: 'retiro', label: 'Retiro' },
          ]}
        />
        <Field label="Monto">
          <AmountInput value={amount} onChange={setAmount} currency={goal.currency} autoFocus={!c} />
        </Field>
        <Field label="Fecha">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Nota">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional, ej.: quincena del 15" />
        </Field>
        {err && <p className="error">{err}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
