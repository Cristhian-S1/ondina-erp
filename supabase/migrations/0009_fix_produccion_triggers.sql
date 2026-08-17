-- ============================================================
-- 0009_fix_produccion_triggers.sql
-- Corrige HU-20 / HU-22: triggers faltantes y vista de indicadores
-- ============================================================

-- ---------------------------------------------------------------------------
-- 0. Helpers requeridos por las políticas de Producción
-- ---------------------------------------------------------------------------

create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.es_rol(p_rol text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.perfiles
        where id = (select auth.uid())
          and rol = p_rol
          and activo
    );
$$;

create or replace function private.mi_sucursal()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
    select sucursal_id
    from public.perfiles
    where id = (select auth.uid())
      and activo;
$$;

revoke all on function private.es_rol(text) from public, anon;
revoke all on function private.mi_sucursal() from public, anon;

grant execute on function private.es_rol(text) to authenticated;
grant execute on function private.mi_sucursal() to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Registrar producción:
--    - valida envases retornables
--    - descuenta stock_envases
--    - aumenta stock_bodega
-- ---------------------------------------------------------------------------
create or replace function public.trg_produccion_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_tipo_empaque uuid;
    v_categoria text;
    v_envases integer;
begin
    select p.tipo_empaque_id, te.categoria
    into v_tipo_empaque, v_categoria
    from public.productos p
    left join public.tipos_empaque te
      on te.id = p.tipo_empaque_id
    where p.id = new.producto_id
      and p.activo;

    if not found then
        raise exception 'El producto no existe o está desactivado';
    end if;

    -- Solo los empaques retornables consumen stock de envases vacíos
    if v_categoria = 'retornable' then
        select cantidad
        into v_envases
        from public.stock_envases
        where sucursal_id = new.sucursal_id
          and tipo_empaque_id = v_tipo_empaque
        for update;

        if coalesce(v_envases, 0) < new.cantidad then
            raise exception
              'No hay envases vacíos suficientes. Disponibles: %',
              coalesce(v_envases, 0);
        end if;

        update public.stock_envases
        set cantidad = cantidad - new.cantidad,
            modificado_en = now()
        where sucursal_id = new.sucursal_id
          and tipo_empaque_id = v_tipo_empaque;
    end if;

    insert into public.stock_bodega (
        sucursal_id,
        producto_id,
        cantidad,
        modificado_en
    )
    values (
        new.sucursal_id,
        new.producto_id,
        new.cantidad,
        now()
    )
    on conflict (sucursal_id, producto_id)
    do update
    set cantidad = public.stock_bodega.cantidad + excluded.cantidad,
        modificado_en = now();

    return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- 2. Anular producción:
--    - resta stock_bodega
--    - devuelve envases retornables
-- ---------------------------------------------------------------------------
create or replace function public.trg_produccion_anular()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_tipo_empaque uuid;
    v_categoria text;
begin
    update public.stock_bodega
    set cantidad = greatest(cantidad - new.cantidad, 0),
        modificado_en = now()
    where sucursal_id = new.sucursal_id
      and producto_id = new.producto_id;

    select p.tipo_empaque_id, te.categoria
    into v_tipo_empaque, v_categoria
    from public.productos p
    left join public.tipos_empaque te
      on te.id = p.tipo_empaque_id
    where p.id = new.producto_id;

    if v_categoria = 'retornable' then
        insert into public.stock_envases (
            sucursal_id,
            tipo_empaque_id,
            cantidad,
            modificado_en
        )
        values (
            new.sucursal_id,
            v_tipo_empaque,
            new.cantidad,
            now()
        )
        on conflict (sucursal_id, tipo_empaque_id)
        do update
        set cantidad = public.stock_envases.cantidad + excluded.cantidad,
            modificado_en = now();
    end if;

    return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- 3. Crear los triggers faltantes
-- ---------------------------------------------------------------------------
drop trigger if exists trg_produccion_insert on public.producciones;

create trigger trg_produccion_insert
after insert on public.producciones
for each row
execute function public.trg_produccion_insert();


drop trigger if exists trg_produccion_anular on public.producciones;

create trigger trg_produccion_anular
after update of anulado on public.producciones
for each row
when (new.anulado and not old.anulado)
execute function public.trg_produccion_anular();


-- ---------------------------------------------------------------------------
-- 4. Asegurar lectura de envases para Producción
-- ---------------------------------------------------------------------------
drop policy if exists "stock_envases_select_operativo"
on public.stock_envases;

create policy "stock_envases_select_operativo"
on public.stock_envases
for select
to authenticated
using (
    private.es_rol('administrador')
    or (
        (private.es_rol('bodega') or private.es_rol('produccion'))
        and sucursal_id = private.mi_sucursal()
    )
);


-- ---------------------------------------------------------------------------
-- 5. Vista de indicadores HU-22
-- ---------------------------------------------------------------------------
create or replace view public.v_indicadores_produccion_diarios
with (security_invoker = true)
as
select
    sucursal_id,
    producto_id,
    (creado_en at time zone 'America/Santiago')::date as fecha,
    sum(cantidad)::bigint as cantidad,
    count(*)::bigint as registros
from public.producciones
where not anulado
group by
    sucursal_id,
    producto_id,
    (creado_en at time zone 'America/Santiago')::date;

revoke all
on public.v_indicadores_produccion_diarios
from public, anon;

grant select
on public.v_indicadores_produccion_diarios
to authenticated;