# Mis Finanzas

App de finanzas personales en lempiras y dólares. Funciona en la computadora y se instala en Android como app (PWA). Los datos se guardan en el dispositivo y funcionan sin internet. La sincronización entre dispositivos llega en la siguiente versión.

## Qué incluye la versión 1

- Cuentas: banco, efectivo, tarjeta de crédito (con límite y disponible), ahorro y billetera digital, cada una en L o US$.
- Movimientos: gastos, ingresos y transferencias. Las transferencias entre lempiras y dólares calculan la tasa usada.
- Categorías con subcategorías (lista para Honduras, editable).
- Presupuestos mensuales por categoría, con avisos al 80 % y 100 % y el gasto de cada quincena.
- Panel: patrimonio total, ingresos y gastos por quincena (1 y 15), mes o año, gasto por categoría y los últimos 6 meses.
- Tasa de cambio con historial; moneda principal configurable.
- Buscar y filtrar movimientos, exportarlos a CSV (abre en Excel).
- Respaldo completo en JSON (descargar y restaurar), tema claro u oscuro.

## Cómo usarlo en tu computadora

Necesitas [Node.js](https://nodejs.org) 20 o más reciente.

```bash
npm install
npm run dev        # abre http://localhost:5173
npm run build      # genera la app lista para publicar en dist/
```

## Estructura

- `src/db.ts`: base de datos local (Dexie / IndexedDB) y tipos.
- `src/data.ts`: saldos, totales y conversiones.
- `src/money.ts`, `src/dates.ts`: formato de montos, quincenas y meses.
- `src/pages/`: Inicio, Movimientos, Cuentas, Presupuestos, Más.
- `src/components/`: formulario de movimientos y piezas comunes.

Los montos se guardan en centavos enteros. Cada registro tiene `id`, `createdAt`, `updatedAt` y `deleted` para la sincronización futura con Supabase.
