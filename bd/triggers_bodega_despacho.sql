-- ============================================================================
-- Triggers de bodega: despacho y devoluciones — Ondina
-- ============================================================================
-- Script para cargar en el SQL Editor de Supabase (proyecto dev
-- rhivlzwtobhiguzmkiat). Hace operativos los movimientos de stock que el
-- esquema ya define pero que NO están cargados en la BD:
--
--   - Crear despacho          -> descuenta stock_bodega y suma carga_vendedor
--   - Despacho de envases     -> descuenta stock_envases (bandejas/cajas)
--   - Devolución de productos -> carga_vendedor -=, stock_bodega +=
--   - Devolución de envases   -> stock_envases += (solo estado 'bueno')
--   - Anulaciones             -> revierten los movimientos anteriores
--
-- NOTA DE MODELO (envases): stock_envases = envases vacíos físicamente en
-- bodega. La venta registra envases_recibidos para reporte pero NO mueve
-- stock; la devolución de envases aquí es la única entrada que suma al
-- inventario de vacíos (evita doble conteo).
--
-- Requisito previo: tablas y RLS de despachos/productos/tipos_empaque
-- ya aplicadas, y las funciones helper es_rol() y fn_auditoria_simple()
-- (vienen de rls_policies.sql y auditoria.sql). No depende de los dominios
-- venta, producción ni merma.
--
-- Idempotente: crea despacho_envases si no existe, usa CREATE OR REPLACE y
-- DROP IF EXISTS, por lo que puede re-ejecutarse sin errores.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0) Parámetro de configuración usado por el trigger de despacho (RNF-15)
-- ---------------------------------------------------------------------------
insert into public.configuracion (clave, valor, descripcion)
values ('ventana_ajuste_minutos', '15',
        'Minutos para sumar productos a un despacho ya registrado (RNF-15: 10-20)')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------------
-- 0b) Tabla de envases por despacho (bandejas/cajas que salen con el despacho)
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

-- ---------------------------------------------------------------------------
-- 1) Despacho: valida stock, descuenta stock_bodega y suma carga_vendedor
-- ---------------------------------------------------------------------------
create or replace function public.trg_despacho_detalle_insert()
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

    select cantidad into v_stock_actual
    from public.stock_bodega
    where sucursal_id = v_despacho.sucursal_id
      and producto_id  = new.producto_id
    for update;
    if v_stock_actual is null or v_stock_actual < new.cantidad then
        raise exception 'Stock insuficiente en bodega para el producto %', new.producto_id;
    end if;
    update public.stock_bodega
    set cantidad = cantidad - new.cantidad, modificado_en = now()
    where sucursal_id = v_despacho.sucursal_id
      and producto_id  = new.producto_id;

    insert into public.carga_vendedor (vendedor_id, producto_id, cantidad, modificado_en)
    values (v_despacho.vendedor_id, new.producto_id, new.cantidad, now())
    on conflict (vendedor_id, producto_id)
    do update set cantidad = carga_vendedor.cantidad + excluded.cantidad,
                  modificado_en = now();

    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1b) Despacho de envases (bandejas/cajas): valida y descuenta stock_envases
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

-- ---------------------------------------------------------------------------
-- 2) Devolución de productos: carga -> bodega
-- ---------------------------------------------------------------------------
-- CORREGIDO: valida que el vendedor tenga carga suficiente y lanza error, en
-- lugar de recortar con greatest(cantidad - X, 0) que creaba stock fantasma.
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
    if v_carga is null or v_carga < new.cantidad then
        raise exception 'Carga insuficiente del vendedor para devolver el producto %', new.producto_id;
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
-- 3) Devolución de envases: suma al inventario de vacíos (solo estado bueno)
-- ---------------------------------------------------------------------------
create or replace function public.trg_devolucion_envase_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_sucursal uuid;
begin
    select sucursal_id into v_sucursal from public.despachos where id = new.despacho_id;
    if new.estado = 'bueno' then
        insert into public.stock_envases (sucursal_id, tipo_empaque_id, cantidad, modificado_en)
        values (v_sucursal, new.tipo_empaque_id, new.cantidad, now())
        on conflict (sucursal_id, tipo_empaque_id)
        do update set cantidad = stock_envases.cantidad + excluded.cantidad,
                      modificado_en = now();
    end if;
    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Anular despacho: devolver a stock_bodega, quitar de carga_vendedor y
--    devolver a stock_envases los envases que salieron
-- ---------------------------------------------------------------------------
create or replace function public.trg_despacho_anular()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    dd record;
begin
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
-- 5) Anular devolución de productos: revertir (carga vuelve a subir, bodega baja)
-- ---------------------------------------------------------------------------
create or replace function public.trg_devolucion_producto_anular()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_despacho public.despachos%rowtype;
begin
    select * into v_despacho from public.despachos where id = new.despacho_id;
    if v_despacho.anulado then
        return new;
    end if;
    update public.carga_vendedor
    set cantidad = cantidad + new.cantidad, modificado_en = now()
    where vendedor_id = v_despacho.vendedor_id and producto_id = new.producto_id;

    update public.stock_bodega
    set cantidad = greatest(cantidad - new.cantidad, 0), modificado_en = now()
    where sucursal_id = v_despacho.sucursal_id and producto_id = new.producto_id;
    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) Anular devolución de envase (bueno): restar lo sumado al stock_envases
-- ---------------------------------------------------------------------------
create or replace function public.trg_devolucion_envase_anular()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_sucursal uuid;
begin
    if new.estado <> 'bueno' then
        return new;
    end if;
    select sucursal_id into v_sucursal from public.despachos where id = new.despacho_id;
    update public.stock_envases
    set cantidad = greatest(cantidad - new.cantidad, 0), modificado_en = now()
    where sucursal_id = v_sucursal and tipo_empaque_id = new.tipo_empaque_id;
    return new;
end;
$$;

-- ===========================================================================
-- Activación de los triggers de bodega
-- ===========================================================================
drop trigger if exists trg_despacho_detalle_insert on public.despacho_detalles;
create trigger trg_despacho_detalle_insert after insert on public.despacho_detalles
    for each row execute function public.trg_despacho_detalle_insert();

drop trigger if exists trg_despacho_envase_insert on public.despacho_envases;
create trigger trg_despacho_envase_insert after insert on public.despacho_envases
    for each row execute function public.trg_despacho_envase_insert();

drop trigger if exists trg_devolucion_producto on public.devoluciones_productos;
create trigger trg_devolucion_producto after insert on public.devoluciones_productos
    for each row execute function public.trg_devolucion_producto_insert();

drop trigger if exists trg_devolucion_envase on public.devoluciones_envases;
create trigger trg_devolucion_envase after insert on public.devoluciones_envases
    for each row execute function public.trg_devolucion_envase_insert();

drop trigger if exists trg_despacho_anular on public.despachos;
create trigger trg_despacho_anular after update of anulado on public.despachos
    for each row when (new.anulado and not old.anulado)
    execute function public.trg_despacho_anular();

drop trigger if exists trg_devolucion_producto_anular on public.devoluciones_productos;
create trigger trg_devolucion_producto_anular after update of anulado
    on public.devoluciones_productos
    for each row when (new.anulado and not old.anulado)
    execute function public.trg_devolucion_producto_anular();

drop trigger if exists trg_devolucion_envase_anular on public.devoluciones_envases;
create trigger trg_devolucion_envase_anular after update of anulado
    on public.devoluciones_envases
    for each row when (new.anulado and not old.anulado)
    execute function public.trg_devolucion_envase_anular();

-- ---------------------------------------------------------------------------
-- RLS de despacho_envases (mismas reglas que despacho_detalles)
-- ---------------------------------------------------------------------------
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
-- 7) Auditoría de despacho_envases: prerrequisitos (tabla y función genérica)
-- ---------------------------------------------------------------------------
-- En proyectos donde bd/auditoria.sql ya se aplicó, esto es un no-op. Se
-- incluye aquí para que el script sea autocontenido.
create table if not exists public.auditoria (
    id bigint generated always as identity primary key,
    tabla text not null,
    registro_id uuid not null,
    accion text not null check (accion in ('INSERT', 'UPDATE', 'ANULACION')),
    usuario_id uuid references public.perfiles(id),
    valores_anteriores jsonb,
    valores_nuevos jsonb,
    creado_en timestamptz not null default now()
);

create index if not exists idx_auditoria_tabla_registro on public.auditoria (tabla, registro_id);

create or replace function public.fn_auditoria_simple()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
    insert into public.auditoria (tabla, registro_id, accion, usuario_id, valores_anteriores, valores_nuevos)
    values (
        tg_table_name,
        coalesce(new.id, old.id),
        case when tg_op = 'INSERT' then 'INSERT' else 'UPDATE' end,
        auth.uid(),
        case when tg_op = 'UPDATE' then to_jsonb(old) end,
        to_jsonb(new)
    );
    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Auditoría de despacho_envases (mismo patrón que despacho_detalles)
-- ---------------------------------------------------------------------------
drop trigger if exists trg_audit_despacho_envases on public.despacho_envases;
create trigger trg_audit_despacho_envases
    after insert or update on public.despacho_envases
    for each row execute function public.fn_auditoria_simple();

commit;
