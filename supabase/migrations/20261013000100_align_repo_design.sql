-- Reconcile absent historical objects without rewriting data or stock.
-- Existing baseline business functions, grants and unrelated policies stay intact.


create or replace function public.fn_sello_modificacion()
returns trigger language plpgsql set search_path = ''
as $$
begin
    if tg_op = 'UPDATE' then
        new.modificado_en := now();
        new.modificado_por := auth.uid();
    end if;
    return new;
end;
$$;

revoke all on function public.fn_sello_modificacion() from public, anon, authenticated;

create or replace function public.fn_auditoria()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
    insert into public.auditoria (tabla, registro_id, accion, usuario_id, valores_anteriores, valores_nuevos)
    values (
        tg_table_name,
        coalesce(new.id, old.id),
        case
            when tg_op = 'INSERT' then 'INSERT'
            when tg_op = 'UPDATE' and new.anulado and not old.anulado then 'ANULACION'
            else 'UPDATE'
        end,
        auth.uid(),
        case when tg_op = 'UPDATE' then to_jsonb(old) end,
        to_jsonb(new)
    );
    return new;
end;
$$;

revoke all on function public.fn_auditoria() from public, anon, authenticated;

create or replace function public.trg_merma_anular()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
    v_despacho public.despachos%rowtype;
begin
    if new.producto_id is not null then
        if new.despacho_id is not null then
            select * into v_despacho from public.despachos where id = new.despacho_id;
            -- Route losses restore seller load; plant losses restore warehouse stock.
            update public.carga_vendedor
            set cantidad = cantidad + new.cantidad, modificado_en = now()
            where vendedor_id = v_despacho.vendedor_id
              and producto_id  = new.producto_id;
        else
            update public.stock_bodega
            set cantidad = cantidad + new.cantidad, modificado_en = now()
            where sucursal_id = new.sucursal_id and producto_id = new.producto_id;
        end if;
    elsif new.tipo_empaque_id is not null then
        update public.stock_envases
        set cantidad = cantidad + new.cantidad, modificado_en = now()
        where sucursal_id = new.sucursal_id and tipo_empaque_id = new.tipo_empaque_id;
    end if;
    return new;
end;
$$;

revoke all on function public.trg_merma_anular() from public, anon, authenticated;

drop trigger if exists trg_audit_ventas on public.ventas;
create trigger trg_audit_ventas after insert or update on public.ventas
    for each row execute function public.fn_auditoria();

drop trigger if exists trg_sello_ventas on public.ventas;
create trigger trg_sello_ventas before update on public.ventas
    for each row execute function public.fn_sello_modificacion();

drop trigger if exists trg_audit_despachos on public.despachos;
create trigger trg_audit_despachos after insert or update on public.despachos
    for each row execute function public.fn_auditoria();

drop trigger if exists trg_sello_despachos on public.despachos;
create trigger trg_sello_despachos before update on public.despachos
    for each row execute function public.fn_sello_modificacion();

drop trigger if exists trg_audit_producciones on public.producciones;
create trigger trg_audit_producciones after insert or update on public.producciones
    for each row execute function public.fn_auditoria();

drop trigger if exists trg_audit_gastos on public.gastos_extras;
create trigger trg_audit_gastos after insert or update on public.gastos_extras
    for each row execute function public.fn_auditoria();

drop trigger if exists trg_sello_gastos on public.gastos_extras;
create trigger trg_sello_gastos before update on public.gastos_extras
    for each row execute function public.fn_sello_modificacion();

drop trigger if exists trg_audit_mermas on public.mermas;
create trigger trg_audit_mermas after insert or update on public.mermas
    for each row execute function public.fn_auditoria();

drop trigger if exists trg_sello_clientes on public.clientes;
create trigger trg_sello_clientes before update on public.clientes
    for each row execute function public.fn_sello_modificacion();

drop trigger if exists trg_audit_devoluciones_productos on public.devoluciones_productos;
create trigger trg_audit_devoluciones_productos
    after insert or update on public.devoluciones_productos
    for each row execute function public.fn_auditoria();

drop trigger if exists trg_audit_devoluciones_envases on public.devoluciones_envases;
create trigger trg_audit_devoluciones_envases
    after insert or update on public.devoluciones_envases
    for each row execute function public.fn_auditoria();

drop trigger if exists trg_audit_venta_detalles on public.venta_detalles;
create trigger trg_audit_venta_detalles
    after insert or update on public.venta_detalles
    for each row execute function public.fn_auditoria_simple();

drop trigger if exists trg_audit_despacho_detalles on public.despacho_detalles;
create trigger trg_audit_despacho_detalles
    after insert or update on public.despacho_detalles
    for each row execute function public.fn_auditoria_simple();

drop trigger if exists trg_audit_incidencias_produccion on public.incidencias_produccion;
create trigger trg_audit_incidencias_produccion after insert or update on public.incidencias_produccion for each row execute function public.fn_auditoria_simple();

drop trigger if exists trg_merma_anular on public.mermas;
create trigger trg_merma_anular after update of anulado on public.mermas for each row when (new.anulado and not old.anulado) execute function public.trg_merma_anular();

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

create or replace view public.v_stock_actual with (security_invoker = true) as
select p.id as producto_id, p.nombre, p.tipo,
       s.sucursal_id,
       coalesce(s.cantidad, 0) as cantidad, s.modificado_en
from public.productos p
left join public.stock_bodega s on s.producto_id = p.id
where p.activo;

revoke all on public.v_stock_actual from public, anon, authenticated;
grant select on public.v_stock_actual to authenticated, service_role;

create or replace view public.v_cuadre_despacho with (security_invoker = true) as
select
    d.id as despacho_id,
    d.sucursal_id,
    d.vendedor_id,
    d.creado_en::date as fecha,
    dd.producto_id,
    sum(dd.cantidad) as cantidad_despachada,
    coalesce(v.cantidad_vendida, 0)   as cantidad_vendida,
    coalesce(dp.cantidad_devuelta, 0) as cantidad_devuelta,
    coalesce(m.cantidad_merma, 0)     as cantidad_merma,
    sum(dd.cantidad) - coalesce(v.cantidad_vendida, 0) - coalesce(dp.cantidad_devuelta, 0)
        - coalesce(m.cantidad_merma, 0) as diferencia
from public.despachos d
join public.despacho_detalles dd on dd.despacho_id = d.id
left join (
    select vd.producto_id, vt.vendedor_id, vt.sucursal_id, vt.creado_en::date as fecha,
           sum(vd.cantidad) as cantidad_vendida
    from public.ventas vt join public.venta_detalles vd on vd.venta_id = vt.id
    where not vt.anulado
    group by vd.producto_id, vt.vendedor_id, vt.sucursal_id, vt.creado_en::date
) v on v.producto_id = dd.producto_id
     and v.vendedor_id = d.vendedor_id
     and v.sucursal_id = d.sucursal_id
     and v.fecha = d.creado_en::date
left join (
    select despacho_id, producto_id, sum(cantidad) as cantidad_devuelta
    from public.devoluciones_productos where not anulado group by despacho_id, producto_id
) dp on dp.despacho_id = d.id and dp.producto_id = dd.producto_id
left join (
    select despacho_id, producto_id, sum(cantidad) as cantidad_merma
    from public.mermas where not anulado and producto_id is not null group by despacho_id, producto_id
) m on m.despacho_id = d.id and m.producto_id = dd.producto_id
where not d.anulado
group by d.id, d.sucursal_id, d.vendedor_id, d.creado_en::date, dd.producto_id,
         v.cantidad_vendida, dp.cantidad_devuelta, m.cantidad_merma;

revoke all on public.v_cuadre_despacho from public, anon, authenticated;
grant select on public.v_cuadre_despacho to authenticated, service_role;

create or replace view public.v_ventas_diarias with (security_invoker = true) as
select creado_en::date as fecha, sucursal_id, vendedor_id,
       count(*) as cantidad_ventas, sum(total) as total_ingresos
from public.ventas
where not anulado
group by creado_en::date, sucursal_id, vendedor_id;

revoke all on public.v_ventas_diarias from public, anon, authenticated;
grant select on public.v_ventas_diarias to authenticated, service_role;

create or replace view public.v_clientes_inactivos with (security_invoker = true) as
select c.id as cliente_id, c.nombre, c.sucursal_id, c.vendedor_id,
       max(v.creado_en) as ultima_compra,
       (select valor::integer from public.configuracion
        where clave = 'dias_inactividad_cliente') as dias_configurados,
       now()::date - max(v.creado_en)::date as dias_sin_comprar
from public.clientes c
left join public.ventas v on v.cliente_id = c.id and not v.anulado
where c.activo
group by c.id, c.nombre, c.sucursal_id, c.vendedor_id
having max(v.creado_en) is null
    or now()::date - max(v.creado_en)::date >
       (select valor::integer from public.configuracion
        where clave = 'dias_inactividad_cliente');

revoke all on public.v_clientes_inactivos from public, anon, authenticated;
grant select on public.v_clientes_inactivos to authenticated, service_role;

create or replace view public.v_historial_cliente with (security_invoker = true) as
select c.id as cliente_id, c.nombre, c.sucursal_id, c.vendedor_id,
       count(distinct v.id) as cantidad_compras,
       coalesce(sum(v.total), 0) as total_comprado,
       max(v.creado_en) as ultima_compra,
       now()::date - max(v.creado_en)::date as dias_sin_comprar
from public.clientes c
left join public.ventas v on v.cliente_id = c.id and not v.anulado
where c.activo
group by c.id, c.nombre, c.sucursal_id, c.vendedor_id;

revoke all on public.v_historial_cliente from public, anon, authenticated;
grant select on public.v_historial_cliente to authenticated, service_role;

create or replace view public.v_ventas_producto with (security_invoker = true) as
select v.creado_en::date as fecha, v.sucursal_id, v.vendedor_id,
       vd.producto_id, p.nombre as producto, p.tipo,
       sum(vd.cantidad) as cantidad,
       sum(vd.subtotal) as total
from public.ventas v
join public.venta_detalles vd on vd.venta_id = v.id
join public.productos p on p.id = vd.producto_id
where not v.anulado
group by v.creado_en::date, v.sucursal_id, v.vendedor_id,
         vd.producto_id, p.nombre, p.tipo;

revoke all on public.v_ventas_producto from public, anon, authenticated;
grant select on public.v_ventas_producto to authenticated, service_role;

-- Preserve older incident rows; validate historical content in a later cleanup.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.incidencias_produccion'::regclass and conname = 'incidencias_produccion_descripcion_largo') then
    alter table public.incidencias_produccion add constraint incidencias_produccion_descripcion_largo
      check (char_length(btrim(descripcion)) between 1 and 1000) not valid;
  end if;
end;
$$;

-- Only these historical production subscriptions; no new product features.
do $$
declare v_table text;
begin
  foreach v_table in array array['producciones', 'incidencias_produccion', 'stock_envases'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;

-- Historical secondary indexes absent from the snapshot (no data rewrites).
create index if not exists idx_clientes_sucursal on public.clientes (sucursal_id);
create index if not exists idx_clientes_vendedor on public.clientes (vendedor_id);
create index if not exists idx_ventas_sucursal on public.ventas (sucursal_id);
create index if not exists idx_ventas_vendedor on public.ventas (vendedor_id);
create index if not exists idx_ventas_cliente on public.ventas (cliente_id);
create index if not exists idx_ventas_creado_en on public.ventas (creado_en);
create index if not exists idx_venta_detalles_venta on public.venta_detalles (venta_id);
create index if not exists idx_venta_detalles_producto on public.venta_detalles (producto_id);
create index if not exists idx_despachos_sucursal on public.despachos (sucursal_id);
create index if not exists idx_despachos_vendedor on public.despachos (vendedor_id);
create index if not exists idx_despachos_creado_en on public.despachos (creado_en);
create index if not exists idx_despacho_detalles_despacho on public.despacho_detalles (despacho_id);
create index if not exists idx_despacho_detalles_producto on public.despacho_detalles (producto_id);
create index if not exists idx_devoluciones_productos_despacho on public.devoluciones_productos (despacho_id);
create index if not exists idx_devoluciones_envases_despacho on public.devoluciones_envases (despacho_id);
create index if not exists idx_mermas_sucursal on public.mermas (sucursal_id);
create index if not exists idx_mermas_despacho on public.mermas (despacho_id);
create index if not exists idx_producciones_sucursal on public.producciones (sucursal_id);
create index if not exists idx_producciones_creado_en on public.producciones (creado_en);
create index if not exists idx_ubicaciones_vendedor on public.ubicaciones_vendedores (vendedor_id, registrado_en desc);
create index if not exists idx_auditoria_creado_en on public.auditoria (creado_en);
