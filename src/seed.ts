import { db, stamp, type Category, type CatKind } from './db';

const PALETTE = ['#0f766e', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#059669', '#0891b2', '#65a30d', '#ea580c', '#4f46e5', '#64748b'];

const GASTOS: [string, string, string[]][] = [
  ['Alimentación', '🛒', ['Supermercado', 'Mercado', 'Restaurantes', 'Comida rápida', 'Café y snacks']],
  ['Vivienda', '🏠', ['Alquiler', 'Hipoteca', 'Mantenimiento', 'Artículos del hogar']],
  ['Servicios', '💡', ['ENEE (luz)', 'Agua', 'Hondutel / teléfono fijo', 'Internet', 'Celular', 'Cable y streaming', 'Gas']],
  ['Transporte', '🚗', ['Combustible', 'Taxi / bus / Uber', 'Mantenimiento del vehículo', 'Seguro del vehículo', 'Matrícula', 'Estacionamiento']],
  ['Salud', '🩺', ['Consultas médicas', 'Medicinas', 'Seguro médico', 'Exámenes', 'Dentista']],
  ['Educación', '🎓', ['Colegiatura', 'Útiles y uniformes', 'Cursos', 'Libros']],
  ['Personal', '👕', ['Ropa y calzado', 'Cuidado personal', 'Gimnasio']],
  ['Entretenimiento', '🎬', ['Salidas', 'Viajes', 'Pasatiempos', 'Suscripciones']],
  ['Familia', '👨‍👩‍👧', ['Remesas enviadas', 'Apoyo familiar', 'Hijos', 'Mascotas']],
  ['Finanzas', '🏦', ['Comisiones bancarias', 'Intereses pagados', 'Impuestos', 'Seguros de vida']],
  ['Regalos y donaciones', '🎁', ['Regalos', 'Iglesia / ofrendas', 'Donaciones']],
  ['Otros gastos', '📦', []],
];

const INGRESOS: [string, string, string[]][] = [
  ['Salario', '💼', ['Quincena', 'Horas extra']],
  ['Aguinaldo y décimo cuarto', '🎉', []],
  ['Remesas recibidas', '💸', []],
  ['Negocio y ventas', '🏪', []],
  ['Intereses y rendimientos', '📈', []],
  ['Alquileres cobrados', '🔑', []],
  ['Reembolsos', '↩️', []],
  ['Otros ingresos', '➕', []],
];

export async function seedIfEmpty() {
  const n = await db.categories.count();
  if (n > 0) return;
  const rows: Category[] = [];
  const add = (list: [string, string, string[]][], kind: CatKind, offset: number) => {
    list.forEach(([name, icon, subs], i) => {
      const color = PALETTE[(i + offset) % PALETTE.length];
      const parent = stamp({ name, kind, parentId: null, color, icon }) as Category;
      rows.push(parent);
      subs.forEach((s) => rows.push(stamp({ name: s, kind, parentId: parent.id, color, icon }) as Category));
    });
  };
  add(GASTOS, 'gasto', 0);
  add(INGRESOS, 'ingreso', 6);
  await db.transaction('rw', db.categories, db.settings, async () => {
    await db.categories.bulkAdd(rows);
    await db.settings.put({ key: 'mainCurrency', value: 'HNL' });
  });
}

export { PALETTE };
