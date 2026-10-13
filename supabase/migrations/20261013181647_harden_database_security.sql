-- B2 / OND-5gi.6: #27 #29 #30 #71; SEG-01..08, BD-07, BACK-N10.
-- Forward-only security hardening; no historical row/stock rewrite.
-- Monetary constraints deliberately remain NOT VALID pending a remote data check.

create or replace function private.es_rol(p_rol text)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public.perfiles
 where id = (select auth.uid()) and activo and rol = p_rol);
$$;
create or replace function private.mi_sucursal()
returns uuid language sql stable security definer set search_path = '' as $$
 select sucursal_id from public.perfiles where id = (select auth.uid()) and activo;
$$;
create or replace function public.es_rol(p_rol text)
returns boolean language sql stable security invoker set search_path = '' as $$
 select private.es_rol(p_rol);
$$;
create or replace function public.mi_sucursal()
returns uuid language sql stable security invoker set search_path = '' as $$
 select private.mi_sucursal();
$$;
-- Global administrators are the only actors whose NULL branch means all branches.
create or replace function private.es_admin_global()
returns boolean language sql stable security invoker set search_path = '' as $$
 select private.es_rol('administrador') and private.mi_sucursal() is null;
$$;
create or replace function private.perfil_activo()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public.perfiles where id = (select auth.uid()) and activo);
$$;
-- Internal branch lookup avoids recursive perfiles RLS in GPS/load/incidence policies.
-- It reveals only membership within the caller's already-authorized branch.
create or replace function private.perfil_en_ambito(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public.perfiles target
 where target.id = p_id and private.perfil_activo()
 and (private.es_admin_global() or target.sucursal_id = private.mi_sucursal()));
$$;

-- Replace the entire policy set: permissive old policies must not survive by OR.
do $$ declare r record; begin
 for r in select tablename, policyname from pg_catalog.pg_policies where schemaname='public'
 loop execute format('drop policy %I on public.%I',r.policyname,r.tablename); end loop;
end $$;

create policy perfiles_select_b2 on public.perfiles for SELECT to authenticated
 using ((select private.perfil_activo()) and (id = (select auth.uid()) or ((select private.es_rol('administrador')) and ((select private.es_admin_global()) or sucursal_id = (select private.mi_sucursal()))) or ((select private.es_rol('bodega')) and sucursal_id = (select private.mi_sucursal()) and rol = 'vendedor')));

create policy sucursales_select_b2 on public.sucursales for SELECT to authenticated
 using ((select private.perfil_activo()) and ((select private.es_admin_global()) or id = (select private.mi_sucursal())));

create policy productos_select_b2 on public.productos for SELECT to authenticated
 using ((select private.perfil_activo()));

create policy tipos_empaque_select_b2 on public.tipos_empaque for SELECT to authenticated
 using ((select private.perfil_activo()));

create policy reglas_comision_select_b2 on public.reglas_comision for SELECT to authenticated
 using ((select private.perfil_activo()));

create policy configuracion_select_b2 on public.configuracion for SELECT to authenticated
 using ((select private.es_rol('administrador')));

create policy auditoria_select_b2 on public.auditoria for SELECT to authenticated
 using ((select private.es_rol('administrador')) and ((select private.es_admin_global()) or private.perfil_en_ambito(usuario_id)));

create policy clientes_select_b2 on public.clientes for SELECT to authenticated
 using (((select private.es_rol('administrador')) and ((select private.es_admin_global()) or sucursal_id = (select private.mi_sucursal()))) or ((select private.es_rol('vendedor')) and vendedor_id = (select auth.uid()) and sucursal_id = (select private.mi_sucursal())));

create policy clientes_insert_b2 on public.clientes for INSERT to authenticated
 with check ((((select private.es_rol('administrador')) and ((select private.es_admin_global()) or sucursal_id = (select private.mi_sucursal()))) or ((select private.es_rol('vendedor')) and vendedor_id = (select auth.uid()) and sucursal_id = (select private.mi_sucursal()))) and creado_por = (select auth.uid()));

create policy ventas_select_b2 on public.ventas for SELECT to authenticated
 using (((select private.es_rol('administrador')) and ((select private.es_admin_global()) or sucursal_id = (select private.mi_sucursal()))) or ((select private.es_rol('vendedor')) and vendedor_id = (select auth.uid()) and sucursal_id = (select private.mi_sucursal())));

create policy gastos_extras_select_b2 on public.gastos_extras for SELECT to authenticated
 using (((select private.es_rol('administrador')) and ((select private.es_admin_global()) or sucursal_id = (select private.mi_sucursal()))) or ((select private.es_rol('vendedor')) and vendedor_id = (select auth.uid()) and sucursal_id = (select private.mi_sucursal())));

create policy gastos_extras_insert_b2 on public.gastos_extras for INSERT to authenticated
 with check ((((select private.es_rol('administrador')) and ((select private.es_admin_global()) or sucursal_id = (select private.mi_sucursal()))) or ((select private.es_rol('vendedor')) and vendedor_id = (select auth.uid()) and sucursal_id = (select private.mi_sucursal()))) and creado_por = (select auth.uid()) and not anulado);

create policy venta_detalles_select_b2 on public.venta_detalles for SELECT to authenticated
 using (exists (select 1 from public.ventas v where v.id = venta_id));

create policy carga_vendedor_select_b2 on public.carga_vendedor for SELECT to authenticated
 using (((select private.es_rol('vendedor')) and vendedor_id = (select auth.uid()) and private.perfil_en_ambito(vendedor_id)) or (((select private.es_rol('administrador')) or (select private.es_rol('bodega'))) and private.perfil_en_ambito(vendedor_id)));

create policy stock_bodega_select_b2 on public.stock_bodega for SELECT to authenticated
 using (((select private.es_rol('administrador')) or (select private.es_rol('bodega')) or (select private.es_rol('produccion'))) and ((select private.es_admin_global()) or sucursal_id = (select private.mi_sucursal())));

create policy stock_envases_select_b2 on public.stock_envases for SELECT to authenticated
 using (((select private.es_rol('administrador')) or (select private.es_rol('bodega')) or (select private.es_rol('produccion'))) and ((select private.es_admin_global()) or sucursal_id = (select private.mi_sucursal())));

create policy despachos_select_b2 on public.despachos for SELECT to authenticated
 using (((select private.es_rol('administrador')) and ((select private.es_admin_global()) or sucursal_id = (select private.mi_sucursal()))) or (((select private.es_rol('bodega')) or (select private.es_rol('produccion'))) and sucursal_id = (select private.mi_sucursal())) or ((select private.es_rol('vendedor')) and vendedor_id = (select auth.uid()) and sucursal_id = (select private.mi_sucursal())));

create policy despachos_insert_b2 on public.despachos for INSERT to authenticated
 with check (((select private.es_rol('administrador')) or (select private.es_rol('bodega'))) and ((select private.es_admin_global()) or sucursal_id = (select private.mi_sucursal())) and creado_por = (select auth.uid()) and despachador_id = (select auth.uid()) and not anulado and exists (select 1 from public.perfiles p where p.id = vendedor_id and p.rol = 'vendedor' and p.activo and p.sucursal_id = despachos.sucursal_id));

create policy despacho_detalles_select_b2 on public.despacho_detalles for SELECT to authenticated
 using (exists (select 1 from public.despachos d where d.id = despacho_id));

create policy despacho_detalles_insert_b2 on public.despacho_detalles for INSERT to authenticated
 with check (((select private.es_rol('administrador')) or (select private.es_rol('bodega'))) and exists (select 1 from public.despachos d where d.id = despacho_id and ((select private.es_admin_global()) or d.sucursal_id = (select private.mi_sucursal())) and not d.anulado));

create policy despacho_envases_select_b2 on public.despacho_envases for SELECT to authenticated
 using (exists (select 1 from public.despachos d where d.id = despacho_id));

create policy despacho_envases_insert_b2 on public.despacho_envases for INSERT to authenticated
 with check (((select private.es_rol('administrador')) or (select private.es_rol('bodega'))) and exists (select 1 from public.despachos d where d.id = despacho_id and ((select private.es_admin_global()) or d.sucursal_id = (select private.mi_sucursal())) and not d.anulado));

create policy devoluciones_productos_select_b2 on public.devoluciones_productos for SELECT to authenticated
 using (((select private.es_rol('administrador')) or (select private.es_rol('bodega'))) and exists (select 1 from public.despachos d where d.id = despacho_id and ((select private.es_admin_global()) or d.sucursal_id = (select private.mi_sucursal()))));

create policy devoluciones_productos_insert_b2 on public.devoluciones_productos for INSERT to authenticated
 with check (((select private.es_rol('administrador')) or (select private.es_rol('bodega'))) and exists (select 1 from public.despachos d where d.id = despacho_id and ((select private.es_admin_global()) or d.sucursal_id = (select private.mi_sucursal()))) and creado_por = (select auth.uid()) and not anulado);

create policy devoluciones_envases_select_b2 on public.devoluciones_envases for SELECT to authenticated
 using (((select private.es_rol('administrador')) or (select private.es_rol('bodega'))) and exists (select 1 from public.despachos d where d.id = despacho_id and ((select private.es_admin_global()) or d.sucursal_id = (select private.mi_sucursal()))));

create policy devoluciones_envases_insert_b2 on public.devoluciones_envases for INSERT to authenticated
 with check (((select private.es_rol('administrador')) or (select private.es_rol('bodega'))) and exists (select 1 from public.despachos d where d.id = despacho_id and ((select private.es_admin_global()) or d.sucursal_id = (select private.mi_sucursal()))) and creado_por = (select auth.uid()) and not anulado);

create policy producciones_select_b2 on public.producciones for SELECT to authenticated
 using (((select private.es_rol('administrador')) or (select private.es_rol('produccion'))) and ((select private.es_admin_global()) or sucursal_id = (select private.mi_sucursal())));

create policy producciones_insert_b2 on public.producciones for INSERT to authenticated
 with check (((select private.es_rol('administrador')) or (select private.es_rol('produccion'))) and ((select private.es_admin_global()) or sucursal_id = (select private.mi_sucursal())) and creado_por = (select auth.uid()) and not anulado);

create policy mermas_select_b2 on public.mermas for SELECT to authenticated
 using ((((select private.es_rol('administrador')) or (select private.es_rol('bodega')) or (select private.es_rol('produccion'))) and ((select private.es_admin_global()) or sucursal_id = (select private.mi_sucursal()))) or ((select private.es_rol('vendedor')) and sucursal_id = (select private.mi_sucursal()) and exists (select 1 from public.despachos d where d.id = despacho_id and d.vendedor_id = (select auth.uid()))));

create policy mermas_insert_b2 on public.mermas for INSERT to authenticated
 with check (((select private.es_admin_global()) or sucursal_id = (select private.mi_sucursal())) and creado_por = (select auth.uid()) and not anulado and ((select private.es_rol('administrador')) or (select private.es_rol('bodega')) or ((select private.es_rol('produccion')) and despacho_id is null and producto_id is not null)) and (despacho_id is null or exists (select 1 from public.despachos d where d.id = despacho_id and d.sucursal_id = mermas.sucursal_id)));

create policy mermas_update_b2 on public.mermas for UPDATE to authenticated
 using (((select private.es_rol('administrador')) and ((select private.es_admin_global()) or sucursal_id = (select private.mi_sucursal()))))
 with check (((select private.es_rol('administrador')) and ((select private.es_admin_global()) or sucursal_id = (select private.mi_sucursal()))));

create policy incidencias_produccion_select_b2 on public.incidencias_produccion for SELECT to authenticated
 using (((select private.es_rol('administrador')) or (select private.es_rol('produccion'))) and private.perfil_en_ambito(creado_por) and (produccion_id is null or exists (select 1 from public.producciones p where p.id = produccion_id)));

create policy incidencias_produccion_insert_b2 on public.incidencias_produccion for INSERT to authenticated
 with check (((select private.es_rol('administrador')) or (select private.es_rol('produccion'))) and creado_por = (select auth.uid()) and (produccion_id is null or exists (select 1 from public.producciones p where p.id = produccion_id)));

create policy ubicaciones_vendedores_select_b2 on public.ubicaciones_vendedores for SELECT to authenticated
 using (((select private.es_rol('vendedor')) and vendedor_id = (select auth.uid()) and private.perfil_en_ambito(vendedor_id)) or ((select private.es_rol('administrador')) and private.perfil_en_ambito(vendedor_id)));

create policy ubicaciones_vendedores_insert_b2 on public.ubicaciones_vendedores for INSERT to authenticated
 with check ((select private.es_rol('vendedor')) and vendedor_id = (select auth.uid()) and private.perfil_en_ambito(vendedor_id));

CREATE OR REPLACE FUNCTION "public"."fn_auditoria_simple"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."trg_despacho_anular"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
    if v_despacho.anulado then
        raise exception 'El despacho está anulado';
    end if;

    -- Every insertion is time-limited, regardless of the caller's es_ajuste flag.
    -- The parent is locked above, serializing initial lines and later additions.
    if not (private.es_rol('bodega') or private.es_rol('administrador'))
       or not (private.es_admin_global() or v_despacho.sucursal_id = private.mi_sucursal()) then
        raise exception 'No tienes permisos para modificar este despacho.';
    end if;
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
        raise exception 'Stock insuficiente en bodega para el producto %', new.producto_id;
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
    if v_despacho.anulado then
        raise exception 'El despacho está anulado';
    end if;

    -- Every insertion is time-limited, regardless of the caller's es_ajuste flag.
    -- The parent is locked above, serializing initial lines and later additions.
    if not (private.es_rol('bodega') or private.es_rol('administrador'))
       or not (private.es_admin_global() or v_despacho.sucursal_id = private.mi_sucursal()) then
        raise exception 'No tienes permisos para modificar este despacho.';
    end if;
    select valor::integer into v_minutos
    from public.configuracion where clave = 'ventana_ajuste_minutos';
    if clock_timestamp() > v_despacho.creado_en
       + make_interval(mins => coalesce(v_minutos, 15)) then
        raise exception 'La ventana de ajuste del despacho expiró.';
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

CREATE OR REPLACE FUNCTION "public"."trg_devolucion_envase_anular"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

CREATE OR REPLACE FUNCTION "public"."trg_devolucion_envase_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_sucursal uuid;
begin
    select sucursal_id into v_sucursal from public.despachos where id = new.despacho_id;
    if new.estado = 'bueno' then
        insert into public.stock_envases (sucursal_id, tipo_empaque_id, cantidad, modificado_en)
        values (v_sucursal, new.tipo_empaque_id, new.cantidad, now())
        on conflict (sucursal_id, tipo_empaque_id)
        do update set cantidad = public.stock_envases.cantidad + excluded.cantidad,
                      modificado_en = now();
    end if;
    return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."trg_devolucion_producto_anular"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

CREATE OR REPLACE FUNCTION "public"."trg_devolucion_producto_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
    do update set cantidad = public.stock_bodega.cantidad + excluded.cantidad,
                  modificado_en = now();
    return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."trg_venta_anular"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    vd record;
    v_empaque uuid;
begin
    for vd in select producto_id, cantidad, envases_recibidos
              from public.venta_detalles where venta_id = new.id loop
        update public.carga_vendedor
        set cantidad = cantidad + vd.cantidad, modificado_en = now()
        where vendedor_id = new.vendedor_id
          and producto_id = vd.producto_id;

        if vd.envases_recibidos > 0 then
            select tipo_empaque_id into v_empaque
            from public.productos where id = vd.producto_id;
            if v_empaque is not null then
                update public.stock_envases
                set cantidad = greatest(cantidad - vd.envases_recibidos, 0),
                    modificado_en = now()
                where sucursal_id = new.sucursal_id
                  and tipo_empaque_id = v_empaque;
            end if;
        end if;
    end loop;
    return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."trg_venta_detalle_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_venta  public.ventas%rowtype;
    v_empaque uuid;
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

    if new.envases_recibidos > 0 then
        select tipo_empaque_id into v_empaque
        from public.productos where id = new.producto_id;
        if v_empaque is not null then
            insert into public.stock_envases (sucursal_id, tipo_empaque_id, cantidad, modificado_en)
            values (v_venta.sucursal_id, v_empaque, new.envases_recibidos, now())
            on conflict (sucursal_id, tipo_empaque_id)
            do update set cantidad = public.stock_envases.cantidad + excluded.cantidad,
                          modificado_en = now();
        end if;
    end if;

    return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."trg_venta_recalcular_total"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_venta uuid := coalesce(new.venta_id, old.venta_id);
begin
    update public.ventas v
    set total = greatest(
        coalesce((select sum(subtotal) from public.venta_detalles where venta_id = v_venta), 0) - v.descuento,
        0)
    where v.id = v_venta;
    return coalesce(new, old);
end;
$$;

-- The adjustment deadline is measured from server time, never client input.
create or replace function private.sellar_fecha_despacho()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 new.creado_en := clock_timestamp();
 return new;
end;
$$;
create trigger trg_fecha_despacho_b2 before insert on public.despachos
 for each row execute function private.sellar_fecha_despacho();

CREATE OR REPLACE FUNCTION "public"."crear_despacho"("p_sucursal_id" "uuid", "p_vendedor_id" "uuid", "p_despachador_id" "uuid", "p_creado_por" "uuid", "p_lineas" "jsonb", "p_envases" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
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

    insert into public.despachos (sucursal_id, vendedor_id, despachador_id, creado_por)
    values (p_sucursal_id, p_vendedor_id, auth.uid(), auth.uid())
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

CREATE OR REPLACE FUNCTION "public"."corregir_devolucion"("p_despacho_id" "uuid", "p_creado_por" "uuid", "p_productos" "jsonb", "p_envases" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_despacho public.despachos%rowtype;
    v_total    integer;
    v_linea    record;
begin
    if not private.es_rol('administrador') then
        raise exception 'Solo administración puede corregir devoluciones';
    end if;

    select * into v_despacho from public.despachos where id = p_despacho_id;
    if v_despacho.id is null then
        raise exception 'El despacho no existe';
    end if;

    if not (private.es_admin_global() or v_despacho.sucursal_id = private.mi_sucursal()) then
        raise exception 'No tienes permisos para corregir devoluciones de esta sucursal.';
    end if;
    if p_creado_por is distinct from auth.uid() then
        raise exception 'El usuario de la operación no coincide con la sesión.';
    end if;
    if jsonb_typeof(coalesce(p_productos, '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(p_envases, '[]'::jsonb)) <> 'array' then
        raise exception 'El formato de las líneas no es válido.';
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
                (p_despacho_id, v_linea.producto_id, v_linea.cantidad, auth.uid());
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
                 v_linea.estado, auth.uid());
        end if;
    end loop;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."registrar_venta"("p_cliente_id" "uuid", "p_metodo_pago" "text", "p_detalles" "jsonb", "p_descuento" numeric DEFAULT 0, "p_observaciones" "text" DEFAULT NULL::"text") RETURNS "uuid"
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
        creado_por
    )
    values (
        v_sucursal_id, v_vendedor, p_cliente_id,
        p_metodo_pago, coalesce(p_descuento, 0), 0, p_observaciones,
        auth.uid()
    )
    returning id into v_venta_id;

    for v_detalle in select jsonb_array_elements(p_detalles) loop
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

CREATE OR REPLACE VIEW "public"."v_ranking_vendedores" AS
 SELECT "p"."id" AS "vendedor_id",
    "p"."sucursal_id",
    (("p"."nombres" || ' '::"text") || "p"."apellidos") AS "vendedor",
    "date_trunc"('month'::"text", "v"."creado_en") AS "mes",
    "count"(DISTINCT "v"."id") AS "cantidad_ventas",
    COALESCE("sum"((("vd"."cantidad")::numeric * "vd"."precio_unitario")), (0)::numeric) AS "total_vendido"
   FROM (("public"."perfiles" "p"
     LEFT JOIN "public"."ventas" "v" ON ((("v"."vendedor_id" = "p"."id") AND (NOT "v"."anulado"))))
     LEFT JOIN "public"."venta_detalles" "vd" ON (("vd"."venta_id" = "v"."id")))
  WHERE ((select private.es_rol('vendedor')) or (select private.es_rol('administrador'))) and (("p"."rol" = 'vendedor'::"text") AND "p"."activo")
  GROUP BY "p"."id", "p"."sucursal_id", "p"."nombres", "p"."apellidos", ("date_trunc"('month'::"text", "v"."creado_en"))
  ORDER BY ("date_trunc"('month'::"text", "v"."creado_en")) DESC, COALESCE("sum"((("vd"."cantidad")::numeric * "vd"."precio_unitario")), (0)::numeric) DESC;

-- No historical scan or correction: new/updated rows are checked immediately.

alter table public.ventas add constraint ventas_total_finito_b2
 check (total <> 'NaN'::numeric and total <> 'Infinity'::numeric and total <> '-Infinity'::numeric) not valid;

alter table public.ventas add constraint ventas_descuento_finito_b2
 check (descuento <> 'NaN'::numeric and descuento <> 'Infinity'::numeric and descuento <> '-Infinity'::numeric) not valid;

alter table public.venta_detalles add constraint venta_detalles_precio_unitario_finito_b2
 check (precio_unitario <> 'NaN'::numeric and precio_unitario <> 'Infinity'::numeric and precio_unitario <> '-Infinity'::numeric) not valid;

alter table public.venta_detalles add constraint venta_detalles_subtotal_finito_b2
 check (subtotal <> 'NaN'::numeric and subtotal <> 'Infinity'::numeric and subtotal <> '-Infinity'::numeric) not valid;

alter table public.gastos_extras add constraint gastos_extras_monto_finito_b2
 check (monto <> 'NaN'::numeric and monto <> 'Infinity'::numeric and monto <> '-Infinity'::numeric) not valid;

alter table public.reglas_comision add constraint reglas_comision_porcentaje_finito_b2
 check (porcentaje <> 'NaN'::numeric and porcentaje <> 'Infinity'::numeric and porcentaje <> '-Infinity'::numeric and porcentaje <= 100) not valid;

alter table public.reglas_comision add constraint reglas_comision_monto_fijo_finito_b2
 check (monto_fijo <> 'NaN'::numeric and monto_fijo <> 'Infinity'::numeric and monto_fijo <> '-Infinity'::numeric) not valid;

alter table public.productos add constraint productos_precio_base_finito_b2
 check (precio_base <> 'NaN'::numeric and precio_base <> 'Infinity'::numeric and precio_base <> '-Infinity'::numeric) not valid;


-- Views always apply caller grants/RLS, including future report views in this chain.
do $$ declare r record; begin
 for r in select c.relname from pg_catalog.pg_class c
 where c.relnamespace='public'::regnamespace and c.relkind='v'
 loop execute format('alter view public.%I set (security_invoker = true)',r.relname); end loop;
end $$;

-- Explicit allow-list. PUBLIC revocation matters because both API roles inherit it.
revoke all on schema public from public, anon;
grant usage on schema public to authenticated, service_role;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke execute on all functions in schema public, private from public, anon, authenticated;
-- Tables queried directly by current frontend, plus dependencies of its invoker views.
grant select on public.perfiles, public.sucursales, public.productos, public.tipos_empaque,
 public.clientes, public.carga_vendedor, public.gastos_extras, public.ventas,
 public.venta_detalles, public.reglas_comision, public.despachos, public.despacho_detalles,
 public.despacho_envases, public.devoluciones_productos, public.devoluciones_envases,
 public.stock_bodega, public.stock_envases, public.producciones, public.mermas to authenticated;
grant select on public.v_comision_vendedor, public.v_ranking_vendedores,
 public.v_indicadores_produccion_diarios to authenticated;
grant insert on public.clientes, public.gastos_extras, public.producciones,
 public.mermas, public.devoluciones_productos, public.devoluciones_envases,
 public.despachos, public.despacho_detalles, public.despacho_envases to authenticated;
-- B1's cancellation contract is retained; all other unused mutations stay closed.
grant update (anulado) on public.mermas to authenticated;
-- Explicit GPS contract in #29; no bodega visibility and no tracking UI/bucket added.
grant select, insert on public.ubicaciones_vendedores to authenticated;
grant usage on sequence public.ubicaciones_vendedores_id_seq to authenticated;
grant execute on function public.registrar_venta(uuid,text,jsonb,numeric,text),
 public.crear_despacho(uuid,uuid,uuid,uuid,jsonb,jsonb),
 public.corregir_devolucion(uuid,uuid,jsonb,jsonb) to authenticated;
-- Private RLS helpers need execution for policies, but are not exposed RPC schemas.
grant execute on function private.es_rol(text), private.mi_sucursal(),
 private.es_admin_global(), private.perfil_activo(), private.perfil_en_ambito(uuid) to authenticated;
-- Deny future implicit exposure for application objects owned by the migration role.
alter default privileges for role postgres in schema public, private revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public, private revoke all on sequences from public, anon, authenticated;
-- PUBLIC function EXECUTE is a global default: a schema-local REVOKE cannot remove it.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public, private revoke execute on functions from public, anon, authenticated;
