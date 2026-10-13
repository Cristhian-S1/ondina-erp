-- Production schema snapshot supplied on 2026-10-13; not a production migration.
-- Existing installations mark this version applied, then run forward deltas.
-- Source normalized from CRLF to LF; no source SQL statements removed.
-- One ACL reset compensates for Supabase bootstrap default view privileges.



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "private"."es_rol"("p_rol" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select exists (
        select 1
        from public.perfiles
        where id = (select auth.uid())
          and rol = p_rol
          and activo
    );
$$;


ALTER FUNCTION "private"."es_rol"("p_rol" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."mi_sucursal"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select sucursal_id
    from public.perfiles
    where id = (select auth.uid())
      and activo;
$$;


ALTER FUNCTION "private"."mi_sucursal"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."corregir_devolucion"("p_despacho_id" "uuid", "p_creado_por" "uuid", "p_productos" "jsonb", "p_envases" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."corregir_devolucion"("p_despacho_id" "uuid", "p_creado_por" "uuid", "p_productos" "jsonb", "p_envases" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."crear_despacho"("p_sucursal_id" "uuid", "p_vendedor_id" "uuid", "p_despachador_id" "uuid", "p_creado_por" "uuid", "p_lineas" "jsonb", "p_envases" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."crear_despacho"("p_sucursal_id" "uuid", "p_vendedor_id" "uuid", "p_despachador_id" "uuid", "p_creado_por" "uuid", "p_lineas" "jsonb", "p_envases" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."es_rol"("p_rol" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from perfiles where id = auth.uid() and rol = p_rol and activo
  );
$$;


ALTER FUNCTION "public"."es_rol"("p_rol" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_auditoria_simple"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."fn_auditoria_simple"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mi_sucursal"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select sucursal_id from perfiles where id = auth.uid();
$$;


ALTER FUNCTION "public"."mi_sucursal"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_venta"("p_cliente_id" "uuid", "p_metodo_pago" "text", "p_detalles" "jsonb", "p_descuento" numeric DEFAULT 0, "p_observaciones" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_venta         public.ventas%rowtype;
    v_cliente       public.clientes%rowtype;
    v_sucursal_id   uuid;
    v_vendedor      uuid := auth.uid();
    v_detalle       jsonb;
    v_venta_id      uuid;
    v_producto      uuid;
    v_cantidad      integer;
    v_precio        numeric(12, 2);
    v_envases       integer;
begin
    if v_vendedor is null then
        raise exception 'No hay un usuario autenticado';
    end if;

    if p_detalles is null or jsonb_array_length(p_detalles) = 0 then
        raise exception 'La venta debe incluir al menos un detalle';
    end if;

    if p_metodo_pago is null or p_metodo_pago not in ('efectivo', 'transferencia') then
        raise exception 'Método de pago inválido (efectivo o transferencia)';
    end if;

    select sucursal_id into v_sucursal_id from public.perfiles where id = v_vendedor;
    if v_sucursal_id is null then
        raise exception 'El usuario autenticado no tiene perfil';
    end if;

    if public.es_rol('administrador') then
        select * into v_cliente from public.clientes
        where id = p_cliente_id and sucursal_id = v_sucursal_id and activo;
    else
        select * into v_cliente from public.clientes
        where id = p_cliente_id
          and sucursal_id = v_sucursal_id
          and vendedor_id = v_vendedor
          and activo;
    end if;
    if v_cliente.id is null then
        raise exception 'Cliente inexistente o fuera de su cartera/sucursal';
    end if;

    insert into public.ventas (
        sucursal_id, vendedor_id, cliente_id,
        metodo_pago, descuento, total, observaciones,
        creado_por
    )
    values (
        v_sucursal_id, v_vendedor, p_cliente_id,
        p_metodo_pago, coalesce(p_descuento, 0), 0, p_observaciones,
        v_vendedor
    )
    returning id into v_venta_id;

    for v_detalle in select jsonb_array_elements(p_detalles) loop
        v_producto := (v_detalle ->> 'producto_id')::uuid;
        v_cantidad := (v_detalle ->> 'cantidad')::integer;
        v_precio   := (v_detalle ->> 'precio_unitario')::numeric(12, 2);
        v_envases  := coalesce((v_detalle ->> 'envases_recibidos')::integer, 0);

        if v_producto is null or v_cantidad is null or v_precio is null then
            raise exception 'Detalle de venta incompleto (producto_id, cantidad y precio_unitario son obligatorios)';
        end if;
        if v_cantidad <= 0 then
            raise exception 'La cantidad debe ser mayor que cero';
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


ALTER FUNCTION "public"."registrar_venta"("p_cliente_id" "uuid", "p_metodo_pago" "text", "p_detalles" "jsonb", "p_descuento" numeric, "p_observaciones" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
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


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_despacho_anular"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."trg_despacho_anular"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_despacho_detalle_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."trg_despacho_detalle_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_despacho_envase_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."trg_despacho_envase_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_devolucion_envase_anular"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."trg_devolucion_envase_anular"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_devolucion_envase_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."trg_devolucion_envase_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_devolucion_producto_anular"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."trg_devolucion_producto_anular"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_devolucion_producto_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
    do update set cantidad = stock_bodega.cantidad + excluded.cantidad,
                  modificado_en = now();
    return new;
end;
$$;


ALTER FUNCTION "public"."trg_devolucion_producto_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_merma_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_despacho public.despachos%rowtype;
    v_stock integer;
begin

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


ALTER FUNCTION "public"."trg_merma_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_produccion_anular"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."trg_produccion_anular"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_produccion_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."trg_produccion_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_venta_anular"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."trg_venta_anular"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_venta_detalle_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
            do update set cantidad = stock_envases.cantidad + excluded.cantidad,
                          modificado_en = now();
        end if;
    end if;

    return new;
end;
$$;


ALTER FUNCTION "public"."trg_venta_detalle_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_venta_recalcular_total"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."trg_venta_recalcular_total"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."auditoria" (
    "id" bigint NOT NULL,
    "tabla" "text" NOT NULL,
    "registro_id" "uuid" NOT NULL,
    "accion" "text" NOT NULL,
    "usuario_id" "uuid",
    "valores_anteriores" "jsonb",
    "valores_nuevos" "jsonb",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "auditoria_accion_check" CHECK (("accion" = ANY (ARRAY['INSERT'::"text", 'UPDATE'::"text", 'ANULACION'::"text"])))
);


ALTER TABLE "public"."auditoria" OWNER TO "postgres";


ALTER TABLE "public"."auditoria" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."auditoria_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."carga_vendedor" (
    "vendedor_id" "uuid" NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "cantidad" integer DEFAULT 0 NOT NULL,
    "modificado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "carga_vendedor_cantidad_check" CHECK (("cantidad" >= 0))
);


ALTER TABLE "public"."carga_vendedor" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clientes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sucursal_id" "uuid" NOT NULL,
    "vendedor_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "telefono" "text",
    "direccion" "text" NOT NULL,
    "numero_local" "text",
    "tipo" "text" DEFAULT 'minorista'::"text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "creado_por" "uuid" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modificado_por" "uuid",
    "modificado_en" timestamp with time zone,
    CONSTRAINT "clientes_tipo_check" CHECK (("tipo" = ANY (ARRAY['mayorista'::"text", 'minorista'::"text", 'ocasional'::"text"])))
);


ALTER TABLE "public"."clientes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracion" (
    "clave" "text" NOT NULL,
    "valor" "text" NOT NULL,
    "descripcion" "text",
    "modificado_por" "uuid",
    "modificado_en" timestamp with time zone
);


ALTER TABLE "public"."configuracion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."despacho_detalles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "despacho_id" "uuid" NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "cantidad" integer NOT NULL,
    "es_ajuste" boolean DEFAULT false NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "despacho_detalles_cantidad_check" CHECK (("cantidad" > 0))
);


ALTER TABLE "public"."despacho_detalles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."despacho_envases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "despacho_id" "uuid" NOT NULL,
    "tipo_empaque_id" "uuid" NOT NULL,
    "cantidad" integer NOT NULL,
    "es_ajuste" boolean DEFAULT false NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "despacho_envases_cantidad_check" CHECK (("cantidad" > 0))
);


ALTER TABLE "public"."despacho_envases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."despachos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sucursal_id" "uuid" NOT NULL,
    "vendedor_id" "uuid" NOT NULL,
    "despachador_id" "uuid" NOT NULL,
    "anulado" boolean DEFAULT false NOT NULL,
    "creado_por" "uuid" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modificado_por" "uuid",
    "modificado_en" timestamp with time zone
);


ALTER TABLE "public"."despachos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."devoluciones_envases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "despacho_id" "uuid" NOT NULL,
    "tipo_empaque_id" "uuid" NOT NULL,
    "cantidad" integer NOT NULL,
    "estado" "text" DEFAULT 'bueno'::"text" NOT NULL,
    "anulado" boolean DEFAULT false NOT NULL,
    "creado_por" "uuid" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "devoluciones_envases_cantidad_check" CHECK (("cantidad" > 0)),
    CONSTRAINT "devoluciones_envases_estado_check" CHECK (("estado" = ANY (ARRAY['bueno'::"text", 'malo'::"text"])))
);


ALTER TABLE "public"."devoluciones_envases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."devoluciones_productos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "despacho_id" "uuid" NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "cantidad" integer NOT NULL,
    "anulado" boolean DEFAULT false NOT NULL,
    "creado_por" "uuid" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "devoluciones_productos_cantidad_check" CHECK (("cantidad" > 0))
);


ALTER TABLE "public"."devoluciones_productos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gastos_extras" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sucursal_id" "uuid" NOT NULL,
    "vendedor_id" "uuid" NOT NULL,
    "tipo" "text" DEFAULT 'otra'::"text" NOT NULL,
    "monto" numeric(12,2) NOT NULL,
    "motivo" "text" NOT NULL,
    "comprobante_url" "text",
    "anulado" boolean DEFAULT false NOT NULL,
    "creado_por" "uuid" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modificado_por" "uuid",
    "modificado_en" timestamp with time zone,
    CONSTRAINT "gastos_extras_monto_check" CHECK (("monto" > (0)::numeric)),
    CONSTRAINT "gastos_extras_tipo_check" CHECK (("tipo" = ANY (ARRAY['combustible'::"text", 'averia'::"text", 'otra'::"text"])))
);


ALTER TABLE "public"."gastos_extras" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."incidencias_produccion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "produccion_id" "uuid",
    "descripcion" "text" NOT NULL,
    "creado_por" "uuid" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."incidencias_produccion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mermas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sucursal_id" "uuid" NOT NULL,
    "despacho_id" "uuid",
    "producto_id" "uuid",
    "tipo_empaque_id" "uuid",
    "cantidad" integer NOT NULL,
    "motivo" "text" NOT NULL,
    "anulado" boolean DEFAULT false NOT NULL,
    "creado_por" "uuid" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mermas_cantidad_check" CHECK (("cantidad" > 0)),
    CONSTRAINT "mermas_check" CHECK ((("producto_id" IS NOT NULL) <> ("tipo_empaque_id" IS NOT NULL)))
);


ALTER TABLE "public"."mermas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."perfiles" (
    "id" "uuid" NOT NULL,
    "sucursal_id" "uuid",
    "nombres" "text" NOT NULL,
    "apellidos" "text" NOT NULL,
    "rut" "text",
    "telefono" "text",
    "rol" "text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "perfiles_rol_check" CHECK (("rol" = ANY (ARRAY['vendedor'::"text", 'bodega'::"text", 'produccion'::"text", 'administrador'::"text"])))
);


ALTER TABLE "public"."perfiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."producciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sucursal_id" "uuid" NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "cantidad" integer NOT NULL,
    "observaciones" "text",
    "anulado" boolean DEFAULT false NOT NULL,
    "creado_por" "uuid" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "producciones_cantidad_check" CHECK (("cantidad" > 0))
);


ALTER TABLE "public"."producciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."productos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "tipo_empaque_id" "uuid",
    "precio_base" numeric(12,2) NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "productos_precio_base_check" CHECK (("precio_base" >= (0)::numeric)),
    CONSTRAINT "productos_tipo_check" CHECK (("tipo" = ANY (ARRAY['agua'::"text", 'hielo'::"text"])))
);


ALTER TABLE "public"."productos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reglas_comision" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo_producto" "text" NOT NULL,
    "porcentaje" numeric(5,2),
    "monto_fijo" numeric(12,2),
    "vigente_desde" timestamp with time zone DEFAULT "now"() NOT NULL,
    "vigente_hasta" timestamp with time zone,
    "creado_por" "uuid",
    CONSTRAINT "reglas_comision_check" CHECK ((("porcentaje" IS NOT NULL) OR ("monto_fijo" IS NOT NULL))),
    CONSTRAINT "reglas_comision_check1" CHECK ((("vigente_hasta" IS NULL) OR ("vigente_hasta" > "vigente_desde"))),
    CONSTRAINT "reglas_comision_monto_fijo_check" CHECK (("monto_fijo" >= (0)::numeric)),
    CONSTRAINT "reglas_comision_porcentaje_check" CHECK (("porcentaje" >= (0)::numeric)),
    CONSTRAINT "reglas_comision_tipo_producto_check" CHECK (("tipo_producto" = ANY (ARRAY['agua'::"text", 'hielo'::"text"])))
);


ALTER TABLE "public"."reglas_comision" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_bodega" (
    "sucursal_id" "uuid" NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "cantidad" integer DEFAULT 0 NOT NULL,
    "modificado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stock_bodega_cantidad_check" CHECK (("cantidad" >= 0))
);


ALTER TABLE "public"."stock_bodega" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_envases" (
    "sucursal_id" "uuid" NOT NULL,
    "tipo_empaque_id" "uuid" NOT NULL,
    "cantidad" integer DEFAULT 0 NOT NULL,
    "modificado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stock_envases_cantidad_check" CHECK (("cantidad" >= 0))
);


ALTER TABLE "public"."stock_envases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sucursales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "direccion" "text",
    "comuna" "text",
    "region" "text",
    "telefono" "text",
    "activa" boolean DEFAULT true NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sucursales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tipos_empaque" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "categoria" "text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    CONSTRAINT "tipos_empaque_categoria_check" CHECK (("categoria" = ANY (ARRAY['retornable'::"text", 'no_retornable'::"text", 'uso_interno'::"text"])))
);


ALTER TABLE "public"."tipos_empaque" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ubicaciones_vendedores" (
    "id" bigint NOT NULL,
    "vendedor_id" "uuid" NOT NULL,
    "latitud" numeric(9,6) NOT NULL,
    "longitud" numeric(9,6) NOT NULL,
    "registrado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ubicaciones_vendedores_latitud_check" CHECK ((("latitud" >= ('-90'::integer)::numeric) AND ("latitud" <= (90)::numeric))),
    CONSTRAINT "ubicaciones_vendedores_longitud_check" CHECK ((("longitud" >= ('-180'::integer)::numeric) AND ("longitud" <= (180)::numeric)))
);


ALTER TABLE "public"."ubicaciones_vendedores" OWNER TO "postgres";


ALTER TABLE "public"."ubicaciones_vendedores" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."ubicaciones_vendedores_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."venta_detalles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "venta_id" "uuid" NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "cantidad" integer NOT NULL,
    "precio_unitario" numeric(12,2) NOT NULL,
    "envases_recibidos" integer DEFAULT 0 NOT NULL,
    "subtotal" numeric(12,2) GENERATED ALWAYS AS ((("cantidad")::numeric * "precio_unitario")) STORED,
    CONSTRAINT "venta_detalles_cantidad_check" CHECK (("cantidad" > 0)),
    CONSTRAINT "venta_detalles_envases_recibidos_check" CHECK (("envases_recibidos" >= 0)),
    CONSTRAINT "venta_detalles_precio_unitario_check" CHECK (("precio_unitario" >= (0)::numeric))
);


ALTER TABLE "public"."venta_detalles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ventas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sucursal_id" "uuid" NOT NULL,
    "vendedor_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "metodo_pago" "text" NOT NULL,
    "tipo_documento" "text",
    "folio_documento" "text",
    "descuento" numeric(12,2) DEFAULT 0 NOT NULL,
    "total" numeric(12,2) DEFAULT 0 NOT NULL,
    "observaciones" "text",
    "anulado" boolean DEFAULT false NOT NULL,
    "creado_por" "uuid" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modificado_por" "uuid",
    "modificado_en" timestamp with time zone,
    CONSTRAINT "ventas_check" CHECK ((("tipo_documento" IS NULL) OR ("folio_documento" IS NOT NULL))),
    CONSTRAINT "ventas_descuento_check" CHECK (("descuento" >= (0)::numeric)),
    CONSTRAINT "ventas_metodo_pago_check" CHECK (("metodo_pago" = ANY (ARRAY['efectivo'::"text", 'transferencia'::"text"]))),
    CONSTRAINT "ventas_tipo_documento_check" CHECK (("tipo_documento" = ANY (ARRAY['boleta'::"text", 'factura'::"text"]))),
    CONSTRAINT "ventas_total_check" CHECK (("total" >= (0)::numeric))
);


ALTER TABLE "public"."ventas" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_bidones_vacios_vendedor" WITH ("security_invoker"='true') AS
 WITH "ventas_dia" AS (
         SELECT "v_1"."vendedor_id",
            ("v_1"."creado_en")::"date" AS "fecha",
            "p"."tipo_empaque_id",
            "sum"("vd"."envases_recibidos") AS "cantidad"
           FROM (("public"."ventas" "v_1"
             JOIN "public"."venta_detalles" "vd" ON (("vd"."venta_id" = "v_1"."id")))
             JOIN "public"."productos" "p" ON (("p"."id" = "vd"."producto_id")))
          WHERE ((NOT "v_1"."anulado") AND ("p"."tipo_empaque_id" IS NOT NULL))
          GROUP BY "v_1"."vendedor_id", (("v_1"."creado_en")::"date"), "p"."tipo_empaque_id"
        ), "devoluciones_dia" AS (
         SELECT "d"."vendedor_id",
            ("d"."creado_en")::"date" AS "fecha",
            "de"."tipo_empaque_id",
            "sum"("de"."cantidad") AS "cantidad"
           FROM ("public"."devoluciones_envases" "de"
             JOIN "public"."despachos" "d" ON (("d"."id" = "de"."despacho_id")))
          WHERE ((NOT "de"."anulado") AND ("de"."estado" = 'bueno'::"text"))
          GROUP BY "d"."vendedor_id", (("d"."creado_en")::"date"), "de"."tipo_empaque_id"
        )
 SELECT COALESCE("v"."vendedor_id", "dv"."vendedor_id") AS "vendedor_id",
    COALESCE("v"."fecha", "dv"."fecha") AS "fecha",
    "te"."id" AS "tipo_empaque_id",
    "te"."nombre" AS "empaque_nombre",
    (COALESCE("v"."cantidad", (0)::bigint) + COALESCE("dv"."cantidad", (0)::bigint)) AS "cantidad"
   FROM (("ventas_dia" "v"
     FULL JOIN "devoluciones_dia" "dv" ON ((("dv"."vendedor_id" = "v"."vendedor_id") AND ("dv"."fecha" = "v"."fecha") AND ("dv"."tipo_empaque_id" = "v"."tipo_empaque_id"))))
     RIGHT JOIN "public"."tipos_empaque" "te" ON (("te"."id" = COALESCE("v"."tipo_empaque_id", "dv"."tipo_empaque_id"))));


ALTER VIEW "public"."v_bidones_vacios_vendedor" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_comision_vendedor" AS
 SELECT "v"."vendedor_id",
    (("v"."creado_en" AT TIME ZONE 'America/Santiago'::"text"))::"date" AS "jornada",
    "p"."tipo",
    "sum"((("vd"."cantidad")::numeric * "vd"."precio_unitario")) AS "base_comision",
    "r"."porcentaje",
    "r"."monto_fijo",
    "count"(DISTINCT "v"."id") AS "ventas_del_tipo",
    "round"((COALESCE((("sum"((("vd"."cantidad")::numeric * "vd"."precio_unitario")) * "r"."porcentaje") / 100.0), (0)::numeric) + (("count"(DISTINCT "v"."id"))::numeric * COALESCE("r"."monto_fijo", (0)::numeric))), 2) AS "comision"
   FROM ((("public"."ventas" "v"
     JOIN "public"."venta_detalles" "vd" ON ((("vd"."venta_id" = "v"."id") AND (NOT "v"."anulado"))))
     JOIN "public"."productos" "p" ON (("p"."id" = "vd"."producto_id")))
     LEFT JOIN LATERAL ( SELECT "r_1"."porcentaje",
            "r_1"."monto_fijo"
           FROM "public"."reglas_comision" "r_1"
          WHERE (("r_1"."tipo_producto" = "p"."tipo") AND ("r_1"."vigente_desde" <= "now"()) AND (("r_1"."vigente_hasta" IS NULL) OR ("r_1"."vigente_hasta" >= "now"())))
          ORDER BY "r_1"."vigente_desde" DESC
         LIMIT 1) "r" ON (true))
  WHERE (NOT "v"."anulado")
  GROUP BY "v"."vendedor_id", ((("v"."creado_en" AT TIME ZONE 'America/Santiago'::"text"))::"date"), "p"."tipo", "r"."porcentaje", "r"."monto_fijo";


ALTER VIEW "public"."v_comision_vendedor" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_indicadores_produccion_diarios" WITH ("security_invoker"='true') AS
 SELECT "sucursal_id",
    "producto_id",
    (("creado_en" AT TIME ZONE 'America/Santiago'::"text"))::"date" AS "fecha",
    "sum"("cantidad") AS "cantidad",
    "count"(*) AS "registros"
   FROM "public"."producciones"
  WHERE (NOT "anulado")
  GROUP BY "sucursal_id", "producto_id", ((("creado_en" AT TIME ZONE 'America/Santiago'::"text"))::"date");


ALTER VIEW "public"."v_indicadores_produccion_diarios" OWNER TO "postgres";


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
  WHERE (("p"."rol" = 'vendedor'::"text") AND "p"."activo")
  GROUP BY "p"."id", "p"."sucursal_id", "p"."nombres", "p"."apellidos", ("date_trunc"('month'::"text", "v"."creado_en"))
  ORDER BY ("date_trunc"('month'::"text", "v"."creado_en")) DESC, COALESCE("sum"((("vd"."cantidad")::numeric * "vd"."precio_unitario")), (0)::numeric) DESC;


ALTER VIEW "public"."v_ranking_vendedores" OWNER TO "postgres";


ALTER TABLE ONLY "public"."auditoria"
    ADD CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carga_vendedor"
    ADD CONSTRAINT "carga_vendedor_pkey" PRIMARY KEY ("vendedor_id", "producto_id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_id_sucursal_id_key" UNIQUE ("id", "sucursal_id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracion"
    ADD CONSTRAINT "configuracion_pkey" PRIMARY KEY ("clave");



ALTER TABLE ONLY "public"."despacho_detalles"
    ADD CONSTRAINT "despacho_detalles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."despacho_envases"
    ADD CONSTRAINT "despacho_envases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."despachos"
    ADD CONSTRAINT "despachos_id_sucursal_id_key" UNIQUE ("id", "sucursal_id");



ALTER TABLE ONLY "public"."despachos"
    ADD CONSTRAINT "despachos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."devoluciones_envases"
    ADD CONSTRAINT "devoluciones_envases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."devoluciones_productos"
    ADD CONSTRAINT "devoluciones_productos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gastos_extras"
    ADD CONSTRAINT "gastos_extras_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."incidencias_produccion"
    ADD CONSTRAINT "incidencias_produccion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mermas"
    ADD CONSTRAINT "mermas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_id_sucursal_id_key" UNIQUE ("id", "sucursal_id");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_rut_key" UNIQUE ("rut");



ALTER TABLE ONLY "public"."producciones"
    ADD CONSTRAINT "producciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos"
    ADD CONSTRAINT "productos_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."productos"
    ADD CONSTRAINT "productos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reglas_comision"
    ADD CONSTRAINT "reglas_comision_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_bodega"
    ADD CONSTRAINT "stock_bodega_pkey" PRIMARY KEY ("sucursal_id", "producto_id");



ALTER TABLE ONLY "public"."stock_envases"
    ADD CONSTRAINT "stock_envases_pkey" PRIMARY KEY ("sucursal_id", "tipo_empaque_id");



ALTER TABLE ONLY "public"."sucursales"
    ADD CONSTRAINT "sucursales_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."sucursales"
    ADD CONSTRAINT "sucursales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tipos_empaque"
    ADD CONSTRAINT "tipos_empaque_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."tipos_empaque"
    ADD CONSTRAINT "tipos_empaque_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ubicaciones_vendedores"
    ADD CONSTRAINT "ubicaciones_vendedores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venta_detalles"
    ADD CONSTRAINT "venta_detalles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ventas"
    ADD CONSTRAINT "ventas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ventas"
    ADD CONSTRAINT "ventas_tipo_documento_folio_documento_key" UNIQUE ("tipo_documento", "folio_documento");



CREATE INDEX "idx_auditoria_tabla_registro" ON "public"."auditoria" USING "btree" ("tabla", "registro_id");



CREATE INDEX "idx_despacho_envases_despacho" ON "public"."despacho_envases" USING "btree" ("despacho_id");



CREATE OR REPLACE TRIGGER "trg_audit_despacho_envases" AFTER INSERT OR UPDATE ON "public"."despacho_envases" FOR EACH ROW EXECUTE FUNCTION "public"."fn_auditoria_simple"();



CREATE OR REPLACE TRIGGER "trg_despacho_anular" AFTER UPDATE OF "anulado" ON "public"."despachos" FOR EACH ROW WHEN (("new"."anulado" AND (NOT "old"."anulado"))) EXECUTE FUNCTION "public"."trg_despacho_anular"();



CREATE OR REPLACE TRIGGER "trg_despacho_detalle_insert" AFTER INSERT ON "public"."despacho_detalles" FOR EACH ROW EXECUTE FUNCTION "public"."trg_despacho_detalle_insert"();



CREATE OR REPLACE TRIGGER "trg_despacho_envase_insert" AFTER INSERT ON "public"."despacho_envases" FOR EACH ROW EXECUTE FUNCTION "public"."trg_despacho_envase_insert"();



CREATE OR REPLACE TRIGGER "trg_devolucion_envase" AFTER INSERT ON "public"."devoluciones_envases" FOR EACH ROW EXECUTE FUNCTION "public"."trg_devolucion_envase_insert"();



CREATE OR REPLACE TRIGGER "trg_devolucion_envase_anular" AFTER UPDATE OF "anulado" ON "public"."devoluciones_envases" FOR EACH ROW WHEN (("new"."anulado" AND (NOT "old"."anulado"))) EXECUTE FUNCTION "public"."trg_devolucion_envase_anular"();



CREATE OR REPLACE TRIGGER "trg_devolucion_producto" AFTER INSERT ON "public"."devoluciones_productos" FOR EACH ROW EXECUTE FUNCTION "public"."trg_devolucion_producto_insert"();



CREATE OR REPLACE TRIGGER "trg_devolucion_producto_anular" AFTER UPDATE OF "anulado" ON "public"."devoluciones_productos" FOR EACH ROW WHEN (("new"."anulado" AND (NOT "old"."anulado"))) EXECUTE FUNCTION "public"."trg_devolucion_producto_anular"();



CREATE OR REPLACE TRIGGER "trg_merma_insert" AFTER INSERT ON "public"."mermas" FOR EACH ROW EXECUTE FUNCTION "public"."trg_merma_insert"();



CREATE OR REPLACE TRIGGER "trg_produccion_anular" AFTER UPDATE OF "anulado" ON "public"."producciones" FOR EACH ROW WHEN (("new"."anulado" AND (NOT "old"."anulado"))) EXECUTE FUNCTION "public"."trg_produccion_anular"();



CREATE OR REPLACE TRIGGER "trg_produccion_insert" AFTER INSERT ON "public"."producciones" FOR EACH ROW EXECUTE FUNCTION "public"."trg_produccion_insert"();



CREATE OR REPLACE TRIGGER "trg_venta_anular" AFTER UPDATE OF "anulado" ON "public"."ventas" FOR EACH ROW WHEN (("new"."anulado" AND (NOT "old"."anulado"))) EXECUTE FUNCTION "public"."trg_venta_anular"();



CREATE OR REPLACE TRIGGER "trg_venta_detalle_insert" AFTER INSERT ON "public"."venta_detalles" FOR EACH ROW EXECUTE FUNCTION "public"."trg_venta_detalle_insert"();



CREATE OR REPLACE TRIGGER "trg_venta_total_del" AFTER DELETE ON "public"."venta_detalles" FOR EACH ROW EXECUTE FUNCTION "public"."trg_venta_recalcular_total"();



CREATE OR REPLACE TRIGGER "trg_venta_total_ins" AFTER INSERT ON "public"."venta_detalles" FOR EACH ROW EXECUTE FUNCTION "public"."trg_venta_recalcular_total"();



CREATE OR REPLACE TRIGGER "trg_venta_total_upd" AFTER UPDATE ON "public"."venta_detalles" FOR EACH ROW EXECUTE FUNCTION "public"."trg_venta_recalcular_total"();



ALTER TABLE ONLY "public"."auditoria"
    ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."carga_vendedor"
    ADD CONSTRAINT "carga_vendedor_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id");



ALTER TABLE ONLY "public"."carga_vendedor"
    ADD CONSTRAINT "carga_vendedor_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_modificado_por_fkey" FOREIGN KEY ("modificado_por") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_vendedor_id_sucursal_id_fkey" FOREIGN KEY ("vendedor_id", "sucursal_id") REFERENCES "public"."perfiles"("id", "sucursal_id");



ALTER TABLE ONLY "public"."configuracion"
    ADD CONSTRAINT "configuracion_modificado_por_fkey" FOREIGN KEY ("modificado_por") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."despacho_detalles"
    ADD CONSTRAINT "despacho_detalles_despacho_id_fkey" FOREIGN KEY ("despacho_id") REFERENCES "public"."despachos"("id");



ALTER TABLE ONLY "public"."despacho_detalles"
    ADD CONSTRAINT "despacho_detalles_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id");



ALTER TABLE ONLY "public"."despacho_envases"
    ADD CONSTRAINT "despacho_envases_despacho_id_fkey" FOREIGN KEY ("despacho_id") REFERENCES "public"."despachos"("id");



ALTER TABLE ONLY "public"."despacho_envases"
    ADD CONSTRAINT "despacho_envases_tipo_empaque_id_fkey" FOREIGN KEY ("tipo_empaque_id") REFERENCES "public"."tipos_empaque"("id");



ALTER TABLE ONLY "public"."despachos"
    ADD CONSTRAINT "despachos_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."despachos"
    ADD CONSTRAINT "despachos_despachador_id_fkey" FOREIGN KEY ("despachador_id") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."despachos"
    ADD CONSTRAINT "despachos_modificado_por_fkey" FOREIGN KEY ("modificado_por") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."despachos"
    ADD CONSTRAINT "despachos_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id");



ALTER TABLE ONLY "public"."despachos"
    ADD CONSTRAINT "despachos_vendedor_id_sucursal_id_fkey" FOREIGN KEY ("vendedor_id", "sucursal_id") REFERENCES "public"."perfiles"("id", "sucursal_id");



ALTER TABLE ONLY "public"."devoluciones_envases"
    ADD CONSTRAINT "devoluciones_envases_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."devoluciones_envases"
    ADD CONSTRAINT "devoluciones_envases_despacho_id_fkey" FOREIGN KEY ("despacho_id") REFERENCES "public"."despachos"("id");



ALTER TABLE ONLY "public"."devoluciones_envases"
    ADD CONSTRAINT "devoluciones_envases_tipo_empaque_id_fkey" FOREIGN KEY ("tipo_empaque_id") REFERENCES "public"."tipos_empaque"("id");



ALTER TABLE ONLY "public"."devoluciones_productos"
    ADD CONSTRAINT "devoluciones_productos_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."devoluciones_productos"
    ADD CONSTRAINT "devoluciones_productos_despacho_id_fkey" FOREIGN KEY ("despacho_id") REFERENCES "public"."despachos"("id");



ALTER TABLE ONLY "public"."devoluciones_productos"
    ADD CONSTRAINT "devoluciones_productos_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id");



ALTER TABLE ONLY "public"."gastos_extras"
    ADD CONSTRAINT "gastos_extras_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."gastos_extras"
    ADD CONSTRAINT "gastos_extras_modificado_por_fkey" FOREIGN KEY ("modificado_por") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."gastos_extras"
    ADD CONSTRAINT "gastos_extras_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id");



ALTER TABLE ONLY "public"."gastos_extras"
    ADD CONSTRAINT "gastos_extras_vendedor_id_sucursal_id_fkey" FOREIGN KEY ("vendedor_id", "sucursal_id") REFERENCES "public"."perfiles"("id", "sucursal_id");



ALTER TABLE ONLY "public"."incidencias_produccion"
    ADD CONSTRAINT "incidencias_produccion_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."incidencias_produccion"
    ADD CONSTRAINT "incidencias_produccion_produccion_id_fkey" FOREIGN KEY ("produccion_id") REFERENCES "public"."producciones"("id");



ALTER TABLE ONLY "public"."mermas"
    ADD CONSTRAINT "mermas_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."mermas"
    ADD CONSTRAINT "mermas_despacho_id_sucursal_id_fkey" FOREIGN KEY ("despacho_id", "sucursal_id") REFERENCES "public"."despachos"("id", "sucursal_id");



ALTER TABLE ONLY "public"."mermas"
    ADD CONSTRAINT "mermas_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id");



ALTER TABLE ONLY "public"."mermas"
    ADD CONSTRAINT "mermas_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id");



ALTER TABLE ONLY "public"."mermas"
    ADD CONSTRAINT "mermas_tipo_empaque_id_fkey" FOREIGN KEY ("tipo_empaque_id") REFERENCES "public"."tipos_empaque"("id");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id");



ALTER TABLE ONLY "public"."producciones"
    ADD CONSTRAINT "producciones_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."producciones"
    ADD CONSTRAINT "producciones_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id");



ALTER TABLE ONLY "public"."producciones"
    ADD CONSTRAINT "producciones_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id");



ALTER TABLE ONLY "public"."productos"
    ADD CONSTRAINT "productos_tipo_empaque_id_fkey" FOREIGN KEY ("tipo_empaque_id") REFERENCES "public"."tipos_empaque"("id");



ALTER TABLE ONLY "public"."reglas_comision"
    ADD CONSTRAINT "reglas_comision_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."stock_bodega"
    ADD CONSTRAINT "stock_bodega_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id");



ALTER TABLE ONLY "public"."stock_bodega"
    ADD CONSTRAINT "stock_bodega_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id");



ALTER TABLE ONLY "public"."stock_envases"
    ADD CONSTRAINT "stock_envases_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id");



ALTER TABLE ONLY "public"."stock_envases"
    ADD CONSTRAINT "stock_envases_tipo_empaque_id_fkey" FOREIGN KEY ("tipo_empaque_id") REFERENCES "public"."tipos_empaque"("id");



ALTER TABLE ONLY "public"."ubicaciones_vendedores"
    ADD CONSTRAINT "ubicaciones_vendedores_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."venta_detalles"
    ADD CONSTRAINT "venta_detalles_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id");



ALTER TABLE ONLY "public"."venta_detalles"
    ADD CONSTRAINT "venta_detalles_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id");



ALTER TABLE ONLY "public"."ventas"
    ADD CONSTRAINT "ventas_cliente_id_sucursal_id_fkey" FOREIGN KEY ("cliente_id", "sucursal_id") REFERENCES "public"."clientes"("id", "sucursal_id");



ALTER TABLE ONLY "public"."ventas"
    ADD CONSTRAINT "ventas_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."ventas"
    ADD CONSTRAINT "ventas_modificado_por_fkey" FOREIGN KEY ("modificado_por") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."ventas"
    ADD CONSTRAINT "ventas_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id");



ALTER TABLE ONLY "public"."ventas"
    ADD CONSTRAINT "ventas_vendedor_id_sucursal_id_fkey" FOREIGN KEY ("vendedor_id", "sucursal_id") REFERENCES "public"."perfiles"("id", "sucursal_id");



ALTER TABLE "public"."auditoria" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auditoria_select_admin" ON "public"."auditoria" FOR SELECT TO "authenticated" USING ("public"."es_rol"('administrador'::"text"));



ALTER TABLE "public"."carga_vendedor" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "carga_vendedor_delete_bodega" ON "public"."carga_vendedor" FOR DELETE TO "authenticated" USING (("public"."es_rol"('bodega'::"text") OR "public"."es_rol"('administrador'::"text")));



CREATE POLICY "carga_vendedor_select_propio" ON "public"."carga_vendedor" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "vendedor_id") OR "public"."es_rol"('bodega'::"text") OR "public"."es_rol"('administrador'::"text")));



CREATE POLICY "carga_vendedor_update_bodega" ON "public"."carga_vendedor" FOR UPDATE TO "authenticated" USING (("public"."es_rol"('bodega'::"text") OR "public"."es_rol"('administrador'::"text"))) WITH CHECK (("public"."es_rol"('bodega'::"text") OR "public"."es_rol"('administrador'::"text")));



CREATE POLICY "carga_vendedor_write_bodega" ON "public"."carga_vendedor" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_rol"('bodega'::"text") OR "public"."es_rol"('administrador'::"text")));



ALTER TABLE "public"."clientes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clientes_delete_admin" ON "public"."clientes" FOR DELETE TO "authenticated" USING ("public"."es_rol"('administrador'::"text"));



CREATE POLICY "clientes_insert_cartera" ON "public"."clientes" FOR INSERT TO "authenticated" WITH CHECK (((("auth"."uid"() = "vendedor_id") AND ("sucursal_id" = "public"."mi_sucursal"())) OR "public"."es_rol"('administrador'::"text")));



CREATE POLICY "clientes_select_cartera" ON "public"."clientes" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "vendedor_id") OR "public"."es_rol"('administrador'::"text")));



CREATE POLICY "clientes_update_cartera" ON "public"."clientes" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "vendedor_id") OR "public"."es_rol"('administrador'::"text"))) WITH CHECK ((("auth"."uid"() = "vendedor_id") OR "public"."es_rol"('administrador'::"text")));



ALTER TABLE "public"."configuracion" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "configuracion_insert_admin" ON "public"."configuracion" FOR INSERT TO "authenticated" WITH CHECK ("public"."es_rol"('administrador'::"text"));



CREATE POLICY "configuracion_select_admin" ON "public"."configuracion" FOR SELECT TO "authenticated" USING ("public"."es_rol"('administrador'::"text"));



CREATE POLICY "configuracion_update_admin" ON "public"."configuracion" FOR UPDATE TO "authenticated" USING ("public"."es_rol"('administrador'::"text")) WITH CHECK ("public"."es_rol"('administrador'::"text"));



ALTER TABLE "public"."despacho_detalles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "despacho_detalles_insert_bodega" ON "public"."despacho_detalles" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_rol"('bodega'::"text") OR "public"."es_rol"('administrador'::"text")));



CREATE POLICY "despacho_detalles_select_despacho" ON "public"."despacho_detalles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."despachos" "d"
  WHERE (("d"."id" = "despacho_detalles"."despacho_id") AND (("d"."vendedor_id" = "auth"."uid"()) OR "public"."es_rol"('bodega'::"text") OR "public"."es_rol"('produccion'::"text") OR "public"."es_rol"('administrador'::"text"))))));



CREATE POLICY "despacho_detalles_update_admin" ON "public"."despacho_detalles" FOR UPDATE TO "authenticated" USING ("public"."es_rol"('administrador'::"text")) WITH CHECK ("public"."es_rol"('administrador'::"text"));



ALTER TABLE "public"."despacho_envases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "despacho_envases_insert_bodega" ON "public"."despacho_envases" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_rol"('bodega'::"text") OR "public"."es_rol"('administrador'::"text")));



CREATE POLICY "despacho_envases_select_despacho" ON "public"."despacho_envases" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."despachos" "d"
  WHERE (("d"."id" = "despacho_envases"."despacho_id") AND (("d"."vendedor_id" = "auth"."uid"()) OR "public"."es_rol"('bodega'::"text") OR "public"."es_rol"('produccion'::"text") OR "public"."es_rol"('administrador'::"text"))))));



CREATE POLICY "despacho_envases_update_admin" ON "public"."despacho_envases" FOR UPDATE TO "authenticated" USING ("public"."es_rol"('administrador'::"text")) WITH CHECK ("public"."es_rol"('administrador'::"text"));



ALTER TABLE "public"."despachos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "despachos_insert_bodega" ON "public"."despachos" FOR INSERT TO "authenticated" WITH CHECK ((("public"."es_rol"('bodega'::"text") AND ("sucursal_id" = "public"."mi_sucursal"())) OR "public"."es_rol"('administrador'::"text")));



CREATE POLICY "despachos_select_operativo" ON "public"."despachos" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "vendedor_id") OR ("public"."es_rol"('bodega'::"text") AND ("sucursal_id" = "public"."mi_sucursal"())) OR ("public"."es_rol"('produccion'::"text") AND ("sucursal_id" = "public"."mi_sucursal"())) OR "public"."es_rol"('administrador'::"text")));



CREATE POLICY "despachos_update_admin" ON "public"."despachos" FOR UPDATE TO "authenticated" USING ("public"."es_rol"('administrador'::"text")) WITH CHECK ("public"."es_rol"('administrador'::"text"));



ALTER TABLE "public"."devoluciones_envases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "devoluciones_envases_insert_despacho" ON "public"."devoluciones_envases" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_rol"('administrador'::"text") OR ("public"."es_rol"('bodega'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."despachos" "d"
  WHERE (("d"."id" = "devoluciones_envases"."despacho_id") AND ("d"."sucursal_id" = "public"."mi_sucursal"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."despachos" "d"
  WHERE (("d"."id" = "devoluciones_envases"."despacho_id") AND ("d"."vendedor_id" = "auth"."uid"()))))));



CREATE POLICY "devoluciones_envases_select_despacho" ON "public"."devoluciones_envases" FOR SELECT TO "authenticated" USING (("public"."es_rol"('administrador'::"text") OR ("public"."es_rol"('bodega'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."despachos" "d"
  WHERE (("d"."id" = "devoluciones_envases"."despacho_id") AND ("d"."sucursal_id" = "public"."mi_sucursal"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."despachos" "d"
  WHERE (("d"."id" = "devoluciones_envases"."despacho_id") AND ("d"."vendedor_id" = "auth"."uid"()))))));



CREATE POLICY "devoluciones_envases_update_admin" ON "public"."devoluciones_envases" FOR UPDATE TO "authenticated" USING ("public"."es_rol"('administrador'::"text")) WITH CHECK ("public"."es_rol"('administrador'::"text"));



ALTER TABLE "public"."devoluciones_productos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "devoluciones_productos_insert_despacho" ON "public"."devoluciones_productos" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_rol"('administrador'::"text") OR ("public"."es_rol"('bodega'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."despachos" "d"
  WHERE (("d"."id" = "devoluciones_productos"."despacho_id") AND ("d"."sucursal_id" = "public"."mi_sucursal"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."despachos" "d"
  WHERE (("d"."id" = "devoluciones_productos"."despacho_id") AND ("d"."vendedor_id" = "auth"."uid"()))))));



CREATE POLICY "devoluciones_productos_select_despacho" ON "public"."devoluciones_productos" FOR SELECT TO "authenticated" USING (("public"."es_rol"('administrador'::"text") OR ("public"."es_rol"('bodega'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."despachos" "d"
  WHERE (("d"."id" = "devoluciones_productos"."despacho_id") AND ("d"."sucursal_id" = "public"."mi_sucursal"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."despachos" "d"
  WHERE (("d"."id" = "devoluciones_productos"."despacho_id") AND ("d"."vendedor_id" = "auth"."uid"()))))));



CREATE POLICY "devoluciones_productos_update_admin" ON "public"."devoluciones_productos" FOR UPDATE TO "authenticated" USING ("public"."es_rol"('administrador'::"text")) WITH CHECK ("public"."es_rol"('administrador'::"text"));



ALTER TABLE "public"."gastos_extras" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gastos_extras_insert_vendedor" ON "public"."gastos_extras" FOR INSERT TO "authenticated" WITH CHECK (((("auth"."uid"() = "vendedor_id") AND ("sucursal_id" = "public"."mi_sucursal"())) OR "public"."es_rol"('administrador'::"text")));



CREATE POLICY "gastos_extras_select_propio" ON "public"."gastos_extras" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "vendedor_id") OR "public"."es_rol"('administrador'::"text")));



CREATE POLICY "gastos_extras_update_admin" ON "public"."gastos_extras" FOR UPDATE TO "authenticated" USING ("public"."es_rol"('administrador'::"text")) WITH CHECK ("public"."es_rol"('administrador'::"text"));



ALTER TABLE "public"."incidencias_produccion" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "incidencias_produccion_insert_produccion" ON "public"."incidencias_produccion" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_rol"('produccion'::"text") OR "public"."es_rol"('administrador'::"text")));



CREATE POLICY "incidencias_produccion_select_produccion" ON "public"."incidencias_produccion" FOR SELECT TO "authenticated" USING (("public"."es_rol"('produccion'::"text") OR "public"."es_rol"('administrador'::"text")));



ALTER TABLE "public"."mermas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mermas_insert_operativo" ON "public"."mermas" FOR INSERT TO "authenticated" WITH CHECK ((("creado_por" = ( SELECT "auth"."uid"() AS "uid")) AND ("private"."es_rol"('administrador'::"text") OR ("private"."es_rol"('bodega'::"text") AND ("sucursal_id" = "private"."mi_sucursal"())) OR ("private"."es_rol"('produccion'::"text") AND ("sucursal_id" = "private"."mi_sucursal"()) AND ("despacho_id" IS NULL) AND ("producto_id" IS NOT NULL)))));



CREATE POLICY "mermas_select_operativo" ON "public"."mermas" FOR SELECT TO "authenticated" USING (("public"."es_rol"('bodega'::"text") OR "public"."es_rol"('produccion'::"text") OR "public"."es_rol"('administrador'::"text") OR (("despacho_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."despachos" "d"
  WHERE (("d"."id" = "mermas"."despacho_id") AND ("d"."vendedor_id" = "auth"."uid"())))))));



CREATE POLICY "mermas_update_admin" ON "public"."mermas" FOR UPDATE TO "authenticated" USING ("public"."es_rol"('administrador'::"text")) WITH CHECK ("public"."es_rol"('administrador'::"text"));



ALTER TABLE "public"."perfiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "perfiles_insert_admin" ON "public"."perfiles" FOR INSERT TO "authenticated" WITH CHECK ("public"."es_rol"('administrador'::"text"));



CREATE POLICY "perfiles_select_propio" ON "public"."perfiles" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "id") OR "public"."es_rol"('administrador'::"text") OR ("public"."es_rol"('bodega'::"text") AND ("sucursal_id" = "public"."mi_sucursal"()))));



CREATE POLICY "perfiles_update_admin" ON "public"."perfiles" FOR UPDATE TO "authenticated" USING ("public"."es_rol"('administrador'::"text")) WITH CHECK ("public"."es_rol"('administrador'::"text"));



ALTER TABLE "public"."producciones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "producciones_insert_produccion" ON "public"."producciones" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_rol"('produccion'::"text") OR "public"."es_rol"('administrador'::"text")));



CREATE POLICY "producciones_select_produccion" ON "public"."producciones" FOR SELECT TO "authenticated" USING (("public"."es_rol"('produccion'::"text") OR "public"."es_rol"('administrador'::"text")));



CREATE POLICY "producciones_update_admin" ON "public"."producciones" FOR UPDATE TO "authenticated" USING ("public"."es_rol"('administrador'::"text")) WITH CHECK ("public"."es_rol"('administrador'::"text"));



ALTER TABLE "public"."productos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "productos_insert_admin" ON "public"."productos" FOR INSERT TO "authenticated" WITH CHECK ("public"."es_rol"('administrador'::"text"));



CREATE POLICY "productos_select_autenticado" ON "public"."productos" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "productos_update_admin" ON "public"."productos" FOR UPDATE TO "authenticated" USING ("public"."es_rol"('administrador'::"text")) WITH CHECK ("public"."es_rol"('administrador'::"text"));



ALTER TABLE "public"."reglas_comision" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reglas_comision_delete_admin" ON "public"."reglas_comision" FOR DELETE TO "authenticated" USING ("public"."es_rol"('administrador'::"text"));



CREATE POLICY "reglas_comision_insert_admin" ON "public"."reglas_comision" FOR INSERT TO "authenticated" WITH CHECK ("public"."es_rol"('administrador'::"text"));



CREATE POLICY "reglas_comision_select_autenticado" ON "public"."reglas_comision" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "reglas_comision_update_admin" ON "public"."reglas_comision" FOR UPDATE TO "authenticated" USING ("public"."es_rol"('administrador'::"text")) WITH CHECK ("public"."es_rol"('administrador'::"text"));



ALTER TABLE "public"."stock_bodega" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_bodega_select_operativo" ON "public"."stock_bodega" FOR SELECT TO "authenticated" USING (("public"."es_rol"('administrador'::"text") OR ("public"."es_rol"('bodega'::"text") AND ("sucursal_id" = "public"."mi_sucursal"()))));



CREATE POLICY "stock_bodega_update_bodega" ON "public"."stock_bodega" FOR UPDATE TO "authenticated" USING (("public"."es_rol"('bodega'::"text") OR "public"."es_rol"('administrador'::"text"))) WITH CHECK (("public"."es_rol"('bodega'::"text") OR "public"."es_rol"('administrador'::"text")));



CREATE POLICY "stock_bodega_write_bodega" ON "public"."stock_bodega" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_rol"('bodega'::"text") OR "public"."es_rol"('administrador'::"text")));



ALTER TABLE "public"."stock_envases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_envases_select_operativo" ON "public"."stock_envases" FOR SELECT TO "authenticated" USING (("private"."es_rol"('administrador'::"text") OR (("private"."es_rol"('bodega'::"text") OR "private"."es_rol"('produccion'::"text")) AND ("sucursal_id" = "private"."mi_sucursal"()))));



CREATE POLICY "stock_envases_update_bodega" ON "public"."stock_envases" FOR UPDATE TO "authenticated" USING (("public"."es_rol"('bodega'::"text") OR "public"."es_rol"('administrador'::"text"))) WITH CHECK (("public"."es_rol"('bodega'::"text") OR "public"."es_rol"('administrador'::"text")));



CREATE POLICY "stock_envases_write_bodega" ON "public"."stock_envases" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_rol"('bodega'::"text") OR "public"."es_rol"('administrador'::"text")));



ALTER TABLE "public"."sucursales" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sucursales_insert_admin" ON "public"."sucursales" FOR INSERT TO "authenticated" WITH CHECK ("public"."es_rol"('administrador'::"text"));



CREATE POLICY "sucursales_select_autenticado" ON "public"."sucursales" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "sucursales_update_admin" ON "public"."sucursales" FOR UPDATE TO "authenticated" USING ("public"."es_rol"('administrador'::"text")) WITH CHECK ("public"."es_rol"('administrador'::"text"));



ALTER TABLE "public"."tipos_empaque" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tipos_empaque_insert_admin" ON "public"."tipos_empaque" FOR INSERT TO "authenticated" WITH CHECK ("public"."es_rol"('administrador'::"text"));



CREATE POLICY "tipos_empaque_select_autenticado" ON "public"."tipos_empaque" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "tipos_empaque_update_admin" ON "public"."tipos_empaque" FOR UPDATE TO "authenticated" USING ("public"."es_rol"('administrador'::"text")) WITH CHECK ("public"."es_rol"('administrador'::"text"));



ALTER TABLE "public"."ubicaciones_vendedores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ubicaciones_vendedores_insert_propio" ON "public"."ubicaciones_vendedores" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "vendedor_id") OR "public"."es_rol"('administrador'::"text")));



CREATE POLICY "ubicaciones_vendedores_select_operativo" ON "public"."ubicaciones_vendedores" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "vendedor_id") OR "public"."es_rol"('bodega'::"text") OR "public"."es_rol"('administrador'::"text")));



ALTER TABLE "public"."venta_detalles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "venta_detalles_insert_venta" ON "public"."venta_detalles" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."ventas" "v"
  WHERE (("v"."id" = "venta_detalles"."venta_id") AND (("v"."vendedor_id" = "auth"."uid"()) OR "public"."es_rol"('administrador'::"text"))))));



CREATE POLICY "venta_detalles_select_venta" ON "public"."venta_detalles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."ventas" "v"
  WHERE (("v"."id" = "venta_detalles"."venta_id") AND (("v"."vendedor_id" = "auth"."uid"()) OR "public"."es_rol"('administrador'::"text"))))));



CREATE POLICY "venta_detalles_update_admin" ON "public"."venta_detalles" FOR UPDATE TO "authenticated" USING ("public"."es_rol"('administrador'::"text")) WITH CHECK ("public"."es_rol"('administrador'::"text"));



ALTER TABLE "public"."ventas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ventas_insert_vendedor" ON "public"."ventas" FOR INSERT TO "authenticated" WITH CHECK (((("auth"."uid"() = "vendedor_id") AND ("sucursal_id" = "public"."mi_sucursal"())) OR "public"."es_rol"('administrador'::"text")));



CREATE POLICY "ventas_select_propio" ON "public"."ventas" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "vendedor_id") OR "public"."es_rol"('administrador'::"text")));



CREATE POLICY "ventas_update_admin" ON "public"."ventas" FOR UPDATE TO "authenticated" USING ("public"."es_rol"('administrador'::"text")) WITH CHECK ("public"."es_rol"('administrador'::"text"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "private" TO "authenticated";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "private"."es_rol"("p_rol" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."es_rol"("p_rol" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."mi_sucursal"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."mi_sucursal"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."corregir_devolucion"("p_despacho_id" "uuid", "p_creado_por" "uuid", "p_productos" "jsonb", "p_envases" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."corregir_devolucion"("p_despacho_id" "uuid", "p_creado_por" "uuid", "p_productos" "jsonb", "p_envases" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."corregir_devolucion"("p_despacho_id" "uuid", "p_creado_por" "uuid", "p_productos" "jsonb", "p_envases" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."crear_despacho"("p_sucursal_id" "uuid", "p_vendedor_id" "uuid", "p_despachador_id" "uuid", "p_creado_por" "uuid", "p_lineas" "jsonb", "p_envases" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."crear_despacho"("p_sucursal_id" "uuid", "p_vendedor_id" "uuid", "p_despachador_id" "uuid", "p_creado_por" "uuid", "p_lineas" "jsonb", "p_envases" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."crear_despacho"("p_sucursal_id" "uuid", "p_vendedor_id" "uuid", "p_despachador_id" "uuid", "p_creado_por" "uuid", "p_lineas" "jsonb", "p_envases" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."es_rol"("p_rol" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."es_rol"("p_rol" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."es_rol"("p_rol" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."fn_auditoria_simple"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_auditoria_simple"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_auditoria_simple"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mi_sucursal"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mi_sucursal"() TO "service_role";
GRANT ALL ON FUNCTION "public"."mi_sucursal"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."registrar_venta"("p_cliente_id" "uuid", "p_metodo_pago" "text", "p_detalles" "jsonb", "p_descuento" numeric, "p_observaciones" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registrar_venta"("p_cliente_id" "uuid", "p_metodo_pago" "text", "p_detalles" "jsonb", "p_descuento" numeric, "p_observaciones" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_venta"("p_cliente_id" "uuid", "p_metodo_pago" "text", "p_detalles" "jsonb", "p_descuento" numeric, "p_observaciones" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_despacho_anular"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_despacho_anular"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_despacho_anular"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_despacho_detalle_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_despacho_detalle_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_despacho_detalle_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_despacho_envase_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_despacho_envase_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_despacho_envase_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_devolucion_envase_anular"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_devolucion_envase_anular"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_devolucion_envase_anular"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_devolucion_envase_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_devolucion_envase_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_devolucion_envase_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_devolucion_producto_anular"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_devolucion_producto_anular"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_devolucion_producto_anular"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_devolucion_producto_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_devolucion_producto_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_devolucion_producto_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_merma_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_merma_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_merma_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_produccion_anular"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_produccion_anular"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_produccion_anular"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_produccion_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_produccion_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_produccion_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_venta_anular"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_venta_anular"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_venta_anular"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_venta_detalle_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_venta_detalle_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_venta_detalle_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_venta_recalcular_total"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_venta_recalcular_total"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_venta_recalcular_total"() TO "service_role";


















GRANT ALL ON TABLE "public"."auditoria" TO "anon";
GRANT ALL ON TABLE "public"."auditoria" TO "authenticated";
GRANT ALL ON TABLE "public"."auditoria" TO "service_role";



GRANT ALL ON SEQUENCE "public"."auditoria_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."auditoria_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."auditoria_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."carga_vendedor" TO "anon";
GRANT ALL ON TABLE "public"."carga_vendedor" TO "authenticated";
GRANT ALL ON TABLE "public"."carga_vendedor" TO "service_role";



GRANT ALL ON TABLE "public"."clientes" TO "anon";
GRANT ALL ON TABLE "public"."clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."clientes" TO "service_role";



GRANT ALL ON TABLE "public"."configuracion" TO "anon";
GRANT ALL ON TABLE "public"."configuracion" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracion" TO "service_role";



GRANT ALL ON TABLE "public"."despacho_detalles" TO "anon";
GRANT ALL ON TABLE "public"."despacho_detalles" TO "authenticated";
GRANT ALL ON TABLE "public"."despacho_detalles" TO "service_role";



GRANT ALL ON TABLE "public"."despacho_envases" TO "anon";
GRANT ALL ON TABLE "public"."despacho_envases" TO "authenticated";
GRANT ALL ON TABLE "public"."despacho_envases" TO "service_role";



GRANT ALL ON TABLE "public"."despachos" TO "anon";
GRANT ALL ON TABLE "public"."despachos" TO "authenticated";
GRANT ALL ON TABLE "public"."despachos" TO "service_role";



GRANT ALL ON TABLE "public"."devoluciones_envases" TO "anon";
GRANT ALL ON TABLE "public"."devoluciones_envases" TO "authenticated";
GRANT ALL ON TABLE "public"."devoluciones_envases" TO "service_role";



GRANT ALL ON TABLE "public"."devoluciones_productos" TO "anon";
GRANT ALL ON TABLE "public"."devoluciones_productos" TO "authenticated";
GRANT ALL ON TABLE "public"."devoluciones_productos" TO "service_role";



GRANT ALL ON TABLE "public"."gastos_extras" TO "anon";
GRANT ALL ON TABLE "public"."gastos_extras" TO "authenticated";
GRANT ALL ON TABLE "public"."gastos_extras" TO "service_role";



GRANT ALL ON TABLE "public"."incidencias_produccion" TO "anon";
GRANT ALL ON TABLE "public"."incidencias_produccion" TO "authenticated";
GRANT ALL ON TABLE "public"."incidencias_produccion" TO "service_role";



GRANT ALL ON TABLE "public"."mermas" TO "anon";
GRANT ALL ON TABLE "public"."mermas" TO "authenticated";
GRANT ALL ON TABLE "public"."mermas" TO "service_role";



GRANT ALL ON TABLE "public"."perfiles" TO "anon";
GRANT ALL ON TABLE "public"."perfiles" TO "authenticated";
GRANT ALL ON TABLE "public"."perfiles" TO "service_role";



GRANT ALL ON TABLE "public"."producciones" TO "anon";
GRANT ALL ON TABLE "public"."producciones" TO "authenticated";
GRANT ALL ON TABLE "public"."producciones" TO "service_role";



GRANT ALL ON TABLE "public"."productos" TO "anon";
GRANT ALL ON TABLE "public"."productos" TO "authenticated";
GRANT ALL ON TABLE "public"."productos" TO "service_role";



GRANT ALL ON TABLE "public"."reglas_comision" TO "anon";
GRANT ALL ON TABLE "public"."reglas_comision" TO "authenticated";
GRANT ALL ON TABLE "public"."reglas_comision" TO "service_role";



GRANT ALL ON TABLE "public"."stock_bodega" TO "anon";
GRANT ALL ON TABLE "public"."stock_bodega" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_bodega" TO "service_role";



GRANT ALL ON TABLE "public"."stock_envases" TO "anon";
GRANT ALL ON TABLE "public"."stock_envases" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_envases" TO "service_role";



GRANT ALL ON TABLE "public"."sucursales" TO "anon";
GRANT ALL ON TABLE "public"."sucursales" TO "authenticated";
GRANT ALL ON TABLE "public"."sucursales" TO "service_role";



GRANT ALL ON TABLE "public"."tipos_empaque" TO "anon";
GRANT ALL ON TABLE "public"."tipos_empaque" TO "authenticated";
GRANT ALL ON TABLE "public"."tipos_empaque" TO "service_role";



GRANT ALL ON TABLE "public"."ubicaciones_vendedores" TO "anon";
GRANT ALL ON TABLE "public"."ubicaciones_vendedores" TO "authenticated";
GRANT ALL ON TABLE "public"."ubicaciones_vendedores" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ubicaciones_vendedores_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ubicaciones_vendedores_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ubicaciones_vendedores_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."venta_detalles" TO "anon";
GRANT ALL ON TABLE "public"."venta_detalles" TO "authenticated";
GRANT ALL ON TABLE "public"."venta_detalles" TO "service_role";



GRANT ALL ON TABLE "public"."ventas" TO "anon";
GRANT ALL ON TABLE "public"."ventas" TO "authenticated";
GRANT ALL ON TABLE "public"."ventas" TO "service_role";



GRANT ALL ON TABLE "public"."v_bidones_vacios_vendedor" TO "anon";
GRANT ALL ON TABLE "public"."v_bidones_vacios_vendedor" TO "authenticated";
GRANT ALL ON TABLE "public"."v_bidones_vacios_vendedor" TO "service_role";



GRANT ALL ON TABLE "public"."v_comision_vendedor" TO "anon";
GRANT ALL ON TABLE "public"."v_comision_vendedor" TO "authenticated";
GRANT ALL ON TABLE "public"."v_comision_vendedor" TO "service_role";



-- The snapshot has no anon ACL here; remove CLI-inherited default privileges.
REVOKE ALL ON TABLE "public"."v_indicadores_produccion_diarios" FROM "anon";
GRANT ALL ON TABLE "public"."v_indicadores_produccion_diarios" TO "authenticated";
GRANT ALL ON TABLE "public"."v_indicadores_produccion_diarios" TO "service_role";



GRANT ALL ON TABLE "public"."v_ranking_vendedores" TO "anon";
GRANT ALL ON TABLE "public"."v_ranking_vendedores" TO "authenticated";
GRANT ALL ON TABLE "public"."v_ranking_vendedores" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
