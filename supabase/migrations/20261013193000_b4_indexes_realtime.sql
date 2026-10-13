-- B4 / OND-5gi.8: GitHub #47 (measured indexes), #48 / BD-12 (Realtime publication).
-- Forward-only and idempotent for the objects it creates. No rows, grants, RPC signatures
-- or public view contracts change. The only existing policy touched is the B3 incident
-- insert policy, recreated with the same predicate and with auth/helper calls wrapped in
-- (select ...) so Postgres evaluates them once per statement (advisor auth_rls_initplan).
-- Before/after EXPLAIN ANALYZE evidence and rejected candidates: supabase/perf-b4.md.
--
-- Production note: a plain CREATE INDEX takes a SHARE lock that blocks writes to the
-- indexed table while it builds. Apply on the remote project only inside the reviewed
-- maintenance window of the release gate, or replace these statements with
-- CREATE INDEX CONCURRENTLY run outside a transaction after an isolated timing check.

-- #47: each index is justified by a measured plan change (supabase/perf-b4.md):
-- production history screen and recent-production query (sucursal + newest first, active rows).
create index if not exists idx_producciones_sucursal_creado_en
  on public.producciones (sucursal_id, creado_en desc)
  where not anulado;

-- Recent product mermas without a dispatch (obtenerMermas), active rows only.
create index if not exists idx_mermas_sucursal_creado_en_pendientes
  on public.mermas (sucursal_id, creado_en desc)
  where not anulado and despacho_id is null and producto_id is not null;

-- Today's seller expenses (obtenerGastosHoy): the seller predicate plus the time window.
create index if not exists idx_gastos_extras_vendedor_creado_en
  on public.gastos_extras (vendedor_id, creado_en desc);

-- Today's sales count for the seller (obtenerCantidadVentasJornada), active rows only.
create index if not exists idx_ventas_vendedor_creado_en_activas
  on public.ventas (vendedor_id, creado_en)
  where not anulado;

-- #48 / BD-12: mermas is subscribed by Produccion.tsx (subscribeProduccion) but was missing
-- from the publication. The subscriptions remain producciones, mermas and stock_envases.
-- incidencias_produccion was published by 0008 and has no current subscriber; it is kept
-- until a product decision removes it (see supabase/perf-b4.md).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mermas'
  ) then
    alter publication supabase_realtime add table public.mermas;
  end if;
end;
$$;

-- #47 / advisor auth_rls_initplan: same predicate as the B3 policy, with initplan-wrapped calls.
drop policy if exists incidencias_produccion_insert_b3 on public.incidencias_produccion;
create policy incidencias_produccion_insert_b3 on public.incidencias_produccion
for insert to authenticated
with check (
  ((select private.es_rol('administrador')) or (select private.es_rol('produccion')))
  and creado_por = (select auth.uid())
  and ((select private.es_admin_global()) or sucursal_id = (select private.mi_sucursal()))
  and (
    produccion_id is null
    or exists (
      select 1 from public.producciones p
      where p.id = incidencias_produccion.produccion_id
        and p.sucursal_id = incidencias_produccion.sucursal_id
    )
  )
);
