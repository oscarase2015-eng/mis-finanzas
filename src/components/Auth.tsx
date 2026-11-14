import { useEffect, useState } from 'react';
import { getSyncState, onSyncState, supabase, syncNow, type SyncState } from '../cloud';
import { remember } from '../theme';
import { Field, Modal } from './ui';

const redirectTo = () => window.location.origin + window.location.pathname;

function translate(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'Correo o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Falta confirmar el correo. Revisa tu bandeja de entrada (y la carpeta de spam).';
  if (m.includes('already registered')) return 'Ese correo ya tiene cuenta. Usa "Entrar".';
  if (m.includes('password should be')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (m.includes('rate limit') || m.includes('security purposes')) return 'Demasiados intentos. Espera un minuto y vuelve a intentar.';
  if (m.includes('fetch')) return 'No hay conexión con el servidor. Revisa tu internet.';
  return msg;
}

export function LoginScreen({ onSkip }: { onSkip: () => void }) {
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});

  const submit = async () => {
    if (!supabase) return;
    if (!email.includes('@')) return setMsg({ err: 'Escribe un correo válido.' });
    setBusy(true);
    setMsg({});
    try {
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectTo() });
        if (error) throw error;
        setMsg({ ok: 'Te enviamos un correo con un enlace para crear una contraseña nueva.' });
      } else if (mode === 'up') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectTo() } });
        if (error) throw error;
        if (!data.session) setMsg({ ok: 'Cuenta creada. Abre el correo de confirmación que te enviamos y vuelve aquí para entrar.' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (e) {
      setMsg({ err: translate((e as Error).message) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card card">
        <div className="brand center-brand">
          <svg width={40} height={40} viewBox="0 0 512 512" aria-hidden="true">
            <rect width="512" height="512" rx="112" fill="#0f766e" />
            <rect x="112" y="280" width="64" height="120" rx="12" fill="#ccfbf1" />
            <rect x="224" y="208" width="64" height="192" rx="12" fill="#ccfbf1" />
            <rect x="336" y="128" width="64" height="272" rx="12" fill="#fff" />
          </svg>
          <span>Mis Finanzas</span>
        </div>
        <p className="muted center">{mode === 'up' ? 'Crea tu cuenta para guardar tus datos en la nube y verlos en la PC y el teléfono.' : mode === 'reset' ? 'Te mandamos un enlace para crear una contraseña nueva.' : 'Entra para sincronizar tus datos entre dispositivos.'}</p>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field label="Correo">
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          {mode !== 'reset' && (
            <Field label="Contraseña" hint={mode === 'up' ? 'Mínimo 6 caracteres.' : undefined}>
              <input type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </Field>
          )}
          {msg.err && <p className="error">{msg.err}</p>}
          {msg.ok && <p className="ok-text">{msg.ok}</p>}
          <button className="btn primary block" disabled={busy}>
            {busy ? 'Un momento…' : mode === 'up' ? 'Crear cuenta' : mode === 'reset' ? 'Enviar enlace' : 'Entrar'}
          </button>
        </form>
        <div className="login-links">
          {mode !== 'in' && (
            <button className="link" onClick={() => (setMode('in'), setMsg({}))}>
              Ya tengo cuenta
            </button>
          )}
          {mode !== 'up' && (
            <button className="link" onClick={() => (setMode('up'), setMsg({}))}>
              Crear cuenta
            </button>
          )}
          {mode === 'in' && (
            <button className="link" onClick={() => (setMode('reset'), setMsg({}))}>
              Olvidé mi contraseña
            </button>
          )}
        </div>
        <button
          className="link muted-link"
          onClick={() => {
            remember('skipLogin', '1');
            onSkip();
          }}
        >
          Usar sin cuenta en este dispositivo
        </button>
      </div>
    </div>
  );
}

export function NewPasswordModal({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const submit = async () => {
    const { error } = await supabase!.auth.updateUser({ password });
    if (error) return setErr(translate(error.message));
    onClose();
  };
  return (
    <Modal
      title="Contraseña nueva"
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
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
        <Field label="Contraseña nueva" hint="Mínimo 6 caracteres.">
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </Field>
        {err && <p className="error">{err}</p>}
      </form>
    </Modal>
  );
}

export function useSyncState() {
  const [s, setS] = useState<SyncState>(getSyncState());
  useEffect(() => onSyncState(setS), []);
  return s;
}

function ago(ms: number) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'hace un momento';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
}

export function syncLabel(st: SyncState) {
  switch (st.status) {
    case 'syncing':
      return 'Sincronizando…';
    case 'offline':
      return 'Sin internet: los cambios se guardan aquí y se suben al volver la conexión';
    case 'error':
      return `Error al sincronizar: ${translate(st.error ?? '')}`;
    default:
      return st.lastSync ? `Sincronizado ${ago(st.lastSync)}` : 'Listo para sincronizar';
  }
}

export function AccountCard({ email, onLogin }: { email: string | null; onLogin: () => void }) {
  const st = useSyncState();
  const [, tick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(i);
  }, []);
  if (!supabase) return null;
  return (
    <section className="card">
      <h3>Cuenta y sincronización</h3>
      {email ? (
        <>
          <p>
            Conectado como <strong>{email}</strong>
          </p>
          <p className={`small ${st.status === 'error' ? 'error' : 'muted'}`}>
            <span className={`sync-dot ${st.status}`} /> {syncLabel(st)}
          </p>
          <div className="row wrap">
            <button className="btn" onClick={() => syncNow()} disabled={st.status === 'syncing'}>
              Sincronizar ahora
            </button>
            <button
              className="btn ghost"
              onClick={async () => {
                if (confirm('¿Cerrar sesión? Tus datos se quedan en este dispositivo y en la nube.')) await supabase!.auth.signOut();
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted small">Estás usando la app sin cuenta: tus datos solo están en este dispositivo.</p>
          <button className="btn primary" onClick={onLogin}>
            Entrar o crear cuenta
          </button>
        </>
      )}
    </section>
  );
}
