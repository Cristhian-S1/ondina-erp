-- HU-29 F1-F5: enforce loss/return integrity for RPC and direct clients.
-- Parent locks precede balance locks and FK key-share locks; movements stay in B3/B6.
create function private.validar_merma_hu29()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
    if new.motivo is null or new.motivo ~ '^[[:space:]]*$' then
        raise exception 'Indica el motivo de la merma.';
    end if;
    if new.despacho_id is not null and new.tipo_empaque_id is not null then
        raise exception 'Registra los envases dañados del despacho como devolución en estado malo.';
    end if;
    if new.despacho_id is not null then
        perform 1 from public.despachos where id=new.despacho_id for update;
    end if;
    return new;
end;
$$;
revoke execute on function private.validar_merma_hu29() from public, anon, authenticated;
create trigger validar_merma_hu29 before insert on public.mermas
  for each row execute function private.validar_merma_hu29();

-- Close the reverse-order hole: return after loss must obey the same combined bound.
-- BEFORE trigger name sorts before trg_devolucion_producto, which owns stock effects.
create function private.validar_devolucion_mermas_hu29()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_despachado bigint; v_devuelto bigint; v_mermas bigint;
begin
    if new.anulado then return new; end if;
    perform 1 from public.despachos where id=new.despacho_id for update;
    select coalesce(sum(cantidad),0) into v_despachado from public.despacho_detalles
      where despacho_id=new.despacho_id and producto_id=new.producto_id;
    select coalesce(sum(cantidad),0) into v_devuelto from public.devoluciones_productos
      where despacho_id=new.despacho_id and producto_id=new.producto_id and not anulado;
    select coalesce(sum(cantidad),0) into v_mermas from public.mermas
      where despacho_id=new.despacho_id and producto_id=new.producto_id and not anulado;
    -- Preserve the B3 error contract when there are no active losses.
    -- trg_devolucion_producto still enforces the original return-only bound.
    if v_mermas > 0 and v_devuelto+v_mermas+new.cantidad > v_despachado then
        raise exception 'La devolución y las mermas superan lo despachado de ese producto.';
    end if;
    return new;
end;
$$;
revoke execute on function private.validar_devolucion_mermas_hu29() from public, anon, authenticated;
create trigger a_validar_devolucion_mermas_hu29 before insert on public.devoluciones_productos
  for each row execute function private.validar_devolucion_mermas_hu29();

-- Keep existing RLS as defense in depth; authenticated cancellation uses the RPC.
revoke update on public.mermas from authenticated;
revoke update (anulado) on public.mermas from authenticated;

create or replace function public.registrar_merma_bodega(
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
        if not found or d.sucursal_id is distinct from p_sucursal_id then
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

create or replace function public.anular_merma_bodega(p_merma_id uuid,p_motivo text)
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
    if not found or (private.es_admin_global() or m.sucursal_id=private.mi_sucursal()) is not true then
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

