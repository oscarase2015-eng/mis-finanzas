import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { db, SYNC_TABLES, type SyncTable } from './db';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Cliente de Supabase, o null si la app se compiló sin configuración de nube */
export const supabase: SupabaseClient | null =
  URL && KEY ? createClient(URL, KEY, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

export type SyncState = { status: 'off' | 'idle' | 'syncing' | 'error' | 'offline'; lastSync: number | null; error?: string };

let state: SyncState = { status: supabase ? 'idle' : 'off', lastSync: null };
const listeners = new Set<(s: SyncState) => void>();
const set = (patch: Partial<SyncState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
};
export const getSyncState = () => state;
export const onSyncState = (fn: (s: SyncState) => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

let session: Session | null = null;
export const getSession = () => session;

const metaKey = (uid: string, k: string) => `_sync:${uid}:${k}`;
async function getMeta(uid: string, k: string) {
  return ((await db.settings.get(metaKey(uid, k)))?.value as number | undefined) ?? 0;
}
async function setMeta(uid: string, k: string, v: number) {
  await db.settings.put({ key: metaKey(uid, k), value: v });
}

interface Row {
  tbl: SyncTable;
  id: string;
  data: Record<string, unknown>;
  updated_at: number;
  deleted: boolean;
  server_at?: string;
}

type AnyRec = { id?: string; key?: string; updatedAt?: number; deleted?: number };
const recId = (t: SyncTable, r: AnyRec) => (t === 'settings' ? r.key! : r.id!);

async function push(uid: string) {
  const mark = await getMeta(uid, 'pushedUpTo');
  let max = mark;
  const rows: Row[] = [];
  for (const t of SYNC_TABLES) {
    const all = (await (db[t] as unknown as { toArray: () => Promise<AnyRec[]> }).toArray()) as AnyRec[];
    for (const r of all) {
      if (t === 'settings' && String(r.key).startsWith('_')) continue;
      const u = r.updatedAt ?? 0;
      // Las categorías iniciales (fecha 0) no se suben: cada dispositivo ya las tiene.
      if (u <= mark || u === 0) continue;
      rows.push({ tbl: t, id: recId(t, r), data: r as Record<string, unknown>, updated_at: u, deleted: !!r.deleted });
      if (u > max) max = u;
    }
  }
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase!.rpc('push_records', { items: rows.slice(i, i + 500) });
    if (error) throw error;
  }
  if (max > mark) await setMeta(uid, 'pushedUpTo', max);
  return rows.length;
}

async function pull(uid: string) {
  const since = await getMeta(uid, 'pulledAt');
  // 5 minutos de margen para no perder escrituras que terminaron tarde
  const from = new Date(Math.max(0, since - 5 * 60_000)).toISOString();
  let newest = since;
  let applied = 0;
  for (let page = 0; ; page++) {
    const { data, error } = await supabase!
      .from('records')
      .select('tbl,id,data,updated_at,deleted,server_at')
      .gt('server_at', from)
      .order('server_at', { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    if (error) throw error;
    const rows = (data ?? []) as Row[];
    for (const t of SYNC_TABLES) {
      const mine = rows.filter((r) => r.tbl === t);
      if (!mine.length) continue;
      const table = db[t] as unknown as { bulkGet: (k: string[]) => Promise<(AnyRec | undefined)[]>; bulkPut: (r: unknown[]) => Promise<unknown> };
      const local = await table.bulkGet(mine.map((r) => r.id));
      const put = mine.filter((r, i) => !local[i] || (local[i]!.updatedAt ?? 0) < r.updated_at).map((r) => r.data);
      if (put.length) {
        await table.bulkPut(put);
        applied += put.length;
      }
    }
    for (const r of rows) newest = Math.max(newest, Date.parse(r.server_at!));
    if (rows.length < 1000) break;
  }
  if (newest > since) await setMeta(uid, 'pulledAt', newest);
  return applied;
}

let running: Promise<void> | null = null;
let again = false;

/** Sube los cambios locales y baja los de la nube. */
export function syncNow(): Promise<void> {
  if (!supabase || !session) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    set({ status: 'offline' });
    return Promise.resolve();
  }
  const uid = session.user.id;
  running = (async () => {
    set({ status: 'syncing', error: undefined });
    try {
      await pull(uid);
      await push(uid);
      set({ status: 'idle', lastSync: Date.now() });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e) });
    } finally {
      running = null;
      if (again) {
        again = false;
        setTimeout(syncNow, 500);
      }
    }
  })();
  return running;
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** Programa una sincronización unos segundos después del último cambio */
export function scheduleSync(ms = 2500) {
  if (!supabase || !session) return;
  clearTimeout(timer);
  timer = setTimeout(syncNow, ms);
}

let started = false;
/** Arranca la escucha de sesión y los disparadores de sincronización */
export function startCloud(onSession: (s: Session | null) => void, onRecovery: () => void) {
  if (!supabase || started) return;
  started = true;
  supabase.auth.getSession().then(({ data }) => {
    session = data.session;
    onSession(session);
    if (session) syncNow();
  });
  supabase.auth.onAuthStateChange((event, s) => {
    const was = session?.user.id;
    session = s;
    onSession(s);
    if (event === 'PASSWORD_RECOVERY') onRecovery();
    if (s && s.user.id !== was) syncNow();
  });
  // Cualquier cambio local programa una sincronización
  for (const t of SYNC_TABLES) {
    const table = db[t] as unknown as { hook: (e: string, fn: (...a: unknown[]) => void) => void };
    const touched = (...a: unknown[]) => {
      const key = String(a[0] ?? '');
      if (!key.startsWith('_')) scheduleSync();
    };
    table.hook('creating', (_k: unknown, obj: unknown) => touched((obj as AnyRec)?.key ?? (obj as AnyRec)?.id));
    table.hook('updating', (_m: unknown, k: unknown) => touched(k));
  }
  window.addEventListener('online', () => syncNow());
  window.addEventListener('offline', () => set({ status: 'offline' }));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && syncNow());
  setInterval(() => document.visibilityState === 'visible' && syncNow(), 60_000);
}
