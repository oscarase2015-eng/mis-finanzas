import { useEffect, useState } from 'react';
import { useStore } from './data';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Accounts from './pages/Accounts';
import Budgets from './pages/Budgets';
import More from './pages/More';
import Debts from './pages/Debts';
import Goals from './pages/Goals';
import Investments from './pages/Investments';
import Inbox from './pages/Inbox';
import Cards from './pages/Cards';
import TxForm from './components/TxForm';
import type { Transaction } from './db';
import type { Session } from '@supabase/supabase-js';
import { startCloud, supabase } from './cloud';
import { LoginScreen, NewPasswordModal, syncLabel, useSyncState } from './components/Auth';
import { remember } from './theme';

export type Page = 'inicio' | 'movimientos' | 'cuentas' | 'presupuestos' | 'tarjetas' | 'deudas' | 'objetivos' | 'inversiones' | 'revisar' | 'mas';

const ICONS: Record<Page, string> = {
  inicio: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  movimientos: 'M4 6h16M4 12h16M4 18h10',
  cuentas: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M7 15h4',
  presupuestos: 'M12 3a9 9 0 1 0 9 9h-9zM15 3.5A9 9 0 0 1 20.5 9H15z',
  tarjetas: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 9.5h18M3 12.5h18M6.5 16h3',
  revisar: 'M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h5l1 2h4l1-2h5',
  deudas: 'M12 3v18M17 7.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2.2 2.8 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3',
  objetivos: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  inversiones: 'M3 17l6-6 4 4 8-8M15 7h6v6',
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
  { id: 'tarjetas', label: 'Tarjetas' },
  { id: 'revisar', label: 'Por revisar' },
  { id: 'deudas', label: 'Deudas' },
  { id: 'objetivos', label: 'Objetivos' },
  { id: 'inversiones', label: 'Inversiones' },
  { id: 'mas', label: 'Más' },
];
const BOTTOM: Page[] = ['inicio', 'movimientos', 'cuentas', 'presupuestos', 'mas'];

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
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);
  const [skipLogin, setSkipLogin] = useState(() => remember('skipLogin') === '1');
  const [recovery, setRecovery] = useState(false);
  const sync = useSyncState();

  useEffect(() => {
    startCloud(
      (s) => {
        setSession(s);
        if (s) {
          remember('skipLogin', '0');
          setSkipLogin(false);
        }
      },
      () => setRecovery(true),
    );
  }, []);

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

  if (!store.ready || session === undefined) return <div className="loading">Cargando…</div>;
  if (supabase && !session && !skipLogin) return <LoginScreen onSkip={() => setSkipLogin(true)} />;

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">
          <svg width={28} height={28} viewBox="0 0 512 512" aria-hidden="true">
            <rect width="512" height="512" rx="112" fill="#000000" />
            <rect x="112" y="280" width="64" height="120" rx="12" fill="#ccfbf1" />
            <rect x="224" y="208" width="64" height="192" rx="12" fill="#ccfbf1" />
            <rect x="336" y="128" width="64" height="272" rx="12" fill="#d71921" />
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
            {n.id === 'revisar' && store.inbox.length > 0 && <span className="count">{store.inbox.length}</span>}
          </button>
        ))}
        {session && (
          <p className={`side-sync small ${sync.status}`}>
            <span className={`sync-dot ${sync.status}`} /> {syncLabel(sync)}
          </p>
        )}
      </nav>

      <main className="content">
        {route.page === 'inicio' && <Dashboard s={store} nav={nav} />}
        {route.page === 'movimientos' && <Transactions s={store} nav={nav} accountFilter={route.account} />}
        {route.page === 'cuentas' && <Accounts s={store} nav={nav} />}
        {route.page === 'presupuestos' && <Budgets s={store} />}
        {route.page === 'tarjetas' && <Cards s={store} nav={nav} />}
        {route.page === 'revisar' && <Inbox s={store} />}
        {route.page === 'deudas' && <Debts s={store} />}
        {route.page === 'objetivos' && <Goals s={store} />}
        {route.page === 'inversiones' && <Investments s={store} />}
        {route.page === 'mas' && (
          <More
            s={store}
            email={session?.user.email ?? null}
            onLogin={() => {
              remember('skipLogin', '0');
              setSkipLogin(false);
            }}
          />
        )}
      </main>

      <button className="fab" aria-label="Nuevo movimiento" onClick={() => nav.newTx()}>
        +
      </button>

      <nav className="bottombar">
        {NAV.filter((n) => BOTTOM.includes(n.id)).map((n) => (
          <button key={n.id} className={route.page === n.id || (n.id === 'mas' && (route.page === 'deudas' || route.page === 'objetivos' || route.page === 'inversiones' || route.page === 'revisar' || route.page === 'tarjetas')) ? 'active' : ''} onClick={() => nav.go(n.id)}>
            <Icon id={n.id} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      {recovery && <NewPasswordModal onClose={() => setRecovery(false)} />}
      {txModal && <TxForm s={store} tx={txModal.tx} preset={txModal.preset} onClose={() => setTxModal(null)} />}
    </div>
  );
}
