-- ============================================================
-- Módulo Producción — HU-19 a HU-23
-- ============================================================
--
-- HU-19: Consulta de envases vacíos disponibles.
-- HU-20: Registro atómico de producción y actualización de stock.
-- HU-21: Consulta histórica de producción.
-- HU-22: Indicadores derivados de registros de producción.
-- HU-23: Registro y auditoría de incidencias.
--
-- Incluye:
-- - RLS por rol y sucursal.
-- - Actualización de stock_bodega.
-- - Consumo y reversión de stock_envases.
-- - Vista de indicadores.
-- - Auditoría.
-- - Supabase Realtime.
-- - Privilegios requeridos para authenticated.
--
-- No contiene datos sensibles ni configuración de entorno.
-- ============================================================

-- HU-19, HU-20, HU-21, HU-22 y HU-23 del módulo Producción.
-- Requiere el esquema histórico documentado en bd/.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.es_rol(p_rol text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles
    where id = (select auth.uid()) and rol = p_rol and activo
  );
$$;

create or replace function private.mi_sucursal()
returns uuid language sql stable security definer set search_path = ''
as $$
  select sucursal_id from public.perfiles
  where id = (select auth.uid()) and activo;
$$;

revoke all on function private.es_rol(text) from public, anon;
revoke all on function private.mi_sucursal() from public, anon;
grant execute on function private.es_rol(text) to authenticated;
grant execute on function private.mi_sucursal() to authenticated;

drop policy if exists "producciones_select_produccion" on public.producciones;
create policy "producciones_select_produccion" on public.producciones
  for select to authenticated
  using (
    private.es_rol('administrador')
    or (private.es_rol('produccion') and sucursal_id = private.mi_sucursal())
  );

drop policy if exists "producciones_insert_produccion" on public.producciones;
create policy "producciones_insert_produccion" on public.producciones
  for insert to authenticated
  with check (
    creado_por = (select auth.uid())
    and sucursal_id = private.mi_sucursal()
    and (private.es_rol('produccion') or private.es_rol('administrador'))
  );

-- No se crea política UPDATE/DELETE para Producción. La política UPDATE
-- administrativa existente en bd/rls_policies.sql continúa siendo la única.

drop policy if exists "incidencias_produccion_select_produccion" on public.incidencias_produccion;
create policy "incidencias_produccion_select_produccion" on public.incidencias_produccion
  for select to authenticated
  using (
    private.es_rol('administrador')
    or (
      private.es_rol('produccion')
      and creado_por in (
        select id from public.perfiles where sucursal_id = private.mi_sucursal()
      )
    )
  );

drop policy if exists "incidencias_produccion_insert_produccion" on public.incidencias_produccion;
create policy "incidencias_produccion_insert_produccion" on public.incidencias_produccion
  for insert to authenticated
  with check (
    creado_por = (select auth.uid())
    and (private.es_rol('produccion') or private.es_rol('administrador'))
    and (
      produccion_id is null
      or exists (
        select 1 from public.producciones p
        where p.id = produccion_id and p.sucursal_id = private.mi_sucursal()
      )
    )
  );

drop policy if exists "stock_envases_select_operativo" on public.stock_envases;
create policy "stock_envases_select_operativo" on public.stock_envases
  for select to authenticated
  using (
    private.es_rol('administrador')
    or (
      (private.es_rol('bodega') or private.es_rol('produccion'))
      and sucursal_id = private.mi_sucursal()
    )
  );

-- La producción y los movimientos de producto/envase se confirman dentro de
-- la misma transacción disparada por el INSERT en producciones.
create or replace function public.trg_produccion_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_tipo_empaque uuid;
  v_categoria text;
  v_envases integer;
begin
  select p.tipo_empaque_id, te.categoria
    into v_tipo_empaque, v_categoria
  from public.productos p
  left join public.tipos_empaque te on te.id = p.tipo_empaque_id
  where p.id = new.producto_id and p.activo;

  if not found then
    raise exception 'El producto no existe o está desactivado';
  end if;

  if v_categoria = 'retornable' then
    select cantidad into v_envases
    from public.stock_envases
    where sucursal_id = new.sucursal_id and tipo_empaque_id = v_tipo_empaque
    for update;

    if coalesce(v_envases, 0) < new.cantidad then
      raise exception 'No hay envases vacíos suficientes. Disponibles: %', coalesce(v_envases, 0);
    end if;

    update public.stock_envases
    set cantidad = cantidad - new.cantidad, modificado_en = now()
    where sucursal_id = new.sucursal_id and tipo_empaque_id = v_tipo_empaque;
  end if;

  insert into public.stock_bodega (sucursal_id, producto_id, cantidad, modificado_en)
  values (new.sucursal_id, new.producto_id, new.cantidad, now())
  on conflict (sucursal_id, producto_id)
  do update set cantidad = public.stock_bodega.cantidad + excluded.cantidad,
                modificado_en = now();
  return new;
end;
$$;

create or replace function public.trg_produccion_anular()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_tipo_empaque uuid;
  v_categoria text;
begin
  update public.stock_bodega
  set cantidad = greatest(cantidad - new.cantidad, 0), modificado_en = now()
  where sucursal_id = new.sucursal_id and producto_id = new.producto_id;

  select p.tipo_empaque_id, te.categoria
    into v_tipo_empaque, v_categoria
  from public.productos p
  left join public.tipos_empaque te on te.id = p.tipo_empaque_id
  where p.id = new.producto_id;

  if v_categoria = 'retornable' then
    insert into public.stock_envases (sucursal_id, tipo_empaque_id, cantidad, modificado_en)
    values (new.sucursal_id, v_tipo_empaque, new.cantidad, now())
    on conflict (sucursal_id, tipo_empaque_id)
    do update set cantidad = public.stock_envases.cantidad + excluded.cantidad,
                  modificado_en = now();
  end if;
  return new;
end;
$$;

alter table public.incidencias_produccion
  drop constraint if exists incidencias_produccion_descripcion_largo;
alter table public.incidencias_produccion
  add constraint incidencias_produccion_descripcion_largo
  check (char_length(btrim(descripcion)) between 1 and 1000);

drop trigger if exists trg_audit_incidencias_produccion on public.incidencias_produccion;
create trigger trg_audit_incidencias_produccion
  after insert or update on public.incidencias_produccion
  for each row execute function public.fn_auditoria_simple();

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
group by sucursal_id, producto_id, (creado_en at time zone 'America/Santiago')::date;

revoke all on public.v_indicadores_produccion_diarios from public, anon;
grant select on public.v_indicadores_produccion_diarios to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'producciones') then
    alter publication supabase_realtime add table public.producciones;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'incidencias_produccion') then
    alter publication supabase_realtime add table public.incidencias_produccion;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stock_envases') then
    alter publication supabase_realtime add table public.stock_envases;
  end if;
end;
$$;

-- =========================================================
-- Privilegios necesarios para el rol authenticated
-- RLS sigue controlando qué filas puede utilizar cada usuario.
-- =========================================================

grant select on table public.perfiles to authenticated;

grant select on table public.productos to authenticated;
grant select on table public.tipos_empaque to authenticated;

grant select on table public.stock_envases to authenticated;
grant select on table public.stock_bodega to authenticated;

grant select, insert on table public.producciones to authenticated;

grant select, insert on table public.incidencias_produccion to authenticated;

grant select on table public.v_indicadores_produccion_diarios to authenticated;
