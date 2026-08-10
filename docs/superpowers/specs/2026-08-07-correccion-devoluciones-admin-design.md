# Diseño — Corrección de devoluciones por el administrador

- **Fecha:** 2026-08-07
- **Rama:** `feature/bodega`
- **Ámbito:** Bodega / Devoluciones (RF-23 / HU-13 / RNF-13)
- **Estado:** Aprobado

## Resumen

Hoy un despacho en estado `Completo` queda bloqueado para todos los roles: el
botón se deshabilita y `seleccionar()` lo rechaza (`Devoluciones.tsx:240-246`).
El negocio necesita que el administrador pueda corregir una devolución ya
registrada cuando el personal de bodega cometió un error de conteo (ej.: se
registraron 4 unidades pero eran 5).

La corrección **no borra**: anula las filas vigentes (revertiendo stock vía los
triggers 8c/8d existentes) y reinserta las cantidades corregidas. Todo en una
transacción atómica vía RPC. La auditoría queda como trazabilidad.

## Reglas de negocio acordadas

- **Productos:** la cantidad devuelta no puede superar lo despachado (tope
  `sum(despacho_detalles)`). Se aplica por igual a bodega y administrador.
- **Envases:** sin tope superior (los retornables pueden volver aunque no estén
  en `despacho_envases`; a veces los clientes entregan de menos, no importa
  cuadrar). Se aplica a bodega y administrador.
- **Alcance de la corrección:** solo cantidades (productos y envases,
  incluyendo buenos/malos). No se agregan ni quitan líneas de catálogo — se
  cambia el valor registrado.
- **Roles:** bodega solo registra en estados pendientes (`pendiente`/`productos`/
  `envases`). El administrador puede abrir y corregir cualquier despacho,
  incluido `Completo`.
- **Carga del vendedor:** la validación de `carga_vendedor` del trigger
  `trg_devolucion_producto_insert` NO se aplica al administrador (solo se valida
  el tope de despachado). Evita que un despacho con muchas ventas bloquee una
  corrección correcta.
- **Mecanismo:** anular + reinsertar (no `UPDATE` en el lugar), para conservar
  el historial en auditoría.

---

## Sección 1 — Backend: RPC `corregir_devolucion`

### Ubicación

Nuevo RPC en `bd/triggers_negocio.sql` (sección nueva al final, antes de la
activación de triggers) o en un archivo separado `bd/corregir_devolucion.sql` si
el archivo de triggers crece demasiado. Convención: aplicar junto con
`rls_policies.sql` en el orden documentado.

### Firma

```sql
create or replace function public.corregir_devolucion(
    p_despacho_id uuid,
    p_creado_por  uuid,
    p_productos   jsonb,   -- [{producto_id uuid, cantidad int}]
    p_envases     jsonb    -- [{tipo_empaque_id uuid, cantidad int, estado text}]
)
returns void
language plpgsql
security definer
set search_path = public
```

### Lógica

1. **Autorización:** si no `es_rol('administrador')` → `raise exception 'Solo administración'`.
2. **Validación de productos:** por cada línea, `cantidad > 0` y
   `cantidad <= sum(despacho_detalles.cantidad)` del producto para el despacho.
   Si no, `raise exception`.
3. **Validación de envases:** por cada línea, `cantidad > 0` y
   `estado in ('bueno','malo')`. Sin tope superior.
4. **Anular devoluciones vigentes** del despacho:
   ```sql
   update public.devoluciones_productos set anulado = true
   where despacho_id = p_despacho_id and anulado = false;
   update public.devoluciones_envases set anulado = true
   where despacho_id = p_despacho_id and anulado = false;
   ```
   Los triggers 8c/8d (`trg_devolucion_producto_anular`,
   `trg_devolucion_envase_anular`) revierten el stock en esta transición.
5. **Reinsertar** las líneas corregidas insertando en `devoluciones_productos`
   y `devoluciones_envases` (con `creado_por = p_creado_por`). Los triggers de
   INSERT vuelven a mover el stock.
6. Las cantidades `0` no generan fila (línea omitida).

### Nota de implementación (carga del vendedor)

`trg_devolucion_producto_insert` valida `carga_vendedor >= new.cantidad`. Para
que el admin no quede bloqueado por esa regla, se modifica el trigger:

```sql
if not es_rol('administrador') then
    if v_carga is null or v_carga < new.cantidad then
        raise exception 'Carga insuficiente del vendedor para devolver el producto %', new.producto_id;
    end if;
end if;
```

El movimiento de stock del trigger (carga `-`, bodega `+`) se mantiene siempre.

### Auditoría

No requiere cambios: ya existen los triggers `trg_audit_devoluciones_productos`
y `trg_audit_devoluciones_envases` (`auditoria.sql:127-134`) que registran la
anulación (ANULACION) y los nuevos INSERT.

### RLS

El RPC es `security definer` con chequeo explícito de rol. Las políticas de
UPDATE ya restringen a admin (`devoluciones_productos_update_admin` en
`rls_policies.sql:474-478` y la equivalente de envases). No se agregan políticas.

---

## Sección 2 — Frontend: `api.ts`

### Nueva función

```ts
export async function corregirDevolucion(payload: {
  despacho_id: string
  creado_por: string
  lineas_producto: { producto_id: string; cantidad: number }[]
  lineas_envase: { tipo_empaque_id: string; cantidad: number; estado: 'bueno' | 'malo' }[]
}): Promise<{ error: string | null }>
```

Llama `supabase.rpc('corregir_devolucion', {...} as never)` y traduce el error
con `mensajeErrorSupabase`, igual que `crearDespacho` (`api.ts:128-139`).

### Filtro `anulado = false`

Se agrega `.eq('anulado', false)` a `obtenerDevolucionesProducto`
(`api.ts:80-88`) y `obtenerDevolucionesEnvase` (`api.ts:90-98`). Así los totales
mostrados (`devueltoProductoDe`, `devueltoEnvaseBuenoDe`, `devueltoEnvaseMaloDe`)
no suman filas anuladas tras una corrección. Esto también beneficia la columna
"Devoluciones" de `Despachos.tsx`.

---

## Sección 3 — Frontend: `Devoluciones.tsx`

### Selección y bloqueos

- `seleccionar()`: el bloqueo por `completo` aplica solo a no-admin.
  ```ts
  if (!esAdmin && estadoDe(despachoId) === 'completo') return
  ```
- Botón de la lista: `disabled` solo cuando `completo && !esAdmin`.
- `esAdmin = perfil?.rol === 'administrador'` (ya existe el patrón en la página).

### Modo edición

- Al seleccionar un despacho, los inputs de productos y envases se **prellenan**
  con las cantidades vigentes (suma de devoluciones no anuladas) cuando el
  admin edita algo ya registrado.
- Determinación de secciones editables:
  - `productosPendientes = estado === 'pendiente' || estado === 'envases'`
  - `envasesPendientes = estado === 'pendiente' || estado === 'productos'`
  - Edición efectiva: `productosPendientes || (esAdmin && hayProductosRegistrados)`
    (y análogo para envases). Para el admin, un despacho con solo productos
    registrados muestra envases editables y productos editables.
- El texto del botón cambia a **"Guardar corrección"** cuando el admin edita un
  despacho con al menos un registro vigente; si no, "Registrar devolución".

### Validación al guardar

- Productos: `cantidad <= despachado` (ya implementado en `registrar()` para
  bodega; se mantiene para admin).
- Envases: sin tope, solo `> 0` (ya es así).
- Se requiere al menos una cantidad `> 0` (ya existe el chequeo).

### Envío

- Si el admin corrige (hay filas vigentes anulables): llamar `corregirDevolucion`
  con todas las cantidades (vigentes editadas).
- Si no hay filas vigentes (registro inicial): mantener el flujo actual
  (`registrarDevolucionProductos` / `registrarDevolucionEnvases`).
- Éxito → recargar datos y resetear la plantilla.
- Error → mostrar mensaje en la vista, sin cerrar.

---

## Sección 4 — Página Despachos (efecto colateral)

No se cambia la UI de `Despachos.tsx`, pero el filtro `anulado = false` en
`obtenerDevoluciones*` hace que la columna lateral "Devoluciones" muestre solo
las filas vigentes (correcto tras una corrección).

---

## Fuera de alcance

- Migraciones versionadas bajo `supabase/migrations/` (no existe aún; los
  cambios se aplican a los `.sql` de `bd/` como convención actual del repo).
- Historial visual de correcciones en la UI (el estado del despacho sigue
  mostrando el resultado vigente; el detalle de ANULACION queda solo en
  auditoría).
- Eliminar o agregar líneas de catálogo en la corrección.
- Reactivar devoluciones anuladas (regla existente: la reactivación NO restaura
  movimientos).

## Verificación

- `npm run lint` y `npm run build` en `frontend/`.
- Revisión manual de los cambios SQL (trigger modificado → RPC → RLS).
- Prueba de corrección: registrar devolución (4), corregir a 5 → stock_bodega y
  stock_envases cuadran; filas originales quedan `anulado = true`.
