# Mis Finanzas

App de finanzas personales en lempiras y dólares. Funciona en la computadora y se instala en Android como app (PWA). Los datos se guardan en el dispositivo, funcionan sin internet y se sincronizan entre dispositivos con Supabase.

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

## Sincronización (Supabase)

1. Crea un proyecto en [Supabase](https://supabase.com) y ejecuta `supabase/schema.sql` en el SQL Editor.
2. Copia `.env.example` como `.env.production` con tu Project URL y anon key.
3. En Authentication → URL Configuration pon como *Site URL* la dirección donde publicas la app.

Todos los datos van en una sola tabla `records` protegida con RLS: cada usuario solo ve lo suyo. Si un registro se edita en dos dispositivos, gana la edición más reciente.

## Publicación

`.github/workflows/deploy.yml` compila y publica en GitHub Pages en cada push a `main`. Activa Pages en Settings → Pages → Source: GitHub Actions.

## Estructura

- `src/db.ts`: base de datos local (Dexie / IndexedDB) y tipos.
- `src/data.ts`: saldos, totales y conversiones.
- `src/cloud.ts`: inicio de sesión y sincronización con Supabase.
- `src/money.ts`, `src/dates.ts`: formato de montos, quincenas y meses.
- `src/pages/`: Inicio, Movimientos, Cuentas, Presupuestos, Más.
- `src/components/`: formulario de movimientos y piezas comunes.

Los montos se guardan en centavos enteros. Cada registro tiene `id`, `createdAt`, `updatedAt` y `deleted` para la sincronización futura con Supabase.
