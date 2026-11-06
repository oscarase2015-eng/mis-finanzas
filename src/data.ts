import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Account, type Budget, type Category, type Currency, type Rate, type Transaction } from './db';
import { convert } from './money';

export interface Store {
  ready: boolean;
  accounts: Account[];
  categories: Category[];
  txs: Transaction[];
  budgets: Budget[];
  rates: Rate[];
  rate: number | null;
  main: Currency;
  catById: Map<string, Category>;
  accById: Map<string, Account>;
  balances: Map<string, number>;
}

export function useStore(): Store {
  const data = useLiveQuery(async () => {
    const [accounts, categories, txs, budgets, rates, mainS] = await Promise.all([
      db.accounts.where('deleted').equals(0).toArray(),
      db.categories.where('deleted').equals(0).toArray(),
      db.transactions.where('deleted').equals(0).toArray(),
      db.budgets.where('deleted').equals(0).toArray(),
      db.rates.where('deleted').equals(0).toArray(),
      db.settings.get('mainCurrency'),
    ]);
    return { accounts, categories, txs, budgets, rates, main: (mainS?.value as Currency) ?? 'HNL' };
  }, []);

  const accounts = data?.accounts ?? [];
  const categories = (data?.categories ?? []).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const txs = (data?.txs ?? []).sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
  const rates = (data?.rates ?? []).sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
  const balances = new Map<string, number>();
  for (const a of accounts) balances.set(a.id, a.initialBalance);
  for (const t of txs) {
    const add = (id: string | null | undefined, v: number) => id && balances.has(id) && balances.set(id, balances.get(id)! + v);
    if (t.type === 'ingreso') add(t.accountId, t.amount);
    else if (t.type === 'gasto') add(t.accountId, -t.amount);
    else {
      add(t.accountId, -t.amount);
      add(t.toAccountId, t.toAmount ?? t.amount);
    }
  }
  return {
    ready: !!data,
    accounts: accounts.sort((a, b) => a.name.localeCompare(b.name, 'es')),
    categories,
    txs,
    budgets: data?.budgets ?? [],
    rates,
    rate: rates[0]?.usdToHnl ?? null,
    main: data?.main ?? 'HNL',
    catById: new Map(categories.map((c) => [c.id, c])),
    accById: new Map(accounts.map((a) => [a.id, a])),
    balances,
  };
}

/** Categoría raíz (padre) de una categoría */
export function rootCat(s: Store, id: string | null | undefined): Category | undefined {
  if (!id) return undefined;
  let c = s.catById.get(id);
  while (c?.parentId) {
    const p = s.catById.get(c.parentId);
    if (!p) break;
    c = p;
  }
  return c;
}

export function catLabel(s: Store, id: string | null | undefined) {
  if (!id) return 'Sin categoría';
  const c = s.catById.get(id);
  if (!c) return 'Sin categoría';
  const p = c.parentId ? s.catById.get(c.parentId) : undefined;
  return p ? `${p.name} › ${c.name}` : c.name;
}

/** Suma ingresos/gastos de un rango convertidos a la moneda indicada */
export function totals(s: Store, start: string, end: string, to: Currency = s.main) {
  let income = 0;
  let expense = 0;
  let missingRate = false;
  for (const t of s.txs) {
    if (t.date < start || t.date > end || t.type === 'transferencia') continue;
    const acc = s.accById.get(t.accountId);
    if (!acc) continue;
    const v = convert(t.amount, acc.currency, to, s.rate);
    if (v === null) {
      missingRate = true;
      continue;
    }
    if (t.type === 'ingreso') income += v;
    else expense += v;
  }
  return { income, expense, net: income - expense, missingRate };
}

export function netWorth(s: Store, to: Currency = s.main) {
  let total = 0;
  let missingRate = false;
  const byCur: Record<Currency, number> = { HNL: 0, USD: 0 };
  for (const a of s.accounts) {
    if (a.archived) continue;
    const b = s.balances.get(a.id) ?? 0;
    byCur[a.currency] += b;
    const v = convert(b, a.currency, to, s.rate);
    if (v === null) missingRate = true;
    else total += v;
  }
  return { total, byCur, missingRate };
}

/** Gasto convertido por categoría raíz en un rango */
export function expenseByRoot(s: Store, start: string, end: string, to: Currency = s.main) {
  const map = new Map<string, number>();
  for (const t of s.txs) {
    if (t.type !== 'gasto' || t.date < start || t.date > end) continue;
    const acc = s.accById.get(t.accountId);
    if (!acc) continue;
    const v = convert(t.amount, acc.currency, to, s.rate);
    if (v === null) continue;
    const key = rootCat(s, t.categoryId)?.id ?? '_none';
    map.set(key, (map.get(key) ?? 0) + v);
  }
  return map;
}

/** IDs de una categoría y todas sus subcategorías */
export function catFamily(s: Store, id: string) {
  const ids = new Set([id]);
  for (const c of s.categories) if (c.parentId === id) ids.add(c.id);
  return ids;
}
