import Dexie, { type EntityTable } from 'dexie';

export type Currency = 'HNL' | 'USD';
export type AccountType = 'banco' | 'efectivo' | 'tarjeta' | 'ahorro' | 'billetera';
export type TxType = 'gasto' | 'ingreso' | 'transferencia';
export type CatKind = 'gasto' | 'ingreso';

/** Campos comunes para la sincronización futura (paso 3). */
interface Base {
  id: string;
  createdAt: number;
  updatedAt: number;
  deleted: 0 | 1;
}

export interface Account extends Base {
  name: string;
  type: AccountType;
  currency: Currency;
  /** Saldo inicial en centavos. En tarjetas, una deuda es negativa. */
  initialBalance: number;
  color: string;
  archived: 0 | 1;
  /** Solo tarjetas: límite en centavos. */
  creditLimit?: number;
  /** Últimos 4 dígitos de la tarjeta, para reconocer las notificaciones del banco */
  cardLast4?: string;
}

export interface Category extends Base {
  name: string;
  kind: CatKind;
  parentId: string | null;
  color: string;
  icon: string;
}

export interface Transaction extends Base {
  type: TxType;
  /** Fecha local YYYY-MM-DD */
  date: string;
  /** Monto en centavos, siempre positivo, en la moneda de la cuenta. */
  amount: number;
  accountId: string;
  categoryId: string | null;
  note: string;
  tags: string[];
  /** Solo transferencias */
  toAccountId?: string | null;
  /** Solo transferencias: monto que entra, en la moneda de la cuenta destino. */
  toAmount?: number | null;
}

export interface Budget extends Base {
  categoryId: string;
  amount: number;
  currency: Currency;
}

export interface Rate extends Base {
  date: string;
  /** Lempiras por 1 dólar */
  usdToHnl: number;
  /** 'auto' si la trajo la app de internet */
  source?: 'auto' | 'manual';
}

export type DebtDirection = 'debo' | 'me_deben';

export interface Debt extends Base {
  name: string;
  /** A quién se le debe (o quién te debe) */
  person: string;
  direction: DebtDirection;
  currency: Currency;
  /** Monto total de la deuda en centavos (editable) */
  total: number;
  startDate: string;
  /** Fecha límite opcional para terminar de pagar */
  dueDate?: string | null;
  /** Tasa de interés anual en %, solo informativa */
  rate?: number | null;
  /** Cuota acordada en centavos (opcional) */
  installment?: number | null;
  note: string;
  color: string;
}

export interface DebtPayment extends Base {
  debtId: string;
  date: string;
  amount: number;
  note: string;
  /** Movimiento creado en una cuenta, si el abono se registró también como gasto o ingreso */
  txId?: string | null;
}

export interface Goal extends Base {
  name: string;
  icon: string;
  color: string;
  currency: Currency;
  /** Monto objetivo en centavos */
  target: number;
  targetDate?: string | null;
  note: string;
  /** 1 cuando el usuario lo marca como logrado/archivado */
  archived: 0 | 1;
}

export interface GoalContribution extends Base {
  goalId: string;
  date: string;
  /** Centavos; negativo si es un retiro */
  amount: number;
  note: string;
  /** Ahorro que ya existía al crear el objetivo; no cuenta para el ritmo */
  initial?: boolean;
}

/** Gasto o ingreso detectado automáticamente (por ejemplo en un correo del banco), pendiente de confirmar */
export interface InboxItem extends Base {
  source: string;
  date: string;
  /** Centavos, positivo */
  amount: number;
  currency: Currency;
  type: 'gasto' | 'ingreso';
  merchant: string;
  cardLast4?: string | null;
  /** Texto original resumido, para revisar */
  raw?: string;
  status: 'pendiente' | 'registrado' | 'descartado';
  txId?: string | null;
}

export interface Setting {
  key: string;
  value: unknown;
  /** Hora de la última edición (ms). Las claves que empiezan con "_" no se sincronizan. */
  updatedAt?: number;
}

export const db = new Dexie('mis-finanzas') as Dexie & {
  accounts: EntityTable<Account, 'id'>;
  categories: EntityTable<Category, 'id'>;
  transactions: EntityTable<Transaction, 'id'>;
  budgets: EntityTable<Budget, 'id'>;
  rates: EntityTable<Rate, 'id'>;
  settings: EntityTable<Setting, 'key'>;
  debts: EntityTable<Debt, 'id'>;
  debtPayments: EntityTable<DebtPayment, 'id'>;
  goals: EntityTable<Goal, 'id'>;
  goalContributions: EntityTable<GoalContribution, 'id'>;
  inbox: EntityTable<InboxItem, 'id'>;
};

db.version(1).stores({
  accounts: 'id, type, archived, deleted, updatedAt',
  categories: 'id, kind, parentId, deleted, updatedAt',
  transactions: 'id, date, accountId, toAccountId, categoryId, type, deleted, updatedAt',
  budgets: 'id, categoryId, deleted, updatedAt',
  rates: 'id, date, deleted, updatedAt',
  settings: 'key',
});

db.version(2).stores({
  debts: 'id, deleted, updatedAt',
  debtPayments: 'id, debtId, date, deleted, updatedAt',
  goals: 'id, deleted, updatedAt',
  goalContributions: 'id, goalId, date, deleted, updatedAt',
});

db.version(3).stores({
  inbox: 'id, status, date, deleted, updatedAt',
});

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export function stamp<T extends object>(obj: T): T & Base {
  const now = Date.now();
  const o = obj as Partial<Base>;
  return { ...obj, id: o.id || uid(), createdAt: now, updatedAt: now, deleted: 0 } as T & Base;
}

type Table = 'accounts' | 'categories' | 'transactions' | 'budgets' | 'rates' | 'debts' | 'debtPayments' | 'goals' | 'goalContributions' | 'inbox';

export async function save<T extends Base>(table: Table, obj: Partial<T> & { id?: string }) {
  const t = db[table] as unknown as EntityTable<Base, 'id'>;
  if (obj.id && (await t.get(obj.id))) {
    await t.update(obj.id, { ...obj, updatedAt: Date.now() } as never);
    return obj.id;
  }
  const rec = stamp(obj as object);
  await t.add(rec as Base);
  return rec.id;
}

export async function softDelete(table: Table, id: string) {
  const t = db[table] as unknown as EntityTable<Base, 'id'>;
  await t.update(id, { deleted: 1, updatedAt: Date.now() } as never);
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const s = await db.settings.get(key);
  return s ? (s.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value, updatedAt: Date.now() });
}

/** Tablas que se sincronizan con la nube */
export const SYNC_TABLES = ['accounts', 'categories', 'transactions', 'budgets', 'rates', 'settings', 'debts', 'debtPayments', 'goals', 'goalContributions', 'inbox'] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];
