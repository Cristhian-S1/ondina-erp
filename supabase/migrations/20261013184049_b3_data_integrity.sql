-- B3 / OND-5gi.7: #31 #32 #33 #34 #35 #42 #70; BD-02..BD-14.
-- Forward only: no stock backfill, row deletion or historical money rewrite.

alter table public.ventas add column idempotency_key uuid;
-- The supplied baseline credited sale containers directly to the plant.
-- Keep that fact for OLD cancellations, without moving any historical balance.
alter table public.ventas add column envases_en_planta boolean not null default true;
alter table public.ventas alter column envases_en_planta set default false;
alter table public.incidencias_produccion add column sucursal_id uuid references public.sucursales(id);
alter table public.despachos add column idempotency_key uuid;
create unique index ventas_idempotency_b3 on public.ventas(idempotency_key) where idempotency_key is not null;
create unique index despachos_idempotency_b3 on public.despachos(idempotency_key) where idempotency_key is not null;
alter table public.auditoria add column motivo text;
alter table public.devoluciones_productos add column motivo text;
alter table public.devoluciones_envases add column motivo text;
-- Snapshot packaging for future production reversals; legacy rows use protected catalog.
alter table public.producciones add column empaque_consumido_id uuid references public.tipos_empaque(id);
create table private.solicitudes_devolucion (
 id uuid primary key default gen_random_uuid(),
 idempotency_key uuid unique,
 despacho_id uuid not null references public.despachos(id),
 creado_por uuid not null references public.perfiles(id)
);
alter table private.solicitudes_devolucion enable row level security;
revoke all on private.solicitudes_devolucion from public, anon, authenticated;

-- All movement paths lock balances in this order after their parent row:
-- warehouse/product UUID, seller/product UUID, packaging UUID.
create function private.bloquear_saldos(p_sucursal uuid, p_vendedor uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
 perform 1 from public.stock_bodega where sucursal_id=p_sucursal order by producto_id for update;
 perform 1 from public.carga_vendedor where vendedor_id=p_vendedor order by producto_id for update;
 perform 1 from public.stock_envases where sucursal_id=p_sucursal order by tipo_empaque_id for update;
end;
$$;

-- Reject negative balances before CHECKs so callers receive safe Spanish P0001.
create function private.saldo_no_negativo()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.cantidad < 0 then raise exception 'Stock o carga insuficiente para completar la operación.'; end if;
 return new;
end;
$$;
create trigger saldo_no_negativo_b3 before insert or update on public.stock_bodega for each row execute function private.saldo_no_negativo();
create trigger saldo_no_negativo_b3 before insert or update on public.stock_envases for each row execute function private.saldo_no_negativo();
create trigger saldo_no_negativo_b3 before insert or update on public.carga_vendedor for each row execute function private.saldo_no_negativo();

-- Business movements are append/annul only. Annul with edited fields still
-- compensates OLD. Reactivation and editing active movement identities are denied.
create function private.proteger_movimiento()
returns trigger language plpgsql set search_path = '' as $$
declare a jsonb := to_jsonb(old); b jsonb := to_jsonb(new);
begin
 if tg_op='DELETE' then raise exception 'Los movimientos conservan su historial; utiliza la anulación.'; end if;
 if coalesce((a->>'anulado')::boolean,false) and not coalesce((b->>'anulado')::boolean,false) then
  raise exception 'No se puede reactivar un movimiento anulado.';
 end if;
 if not coalesce((b->>'anulado')::boolean,false) and
    (a - array['anulado','modificado_en','modificado_por','observaciones','descuento','total']) is distinct from
    (b - array['anulado','modificado_en','modificado_por','observaciones','descuento','total']) then
  raise exception 'Los datos de un movimiento registrado no se pueden editar.';
 end if;
 return new;
end;
$$;
do $$ declare t text; begin
 foreach t in array array['ventas','despachos','producciones','mermas','devoluciones_productos','devoluciones_envases','venta_detalles','despacho_detalles','despacho_envases'] loop
  execute format('create trigger proteger_movimiento_b3 before update or delete on public.%I for each row execute function private.proteger_movimiento()',t);
 end loop;
end $$;

-- Catalog changes cannot change the identity of historical reversals or types.
create function private.proteger_catalogo_historico()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if (new.tipo,new.tipo_empaque_id) is distinct from (old.tipo,old.tipo_empaque_id)
 and (exists(select 1 from public.venta_detalles where producto_id=old.id)
   or exists(select 1 from public.producciones where producto_id=old.id)) then
  raise exception 'El tipo y empaque de un producto con movimientos son históricos.';
 end if;
 return new;
end;
$$;
create trigger catalogo_historico_b3 before update on public.productos for each row execute function private.proteger_catalogo_historico();

-- One audit event per business row write, including composite-key balances.
-- registro_id is the first domain UUID for composite keys; full keys are in JSON.
create or replace function public.fn_auditoria_simple()
returns trigger language plpgsql security definer set search_path = '' as $$
declare a jsonb; b jsonb; k uuid;
begin
 a := case when tg_op <> 'INSERT' then to_jsonb(old) end;
 b := case when tg_op <> 'DELETE' then to_jsonb(new) end;
 k := coalesce((coalesce(b,a)->>'id')::uuid,(coalesce(b,a)->>'sucursal_id')::uuid,
       (coalesce(b,a)->>'vendedor_id')::uuid,'00000000-0000-0000-0000-000000000000'::uuid);
 insert into public.auditoria(tabla,registro_id,accion,usuario_id,valores_anteriores,valores_nuevos,motivo)
 values(tg_table_name,k,case when tg_op='UPDATE' and b->>'anulado'='true' and a->>'anulado'='false'
 then 'ANULACION' else tg_op end,auth.uid(),a,b,
 coalesce(nullif(current_setting('ondina.motivo',true),''),b->>'motivo'));
 return coalesce(new,old);
end;
$$;
alter table public.auditoria drop constraint auditoria_accion_check;
alter table public.auditoria add constraint auditoria_accion_check check(accion in ('INSERT','UPDATE','ANULACION','DELETE'));
do $$ declare r record; t text; begin
 for r in select event_object_table,trigger_name from information_schema.triggers
 where trigger_schema='public' and action_statement ~ 'fn_auditoria' group by 1,2 loop
 execute format('drop trigger %I on public.%I',r.trigger_name,r.event_object_table); end loop;
 foreach t in array array['ventas','venta_detalles','despachos','despacho_detalles','despacho_envases',
 'devoluciones_productos','devoluciones_envases','producciones','mermas','incidencias_produccion',
 'gastos_extras','reglas_comision','configuracion','stock_bodega','stock_envases','carga_vendedor'] loop
 execute format('create trigger auditoria_b3 after insert or update or delete on public.%I for each row execute function public.fn_auditoria_simple()',t);
 end loop;
end $$;

-- Sale collection belongs to the seller, not the plant. Only the physical
-- return credits plant containers; production consumes them once.
create or replace function public.trg_venta_detalle_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v public.ventas%rowtype;
begin
 select * into v from public.ventas where id=new.venta_id for update;
 if v.anulado then return new; end if;
 perform private.bloquear_saldos(v.sucursal_id,v.vendedor_id);
 update public.carga_vendedor set cantidad=cantidad-new.cantidad,modificado_en=now()
 where vendedor_id=v.vendedor_id and producto_id=new.producto_id;
 if not found then raise exception 'Stock o carga insuficiente para completar la operación.'; end if;
 return new;
end;
$$;
create or replace function public.trg_venta_anular()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
 perform private.bloquear_saldos(old.sucursal_id,old.vendedor_id);
 if old.envases_en_planta then
  for r in select p.tipo_empaque_id,sum(vd.envases_recibidos) cantidad from public.venta_detalles vd join public.productos p on p.id=vd.producto_id where vd.venta_id=old.id and p.tipo_empaque_id is not null group by p.tipo_empaque_id order by p.tipo_empaque_id loop
   update public.stock_envases set cantidad=cantidad-r.cantidad,modificado_en=now() where sucursal_id=old.sucursal_id and tipo_empaque_id=r.tipo_empaque_id;
  end loop;
 end if;
 for r in select producto_id,sum(cantidad) cantidad from public.venta_detalles where venta_id=old.id group by producto_id order by producto_id loop
 update public.carga_vendedor set cantidad=cantidad+r.cantidad,modificado_en=now() where vendedor_id=old.vendedor_id and producto_id=r.producto_id;
 end loop;
 return new;
end;
$$;
-- Header discount edits recalculate total even without line writes.
create function private.recalcular_descuento()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 new.total := greatest(coalesce((select sum(subtotal) from public.venta_detalles where venta_id=old.id),0)-new.descuento,0);
 return new;
end;
$$;
create trigger descuento_total_b3 before update of descuento on public.ventas for each row execute function private.recalcular_descuento();

create or replace function public.trg_devolucion_producto_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d public.despachos%rowtype; despachado bigint; devuelto bigint;
begin
 if new.anulado then return new; end if;
 select * into d from public.despachos where id=new.despacho_id for update;
 if auth.uid() is not null and (not (private.es_rol('bodega') or private.es_rol('administrador')) or not (private.es_admin_global() or d.sucursal_id=private.mi_sucursal())) then
 raise exception using errcode='42501',message='No tienes permisos para registrar devoluciones.'; end if;
 if d.anulado then raise exception 'El despacho está anulado'; end if;
 perform private.bloquear_saldos(d.sucursal_id,d.vendedor_id);
 select coalesce(sum(cantidad),0) into despachado from public.despacho_detalles where despacho_id=d.id and producto_id=new.producto_id;
 select coalesce(sum(cantidad),0) into devuelto from public.devoluciones_productos where despacho_id=d.id and producto_id=new.producto_id and not anulado;
 -- BEFORE INSERT: add NEW to the committed/own-transaction return total.
 if devuelto + new.cantidad > despachado then raise exception 'No se puede devolver más de lo despachado.'; end if;
 update public.carga_vendedor set cantidad=cantidad-new.cantidad,modificado_en=now() where vendedor_id=d.vendedor_id and producto_id=new.producto_id;
 if not found then raise exception 'Stock o carga insuficiente para completar la operación.'; end if;
 insert into public.stock_bodega(sucursal_id,producto_id,cantidad) values(d.sucursal_id,new.producto_id,new.cantidad)
 on conflict(sucursal_id,producto_id) do update set cantidad=public.stock_bodega.cantidad+excluded.cantidad,modificado_en=now();
 return new;
end;
$$;
create or replace function public.trg_devolucion_producto_anular()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d public.despachos%rowtype;
begin
 select * into d from public.despachos where id=old.despacho_id for update;
 -- Dispatch annul already compensates the net movement as one operation.
 if d.anulado then return new; end if;
 perform private.bloquear_saldos(d.sucursal_id,d.vendedor_id);
 update public.stock_bodega set cantidad=cantidad-old.cantidad,modificado_en=now() where sucursal_id=d.sucursal_id and producto_id=old.producto_id;
 update public.carga_vendedor set cantidad=cantidad+old.cantidad,modificado_en=now() where vendedor_id=d.vendedor_id and producto_id=old.producto_id;
 return new;
end;
$$;
create or replace function public.trg_devolucion_envase_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d public.despachos%rowtype;
begin
 if new.anulado then return new; end if;
 select * into d from public.despachos where id=new.despacho_id for update;
 if auth.uid() is not null and (not (private.es_rol('bodega') or private.es_rol('administrador')) or not (private.es_admin_global() or d.sucursal_id=private.mi_sucursal())) then
 raise exception using errcode='42501',message='No tienes permisos para registrar devoluciones.'; end if;
 if d.anulado then raise exception 'El despacho está anulado'; end if;
 perform private.bloquear_saldos(d.sucursal_id,d.vendedor_id);
 if new.estado='bueno' then
 insert into public.stock_envases(sucursal_id,tipo_empaque_id,cantidad) values(d.sucursal_id,new.tipo_empaque_id,new.cantidad)
 on conflict(sucursal_id,tipo_empaque_id) do update set cantidad=public.stock_envases.cantidad+excluded.cantidad,modificado_en=now();
 end if;
 return new;
end;
$$;
create or replace function public.trg_devolucion_envase_anular()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d public.despachos%rowtype;
begin
 select * into d from public.despachos where id=old.despacho_id for update;
 -- Dispatch annul already compensates the net movement as one operation.
 if d.anulado then return new; end if;
 perform private.bloquear_saldos(d.sucursal_id,d.vendedor_id);
 if old.estado='bueno' then
 update public.stock_envases set cantidad=cantidad-old.cantidad,modificado_en=now() where sucursal_id=d.sucursal_id and tipo_empaque_id=old.tipo_empaque_id;
 end if;
 return new;
end;
$$;
create or replace function public.trg_despacho_anular()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
 perform private.bloquear_saldos(old.sucursal_id,old.vendedor_id);
 -- Undo only the outstanding product movement. Already-returned goods may
 -- have been produced/sold again; no temporary debit or invented stock.
 for r in select dd.producto_id,sum(dd.cantidad)-coalesce((select sum(dp.cantidad) from public.devoluciones_productos dp where dp.despacho_id=old.id and dp.producto_id=dd.producto_id and not dp.anulado),0) cantidad
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

create function private.sellar_empaque_produccion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 new.empaque_consumido_id := (select p.tipo_empaque_id from public.productos p join public.tipos_empaque t on t.id=p.tipo_empaque_id where p.id=new.producto_id and t.categoria='retornable');
 return new;
end;
$$;
create trigger empaque_produccion_b3 before insert on public.producciones for each row execute function private.sellar_empaque_produccion();

CREATE OR REPLACE FUNCTION "public"."trg_despacho_detalle_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_despacho     public.despachos%rowtype;
    v_minutos      integer;
    v_stock_actual integer;
begin
    select * into v_despacho
    from public.despachos where id = new.despacho_id for update;
    -- Every insertion is time-limited, regardless of the caller's es_ajuste flag.
    -- The parent is locked above, serializing initial lines and later additions.
    if not (private.es_rol('bodega') or private.es_rol('administrador'))
       or not (private.es_admin_global() or v_despacho.sucursal_id = private.mi_sucursal()) then
        raise exception using errcode='42501',message='No tienes permisos para modificar este despacho.';
    end if;
    if v_despacho.anulado then raise exception 'El despacho está anulado'; end if;
    perform private.bloquear_saldos(v_despacho.sucursal_id,v_despacho.vendedor_id);
    select valor::integer into v_minutos
    from public.configuracion where clave = 'ventana_ajuste_minutos';
    if clock_timestamp() > v_despacho.creado_en
       + make_interval(mins => coalesce(v_minutos, 15)) then
        raise exception 'La ventana de ajuste del despacho expiró.';
    end if;

    select cantidad into v_stock_actual
    from public.stock_bodega
    where sucursal_id = v_despacho.sucursal_id
      and producto_id  = new.producto_id
    for update;
    if v_stock_actual is null or v_stock_actual < new.cantidad then
        raise exception 'Stock o carga insuficiente para completar la operación.';
    end if;
    update public.stock_bodega
    set cantidad = cantidad - new.cantidad, modificado_en = now()
    where sucursal_id = v_despacho.sucursal_id
      and producto_id  = new.producto_id;

    insert into public.carga_vendedor (vendedor_id, producto_id, cantidad, modificado_en)
    values (v_despacho.vendedor_id, new.producto_id, new.cantidad, now())
    on conflict (vendedor_id, producto_id)
    do update set cantidad = public.carga_vendedor.cantidad + excluded.cantidad,
                  modificado_en = now();

    return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."trg_despacho_envase_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_despacho     public.despachos%rowtype;
    v_minutos      integer;
    v_stock_actual integer;
begin
    select * into v_despacho
    from public.despachos where id = new.despacho_id for update;
    -- Every insertion is time-limited, regardless of the caller's es_ajuste flag.
    -- The parent is locked above, serializing initial lines and later additions.
    if not (private.es_rol('bodega') or private.es_rol('administrador'))
       or not (private.es_admin_global() or v_despacho.sucursal_id = private.mi_sucursal()) then
        raise exception using errcode='42501',message='No tienes permisos para modificar este despacho.';
    end if;
    if v_despacho.anulado then raise exception 'El despacho está anulado'; end if;
    perform private.bloquear_saldos(v_despacho.sucursal_id,v_despacho.vendedor_id);
    select valor::integer into v_minutos
    from public.configuracion where clave = 'ventana_ajuste_minutos';
    if clock_timestamp() > v_despacho.creado_en
       + make_interval(mins => coalesce(v_minutos, 15)) then
        raise exception 'La ventana de ajuste del despacho expiró.';
    end if;

    if not exists(select 1 from public.tipos_empaque where id=new.tipo_empaque_id and categoria='uso_interno') then raise exception 'El despacho solo admite envases de uso interno.'; end if;

    -- Descuenta envases vacíos de la sucursal (clave compuesta)
    select cantidad into v_stock_actual
    from public.stock_envases
    where sucursal_id = v_despacho.sucursal_id
      and tipo_empaque_id = new.tipo_empaque_id
    for update;
    if v_stock_actual is null or v_stock_actual < new.cantidad then
        raise exception 'Stock o carga insuficiente para completar la operación.';
    end if;
    update public.stock_envases
    set cantidad = cantidad - new.cantidad, modificado_en = now()
    where sucursal_id = v_despacho.sucursal_id
      and tipo_empaque_id = new.tipo_empaque_id;

    return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."trg_produccion_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_tipo_empaque uuid;
    v_categoria text;
    v_envases integer;
begin
    if new.anulado then return new; end if;
    perform private.bloquear_saldos(new.sucursal_id, null);
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

CREATE OR REPLACE FUNCTION "public"."trg_merma_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_despacho public.despachos%rowtype;
    v_stock integer;
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

create or replace function public.trg_produccion_anular()
returns trigger language plpgsql security definer set search_path = '' as $$
declare empaque uuid;
begin
 perform private.bloquear_saldos(old.sucursal_id,null);
 update public.stock_bodega set cantidad=cantidad-old.cantidad,modificado_en=now() where sucursal_id=old.sucursal_id and producto_id=old.producto_id;
 empaque := coalesce(old.empaque_consumido_id,(select p.tipo_empaque_id from public.productos p join public.tipos_empaque t on t.id=p.tipo_empaque_id where p.id=old.producto_id and t.categoria='retornable'));
 if empaque is not null then
 insert into public.stock_envases(sucursal_id,tipo_empaque_id,cantidad) values(old.sucursal_id,empaque,old.cantidad)
 on conflict(sucursal_id,tipo_empaque_id) do update set cantidad=public.stock_envases.cantidad+excluded.cantidad,modificado_en=now();
 end if;
 return new;
end;
$$;
create or replace function public.trg_merma_anular()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d public.despachos%rowtype;
begin
 if old.despacho_id is not null then select * into d from public.despachos where id=old.despacho_id for update; end if;
 perform private.bloquear_saldos(old.sucursal_id,d.vendedor_id);
 if old.producto_id is not null then
  if old.despacho_id is not null then
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

drop function public.registrar_venta(uuid,text,jsonb,numeric,text);
CREATE OR REPLACE FUNCTION "public"."registrar_venta"("p_cliente_id" "uuid", "p_metodo_pago" "text", "p_detalles" "jsonb", "p_descuento" numeric DEFAULT 0, "p_observaciones" "text" DEFAULT NULL::"text", "p_idempotency_key" uuid DEFAULT NULL) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_cliente       public.clientes%rowtype;
    v_sucursal_id   uuid;
    v_vendedor      uuid := auth.uid();
    v_detalle       jsonb;
    v_venta_id      uuid;
    v_producto      uuid;
    v_cantidad      integer;
    v_precio        numeric;
    v_envases       integer;
begin
    if not (private.es_rol('vendedor') or private.es_rol('administrador')) then raise exception 'No tienes permisos para registrar ventas.'; end if;
    if p_idempotency_key is not null then
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('registrar_venta:' || p_idempotency_key::text,0));
      select id into v_venta_id from public.ventas where idempotency_key=p_idempotency_key and creado_por=auth.uid() and (private.es_admin_global() or sucursal_id=private.mi_sucursal());
      if found then return v_venta_id; end if;
      if exists(select 1 from public.ventas where idempotency_key=p_idempotency_key) then raise exception 'La clave de reintento pertenece a otra operación.'; end if;
    end if;
    if v_vendedor is null then
        raise exception 'No hay un usuario autenticado';
    end if;

    if not (private.es_rol('vendedor') or private.es_rol('administrador')) then
        raise exception 'No tienes permisos para registrar ventas.';
    end if;
    if coalesce(p_descuento,0) in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) then
        raise exception 'El descuento debe ser un número finito.';
    end if;
    if p_detalles is null or jsonb_typeof(p_detalles) <> 'array' then
        raise exception 'El formato de los detalles de venta no es válido.';
    end if;
    if jsonb_array_length(p_detalles) = 0 then
        raise exception 'La venta debe incluir al menos un detalle';
    end if;

    if p_metodo_pago is null or p_metodo_pago not in ('efectivo', 'transferencia') then
        raise exception 'Método de pago inválido (efectivo o transferencia)';
    end if;

    select * into v_cliente from public.clientes
    where id = p_cliente_id and activo
      and (private.es_admin_global() or sucursal_id = private.mi_sucursal())
      and (private.es_rol('administrador') or vendedor_id = auth.uid());
    if v_cliente.id is null then
        raise exception 'Cliente inexistente o fuera de su cartera/sucursal';
    end if;

    v_sucursal_id := v_cliente.sucursal_id;
    -- Administration acts on the client's seller, retaining the authenticated actor.
    if private.es_rol('administrador') then
        v_vendedor := v_cliente.vendedor_id;
    end if;
    if not exists (select 1 from public.perfiles where id = v_vendedor
                   and activo and rol = 'vendedor' and sucursal_id = v_sucursal_id) then
        raise exception 'El vendedor no existe o está desactivado.';
    end if;
    insert into public.ventas (
        sucursal_id, vendedor_id, cliente_id,
        metodo_pago, descuento, total, observaciones,
        creado_por, idempotency_key
    )
    values (
        v_sucursal_id, v_vendedor, p_cliente_id,
        p_metodo_pago, coalesce(p_descuento, 0), 0, p_observaciones,
        auth.uid(), p_idempotency_key
    )
    returning id into v_venta_id;

    for v_detalle in select value from jsonb_array_elements(p_detalles) order by value->>'producto_id' loop
        v_producto := (v_detalle ->> 'producto_id')::uuid;
        v_cantidad := (v_detalle ->> 'cantidad')::integer;
        v_precio   := (v_detalle ->> 'precio_unitario')::numeric;
        v_envases  := coalesce((v_detalle ->> 'envases_recibidos')::integer, 0);

        if v_producto is null or v_cantidad is null or v_precio is null then
            raise exception 'Detalle de venta incompleto (producto_id, cantidad y precio_unitario son obligatorios)';
        end if;
        if v_cantidad <= 0 then
            raise exception 'La cantidad debe ser mayor que cero';
        end if;
        if v_precio in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) then
            raise exception 'El precio unitario debe ser un número finito.';
        end if;
        if not exists (select 1 from public.productos where id = v_producto and activo) then
            raise exception 'El producto no existe o está desactivado';
        end if;
        if v_precio < 0 then
            raise exception 'El precio unitario no puede ser negativo';
        end if;

        insert into public.venta_detalles (
            venta_id, producto_id, cantidad,
            precio_unitario, envases_recibidos
        )
        values (
            v_venta_id, v_producto, v_cantidad,
            v_precio, v_envases
        );
    end loop;

    return v_venta_id;
end;
$$;

drop function public.crear_despacho(uuid,uuid,uuid,uuid,jsonb,jsonb);
CREATE OR REPLACE FUNCTION "public"."crear_despacho"("p_sucursal_id" "uuid", "p_vendedor_id" "uuid", "p_despachador_id" "uuid", "p_creado_por" "uuid", "p_lineas" "jsonb", "p_envases" "jsonb" DEFAULT '[]'::"jsonb", "p_idempotency_key" uuid DEFAULT NULL) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_despacho_id     uuid;
    v_linea           jsonb;
    v_envase          jsonb;
    v_producto_id     uuid;
    v_tipo_empaque_id uuid;
    v_cantidad        integer;
begin
    if not (private.es_rol('bodega') or private.es_rol('administrador')) or not (private.es_admin_global() or p_sucursal_id=private.mi_sucursal()) then raise exception 'No tienes permisos para crear despachos en esta sucursal.'; end if;
    if p_idempotency_key is not null then
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('crear_despacho:' || p_idempotency_key::text,0));
      select id into v_despacho_id from public.despachos where idempotency_key=p_idempotency_key and creado_por=auth.uid() and (private.es_admin_global() or sucursal_id=private.mi_sucursal());
      if found then return v_despacho_id; end if;
      if exists(select 1 from public.despachos where idempotency_key=p_idempotency_key) then raise exception 'La clave de reintento pertenece a otra operación.'; end if;
    end if;
    if not (private.es_rol('bodega') or private.es_rol('administrador'))
       or not (private.es_admin_global() or p_sucursal_id = private.mi_sucursal()) then
        raise exception 'No tienes permisos para crear despachos en esta sucursal.';
    end if;
    if p_creado_por is distinct from auth.uid() or p_despachador_id is distinct from auth.uid() then
        raise exception 'El usuario de la operación no coincide con la sesión.';
    end if;
    if p_sucursal_id is null or p_vendedor_id is null
       or p_despachador_id is null or p_creado_por is null then
        raise exception 'Faltan datos del despacho: sucursal, vendedor, despachador o usuario.';
    end if;

    if p_lineas is null or jsonb_typeof(p_lineas) <> 'array'
       or jsonb_array_length(p_lineas) = 0 then
        raise exception 'Agrega al menos un producto al despacho.';
    end if;

    if not exists(select 1 from public.perfiles where id=p_vendedor_id and activo and rol='vendedor' and sucursal_id=p_sucursal_id) then raise exception 'El vendedor no existe o está desactivado.'; end if;
    if jsonb_typeof(coalesce(p_envases,'[]'::jsonb)) <> 'array' then raise exception 'El formato de las líneas no es válido.'; end if;
    insert into public.despachos (sucursal_id, vendedor_id, despachador_id, creado_por, idempotency_key)
    values (p_sucursal_id, p_vendedor_id, auth.uid(), auth.uid(), p_idempotency_key)
    returning id into v_despacho_id;

    for v_linea in select value from jsonb_array_elements(p_lineas) order by value->>'producto_id' loop
        v_producto_id := (v_linea ->> 'producto_id')::uuid;
        v_cantidad    := (v_linea ->> 'cantidad')::integer;
        if not exists(select 1 from public.productos where id=v_producto_id and activo) then raise exception 'El producto no existe o está desactivado'; end if;
        if v_producto_id is null or v_cantidad is null or v_cantidad <= 0 then
            raise exception 'Línea de producto inválida en el despacho.';
        end if;
        insert into public.despacho_detalles (despacho_id, producto_id, cantidad)
        values (v_despacho_id, v_producto_id, v_cantidad);
    end loop;

    if p_envases is not null and jsonb_typeof(p_envases) = 'array' then
        for v_envase in select value from jsonb_array_elements(p_envases) order by value->>'tipo_empaque_id' loop
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

-- Internal shared atomic return operation. Public wrappers authorize beforehand.
create function private.insertar_devolucion(p_despacho_id uuid,p_productos jsonb,p_envases jsonb,p_motivo text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
 if jsonb_typeof(coalesce(p_productos,'[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(p_envases,'[]'::jsonb)) <> 'array' then
 raise exception 'El formato de las líneas no es válido.'; end if;
 if exists(select 1 from jsonb_to_recordset(coalesce(p_productos,'[]'::jsonb)) as x(producto_id uuid,cantidad int)
 where producto_id is null or cantidad is null or cantidad<=0) then raise exception 'Línea de producto inválida en la devolución.'; end if;
 if exists(select 1 from jsonb_to_recordset(coalesce(p_envases,'[]'::jsonb)) as x(tipo_empaque_id uuid,cantidad int,estado text)
 where tipo_empaque_id is null or cantidad is null or cantidad<=0 or estado is null or estado not in ('bueno','malo')) then raise exception 'Línea de envase inválida en la devolución.'; end if;
 for r in select producto_id,sum(cantidad)::int cantidad from jsonb_to_recordset(coalesce(p_productos,'[]'::jsonb)) as x(producto_id uuid,cantidad int)
 group by producto_id order by producto_id loop
 insert into public.devoluciones_productos(despacho_id,producto_id,cantidad,creado_por,motivo)
 values(p_despacho_id,r.producto_id,r.cantidad,auth.uid(),p_motivo);
 end loop;
 -- No cap on empty containers: these need not originate in this dispatch.
 for r in select tipo_empaque_id,estado,sum(cantidad)::int cantidad from jsonb_to_recordset(coalesce(p_envases,'[]'::jsonb)) as x(tipo_empaque_id uuid,cantidad int,estado text)
 group by tipo_empaque_id,estado order by tipo_empaque_id,estado loop
 insert into public.devoluciones_envases(despacho_id,tipo_empaque_id,cantidad,estado,creado_por,motivo)
 values(p_despacho_id,r.tipo_empaque_id,r.cantidad,r.estado,auth.uid(),p_motivo);
 end loop;
end;
$$;
create function public.registrar_devolucion(p_despacho_id uuid,p_productos jsonb,p_envases jsonb,p_idempotency_key uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare d public.despachos%rowtype; resultado uuid;
begin
 if not (private.es_rol('bodega') or private.es_rol('administrador')) then raise exception 'No tienes permisos para registrar devoluciones.'; end if;
 if p_idempotency_key is not null then
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('registrar_devolucion:'||p_idempotency_key::text,0));
 select id into resultado from private.solicitudes_devolucion where idempotency_key=p_idempotency_key and creado_por=auth.uid() and despacho_id=p_despacho_id
 and exists(select 1 from public.despachos where id=p_despacho_id and (private.es_admin_global() or sucursal_id=private.mi_sucursal()));
 if found then return resultado; end if;
 if exists(select 1 from private.solicitudes_devolucion where idempotency_key=p_idempotency_key) then raise exception 'La clave de reintento pertenece a otra operación.'; end if;
 end if;
 select * into d from public.despachos where id=p_despacho_id for update;
 if not found then raise exception 'El despacho no existe'; end if;
 if not (private.es_admin_global() or d.sucursal_id=private.mi_sucursal()) then raise exception 'No tienes permisos para registrar devoluciones.'; end if;
 if d.anulado then raise exception 'El despacho está anulado'; end if;
 perform private.bloquear_saldos(d.sucursal_id,d.vendedor_id);
 perform private.insertar_devolucion(d.id,p_productos,p_envases);
 insert into private.solicitudes_devolucion(idempotency_key,despacho_id,creado_por) values(p_idempotency_key,d.id,auth.uid()) returning id into resultado;
 return resultado;
end;
$$;
drop function public.corregir_devolucion(uuid,uuid,jsonb,jsonb);
create function public.corregir_devolucion(p_despacho_id uuid,p_creado_por uuid,p_productos jsonb,p_envases jsonb,p_motivo text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.despachos%rowtype; motivo_correccion text := coalesce(p_motivo,'Corrección de devolución (cliente anterior)'); anterior text;
begin
 if not private.es_rol('administrador') then raise exception 'Solo administración puede corregir devoluciones'; end if;
 if p_creado_por is distinct from auth.uid() then raise exception 'El usuario de la operación no coincide con la sesión.'; end if;
 if length(btrim(motivo_correccion))=0 then raise exception 'Indica el motivo de la corrección.'; end if;
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
 perform set_config('ondina.motivo',coalesce(anterior,''),true);
end;
$$;

-- D-COM-1: nonoverlapping [start,end) rules, as-of sale creation.
create extension if not exists btree_gist with schema extensions;
alter table public.reglas_comision add constraint reglas_comision_no_solapamiento_b3
 exclude using gist(tipo_producto with =,tstzrange(vigente_desde,vigente_hasta,'[)') with &&);
-- Rules already used by sales cannot have their rate/type/start rewritten or
-- their end moved before a sale. A new retroactive rule cannot reprice history.
create function private.proteger_regla_historica()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_op in ('UPDATE','DELETE') and exists(
  select 1 from public.ventas v join public.venta_detalles vd on vd.venta_id=v.id join public.productos p on p.id=vd.producto_id
  where p.tipo=old.tipo_producto and tstzrange(old.vigente_desde,old.vigente_hasta,'[)') @> v.creado_en) then
  if tg_op='DELETE' then raise exception 'No se puede modificar una regla de comisión histórica.'; end if;
  if (new.tipo_producto,new.porcentaje,new.monto_fijo,new.vigente_desde) is distinct from (old.tipo_producto,old.porcentaje,old.monto_fijo,old.vigente_desde)
   or exists(select 1 from public.ventas v join public.venta_detalles vd on vd.venta_id=v.id join public.productos p on p.id=vd.producto_id
   where p.tipo=old.tipo_producto and tstzrange(old.vigente_desde,old.vigente_hasta,'[)') @> v.creado_en
   and not (tstzrange(new.vigente_desde,new.vigente_hasta,'[)') @> v.creado_en)) then
   raise exception 'No se puede modificar una regla de comisión histórica.';
  end if;
 end if;
 if tg_op='INSERT' or (tg_op='UPDATE' and (new.tipo_producto,new.vigente_desde,new.vigente_hasta) is distinct from (old.tipo_producto,old.vigente_desde,old.vigente_hasta)) then
  if exists(select 1 from public.ventas v join public.venta_detalles vd on vd.venta_id=v.id join public.productos p on p.id=vd.producto_id
   where p.tipo=new.tipo_producto and tstzrange(new.vigente_desde,new.vigente_hasta,'[)') @> v.creado_en
   and (tg_op='INSERT' or not (tstzrange(old.vigente_desde,old.vigente_hasta,'[)') @> v.creado_en))) then
   raise exception 'Una regla nueva no puede cambiar comisiones de ventas anteriores.';
  end if;
 end if;
 return coalesce(new,old);
end;
$$;
create trigger regla_historica_b3 before insert or update or delete on public.reglas_comision for each row execute function private.proteger_regla_historica();

create or replace view public.v_comision_vendedor with(security_invoker=true) as
with lineas as (
 select v.id,v.vendedor_id,v.creado_en,p.tipo,vd.subtotal,
 sum(vd.subtotal) over(partition by v.id) bruto,v.descuento,r.porcentaje,r.monto_fijo
 from public.ventas v join public.venta_detalles vd on vd.venta_id=v.id
 join public.productos p on p.id=vd.producto_id
 left join public.reglas_comision r on r.tipo_producto=p.tipo and tstzrange(r.vigente_desde,r.vigente_hasta,'[)') @> v.creado_en
 where not v.anulado
), netas as (
 select *,case when bruto>0 then subtotal*greatest(bruto-descuento,0)/bruto else 0 end base from lineas
)
select vendedor_id,(creado_en at time zone 'America/Santiago')::date jornada,tipo,
 sum(base) base_comision,porcentaje,monto_fijo,count(distinct id) ventas_del_tipo,
 round(coalesce(sum(base)*porcentaje/100,0)+count(distinct id)*coalesce(monto_fijo,0),2) comision
from netas group by vendedor_id,(creado_en at time zone 'America/Santiago')::date,tipo,porcentaje,monto_fijo;
-- Preserve timestamptz mes type, encoding Santiago month start explicitly.
create or replace view public.v_ranking_vendedores with(security_invoker=true) as
select p.id vendedor_id,p.sucursal_id,p.nombres||' '||p.apellidos vendedor,
 date_trunc('month',v.creado_en at time zone 'America/Santiago') at time zone 'America/Santiago' mes,
 count(v.id) cantidad_ventas,coalesce(sum(v.total),0) total_vendido
from public.perfiles p left join public.ventas v on v.vendedor_id=p.id and not v.anulado
where (private.es_rol('vendedor') or private.es_rol('administrador')) and p.rol='vendedor' and p.activo
 group by p.id,p.sucursal_id,p.nombres,p.apellidos,date_trunc('month',v.creado_en at time zone 'America/Santiago') at time zone 'America/Santiago';

create or replace view public.v_bidones_vacios_vendedor with(security_invoker=true) as
with movimientos as (
 select v.vendedor_id,(v.creado_en at time zone 'America/Santiago')::date fecha,p.tipo_empaque_id,sum(vd.envases_recibidos)::bigint cantidad
 from public.ventas v join public.venta_detalles vd on vd.venta_id=v.id join public.productos p on p.id=vd.producto_id
 where not v.anulado and p.tipo_empaque_id is not null
 group by v.vendedor_id,(v.creado_en at time zone 'America/Santiago')::date,p.tipo_empaque_id
 union all
 select d.vendedor_id,(de.creado_en at time zone 'America/Santiago')::date,de.tipo_empaque_id,-sum(de.cantidad)::bigint
 from public.devoluciones_envases de join public.despachos d on d.id=de.despacho_id
 where not de.anulado and not d.anulado and de.estado='bueno'
 group by d.vendedor_id,(de.creado_en at time zone 'America/Santiago')::date,de.tipo_empaque_id
)
select m.vendedor_id,m.fecha,t.id tipo_empaque_id,t.nombre empaque_nombre,sum(m.cantidad)::bigint cantidad
from movimientos m join public.tipos_empaque t on t.id=m.tipo_empaque_id group by m.vendedor_id,m.fecha,t.id,t.nombre;

-- B2 restored incident policies; B3 enables the existing table for the UI.
grant select,insert on public.incidencias_produccion to authenticated;
-- Every new/replaced endpoint has an explicit ACL; helpers remain internal.
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.es_rol(text),private.mi_sucursal(),private.es_admin_global(),private.perfil_activo(),private.perfil_en_ambito(uuid) to authenticated;
revoke execute on function public.registrar_venta(uuid,text,jsonb,numeric,text,uuid),public.crear_despacho(uuid,uuid,uuid,uuid,jsonb,jsonb,uuid),public.registrar_devolucion(uuid,jsonb,jsonb,uuid),public.corregir_devolucion(uuid,uuid,jsonb,jsonb,text) from public,anon;
grant execute on function public.registrar_venta(uuid,text,jsonb,numeric,text,uuid),public.crear_despacho(uuid,uuid,uuid,uuid,jsonb,jsonb,uuid),public.registrar_devolucion(uuid,jsonb,jsonb,uuid),public.corregir_devolucion(uuid,uuid,jsonb,jsonb,text) to authenticated,service_role;

-- D-TZ-1 for every retained reporting view.
create or replace view public.v_cuadre_despacho with (security_invoker = true) as
select
    d.id as despacho_id,
    d.sucursal_id,
    d.vendedor_id,
    (d.creado_en at time zone 'America/Santiago')::date as fecha,
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
    select vd.producto_id, vt.vendedor_id, vt.sucursal_id, (vt.creado_en at time zone 'America/Santiago')::date as fecha,
           sum(vd.cantidad) as cantidad_vendida
    from public.ventas vt join public.venta_detalles vd on vd.venta_id = vt.id
    where not vt.anulado
    group by vd.producto_id, vt.vendedor_id, vt.sucursal_id, (vt.creado_en at time zone 'America/Santiago')::date
) v on v.producto_id = dd.producto_id
     and v.vendedor_id = d.vendedor_id
     and v.sucursal_id = d.sucursal_id
     and v.fecha = (d.creado_en at time zone 'America/Santiago')::date
left join (
    select despacho_id, producto_id, sum(cantidad) as cantidad_devuelta
    from public.devoluciones_productos where not anulado group by despacho_id, producto_id
) dp on dp.despacho_id = d.id and dp.producto_id = dd.producto_id
left join (
    select despacho_id, producto_id, sum(cantidad) as cantidad_merma
    from public.mermas where not anulado and producto_id is not null group by despacho_id, producto_id
) m on m.despacho_id = d.id and m.producto_id = dd.producto_id
where not d.anulado
group by d.id, d.sucursal_id, d.vendedor_id, (d.creado_en at time zone 'America/Santiago')::date, dd.producto_id,
         v.cantidad_vendida, dp.cantidad_devuelta, m.cantidad_merma;

revoke all on public.v_cuadre_despacho from public, anon, authenticated;
grant select on public.v_cuadre_despacho to service_role;

create or replace view public.v_ventas_diarias with (security_invoker = true) as
select (creado_en at time zone 'America/Santiago')::date as fecha, sucursal_id, vendedor_id,
       count(*) as cantidad_ventas, sum(total) as total_ingresos
from public.ventas
where not anulado
group by (creado_en at time zone 'America/Santiago')::date, sucursal_id, vendedor_id;

revoke all on public.v_ventas_diarias from public, anon, authenticated;
grant select on public.v_ventas_diarias to service_role;

create or replace view public.v_clientes_inactivos with (security_invoker = true) as
select c.id as cliente_id, c.nombre, c.sucursal_id, c.vendedor_id,
       max(v.creado_en) as ultima_compra,
       (select valor::integer from public.configuracion
        where clave = 'dias_inactividad_cliente') as dias_configurados,
       (now() at time zone 'America/Santiago')::date - (max(v.creado_en) at time zone 'America/Santiago')::date as dias_sin_comprar
from public.clientes c
left join public.ventas v on v.cliente_id = c.id and not v.anulado
where c.activo
group by c.id, c.nombre, c.sucursal_id, c.vendedor_id
having max(v.creado_en) is null
    or (now() at time zone 'America/Santiago')::date - (max(v.creado_en) at time zone 'America/Santiago')::date >
       (select valor::integer from public.configuracion
        where clave = 'dias_inactividad_cliente');

revoke all on public.v_clientes_inactivos from public, anon, authenticated;
grant select on public.v_clientes_inactivos to service_role;

create or replace view public.v_historial_cliente with (security_invoker = true) as
select c.id as cliente_id, c.nombre, c.sucursal_id, c.vendedor_id,
       count(distinct v.id) as cantidad_compras,
       coalesce(sum(v.total), 0) as total_comprado,
       max(v.creado_en) as ultima_compra,
       (now() at time zone 'America/Santiago')::date - (max(v.creado_en) at time zone 'America/Santiago')::date as dias_sin_comprar
from public.clientes c
left join public.ventas v on v.cliente_id = c.id and not v.anulado
where c.activo
group by c.id, c.nombre, c.sucursal_id, c.vendedor_id;

revoke all on public.v_historial_cliente from public, anon, authenticated;
grant select on public.v_historial_cliente to service_role;

create or replace view public.v_ventas_producto with (security_invoker = true) as
select (v.creado_en at time zone 'America/Santiago')::date as fecha, v.sucursal_id, v.vendedor_id,
       vd.producto_id, p.nombre as producto, p.tipo,
       sum(vd.cantidad) as cantidad,
       sum(vd.subtotal) as total
from public.ventas v
join public.venta_detalles vd on vd.venta_id = v.id
join public.productos p on p.id = vd.producto_id
where not v.anulado
group by (v.creado_en at time zone 'America/Santiago')::date, v.sucursal_id, v.vendedor_id,
         vd.producto_id, p.nombre, p.tipo;

revoke all on public.v_ventas_producto from public, anon, authenticated;
grant select on public.v_ventas_producto to service_role;


create function private.serializar_venta_reglas()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 lock table public.reglas_comision in share mode;
 return new;
end;
$$;
create trigger venta_reglas_b3 before insert on public.ventas for each row execute function private.serializar_venta_reglas();

-- Bind new descriptive incidents to their operating branch; legacy incidents
-- retain their original author-based visibility without any row backfill.
create function private.sellar_sucursal_incidencia()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 new.sucursal_id := coalesce(new.sucursal_id,(select sucursal_id from public.perfiles where id=new.creado_por));
 if new.sucursal_id is null then raise exception 'Selecciona una sucursal para registrar la incidencia.'; end if;
 return new;
end;
$$;
create trigger incidencia_sucursal_b3 before insert on public.incidencias_produccion for each row execute function private.sellar_sucursal_incidencia();
drop policy incidencias_produccion_select_b2 on public.incidencias_produccion;
create policy incidencias_produccion_select_b3 on public.incidencias_produccion for select to authenticated
using ((private.es_rol('administrador') or private.es_rol('produccion'))
 and (private.es_admin_global() or sucursal_id=private.mi_sucursal() or (sucursal_id is null and private.perfil_en_ambito(creado_por)))
 and (produccion_id is null or exists(select 1 from public.producciones p where p.id=produccion_id)));
drop policy incidencias_produccion_insert_b2 on public.incidencias_produccion;
create policy incidencias_produccion_insert_b3 on public.incidencias_produccion for insert to authenticated
with check ((private.es_rol('administrador') or private.es_rol('produccion')) and creado_por=auth.uid()
 and (private.es_admin_global() or sucursal_id=private.mi_sucursal())
 and (produccion_id is null or exists(select 1 from public.producciones p where p.id=produccion_id and p.sucursal_id=incidencias_produccion.sucursal_id)));

create function private.proteger_categoria_historica()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.categoria is distinct from old.categoria and exists(select 1 from public.productos p where p.tipo_empaque_id=old.id
 and (exists(select 1 from public.producciones where producto_id=p.id) or exists(select 1 from public.venta_detalles where producto_id=p.id))) then
 raise exception 'La categoría de un empaque con movimientos es histórica.'; end if;
 return new;
end;
$$;
create trigger categoria_historica_b3 before update on public.tipos_empaque for each row execute function private.proteger_categoria_historica();
revoke execute on function private.serializar_venta_reglas(),private.sellar_sucursal_incidencia(),private.proteger_categoria_historica() from public,anon,authenticated;

-- Acquire the parent row before FK checks: AFTER INSERT would first acquire
-- KEY SHARE on the parent and concurrent appenders could deadlock upgrading it.
drop trigger trg_despacho_detalle_insert on public.despacho_detalles;
create trigger trg_despacho_detalle_insert before insert on public.despacho_detalles for each row execute function public.trg_despacho_detalle_insert();
drop trigger trg_despacho_envase_insert on public.despacho_envases;
create trigger trg_despacho_envase_insert before insert on public.despacho_envases for each row execute function public.trg_despacho_envase_insert();
drop trigger trg_devolucion_producto on public.devoluciones_productos;
create trigger trg_devolucion_producto before insert on public.devoluciones_productos for each row execute function public.trg_devolucion_producto_insert();
drop trigger trg_devolucion_envase on public.devoluciones_envases;
create trigger trg_devolucion_envase before insert on public.devoluciones_envases for each row execute function public.trg_devolucion_envase_insert();
drop trigger trg_venta_detalle_insert on public.venta_detalles;
create trigger trg_venta_detalle_insert before insert on public.venta_detalles for each row execute function public.trg_venta_detalle_insert();

-- 'Hoy' must use the database's Santiago business day, never browser midnight.
-- INVOKER retains B2 seller/admin and branch RLS for the supplied seller ID.
create function public.contar_ventas_jornada(p_vendedor_id uuid)
returns bigint language sql stable security invoker set search_path = '' as $$
 select count(*) from public.ventas
 where vendedor_id=p_vendedor_id and not anulado
 and (creado_en at time zone 'America/Santiago')::date=(now() at time zone 'America/Santiago')::date;
$$;
revoke all on function public.contar_ventas_jornada(uuid) from public,anon;
grant execute on function public.contar_ventas_jornada(uuid) to authenticated,service_role;

notify pgrst, 'reload schema';
