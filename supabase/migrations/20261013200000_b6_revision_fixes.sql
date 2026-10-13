-- B6 / OND-5gi.9: #29 #30 #31 #32 #33 #42; backend review R1 RB-1 RB-5 RB-9 RB-11 RB-15 RB-16.
-- Forward only: no row, balance, price or history rewrite. Every replaced function keeps
-- its B3 SECURITY DEFINER contract and empty search_path.

-- RB-9: a sale line cannot be attached to an annulled sale. The sale row is locked
-- first, so a concurrent annulment cannot race the insert.
create or replace function public.trg_venta_detalle_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v public.ventas%rowtype;
begin
 select * into v from public.ventas where id=new.venta_id for update;
 if v.anulado then raise exception 'La venta está anulada'; end if;
 perform private.bloquear_saldos(v.sucursal_id,v.vendedor_id);
 update public.carga_vendedor set cantidad=cantidad-new.cantidad,modificado_en=now()
 where vendedor_id=v.vendedor_id and producto_id=new.producto_id;
 if not found then raise exception 'Stock o carga insuficiente para completar la operación.'; end if;
 return new;
end;
$$;

-- RB-1: a loss linked to a dispatch already left the seller's load. Cancelling the
-- dispatch returns only what is still outstanding: dispatched - returned - active
-- linked losses. The loss itself stays recorded, as it is physically gone.
create or replace function public.trg_despacho_anular()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
 perform private.bloquear_saldos(old.sucursal_id,old.vendedor_id);
 for r in select dd.producto_id,
  sum(dd.cantidad)
  - coalesce((select sum(dp.cantidad) from public.devoluciones_productos dp where dp.despacho_id=old.id and dp.producto_id=dd.producto_id and not dp.anulado),0)
  - coalesce((select sum(m.cantidad) from public.mermas m where m.despacho_id=old.id and m.producto_id=dd.producto_id and not m.anulado),0) cantidad
 from public.despacho_detalles dd where dd.despacho_id=old.id group by dd.producto_id order by dd.producto_id loop
 if r.cantidad<0 then raise exception 'No se puede devolver más de lo despachado.'; end if;
 update public.stock_bodega set cantidad=cantidad+r.cantidad,modificado_en=now() where sucursal_id=old.sucursal_id and producto_id=r.producto_id;
 update public.carga_vendedor set cantidad=cantidad-r.cantidad,modificado_en=now() where vendedor_id=old.vendedor_id and producto_id=r.producto_id;
 end loop;
 for r in select tipo_empaque_id,sum(cantidad) cantidad from (
 select tipo_empaque_id,cantidad from public.despacho_envases where despacho_id=old.id
 union all select tipo_empaque_id,-cantidad from public.devoluciones_envases where despacho_id=old.id and not anulado and estado='bueno'
 ) mov group by tipo_empaque_id order by tipo_empaque_id loop
 update public.stock_envases set cantidad=cantidad+r.cantidad,modificado_en=now() where sucursal_id=old.sucursal_id and tipo_empaque_id=r.tipo_empaque_id;
 end loop;
 -- Return annul triggers see the annulled parent and do not compensate twice.
 update public.devoluciones_productos set anulado=true where despacho_id=old.id and not anulado;
 update public.devoluciones_envases set anulado=true where despacho_id=old.id and not anulado;
 return new;
end;
$$;

-- RB-1: a linked product loss cannot exceed what is still outstanding on its dispatch,
-- so the cancellation above never computes a negative return. The AFTER INSERT row is
-- already visible to this transaction, hence the exclusion of NEW.id. The dispatch row
-- is locked by the first statement, serializing concurrent returns and losses.
create or replace function public.trg_merma_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
    v_despacho  public.despachos%rowtype;
    v_stock     integer;
    v_pendiente integer;
begin
    if new.anulado then return new; end if;
    if new.despacho_id is not null then
      select * into v_despacho from public.despachos where id=new.despacho_id for update;
      if v_despacho.anulado or v_despacho.sucursal_id is distinct from new.sucursal_id then raise exception 'El despacho está anulado o pertenece a otra sucursal.'; end if;
    end if;
    perform private.bloquear_saldos(new.sucursal_id, v_despacho.vendedor_id);

    -- ========================================================
    -- MERMA DE PRODUCTO
    -- ========================================================
    if new.producto_id is not null then

        -- ----------------------------------------------------
        -- Merma asociada a un despacho / vendedor
        -- ----------------------------------------------------
        if new.despacho_id is not null then

            select *
            into v_despacho
            from public.despachos
            where id = new.despacho_id;

            if not found then
                raise exception 'El despacho asociado no existe';
            end if;

            select coalesce((select sum(dd.cantidad) from public.despacho_detalles dd
                              where dd.despacho_id = new.despacho_id and dd.producto_id = new.producto_id), 0)
                 - coalesce((select sum(dp.cantidad) from public.devoluciones_productos dp
                              where dp.despacho_id = new.despacho_id and dp.producto_id = new.producto_id and not dp.anulado), 0)
                 - coalesce((select sum(m.cantidad) from public.mermas m
                              where m.despacho_id = new.despacho_id and m.producto_id = new.producto_id
                                and not m.anulado and m.id is distinct from new.id), 0)
            into v_pendiente;

            if new.cantidad > v_pendiente then
                raise exception 'La merma supera lo despachado pendiente de ese producto.';
            end if;

            select cantidad
            into v_stock
            from public.carga_vendedor
            where vendedor_id = v_despacho.vendedor_id
              and producto_id = new.producto_id
            for update;

            if coalesce(v_stock, 0) < new.cantidad then
                raise exception
                    'Cantidad de merma superior a la carga disponible. Disponible: %',
                    coalesce(v_stock, 0);
            end if;

            update public.carga_vendedor
            set cantidad = cantidad - new.cantidad,
                modificado_en = now()
            where vendedor_id = v_despacho.vendedor_id
              and producto_id = new.producto_id;


        -- ----------------------------------------------------
        -- Merma de planta / Producción
        -- ----------------------------------------------------
        else

            select cantidad
            into v_stock
            from public.stock_bodega
            where sucursal_id = new.sucursal_id
              and producto_id = new.producto_id
            for update;

            if coalesce(v_stock, 0) < new.cantidad then
                raise exception
                    'Cantidad de merma superior al stock disponible. Disponible: %',
                    coalesce(v_stock, 0);
            end if;

            update public.stock_bodega
            set cantidad = cantidad - new.cantidad,
                modificado_en = now()
            where sucursal_id = new.sucursal_id
              and producto_id = new.producto_id;

        end if;


    -- ========================================================
    -- MERMA DE ENVASE
    -- ========================================================
    elsif new.tipo_empaque_id is not null then

        select cantidad
        into v_stock
        from public.stock_envases
        where sucursal_id = new.sucursal_id
          and tipo_empaque_id = new.tipo_empaque_id
        for update;

        if coalesce(v_stock, 0) < new.cantidad then
            raise exception
                'Cantidad de merma superior a los envases disponibles. Disponibles: %',
                coalesce(v_stock, 0);
        end if;

        update public.stock_envases
        set cantidad = cantidad - new.cantidad,
            modificado_en = now()
        where sucursal_id = new.sucursal_id
          and tipo_empaque_id = new.tipo_empaque_id;

    else
        raise exception 'La merma debe indicar un producto o un tipo de envase';
    end if;

    return new;
end;
$$;

-- RB-1: a loss linked to an annulled dispatch was already excluded from that dispatch's
-- cancellation, so annulling it later must not return units to the seller's load.
-- Container losses come from the plant pool, not the load, and always compensate.
create or replace function public.trg_merma_anular()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d public.despachos%rowtype;
begin
 if old.despacho_id is not null then select * into d from public.despachos where id=old.despacho_id for update; end if;
 perform private.bloquear_saldos(old.sucursal_id,d.vendedor_id);
 if old.producto_id is not null then
  if old.despacho_id is not null then
   if d.anulado then return new; end if;
   update public.carga_vendedor set cantidad=cantidad+old.cantidad,modificado_en=now() where vendedor_id=d.vendedor_id and producto_id=old.producto_id;
  else
   update public.stock_bodega set cantidad=cantidad+old.cantidad,modificado_en=now() where sucursal_id=old.sucursal_id and producto_id=old.producto_id;
  end if;
 else
  update public.stock_envases set cantidad=cantidad+old.cantidad,modificado_en=now() where sucursal_id=old.sucursal_id and tipo_empaque_id=old.tipo_empaque_id;
 end if;
 return new;
end;
$$;

-- RB-11: corrections use the same retry ledger as returns. The key is recorded in
-- the same transaction as the correction, so a replay returns without a second
-- annul/reinsert cycle or audit row. The return type stays void for the client.
drop function public.corregir_devolucion(uuid,uuid,jsonb,jsonb,text);
create function public.corregir_devolucion(p_despacho_id uuid,p_creado_por uuid,p_productos jsonb,p_envases jsonb,p_motivo text default null,p_idempotency_key uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.despachos%rowtype; motivo_correccion text := coalesce(p_motivo,'Corrección de devolución (cliente anterior)'); anterior text;
begin
 if not private.es_rol('administrador') then raise exception 'Solo administración puede corregir devoluciones'; end if;
 if p_creado_por is distinct from auth.uid() then raise exception 'El usuario de la operación no coincide con la sesión.'; end if;
 if length(btrim(motivo_correccion))=0 then raise exception 'Indica el motivo de la corrección.'; end if;
 if p_idempotency_key is not null then
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('corregir_devolucion:'||p_idempotency_key::text,0));
 if exists(select 1 from private.solicitudes_devolucion where idempotency_key=p_idempotency_key and creado_por=auth.uid() and despacho_id=p_despacho_id
 and exists(select 1 from public.despachos where id=p_despacho_id and (private.es_admin_global() or sucursal_id=private.mi_sucursal()))) then return; end if;
 if exists(select 1 from private.solicitudes_devolucion where idempotency_key=p_idempotency_key) then raise exception 'La clave de reintento pertenece a otra operación.'; end if;
 end if;
 select * into d from public.despachos where id=p_despacho_id for update;
 if not found then raise exception 'El despacho no existe'; end if;
 if not (private.es_admin_global() or d.sucursal_id=private.mi_sucursal()) then raise exception 'No tienes permisos para corregir devoluciones de esta sucursal.'; end if;
 if d.anulado then raise exception 'El despacho está anulado'; end if;
 perform private.bloquear_saldos(d.sucursal_id,d.vendedor_id);
 anterior := current_setting('ondina.motivo',true);
 perform set_config('ondina.motivo',motivo_correccion,true);
 update public.devoluciones_productos set anulado=true,motivo=motivo_correccion where despacho_id=d.id and not anulado;
 update public.devoluciones_envases set anulado=true,motivo=motivo_correccion where despacho_id=d.id and not anulado;
 perform private.insertar_devolucion(d.id,p_productos,p_envases,motivo_correccion);
 if p_idempotency_key is not null then
 insert into private.solicitudes_devolucion(idempotency_key,despacho_id,creado_por) values(p_idempotency_key,d.id,auth.uid());
 end if;
 perform set_config('ondina.motivo',coalesce(anterior,''),true);
end;
$$;
revoke execute on function public.corregir_devolucion(uuid,uuid,jsonb,jsonb,text,uuid) from public,anon;
grant execute on function public.corregir_devolucion(uuid,uuid,jsonb,jsonb,text,uuid) to authenticated,service_role;

-- RB-15: bodega read every seller profile of its branch, including rut and telefono.
-- Profile rows are now limited to self and branch administration. Bodega gets the
-- seller list only through the narrow RPC below, which exposes no contact data.
-- Column grants cannot express "own row only", so the restriction is row-level.
create function private.es_vendedor_activo(p_id uuid, p_sucursal_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public.perfiles p
 where p.id = p_id and p.rol = 'vendedor' and p.activo and p.sucursal_id = p_sucursal_id
 and private.perfil_activo() and (private.es_admin_global() or p.sucursal_id = private.mi_sucursal()));
$$;
grant execute on function private.es_vendedor_activo(uuid,uuid) to authenticated;

drop policy perfiles_select_b2 on public.perfiles;
create policy perfiles_select_b6 on public.perfiles for SELECT to authenticated
 using ((select private.perfil_activo()) and (id = (select auth.uid()) or ((select private.es_rol('administrador')) and ((select private.es_admin_global()) or sucursal_id = (select private.mi_sucursal())))));

-- The dispatch and client policies checked the seller through perfiles as the caller,
-- which bodega can no longer read. The same check now runs in a scoped helper (RB-16).
drop policy despachos_insert_b2 on public.despachos;
create policy despachos_insert_b6 on public.despachos for INSERT to authenticated
 with check (((select private.es_rol('administrador')) or (select private.es_rol('bodega'))) and ((select private.es_admin_global()) or sucursal_id = (select private.mi_sucursal())) and creado_por = (select auth.uid()) and despachador_id = (select auth.uid()) and not anulado and private.es_vendedor_activo(vendedor_id, despachos.sucursal_id));

-- RB-16: the client seller must be an active seller of the same branch. The branch
-- match is also enforced by the clientes_vendedor_id_sucursal_id_fkey foreign key.
-- The baseline defines no UPDATE policy or grant on clientes, so this check guards INSERT.
drop policy clientes_insert_b2 on public.clientes;
create policy clientes_insert_b6 on public.clientes for INSERT to authenticated
 with check ((((select private.es_rol('administrador')) and ((select private.es_admin_global()) or sucursal_id = (select private.mi_sucursal()))) or ((select private.es_rol('vendedor')) and vendedor_id = (select auth.uid()) and sucursal_id = (select private.mi_sucursal()))) and creado_por = (select auth.uid()) and private.es_vendedor_activo(vendedor_id, sucursal_id));

-- Seller list for branch selectors (bodega dispatch and return screens). Scope matches
-- the RLS rules: administration by branch, bodega by its own branch.
create function public.vendedores_sucursal(p_sucursal_id uuid)
returns table(id uuid, nombres text, apellidos text)
language sql stable security definer set search_path = '' as $$
 select p.id, p.nombres, p.apellidos from public.perfiles p
 where (private.es_rol('bodega') or private.es_rol('administrador'))
 and private.perfil_activo()
 and (private.es_admin_global() or p_sucursal_id = private.mi_sucursal())
 and p.sucursal_id = p_sucursal_id and p.rol = 'vendedor' and p.activo
 order by p.nombres;
$$;
revoke execute on function public.vendedores_sucursal(uuid) from public,anon;
grant execute on function public.vendedores_sucursal(uuid) to authenticated,service_role;

-- RB-5: NOT VALID enforces every new and updated audit row without scanning the table.
-- VALIDATE is a separate reviewed step (supabase/reconciliation.md).
alter table public.auditoria drop constraint auditoria_accion_check;
alter table public.auditoria add constraint auditoria_accion_check check(accion in ('INSERT','UPDATE','ANULACION','DELETE')) not valid;

notify pgrst, 'reload schema';
