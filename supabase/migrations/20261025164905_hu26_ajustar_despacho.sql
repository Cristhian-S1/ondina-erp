-- HU-26: append-only product adjustments. Existing movement/audit triggers own effects.
-- The 10–20 minute configuration CHECK is deferred pending separate approval.
create table private.solicitudes_ajuste_despacho (
    idempotency_key uuid primary key,
    despacho_id uuid not null references public.despachos(id),
    creado_por uuid not null references public.perfiles(id),
    creado_en timestamptz not null default now(),
    lineas jsonb not null,
    resultado jsonb not null
);
alter table private.solicitudes_ajuste_despacho enable row level security;
revoke all on private.solicitudes_ajuste_despacho from public, anon, authenticated;

create function public.ajustar_despacho(
    p_despacho_id uuid,
    p_lineas jsonb,
    p_idempotency_key uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    d public.despachos%rowtype;
    solicitud private.solicitudes_ajuste_despacho%rowtype;
    linea jsonb;
    producto uuid;
    cantidad integer;
    detalle uuid;
    detalles jsonb := '[]'::jsonb;
    resultado jsonb;
    minutos integer;
begin
    if auth.uid() is null
       or not (private.es_rol('bodega') or private.es_rol('administrador')) then
        raise exception using errcode = '42501',
            message = 'No tienes permisos para modificar este despacho.';
    end if;
    if p_idempotency_key is null then
        raise exception 'Indica la clave de reintento del ajuste.';
    end if;
    -- Global per-operation key lock precedes the dispatch/balance locks.
    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('ajustar_despacho:' || p_idempotency_key::text, 0));
    select * into d from public.despachos where id = p_despacho_id for update;
    if not found then raise exception 'El despacho no existe'; end if;
    if (private.es_admin_global() or d.sucursal_id = private.mi_sucursal()) is not true then
        raise exception using errcode = '42501',
            message = 'No tienes permisos para modificar este despacho.';
    end if;
    if d.anulado then raise exception 'El despacho está anulado'; end if;

    select * into solicitud from private.solicitudes_ajuste_despacho
    where idempotency_key = p_idempotency_key;
    if found then
        if solicitud.despacho_id is distinct from d.id
           or solicitud.creado_por is distinct from auth.uid()
           or solicitud.lineas is distinct from p_lineas then
            raise exception 'La clave de reintento pertenece a otra operación.';
        end if;
        -- A successful retry remains readable after the window expires.
        return solicitud.resultado;
    end if;
    if p_lineas is null or pg_catalog.jsonb_typeof(p_lineas) <> 'array' then
        raise exception 'Agrega al menos un producto al despacho.';
    end if;
    if pg_catalog.jsonb_array_length(p_lineas) = 0 then
        raise exception 'Agrega al menos un producto al despacho.';
    end if;
    -- Validate every line before insertion; casts must never round a fraction.
    for linea in select value from pg_catalog.jsonb_array_elements(p_lineas) loop
        if pg_catalog.jsonb_typeof(linea) <> 'object'
           or (linea ->> 'cantidad') is null
           or (linea ->> 'cantidad') !~ '^[0-9]+$' then
            raise exception 'Línea de producto inválida en el despacho.';
        end if;
        begin
            producto := (linea ->> 'producto_id')::uuid;
            cantidad := (linea ->> 'cantidad')::integer;
        exception when invalid_text_representation or numeric_value_out_of_range then
            raise exception 'Línea de producto inválida en el despacho.';
        end;
        if producto is null or cantidad is null or cantidad <= 0 then
            raise exception 'Línea de producto inválida en el despacho.';
        end if;
        if not exists(select 1 from public.productos where id = producto and activo) then
            raise exception 'El producto no existe o está desactivado';
        end if;
    end loop;
    if exists(
        select 1 from pg_catalog.jsonb_array_elements(p_lineas) x
        group by (x.value ->> 'producto_id')::uuid having count(*) > 1
    ) then
        raise exception 'No repitas productos en el ajuste.';
    end if;

    select valor::integer into minutos from public.configuracion
    where clave = 'ventana_ajuste_minutos';
    for linea in select value from pg_catalog.jsonb_array_elements(p_lineas)
        order by (value ->> 'producto_id')::uuid loop
        insert into public.despacho_detalles(despacho_id, producto_id, cantidad, es_ajuste)
        values(d.id, (linea ->> 'producto_id')::uuid, (linea ->> 'cantidad')::integer, true)
        returning id into detalle;
        detalles := detalles || pg_catalog.jsonb_build_array(detalle);
    end loop;
    resultado := pg_catalog.jsonb_build_object(
        'despacho_id', d.id,
        'lineas_agregadas', detalles,
        'ventana_expira_en', d.creado_en + pg_catalog.make_interval(mins => coalesce(minutos, 15))
    );
    insert into private.solicitudes_ajuste_despacho(
        idempotency_key, despacho_id, creado_por, lineas, resultado
    ) values(p_idempotency_key, d.id, auth.uid(), p_lineas, resultado);
    return resultado;
end;
$$;
revoke execute on function public.ajustar_despacho(uuid,jsonb,uuid) from public, anon;
grant execute on function public.ajustar_despacho(uuid,jsonb,uuid) to authenticated, service_role;
