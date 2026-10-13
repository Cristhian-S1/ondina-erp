-- ============================================================
-- 0006_bodega_despachos_envases.sql — Módulo de bodega (HU-13)
-- ============================================================
-- Delta del módulo de bodega sobre el baseline 0001-0005:
--   1) Tabla `despacho_envases` (bandejas/cajas que salen con el despacho)
--      + índice + RLS + políticas (mismas reglas que despacho_detalles).
--   2) Trigger `trg_despacho_envase_insert`: valida y descuenta stock_envases
--      de la sucursal al despachar envases.
--   3) RPC `crear_despacho`: inserta despacho + detalles + envases de forma
--      atómica (los triggers de stock validan inventario).
--   4) RPC `corregir_devolucion` (RF-23/HU-13): solo administración anula las
--      devoluciones vigentes del despacho y reinserta las cantidades
--      corregidas. No borra: las filas originales quedan anuladas y su stock
--      se revierte; las nuevas líneas vuelven a mover stock.
--   5) Ajuste de modelo (envases): la venta registra `envases_recibidos` con
--      fines de reporte pero NO mueve stock_envases; solo la devolución de
--      envases en bodega suma al inventario de vacíos. Se actualizan
--      trg_venta_detalle_insert, trg_venta_anular y trg_despacho_anular
--      (este último devuelve también los envases despachados).
--   6) Validación estricta en trg_devolucion_producto_insert: se devuelve
--      hasta lo que el vendedor tiene en carga (evita stock fantasma).
--   7) Auditoría simple de `despacho_envases` (fn_auditoria_simple).
--
-- El estado aquí versionado corresponde a los scripts de bd/
-- (triggers_bodega_despacho.sql y secciones 1b/2/4/8a/8b/9 de
-- triggers_negocio.sql) aplicados manualmente en el entorno en uso.
-- ============================================================

-- ---------------------------------------------------------------------------
-- 1. Tabla despacho_envases: bandejas/cajas que salen con el despacho
-- ---------------------------------------------------------------------------
create table if not exists public.despacho_envases (
    id uuid primary key default gen_random_uuid(),
    despacho_id uuid not null references public.despachos(id),
    tipo_empaque_id uuid not null references public.tipos_empaque(id),
    cantidad integer not null check (cantidad > 0),
    es_ajuste boolean not null default false,
    creado_en timestamptz not null default now()
);

create index if not exists idx_despacho_envases_despacho
    on public.despacho_envases (despacho_id);

alter table public.despacho_envases enable row level security;

-- RLS de despacho_envases (mismas reglas que despacho_detalles)
drop policy if exists "despacho_envases_select_despacho" on public.despacho_envases;
create policy "despacho_envases_select_despacho" on public.despacho_envases
  for select to authenticated
  using (
    exists (
      select 1 from public.despachos d
      where d.id = despacho_id
        and (
          d.vendedor_id = auth.uid()
          or es_rol('bodega')
          or es_rol('produccion')
          or es_rol('administrador')
        )
    )
  );

drop policy if exists "despacho_envases_insert_bodega" on public.despacho_envases;
create policy "despacho_envases_insert_bodega" on public.despacho_envases
  for insert to authenticated
  with check (es_rol('bodega') or es_rol('administrador'));

drop policy if exists "despacho_envases_update_admin" on public.despacho_envases;
create policy "despacho_envases_update_admin" on public.despacho_envases
  for update to authenticated
  using (es_rol('administrador'))
  with check (es_rol('administrador'));

-- ---------------------------------------------------------------------------
-- 2. Despacho de envases: valida y descuenta stock_envases (HU-26 / RNF-15)
-- ---------------------------------------------------------------------------
create or replace function public.trg_despacho_envase_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_despacho     public.despachos%rowtype;
    v_minutos      integer;
    v_stock_actual integer;
begin
    select * into v_despacho
    from public.despachos where id = new.despacho_id for update;
    if v_despacho.anulado then
        raise exception 'El despacho está anulado';
    end if;

    -- Los ajustes solo suman y solo dentro de la ventana configurable
    if new.es_ajuste then
        select valor::integer into v_minutos
        from public.configuracion where clave = 'ventana_ajuste_minutos';
        if now() > v_despacho.creado_en + make_interval(mins => coalesce(v_minutos, 0)) then
            raise exception 'La ventana de ajuste expiró (% minutos). Solo el administrador puede corregir el despacho.', v_minutos;
        end if;
    end if;

    -- Descuenta envases vacíos de la sucursal (clave compuesta)
    select cantidad into v_stock_actual
    from public.stock_envases
    where sucursal_id = v_despacho.sucursal_id
      and tipo_empaque_id = new.tipo_empaque_id
    for update;
    if v_stock_actual is null or v_stock_actual < new.cantidad then
        raise exception 'Stock insuficiente de envases para el tipo %', new.tipo_empaque_id;
    end if;
    update public.stock_envases
    set cantidad = cantidad - new.cantidad, modificado_en = now()
    where sucursal_id = v_despacho.sucursal_id
      and tipo_empaque_id = new.tipo_empaque_id;

    return new;
end;
$$;

drop trigger if exists trg_despacho_envase_insert on public.despacho_envases;
create trigger trg_despacho_envase_insert after insert on public.despacho_envases
    for each row execute function public.trg_despacho_envase_insert();

-- ---------------------------------------------------------------------------
-- 3. Venta: descuenta carga del vendedor; registra envases sin mover stock
-- ---------------------------------------------------------------------------
create or replace function public.trg_venta_detalle_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_venta  public.ventas%rowtype;
begin
    select * into v_venta from public.ventas where id = new.venta_id;
    if v_venta.anulado then
        raise exception 'La venta está anulada';
    end if;

    update public.carga_vendedor
    set cantidad = cantidad - new.cantidad, modificado_en = now()
    where vendedor_id = v_venta.vendedor_id
      and producto_id  = new.producto_id;
    if not found then
        raise exception 'El vendedor no tiene carga del producto %', new.producto_id;
    end if;
    if (select cantidad from public.carga_vendedor
        where vendedor_id = v_venta.vendedor_id and producto_id = new.producto_id) < 0 then
        raise exception 'Carga insuficiente del vendedor para el producto %', new.producto_id;
    end if;

    -- NOTA DE MODELO: `envases_recibidos` se registra aquí con fines de reporte
    -- (cuántos envases vacíos devolvió el cliente), pero NO mueve stock_envases.
    -- Los envases aún viajan con el vendedor; solo la devolución de envases del
    -- despachador (trg_devolucion_envase_insert) suma al inventario de vacíos de
    -- la sucursal, cuando el envase llega físicamente a bodega. Así hay una sola
    -- entrada y no existe doble conteo.

    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Devolución de productos: carga -> bodega (validación estricta)
-- ---------------------------------------------------------------------------
create or replace function public.trg_devolucion_producto_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_despacho public.despachos%rowtype;
    v_carga    integer;
begin
    select * into v_despacho from public.despachos where id = new.despacho_id;

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

    update public.carga_vendedor
    set cantidad = cantidad - new.cantidad, modificado_en = now()
    where vendedor_id = v_despacho.vendedor_id
      and producto_id  = new.producto_id;

    insert into public.stock_bodega (sucursal_id, producto_id, cantidad, modificado_en)
    values (v_despacho.sucursal_id, new.producto_id, new.cantidad, now())
    on conflict (sucursal_id, producto_id)
    do update set cantidad = stock_bodega.cantidad + excluded.cantidad,
                  modificado_en = now();
    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8a. Anular venta: devolver carga al vendedor (no toca stock_envases)
-- ---------------------------------------------------------------------------
create or replace function public.trg_venta_anular()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    vd record;
begin
    -- Por cada detalle de la venta: sumamos a la carga del vendedor
    -- (en el INSERT se había restado). No se toca stock_envases porque la
    -- venta no lo movió (ver trg_venta_detalle_insert: los envases se cuentan
    -- cuando el despachador registra la devolución en bodega).
    for vd in select producto_id, cantidad
              from public.venta_detalles where venta_id = new.id loop
        update public.carga_vendedor
        set cantidad = cantidad + vd.cantidad, modificado_en = now()
        where vendedor_id = new.vendedor_id
          and producto_id = vd.producto_id;
    end loop;
    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8b. Anular despacho: devolver a stock_bodega, quitar de carga_vendedor y
--     devolver a stock_envases los envases que salieron
-- ---------------------------------------------------------------------------
create or replace function public.trg_despacho_anular()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    dd record;
begin
    -- Por cada detalle (incluidos los ajustes): revertimos el movimiento.
    -- stock_bodega se había restado -> sumamos. carga_vendedor se había
    -- sumado -> restamos (respetando no-negativo).
    for dd in select producto_id, sum(cantidad) as total
              from public.despacho_detalles where despacho_id = new.id
              group by producto_id loop
        update public.stock_bodega
        set cantidad = cantidad + dd.total, modificado_en = now()
        where sucursal_id = new.sucursal_id and producto_id = dd.producto_id;

        update public.carga_vendedor
        set cantidad = greatest(cantidad - dd.total, 0), modificado_en = now()
        where vendedor_id = new.vendedor_id and producto_id = dd.producto_id;
    end loop;

    -- Por cada envase despachado: stock_envases se había restado -> sumamos.
    for dd in select tipo_empaque_id, sum(cantidad) as total
              from public.despacho_envases where despacho_id = new.id
              group by tipo_empaque_id loop
        update public.stock_envases
        set cantidad = cantidad + dd.total, modificado_en = now()
        where sucursal_id = new.sucursal_id and tipo_empaque_id = dd.tipo_empaque_id;
    end loop;

    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. RPC crear_despacho: inserta despacho + detalles + envases de forma atómica
-- ---------------------------------------------------------------------------
create or replace function public.crear_despacho(
    p_sucursal_id uuid,
    p_vendedor_id uuid,
    p_despachador_id uuid,
    p_creado_por uuid,
    p_lineas jsonb,
    p_envases jsonb default '[]'::jsonb
) returns uuid
language plpgsql
set search_path = public
as $$
declare
    v_despacho_id     uuid;
    v_linea           jsonb;
    v_envase          jsonb;
    v_producto_id     uuid;
    v_tipo_empaque_id uuid;
    v_cantidad        integer;
begin
    if p_sucursal_id is null or p_vendedor_id is null
       or p_despachador_id is null or p_creado_por is null then
        raise exception 'Faltan datos del despacho: sucursal, vendedor, despachador o usuario.';
    end if;

    if p_lineas is null or jsonb_typeof(p_lineas) <> 'array'
       or jsonb_array_length(p_lineas) = 0 then
        raise exception 'Agrega al menos un producto al despacho.';
    end if;

    insert into public.despachos (sucursal_id, vendedor_id, despachador_id, creado_por)
    values (p_sucursal_id, p_vendedor_id, p_despachador_id, p_creado_por)
    returning id into v_despacho_id;

    for v_linea in select * from jsonb_array_elements(p_lineas) loop
        v_producto_id := (v_linea ->> 'producto_id')::uuid;
        v_cantidad    := (v_linea ->> 'cantidad')::integer;
        if v_producto_id is null or v_cantidad is null or v_cantidad <= 0 then
            raise exception 'Línea de producto inválida en el despacho.';
        end if;
        insert into public.despacho_detalles (despacho_id, producto_id, cantidad)
        values (v_despacho_id, v_producto_id, v_cantidad);
    end loop;

    if p_envases is not null and jsonb_typeof(p_envases) = 'array' then
        for v_envase in select * from jsonb_array_elements(p_envases) loop
            v_tipo_empaque_id := (v_envase ->> 'tipo_empaque_id')::uuid;
            v_cantidad        := (v_envase ->> 'cantidad')::integer;
            if v_tipo_empaque_id is null or v_cantidad is null or v_cantidad <= 0 then
                raise exception 'Línea de envase inválida en el despacho.';
            end if;
            insert into public.despacho_envases (despacho_id, tipo_empaque_id, cantidad)
            values (v_despacho_id, v_tipo_empaque_id, v_cantidad);
        end loop;
    end if;

    return v_despacho_id;
end;
$$;

grant execute on function public.crear_despacho(
    uuid, uuid, uuid, uuid, jsonb, jsonb
) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. RPC corregir_devolucion (RF-23 / HU-13): anula vigentes y reinserta
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

grant execute on function public.corregir_devolucion(
    uuid, uuid, jsonb, jsonb
) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Auditoría simple de despacho_envases (fn_auditoria_simple)
-- ---------------------------------------------------------------------------
drop trigger if exists trg_audit_despacho_envases on public.despacho_envases;
create trigger trg_audit_despacho_envases
    after insert or update on public.despacho_envases
    for each row execute function public.fn_auditoria_simple();
