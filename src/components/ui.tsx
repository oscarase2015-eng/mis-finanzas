import { useEffect, type ReactNode } from 'react';
import type { Store } from '../data';
import type { CatKind, Currency } from '../db';
import { SYMBOL, fmt } from '../money';
import { periodOf, shiftPeriod, today, type Period } from '../dates';

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', k);
      document.body.classList.remove('no-scroll');
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function AmountInput({ value, onChange, currency, autoFocus }: { value: string; onChange: (v: string) => void; currency: Currency; autoFocus?: boolean }) {
  return (
    <div className="amount-input">
      <span>{SYMBOL[currency]}</span>
      <input inputMode="decimal" placeholder="0.00" value={value} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function CategorySelect({ s, kind, value, onChange, allowEmpty, onlyRoots }: { s: Store; kind: CatKind; value: string; onChange: (v: string) => void; allowEmpty?: string; onlyRoots?: boolean }) {
  const roots = s.categories.filter((c) => c.kind === kind && !c.parentId);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {allowEmpty !== undefined && <option value="">{allowEmpty}</option>}
      {roots.map((r) => {
        const kids = onlyRoots ? [] : s.categories.filter((c) => c.parentId === r.id);
        return kids.length ? (
          <optgroup key={r.id} label={`${r.icon} ${r.name}`}>
            <option value={r.id}>{r.name} (general)</option>
            {kids.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </optgroup>
        ) : (
          <option key={r.id} value={r.id}>
            {r.icon} {r.name}
          </option>
        );
      })}
    </select>
  );
}

export function AccountSelect({ s, value, onChange, exclude, allowEmpty }: { s: Store; value: string; onChange: (v: string) => void; exclude?: string; allowEmpty?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {allowEmpty !== undefined && <option value="">{allowEmpty}</option>}
      {s.accounts
        .filter((a) => !a.archived && a.id !== exclude)
        .map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({SYMBOL[a.currency]}) · {fmt(s.balances.get(a.id) ?? 0, a.currency)}
          </option>
        ))}
    </select>
  );
}

export function Progress({ ratio }: { ratio: number }) {
  const cls = ratio >= 1 ? 'over' : ratio >= 0.8 ? 'warn' : 'ok';
  return (
    <div className="progress">
      <div className={`progress-fill ${cls}`} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PeriodNav({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  return (
    <div className="period-nav">
      <Segmented
        value={period.kind}
        options={[
          { value: 'quincena', label: 'Quincena' },
          { value: 'mes', label: 'Mes' },
          { value: 'anio', label: 'Año' },
        ]}
        onChange={(k) => onChange(periodOf(k, today()))}
      />
      <div className="period-step">
        <button className="icon-btn" onClick={() => onChange(shiftPeriod(period, -1))} aria-label="Anterior">
          ‹
        </button>
        <span className="period-label">{period.label}</span>
        <button className="icon-btn" onClick={() => onChange(shiftPeriod(period, 1))} aria-label="Siguiente">
          ›
        </button>
      </div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children}
    </div>
  );
}

export function RateWarning({ s }: { s: Store }) {
  const hasUsd = s.accounts.some((a) => a.currency !== s.main);
  if (s.rate || !hasUsd) return null;
  return (
    <div className="notice">
      Tienes cuentas en otra moneda pero aún no hay tasa de cambio. Agrégala en <a href="#mas">Más › Tasa de cambio</a> para ver los totales completos.
    </div>
  );
}
