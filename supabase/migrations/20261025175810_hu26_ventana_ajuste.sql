-- HU-26: expose the configured window and server clock without opening configuration RLS.
-- Whole minutes between 5 and 60 keep the existing adjustment triggers usable.
alter table public.configuracion
    add constraint configuracion_ventana_ajuste_minutos_rango
    check (case
        when clave <> 'ventana_ajuste_minutos' then true
        when valor !~ '^[0-9]{1,2}$' then false
        else valor::integer between 5 and 60
    end) not valid;
alter table public.configuracion
    validate constraint configuracion_ventana_ajuste_minutos_rango;

create function public.ventana_ajuste_despacho()
returns table(minutos integer, servidor_ahora timestamptz)
language sql stable security definer set search_path = '' as $$
    select coalesce((select valor::integer from public.configuracion
                     where clave = 'ventana_ajuste_minutos'), 15),
           pg_catalog.clock_timestamp()
    where auth.uid() is not null
      and (private.es_rol('bodega') or private.es_rol('administrador'));
$$;
revoke execute on function public.ventana_ajuste_despacho() from public, anon;
grant execute on function public.ventana_ajuste_despacho() to authenticated, service_role;
