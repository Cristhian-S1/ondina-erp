# Corrección de Devoluciones por Administrador — Plan de Implementación

> **Para agentes que ejecutan:** SUB-SKILL REQUERIDO: usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Las tareas usan checkbox (`- [ ]`).

**Goal:** Permitir que el administrador corrija (anular + reinsertar vía RPC) las cantidades de devoluciones registradas, incluso en despachos `Completo`, conservando trazabilidad en auditoría.

**Architecture:** Un RPC `corregir_devolucion` (SECURITY DEFINER, solo admin) anula las devoluciones vigentes del despacho y reinserta las cantidades corregidas; los triggers existentes revuelven y vuelven a mover stock. En el frontend, el admin abre despachos completos con inputs prellenados y guarda la corrección por el RPC; las consultas de devoluciones filtran `anulado = false`.

**Tech Stack:** PostgreSQL/plpgsql (Supabase), React 19 + TypeScript, supabase-js v2.

**Spec:** `docs/superpowers/specs/2026-08-07-correccion-devoluciones-admin-design.md`

## Global Constraints

- TypeScript estricto con `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`. Usa `import type` para tipos.
- Sin comentarios en el código salvo los que ya existan o los comentarios SQL de sección del repo.
- Mensajes al usuario en español.
- Commits: Conventional Commits, en español, imperativo, máx. 72 caracteres: `<tipo>(<alcance>): <descripción> [HU-13]`.
- Cambios SQL se aplican a los `.sql` de `bd/` (no hay `supabase/migrations/` aún).
- Verificación frontend: `npm run lint` y `npm run build` en `frontend/`. No hay framework de tests en el repo.
- Regla de negocio: productos `<= despachado` (suma de `despacho_detalles`); envases sin tope.
- Regla de negocio: el trigger de devolución de productos omite la validación de `carga_vendedor` para `administrador`.
- Regla de negocio: solo el admin puede abrir/corregir despachos `Completo`; bodega solo registra en estados pendientes.

---

### Task 1: BD — omitir validación de carga para admin en `trg_devolucion_producto_insert`

**Files:**
- Modify: `bd/triggers_negocio.sql:180-210` (función `trg_devolucion_producto_insert`)

**Interfaces:**
- Consumes: función auxiliar `es_rol(text)` (definida en `bd/rls_policies.sql:14-26`, SECURITY DEFINER).
- Produces: trigger que mueve stock igual que hoy pero sin `raise exception` de carga cuando el llamador es admin. Depende de él el RPC de la Task 2 (su reinsert de productos no debe bloquearse).

- [ ] **Step 1: Modificar la validación de carga**

Reemplazar el bloque de validación dentro de `trg_devolucion_producto_insert`. Estado actual (líneas 189-196):

```sql
    select cantidad into v_carga
    from public.carga_vendedor
    where vendedor_id = v_despacho.vendedor_id
      and producto_id  = new.producto_id
    for update;
    if v_carga is null or v_carga < new.cantidad then
        raise exception 'Carga insuficiente del vendedor para devolver el producto %', new.producto_id;
    end if;
```

Nuevo bloque (envuelve el `raise exception` en `if not es_rol('administrador')`):

```sql
    select cantidad into v_carga
    from public.carga_vendedor
    where vendedor_id = v_despacho.vendedor_id
      and producto_id  = new.producto_id
    for update;
    if not es_rol('administrador') then
        if v_carga is null or v_carga < new.cantidad then
            raise exception 'Carga insuficiente del vendedor para devolver el producto %', new.producto_id;
        end if;
    end if;
```

El `update public.carga_vendedor ... cantidad = cantidad - new.cantidad` y el `insert ... on conflict ... stock_bodega.cantidad + excluded.cantidad` posteriores se mantienen igual.

- [ ] **Step 2: Verificar la sintaxis del archivo**

Run: `grep -n "not es_rol('administrador')" bd/triggers_negocio.sql`
Expected: la línea nueva aparece una vez, dentro de `trg_devolucion_producto_insert`. No hay parser SQL local; verificación visual del bloque (el `if` se cierra con `end if;` correctamente antes del `update` de carga).

- [ ] **Step 3: Commit**

```bash
git add bd/triggers_negocio.sql
git commit -m "feat(bd): omitir validación de carga al devolver productos para admin [HU-13]"
```

---

### Task 2: BD — RPC `corregir_devolucion`

**Files:**
- Modify: `bd/triggers_negocio.sql` (agregar función antes de la sección "Activación de triggers de negocio", que empieza en la línea 441)

**Interfaces:**
- Consumes: `es_rol(text)`, tablas `despachos`, `despacho_detalles`, `devoluciones_productos`, `devoluciones_envases`, y los triggers `trg_devolucion_producto_insert` / `trg_devolucion_envase_insert` (Task 1 ya omitió la carga para admin).
- Produces: `public.corregir_devolucion(p_despacho_id uuid, p_creado_por uuid, p_productos jsonb, p_envases jsonb) returns void`. La consume el frontend en la Task 3.

- [ ] **Step 1: Escribir la función RPC**

Insertar al final del archivo, justo antes del bloque `-- Activación de triggers de negocio` (línea 441):

```sql
-- ---------------------------------------------------------------------------
-- 9. Corrección de devoluciones por administración: anula las vigentes y
--    reinserta las cantidades corregidas (RF-23 / HU-13). No borra: las filas
--    originales quedan anuladas y su stock se revierte (secciones 8c/8d); las
--    nuevas líneas vuelven a mover stock (secciones 4/5). Todo en una
--    transacción.
-- ---------------------------------------------------------------------------
create or replace function public.corregir_devolucion(
    p_despacho_id uuid,
    p_creado_por  uuid,
    p_productos   jsonb,
    p_envases     jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_despacho public.despachos%rowtype;
    v_total    integer;
    v_linea    record;
begin
    if not es_rol('administrador') then
        raise exception 'Solo administración puede corregir devoluciones';
    end if;

    select * into v_despacho from public.despachos where id = p_despacho_id;
    if v_despacho.id is null then
        raise exception 'El despacho no existe';
    end if;

    -- Validar productos: cantidad <= despachado (suma de despacho_detalles)
    for v_linea in
        select * from jsonb_to_recordset(coalesce(p_productos, '[]'::jsonb))
        as x(producto_id uuid, cantidad int)
    loop
        if v_linea.cantidad <= 0 then
            continue;
        end if;
        select coalesce(sum(cantidad), 0) into v_total
        from public.despacho_detalles
        where despacho_id = p_despacho_id
          and producto_id = v_linea.producto_id;
        if v_linea.cantidad > v_total then
            raise exception 'No se puede devolver más de lo despachado del producto %', v_linea.producto_id;
        end if;
    end loop;

    -- Validar envases: estado válido (sin tope de cantidad)
    for v_linea in
        select * from jsonb_to_recordset(coalesce(p_envases, '[]'::jsonb))
        as x(tipo_empaque_id uuid, cantidad int, estado text)
    loop
        if v_linea.cantidad > 0 and v_linea.estado not in ('bueno', 'malo') then
            raise exception 'Estado de envase inválido';
        end if;
    end loop;

    -- Anular devoluciones vigentes del despacho (triggers 8c/8d revierten stock)
    update public.devoluciones_productos set anulado = true
    where despacho_id = p_despacho_id and anulado = false;
    update public.devoluciones_envases set anulado = true
    where despacho_id = p_despacho_id and anulado = false;

    -- Reinsertar líneas corregidas (triggers 4/5 vuelven a mover stock)
    for v_linea in
        select * from jsonb_to_recordset(coalesce(p_productos, '[]'::jsonb))
        as x(producto_id uuid, cantidad int)
    loop
        if v_linea.cantidad > 0 then
            insert into public.devoluciones_productos
                (despacho_id, producto_id, cantidad, creado_por)
            values
                (p_despacho_id, v_linea.producto_id, v_linea.cantidad, p_creado_por);
        end if;
    end loop;

    for v_linea in
        select * from jsonb_to_recordset(coalesce(p_envases, '[]'::jsonb))
        as x(tipo_empaque_id uuid, cantidad int, estado text)
    loop
        if v_linea.cantidad > 0 then
            insert into public.devoluciones_envases
                (despacho_id, tipo_empaque_id, cantidad, estado, creado_por)
            values
                (p_despacho_id, v_linea.tipo_empaque_id, v_linea.cantidad,
                 v_linea.estado, p_creado_por);
        end if;
    end loop;
end;
$$;
```

- [ ] **Step 2: Verificar la sintaxis del archivo**

Run: `grep -n "corregir_devolucion" bd/triggers_negocio.sql`
Expected: la definición de la función (`create or replace function public.corregir_devolucion`) y su cierre (`end;` `$$;`). Revisar visualmente que los `for v_linea in ... loop ... end loop;` y los `end if;` estén balanceados.

- [ ] **Step 3: Commit**

```bash
git add bd/triggers_negocio.sql
git commit -m "feat(bd): corregir devoluciones de forma atómica vía RPC [HU-13]"
```

---

### Task 3: Frontend `api.ts` — `corregirDevolucion` y filtro `anulado`

**Files:**
- Modify: `frontend/src/domains/bodega/api.ts:80-98` (filtros) y `frontend/src/domains/bodega/api.ts:128-139` (patrón RPC, junto a `crearDespacho`)

**Interfaces:**
- Consumes: `mensajeErrorSupabase` de `../../lib/errors`, `supabase` de `../../lib/supabase`, tipos `DevolucionProducto`, `DevolucionEnvase` de `./types`.
- Produces: `corregirDevolucion(payload): Promise<{ error: string | null }>` con `payload = { despacho_id: string; creado_por: string; lineas_producto: { producto_id: string; cantidad: number }[]; lineas_envase: { tipo_empaque_id: string; cantidad: number; estado: 'bueno' | 'malo' }[] }`. La consume `Devoluciones.tsx` en la Task 4.

**Nota:** el árbol de trabajo tiene pendiente el commit del guard de `obtenerStockBodega`/`obtenerStockEnvases` (`if (!sucursalId) return []`). Incluirlo en el commit de esta tarea.

- [ ] **Step 1: Agregar filtro `anulado = false`**

En `obtenerDevolucionesProducto` (líneas 80-88), insertar `.eq('anulado', false)` entre `.in(...)` y `.returns(...)`:

```ts
export async function obtenerDevolucionesProducto(despachoIds: string[]): Promise<DevolucionProducto[]> {
  if (despachoIds.length === 0) return []
  const { data } = await supabase
    .from('devoluciones_productos')
    .select('*')
    .in('despacho_id', despachoIds)
    .eq('anulado', false)
    .returns<DevolucionProducto[]>()
  return data ?? []
}
```

Ídem en `obtenerDevolucionesEnvase` (líneas 90-98):

```ts
export async function obtenerDevolucionesEnvase(despachoIds: string[]): Promise<DevolucionEnvase[]> {
  if (despachoIds.length === 0) return []
  const { data } = await supabase
    .from('devoluciones_envases')
    .select('*')
    .in('despacho_id', despachoIds)
    .eq('anulado', false)
    .returns<DevolucionEnvase[]>()
  return data ?? []
}
```

- [ ] **Step 2: Agregar la función `corregirDevolucion`**

Después de `registrarDevolucionEnvases` (final del archivo, tras la línea 174):

```ts
export interface CorregirDevolucionPayload {
  despacho_id: string
  creado_por: string
  lineas_producto: { producto_id: string; cantidad: number }[]
  lineas_envase: { tipo_empaque_id: string; cantidad: number; estado: 'bueno' | 'malo' }[]
}

export async function corregirDevolucion(
  payload: CorregirDevolucionPayload,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('corregir_devolucion', {
    p_despacho_id: payload.despacho_id,
    p_creado_por: payload.creado_por,
    p_productos: payload.lineas_producto,
    p_envases: payload.lineas_envase,
  } as never)

  return { error: error ? mensajeErrorSupabase(error) : null }
}
```

- [ ] **Step 3: Verificar lint y build**

Run (en `frontend/`): `npm run lint && npm run build`
Expected: ambos pasan. El RPC tipado como `never` evita el error de tipos en supabase-js.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/domains/bodega/api.ts
git commit -m "feat(bodega): corregir devoluciones vía RPC y ocultar anuladas [HU-13]"
```

---

### Task 4: Frontend `Devoluciones.tsx` — edición por administrador

**Files:**
- Modify: `frontend/src/domains/bodega/pages/Devoluciones.tsx`

**Interfaces:**
- Consumes: `corregirDevolucion` de `../api` (Task 3); helpers existentes `estadoDe`, `productosDespachados`, `envasesDespachados`, `devueltoProductoDe`, `devueltoEnvaseBuenoDe`, `devueltoEnvaseMaloDe`; estado `productoInputs`, `envaseInputs`, `seleccionado`, `desvProducto`, `desvEnvase`, `perfil`.
- Produces: página que permite al admin abrir/corregir despachos completos con inputs prellenados; flujo de registro de bodega sin cambios.

- [ ] **Step 1: Agregar `esAdmin` y prellenado al seleccionar**

En el cuerpo de `Devoluciones()` agregar:

```ts
const esAdmin = perfil?.rol === 'administrador'
```

Reemplazar `seleccionar` (líneas 240-246):

```ts
  function seleccionar(despachoId: string) {
    if (!esAdmin && estadoDe(despachoId) === 'completo') return
    setSeleccionado(despachoId)
    setProductoInputs({})
    setEnvaseInputs({})
    setError(null)
  }
```

Agregar una función `prellenarInputs` que carga las cantidades vigentes al abrir un despacho ya registrado (se usa al seleccionar si el admin edita; el prellenado deja los inputs en blanco en registro inicial):

```ts
  function prellenarInputs(despachoId: string) {
    const productos: Record<string, string> = {}
    for (const [productoId] of productosDespachados(despachoId)) {
      const devuelto = devueltoProductoDe(despachoId, productoId)
      if (devuelto > 0) productos[productoId] = String(devuelto)
    }
    const envases: Record<string, { buenos: string; malos: string }> = {}
    for (const t of tiposEmpaqueDevolvibles) {
      const buenos = devueltoEnvaseBuenoDe(despachoId, t.id)
      const malos = devueltoEnvaseMaloDe(despachoId, t.id)
      if (buenos > 0 || malos > 0) {
        envases[t.id] = {
          buenos: buenos > 0 ? String(buenos) : '',
          malos: malos > 0 ? String(malos) : '',
        }
      }
    }
    setProductoInputs(productos)
    setEnvaseInputs(envases)
  }
```

**Nota:** `prellenarInputs` se definirá después de los helpers `productosDespachados`, `devueltoProductoDe`, etc. (líneas ~189-238) y antes de `seleccionar`. Al final del Step 1, `seleccionar` debe llamar a `prellenarInputs(despachoId)` en lugar de setear `{}`:

```ts
  function seleccionar(despachoId: string) {
    if (!esAdmin && estadoDe(despachoId) === 'completo') return
    setSeleccionado(despachoId)
    prellenarInputs(despachoId)
    setError(null)
  }
```

- [ ] **Step 2: Habilitar la selección en la lista para admin**

En el render de la lista (líneas 442-471), el botón de cada despacho: el `disabled` y la clase `cursor-not-allowed` deben aplicar solo a no-admin:

```tsx
              {despachosFiltrados.map((d) => {
                const dEstado = estadoDe(d.id)
                const completo = dEstado === 'completo'
                const bloqueado = completo && !esAdmin
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      disabled={bloqueado}
                      onClick={() => seleccionar(d.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        seleccionado === d.id
                          ? 'border-brand-200 bg-brand-50'
                          : bloqueado
                            ? 'cursor-not-allowed border-slate-100 opacity-60'
                            : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
```

- [ ] **Step 3: Calcular flags de edición**

Después de `const estado = seleccionado ? estadoDe(seleccionado) : null` (línea 327), reemplazar los flags actuales (líneas 328-329):

```ts
  const productosPendientes = estado === 'pendiente' || estado === 'envases'
  const envasesPendientes = estado === 'pendiente' || estado === 'productos'
```

por:

```ts
  const productosPendientes = estado === 'pendiente' || estado === 'envases'
  const envasesPendientes = estado === 'pendiente' || estado === 'productos'
  const hayProductosRegistrados = desvProducto.some((x) => x.despacho_id === seleccionado)
  const hayEnvasesRegistrados = desvEnvase.some((x) => x.despacho_id === seleccionado)
  const editarProductos = productosPendientes || (esAdmin && hayProductosRegistrados)
  const editarEnvases = envasesPendientes || (esAdmin && hayEnvasesRegistrados)
  const esCorreccion = esAdmin && (hayProductosRegistrados || hayEnvasesRegistrados)
```

- [ ] **Step 4: Usar los flags en la plantilla**

En la sección "Productos del despacho" (líneas 496-567):

- Badge "Ya devueltos" (línea 502): cambiar `{!productosPendientes && (` → `{!editarProductos && (`
- Input vs. read-only (línea 534): cambiar `{productosPendientes ? (` → `{editarProductos ? (`

En la sección "Envases" (líneas 569-653):

- Badge "Ya devueltos" (línea 574): cambiar `{!envasesPendientes && (` → `{!editarEnvases && (`
- Inputs buenos/malos (líneas 603 y 624): cambiar `{envasesPendientes ? (` → `{editarEnvases ? (`

**Nota:** la columna "Carga" (líneas 512 y 528) sigue condicionada por `estado === 'pendiente'`; no tocar.

- [ ] **Step 5: Adaptar `registrar()` para corrección**

Reemplazar el cuerpo de `registrar` (líneas 248-322) para que el admin con registros vigentes use `corregirDevolucion`:

```ts
  async function registrar() {
    if (!perfil || !seleccionado) return
    setError(null)
    const estado = estadoDe(seleccionado)

    const productosPendientes = estado === 'pendiente' || estado === 'envases'
    const envasesPendientes = estado === 'pendiente' || estado === 'productos'
    const hayProductos = desvProducto.some((x) => x.despacho_id === seleccionado)
    const hayEnvases = desvEnvase.some((x) => x.despacho_id === seleccionado)
    const esCorreccion = esAdmin && (hayProductos || hayEnvases)

    const lineasProducto = productosPendientes || esCorreccion
      ? Object.entries(productoInputs)
          .filter(([, cantidad]) => Number(cantidad) > 0)
          .map(([producto_id, cantidad]) => ({ producto_id, cantidad: Number(cantidad) }))
      : []

    const lineasEnvase = envasesPendientes || esCorreccion
      ? Object.entries(envaseInputs)
          .filter(([, v]) => Number(v.buenos) > 0 || Number(v.malos) > 0)
          .flatMap(([tipo_empaque_id, v]) => [
            ...(Number(v.buenos) > 0
              ? [{ tipo_empaque_id, cantidad: Number(v.buenos), estado: 'bueno' as const }]
              : []),
            ...(Number(v.malos) > 0
              ? [{ tipo_empaque_id, cantidad: Number(v.malos), estado: 'malo' as const }]
              : []),
          ])
      : []

    if (lineasProducto.length === 0 && lineasEnvase.length === 0) {
      setError('Registra al menos una cantidad a devolver.')
      return
    }

    const despachados = productosDespachados(seleccionado)
    for (const l of lineasProducto) {
      const max = despachados.get(l.producto_id) ?? 0
      if (l.cantidad > max) {
        const p = productos.find((x) => x.id === l.producto_id)
        setError(
          `No puedes devolver más de ${max} ${p?.nombre ?? 'del producto'} (despachado).`,
        )
        return
      }
    }

    setEnviando(true)
    if (esCorreccion) {
      const { error: err } = await corregirDevolucion({
        despacho_id: seleccionado,
        creado_por: perfil.id,
        lineas_producto: lineasProducto,
        lineas_envase: lineasEnvase,
      })
      if (err) {
        setError(err)
        setEnviando(false)
        return
      }
    } else {
      if (lineasProducto.length > 0) {
        const { error: err } = await registrarDevolucionProductos({
          despacho_id: seleccionado,
          creado_por: perfil.id,
          lineas: lineasProducto,
        })
        if (err) {
          setError(err)
          setEnviando(false)
          return
        }
      }
      if (lineasEnvase.length > 0) {
        const { error: err } = await registrarDevolucionEnvases({
          despacho_id: seleccionado,
          creado_por: perfil.id,
          lineas: lineasEnvase,
        })
        if (err) {
          setError(err)
          setEnviando(false)
          return
        }
      }
    }

    setEnviando(false)
    setProductoInputs({})
    setEnvaseInputs({})
    await load()
  }
```

Agregar `corregirDevolucion` al import de `../api` (líneas 3-14).

- [ ] **Step 6: Texto del botón según corrección**

En el botón "Registrar devolución" (líneas 655-664):

```tsx
                <div className="border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    className={`${btnPrimary} w-full`}
                    disabled={enviando}
                    onClick={() => void registrar()}
                  >
                    {enviando
                      ? 'Guardando...'
                      : esCorreccion
                        ? 'Guardar corrección'
                        : 'Registrar devolución'}
                  </button>
                </div>
```

`esCorreccion` es el flag calculado en el Step 3 (visible en el scope del render).

- [ ] **Step 7: Verificar lint y build**

Run (en `frontend/`): `npm run lint && npm run build`
Expected: ambos pasan (sin errores de tipos ni de imports).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/domains/bodega/pages/Devoluciones.tsx
git commit -m "feat(bodega): permitir al admin corregir devoluciones completas [HU-13]"
```

---

## Verificación integral (manual, requiere Supabase)

1. Aplicar `triggers_negocio.sql` completo (incluye la Task 1 y la Task 2) en el SQL Editor.
2. Registrar un despacho con 10 uds de un producto y 3 envases.
3. Como bodega, registrar devolución: 4 productos + 1 envase bueno. Despacho → estado `Completo`.
4. Verificar en `stock_bodega`/`stock_envases` que el stock aumentó según lo devuelto.
5. Como admin, abrir el despacho completo: los inputs deben venir prellenados (4 y 1).
6. Corregir a 5 productos y 2 envases buenos → "Guardar corrección".
7. Verificar: filas originales quedan `anulado = true`; nuevas filas con 5 y 2; `stock_bodega`/`stock_envases` cuadran con el neto (carga −1, stock +1 en el ejemplo); auditoría tiene ANULACION + INSERT.
8. Como bodega, verificar que un despacho `Completo` sigue bloqueado.
9. Como admin, probar devolver más de lo despachado en un producto → debe rechazar con "No se puede devolver más de lo despachado".
