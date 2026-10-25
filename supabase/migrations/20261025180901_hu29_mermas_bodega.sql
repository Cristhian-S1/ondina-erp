-- HU-29 approved new objects only; existing triggers, ACLs and policies are unchanged.
-- Daily aggregates restate active event-day facts, not historical closing balances.
create table private.solicitudes_merma_bodega (
    idempotency_key uuid primary key,
    merma_id uuid not null unique references public.mermas(id),
    creado_por uuid not null references public.perfiles(id),
    creado_en timestamptz not null default now(),
    payload jsonb not null
);
alter table private.solicitudes_merma_bodega enable row level security;
revoke all on private.solicitudes_merma_bodega from public, anon, authenticated;

create function public.registrar_merma_bodega(
    p_sucursal_id uuid,
    p_origen text,
    p_despacho_id uuid,
    p_producto_id uuid,
    p_tipo_empaque_id uuid,
    p_cantidad integer,
    p_motivo text,
    p_idempotency_key uuid,
    p_devolucion_envase_id uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
    d public.despachos%rowtype;
    s private.solicitudes_merma_bodega%rowtype;
    v_payload jsonb;
    v_id uuid;
    v_motivo text := pg_catalog.btrim(p_motivo);
    v_previo text := pg_catalog.current_setting('ondina.motivo', true);
begin
    if auth.uid() is null
       or (private.es_rol('bodega') or private.es_rol('administrador')) is not true
       or (private.es_admin_global() or p_sucursal_id = private.mi_sucursal()) is not true then
        raise exception using errcode='42501',
          message='No tienes permisos para registrar mermas en esta sucursal.';
    end if;
    if p_sucursal_id is null then raise exception 'Selecciona una sucursal.'; end if;
    if p_idempotency_key is null then raise exception 'Indica la clave de reintento de la merma.'; end if;
    if p_devolucion_envase_id is not null then
        raise exception 'Los envases dañados en una devolución no se registran otra vez como merma.';
    end if;
    if p_origen is null or p_origen not in ('bodega','despacho') then
        raise exception 'Selecciona un origen de merma válido.';
    end if;
    if (p_origen='bodega' and p_despacho_id is not null)
       or (p_origen='despacho' and p_despacho_id is null) then
        raise exception 'El origen no coincide con el despacho indicado.';
    end if;
    if (p_producto_id is null) = (p_tipo_empaque_id is null) then
        raise exception 'Indica solo un producto o un tipo de envase.';
    end if;
    if p_despacho_id is not null and p_tipo_empaque_id is not null then
        raise exception 'Registra los envases dañados del despacho como devolución en estado malo.';
    end if;
    if p_cantidad is null or p_cantidad <= 0 then raise exception 'La cantidad debe ser un entero mayor que cero.'; end if;
    if v_motivo is null or v_motivo = '' then raise exception 'Indica el motivo de la merma.'; end if;
    v_payload := pg_catalog.jsonb_build_object(
        'sucursal_id',p_sucursal_id,'origen',p_origen,'despacho_id',p_despacho_id,
        'producto_id',p_producto_id,'tipo_empaque_id',p_tipo_empaque_id,
        'cantidad',p_cantidad,'motivo',v_motivo);
    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('registrar_merma_bodega:'||p_idempotency_key::text,0));
    select * into s from private.solicitudes_merma_bodega
      where idempotency_key=p_idempotency_key;
    if found then
        if s.creado_por is distinct from auth.uid() or s.payload is distinct from v_payload then
            raise exception 'La clave de reintento pertenece a otra operación.';
        end if;
        return s.merma_id;
    end if;
    -- Replay precedes mutable catalog/dispatch state checks: return the historical ID,
    -- even if the item was later deactivated or the loss/dispatch was annulled.
    if not exists(select 1 from public.sucursales where id=p_sucursal_id) then
        raise exception 'La sucursal no existe.';
    end if;
    if p_producto_id is not null and not exists(
        select 1 from public.productos where id=p_producto_id and activo
    ) then raise exception 'El producto no existe o está desactivado'; end if;
    if p_tipo_empaque_id is not null and not exists(
        select 1 from public.tipos_empaque where id=p_tipo_empaque_id and activo
    ) then raise exception 'El tipo de envase no existe o está desactivado.'; end if;
    if p_despacho_id is not null then
        select * into d from public.despachos where id=p_despacho_id for update;
        if not found then raise exception 'El despacho no existe'; end if;
        if d.sucursal_id is distinct from p_sucursal_id then
            raise exception using errcode='42501',
              message='No tienes permisos para registrar mermas en esta sucursal.';
        end if;
        if d.anulado then raise exception 'El despacho está anulado'; end if;
    end if;
    perform private.bloquear_saldos(p_sucursal_id,d.vendedor_id);
    perform pg_catalog.set_config('ondina.motivo',v_motivo,true);
    insert into public.mermas(sucursal_id,despacho_id,producto_id,tipo_empaque_id,
                             cantidad,motivo,creado_por)
    values(p_sucursal_id,p_despacho_id,p_producto_id,p_tipo_empaque_id,
           p_cantidad,v_motivo,auth.uid()) returning id into v_id;
    insert into private.solicitudes_merma_bodega(idempotency_key,merma_id,creado_por,payload)
    values(p_idempotency_key,v_id,auth.uid(),v_payload);
    perform pg_catalog.set_config('ondina.motivo',coalesce(v_previo,''),true);
    return v_id;
end;
$$;
revoke execute on function public.registrar_merma_bodega(uuid,text,uuid,uuid,uuid,integer,text,uuid,uuid)
  from public, anon;
grant execute on function public.registrar_merma_bodega(uuid,text,uuid,uuid,uuid,integer,text,uuid,uuid)
  to authenticated, service_role;

create function public.anular_merma_bodega(p_merma_id uuid,p_motivo text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
    m public.mermas%rowtype;
    v_previo text := pg_catalog.current_setting('ondina.motivo',true);
begin
    if auth.uid() is null or private.es_rol('administrador') is not true then
        raise exception using errcode='42501',message='Solo administración puede anular mermas.';
    end if;
    if p_motivo is null or pg_catalog.btrim(p_motivo)='' then
        raise exception 'Indica el motivo de la anulación.';
    end if;
    select * into m from public.mermas where id=p_merma_id;
    if not found then raise exception 'La merma no existe.'; end if;
    if (private.es_admin_global() or m.sucursal_id=private.mi_sucursal()) is not true then
        raise exception using errcode='42501',message='No tienes permisos para anular esta merma.';
    end if;
    if m.despacho_id is not null then
        perform 1 from public.despachos where id=m.despacho_id for update;
    end if;
    select * into m from public.mermas where id=p_merma_id for update;
    if m.anulado then return m.id; end if;
    perform pg_catalog.set_config('ondina.motivo',pg_catalog.btrim(p_motivo),true);
    update public.mermas set anulado=true where id=m.id;
    perform pg_catalog.set_config('ondina.motivo',coalesce(v_previo,''),true);
    return m.id;
end;
$$;
revoke execute on function public.anular_merma_bodega(uuid,text) from public, anon;
grant execute on function public.anular_merma_bodega(uuid,text) to authenticated, service_role;

create function public.cuadre_diario_bodega(
    p_sucursal_id uuid,p_desde date,p_hasta date,p_vendedor_id uuid default null
) returns table(
    sucursal_id uuid,vendedor_id uuid,fecha date,producto_id uuid,
    despachado bigint,vendido bigint,devuelto bigint,mermas bigint,
    esperado_en_carga bigint,saldo_inicial bigint,carga_actual bigint,
    diferencia_carga bigint,comparacion_disponible boolean
)
language plpgsql stable security definer set search_path = '' as $$
declare
    v_desde timestamptz;
    v_hasta timestamptz;
    v_hoy date := (now() at time zone 'America/Santiago')::date;
begin
    if auth.uid() is null
       or (private.es_rol('bodega') or private.es_rol('administrador')) is not true
       or (private.es_admin_global() or p_sucursal_id=private.mi_sucursal()) is not true then
        raise exception using errcode='42501',message='No tienes permisos para consultar este cuadre.';
    end if;
    if p_sucursal_id is null or p_desde is null or p_hasta is null
       or p_hasta<p_desde or p_hasta-p_desde>30 or p_hasta>v_hoy then
        raise exception 'Indica un rango válido de hasta 31 días, sin fechas futuras.';
    end if;
    if not exists(select 1 from public.sucursales s where s.id=p_sucursal_id) then
        raise exception 'La sucursal no existe.';
    end if;
    if p_vendedor_id is not null and not exists(
        select 1 from public.perfiles p where p.id=p_vendedor_id
          and p.rol='vendedor' and p.sucursal_id=p_sucursal_id
    ) then raise exception 'El vendedor no pertenece a esta sucursal.'; end if;
    -- Convert both local dates independently: DST days are not necessarily 24h.
    v_desde := p_desde::timestamp at time zone 'America/Santiago';
    v_hasta := (p_hasta+1)::timestamp at time zone 'America/Santiago';
    return query
    with mov as (
        select d.sucursal_id,d.vendedor_id,dd.producto_id,dd.creado_en ts,
               dd.cantidad::bigint nd,0::bigint nv,0::bigint nr,0::bigint nm
        from public.despachos d join public.despacho_detalles dd on dd.despacho_id=d.id
        where d.sucursal_id=p_sucursal_id and not d.anulado
          and dd.creado_en>=v_desde and dd.creado_en<v_hasta
          and (p_vendedor_id is null or d.vendedor_id=p_vendedor_id)
        union all
        select v.sucursal_id,v.vendedor_id,vd.producto_id,v.creado_en,
               0,vd.cantidad::bigint,0,0
        from public.ventas v join public.venta_detalles vd on vd.venta_id=v.id
        where v.sucursal_id=p_sucursal_id and not v.anulado
          and v.creado_en>=v_desde and v.creado_en<v_hasta
          and (p_vendedor_id is null or v.vendedor_id=p_vendedor_id)
        union all
        select d.sucursal_id,d.vendedor_id,r.producto_id,r.creado_en,0,0,r.cantidad::bigint,0
        from public.devoluciones_productos r join public.despachos d on d.id=r.despacho_id
        where d.sucursal_id=p_sucursal_id and not d.anulado and not r.anulado
          and r.creado_en>=v_desde and r.creado_en<v_hasta
          and (p_vendedor_id is null or d.vendedor_id=p_vendedor_id)
        union all
        select m.sucursal_id,d.vendedor_id,m.producto_id,m.creado_en,0,0,0,m.cantidad::bigint
        from public.mermas m join public.despachos d on d.id=m.despacho_id
        where m.sucursal_id=p_sucursal_id and d.sucursal_id=p_sucursal_id
          and not d.anulado and not m.anulado and m.producto_id is not null
          and m.creado_en>=v_desde and m.creado_en<v_hasta
          and (p_vendedor_id is null or d.vendedor_id=p_vendedor_id)
    ), claves as (
        select x.sucursal_id,x.vendedor_id,(x.ts at time zone 'America/Santiago')::date dia,x.producto_id
        from mov x
        union
        -- Include carry-over load even when there were no movements today.
        select p_sucursal_id,c.vendedor_id,v_hoy,c.producto_id
        from public.carga_vendedor c join public.perfiles p on p.id=c.vendedor_id
        where p.sucursal_id=p_sucursal_id and p.rol='vendedor'
          and v_hoy between p_desde and p_hasta
          and (p_vendedor_id is null or c.vendedor_id=p_vendedor_id)
    ), tot as (
        select k.sucursal_id,k.vendedor_id,k.dia,k.producto_id,
               coalesce(sum(x.nd),0)::bigint nd,coalesce(sum(x.nv),0)::bigint nv,
               coalesce(sum(x.nr),0)::bigint nr,coalesce(sum(x.nm),0)::bigint nm
        from claves k left join mov x on x.sucursal_id=k.sucursal_id
          and x.vendedor_id=k.vendedor_id and x.producto_id=k.producto_id
          and (x.ts at time zone 'America/Santiago')::date=k.dia
        group by k.sucursal_id,k.vendedor_id,k.dia,k.producto_id
    )
    -- Optional audit-supported comparison is deliberately unavailable in this scope.
    select t.sucursal_id,t.vendedor_id,t.dia,t.producto_id,t.nd,t.nv,t.nr,t.nm,
           t.nd-t.nv-t.nr-t.nm,null::bigint,null::bigint,null::bigint,false
    from tot t order by t.dia,t.vendedor_id,t.producto_id;
end;
$$;
revoke execute on function public.cuadre_diario_bodega(uuid,date,date,uuid) from public, anon;
grant execute on function public.cuadre_diario_bodega(uuid,date,date,uuid) to authenticated, service_role;

alter table private.solicitudes_merma_bodega owner to postgres;
alter function public.registrar_merma_bodega(uuid,text,uuid,uuid,uuid,integer,text,uuid,uuid) owner to postgres;
alter function public.anular_merma_bodega(uuid,text) owner to postgres;
alter function public.cuadre_diario_bodega(uuid,date,date,uuid) owner to postgres;
