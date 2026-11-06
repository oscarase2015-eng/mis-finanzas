import { useEffect, useState } from 'react';
import { useStore } from './data';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Accounts from './pages/Accounts';
import Budgets from './pages/Budgets';
import More from './pages/More';
import TxForm from './components/TxForm';
import type { Transaction } from './db';

export type Page = 'inicio' | 'movimientos' | 'cuentas' | 'presupuestos' | 'mas';

const ICONS: Record<Page, string> = {
  inicio: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  movimientos: 'M4 6h16M4 12h16M4 18h10',
  cuentas: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M7 15h4',
  presupuestos: 'M12 3a9 9 0 1 0 9 9h-9zM15 3.5A9 9 0 0 1 20.5 9H15z',
  mas: 'M5 12h.01M12 12h.01M19 12h.01',
};

const Icon = ({ id }: { id: Page }) => (
  <svg className="nav-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={id === 'mas' ? 3.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={ICONS[id]} />
  </svg>
);

const NAV: { id: Page; label: string }[] = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'movimientos', label: 'Movimientos' },
  { id: 'cuentas', label: 'Cuentas' },
  { id: 'presupuestos', label: 'Presupuestos' },
  { id: 'mas', label: 'Más' },
];

function readHash(): { page: Page; account?: string } {
  const h = window.location.hash.replace('#', '');
  const [p, q] = h.split('?');
  const page = (NAV.find((n) => n.id === p)?.id ?? 'inicio') as Page;
  const account = new URLSearchParams(q ?? '').get('cuenta') ?? undefined;
  return { page, account };
}

export interface Nav {
  go: (page: Page, opts?: { account?: string }) => void;
  newTx: (preset?: Partial<Transaction>) => void;
  editTx: (tx: Transaction) => void;
}

export default function App() {
  const store = useStore();
  const [route, setRoute] = useState(readHash);
  const [txModal, setTxModal] = useState<{ tx?: Transaction; preset?: Partial<Transaction> } | null>(null);

  useEffect(() => {
    const on = () => setRoute(readHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const nav: Nav = {
    go: (page, opts) => {
      window.location.hash = opts?.account ? `${page}?cuenta=${opts.account}` : page;
      window.scrollTo(0, 0);
    },
    newTx: (preset) => setTxModal({ preset }),
    editTx: (tx) => setTxModal({ tx }),
  };

  if (!store.ready) return <div className="loading">Cargando…</div>;

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">
          <svg width={28} height={28} viewBox="0 0 512 512" aria-hidden="true">
            <rect width="512" height="512" rx="112" fill="#0f766e" />
            <rect x="112" y="280" width="64" height="120" rx="12" fill="#ccfbf1" />
            <rect x="224" y="208" width="64" height="192" rx="12" fill="#ccfbf1" />
            <rect x="336" y="128" width="64" height="272" rx="12" fill="#fff" />
          </svg>
          <span>Mis Finanzas</span>
        </div>
        <button className="btn primary block" onClick={() => nav.newTx()}>
          + Nuevo movimiento
        </button>
        {NAV.map((n) => (
          <button key={n.id} className={`side-link ${route.page === n.id ? 'active' : ''}`} onClick={() => nav.go(n.id)}>
            <Icon id={n.id} />
            {n.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {route.page === 'inicio' && <Dashboard s={store} nav={nav} />}
        {route.page === 'movimientos' && <Transactions s={store} nav={nav} accountFilter={route.account} />}
        {route.page === 'cuentas' && <Accounts s={store} nav={nav} />}
        {route.page === 'presupuestos' && <Budgets s={store} />}
        {route.page === 'mas' && <More s={store} />}
      </main>

      <button className="fab" aria-label="Nuevo movimiento" onClick={() => nav.newTx()}>
        +
      </button>

      <nav className="bottombar">
        {NAV.map((n) => (
          <button key={n.id} className={route.page === n.id ? 'active' : ''} onClick={() => nav.go(n.id)}>
            <Icon id={n.id} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      {txModal && <TxForm s={store} tx={txModal.tx} preset={txModal.preset} onClose={() => setTxModal(null)} />}
    </div>
  );
}
