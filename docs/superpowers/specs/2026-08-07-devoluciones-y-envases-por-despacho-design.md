# Diseño — Vista de devoluciones y envases por despacho

- **Fecha:** 2026-08-07
- **Rama:** `feature/bodega`
- **Ámbito:** Bodega / Despacho (HU-26, HU-27, HU-28; RF-14, RF-15, RNF-15)
- **Estado:** Aprobado

## Resumen

Correcciones al flujo de devoluciones del frontend y habilitación de registro de
envases (bandejas/cajas) por despacho, que hoy no es posible. El esquema lo tenía
marcado como "pendiente por decisión de alcance" en `triggers_negocio.sql:18-20`.

Cuatro objetivos:

1. Nueva vista dedicada "Devoluciones" tipo plantilla (sin formularios flotantes).
2. Envases por despacho: al registrar un despacho, indicar cuántas bandejas/cajas salen.
3. Descuento de `stock_envases` al despachar (el inventario refleja lo que está en bodega).
4. Historial de devoluciones en Despachos agrupado por despacho.

## Decisiones de diseño acordadas

- Elegibilidad de despacho para devolución: un despacho aparece en la vista de
  devoluciones hasta registrar **ambos** tipos (productos y envases). Estados:
  `Pendiente`, `Productos`, `Envases`, `Completo`.
- Solo los tipos de empaque de categoría `uso_interno` (bandejas/cajas) se pueden
  registrar como "salen en el despacho". La devolución de envases sigue aceptando
  cualquier categoría.
- Al despachar envases, `stock_envases` se descuenta; al devolverlos (estado bueno),
  vuelve a sumar (comportamiento ya existente en `trg_devolucion_envase_insert`).
- La anulación de un despacho revierte también los envases a `stock_envases`.

---

## Sección 1 — Backend: tabla `despacho_envases`

### Esquema (`bd/ondina_schema_supabase.sql`)

Nueva tabla con el mismo patrón de `despacho_detalles` (un ajuste es una fila nueva):

```sql
create table despacho_envases (
    id uuid primary key default gen_random_uuid(),
    despacho_id uuid not null references despachos(id),
    tipo_empaque_id uuid not null references tipos_empaque(id),
    cantidad integer not null check (cantidad > 0),
    es_ajuste boolean not null default false,
    creado_en timestamptz not null default now()
);
```

- `alter table despacho_envases enable row level security;`
- Índice `idx_despacho_envases_despacho on public.despacho_envases (despacho_id)`.
- Eliminar la nota "Pendiente por decisión de alcance: bandejas/cajas" del archivo de
  triggers y actualizar los comentarios de cabecera.

### Trigger (`bd/triggers_negocio.sql`)

`trg_despacho_envase_insert` (AFTER INSERT, por fila), análogo a
`trg_despacho_detalle_insert`:

1. Lee el despacho con `for update`; si `anulado`, `raise exception`.
2. Si `es_ajuste`, valida `ventana_ajuste_minutos` (misma lógica que productos).
3. Verifica `stock_envases` (clave `sucursal_id, tipo_empaque_id`); si no existe o es
   menor a `cantidad`, `raise exception` (stock insuficiente).
4. Descuenta: `stock_envases.cantidad -= new.cantidad`.

Reversión (sección 8): `trg_despacho_anular` agrega un bucle sobre `despacho_envases`
que suma `cantidad` de vuelta a `stock_envases` (respetando la sucursal del despacho).

### RLS (`bd/rls_policies.sql`)

Políticas espejo de `despacho_detalles` (líneas 376-403):

- `despacho_envases_select_despacho`: select según el despacho padre (mismas reglas:
  bodega todos, vendedor solo los suyos, etc.).
- `despacho_envases_insert_bodega`: insert solo bodega/administrador sobre despachos
  de su sucursal.
- `despacho_envases_update_admin`: update solo administrador.

### Auditoría (`bd/auditoria.sql`)

Trigger `fn_auditoria_simple` (INSERT/UPDATE) sobre `despacho_envases`, igual que
`despacho_detalles` (líneas 144-147).

---

## Sección 2 — Frontend: registrar envases en el despacho

### `frontend/src/domains/bodega/types.ts`

Nuevo tipo:

```ts
export interface DespachoEnvase {
  id: string
  despacho_id: string
  tipo_empaque_id: string
  cantidad: number
  es_ajuste: boolean
  creado_en: string
}
```

### `frontend/src/domains/bodega/api.ts`

- `NuevoDespacho` gana `envases: { tipo_empaque_id: string; cantidad: number }[]`.
- `crearDespacho` inserta en `despacho_envases` tras los detalles; si falla, rollback
  (borrar despacho y sus detalles, mismo patrón actual).
- Nuevo `obtenerEnvasesDespacho(despachoIds: string[]): Promise<DespachoEnvase[]>`.

### `frontend/src/types/database.ts`

Registro de `despacho_envases` (Row: `DespachoEnvase`, Insert sin
`id | creado_en | es_ajuste`, Update `Partial`).

### Modal "Nuevo despacho" (`Despachos.tsx`)

- Nueva sección **"Envases del despacho (bandejas/cajas)"** con líneas dinámicas:
  `[select Envase] [input Cant.] [Quitar]` y botón "+ Agregar envase".
- El select de envase filtra `tipos_empaque` por `categoria === 'uso_interno'` y muestra
  el stock disponible (`stockEnvaseDe`).
- Validación antes de enviar: stock suficiente por tipo de empaque (mismo patrón que
  productos); si falla, error sin enviar.
- Sección "Envases despachados" (solo lectura) dentro del despacho expandido, con el
  nombre del tipo de empaque y la cantidad.

---

## Sección 3 — Nueva vista `/devoluciones` (Enfoque A)

### Navegación

- `frontend/src/domains/bodega/pages/Devoluciones.tsx` (nuevo).
- Ícono `RecycleIcon` nuevo en `frontend/src/components/icons.tsx`.
- Registro en `bodega/index.tsx`: nav `{ path: '/devoluciones', label: 'Devoluciones',
  icon: RecycleIcon, roles: ['bodega', 'administrador'] }` y ruta correspondiente.

### Datos

Reutiliza `api.ts`: `obtenerDespachos`, `obtenerDetallesDespacho`,
`obtenerEnvasesDespacho`, `obtenerDevolucionesProducto`, `obtenerDevolucionesEnvase`,
`obtenerStockBodega`, `obtenerStockEnvases`, `obtenerCargaVendedores`,
`registrarDevolucionProductos`, `registrarDevolucionEnvases`.

### Layout de dos paneles

**Panel izquierdo (lista de despachos, ~22rem):** despachos recientes de la sucursal
(máximo 20, mismo límite que Despachos). Cada ítem: avatar, vendedor, fecha, total
unidades y badge de estado. Clic selecciona. Los `Completo` se muestran deshabilitados.

Badges de estado:

- **Pendiente** — sin devoluciones; ambas secciones editables.
- **Productos** — ya devolvió productos; solo envases editables (productos en solo lectura).
- **Envases** — ya devolvió envases; solo productos editables (envases en solo lectura).
- **Completo** — ambas devoluciones; no seleccionable.

**Panel derecho (plantilla del despacho seleccionado):**

- Header: vendedor, fecha, unidades y badge de estado.
- **"Productos del despacho"**: tabla con una fila por producto despachado (agrupando
  `despacho_detalles` por producto, sumando cantidades). Columnas:
  `Producto | Despachado | Carga actual | Devuelve [input]`. `Devuelve ≤ Despachado`.
- **"Envases"**: tabla con una fila por **tipo de empaque activo del catálogo**
  (`tipos_empaque` con `activo = true`). Columnas:
  `Envase | Despachadas | En bodega | Devuelve [input] | Estado [select bueno/malo]`.
  La columna "Despachadas" viene de `despacho_envases` del despacho (será 0 para los
  tipos no despachados; sirve de cuadre para bandejas/cajas). Sin tope en `Devuelve`
  (solo `> 0`), porque los retornables vuelven sin estar en `despacho_envases`.
- Footer: botón primario único **"Registrar devolución"** a ancho completo.

### Flujo de registro

1. Solo se envían los tipos pendientes: si no hay devolución de productos →
   `registrarDevolucionProductos` con las líneas `> 0`; si no hay devolución de envases →
   `registrarDevolucionEnvases`. En secuencia.
2. Éxito → recargar datos y resetear la plantilla (el despacho pasa al estado siguiente).
3. Error → mostrar mensaje en la vista, sin cerrar.

---

## Sección 4 — Página Despachos

- Se elimina el modal de devolución y su estado (`devOpen`, `devTab`, `devLineasProducto`,
  `devLineasEnvase`, `devEnviando`, `devDespachoId`, `registrarDevolucion`, `abrirDevolucion`).
- El botón "Devolución" del header y el botón dentro de cada despacho expandido navegan a
  `/devoluciones` (react-router `useNavigate`/`Link`).
- La **columna lateral** "Devoluciones" se agrupa por despacho: cada despacho con
  devoluciones muestra encabezado (vendedor + fecha) y debajo sus líneas (productos `−X`
  en ámbar, envases `+X` en verde). Orden por fecha más reciente.
- El modal "Nuevo despacho" se mantiene (con la sección de envases de la Sección 2).

---

## Fuera de alcance

- Migraciones versionadas bajo `supabase/migrations/` (no existe aún; los cambios se
  aplican a los `.sql` de `bd/` como es la convención actual del repo).
- Ajustes (sumar envases dentro de la ventana) desde la UI: los triggers soportan
  `es_ajuste`, pero la UI de ajuste no se construye en este trabajo.
- Cuadre global "despachado vs vendido vs devuelto" como reporte dedicado.

## Verificación

- `npm run lint` y `npm run build` en `frontend/`.
- Revisión manual de los cambios SQL (esquema → triggers → auditoría → vistas → seed → RLS).
