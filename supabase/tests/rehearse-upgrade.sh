#!/usr/bin/env bash
# Destructive only to the isolated local ondina-erp database; never uses remote credentials.
set -euo pipefail
cd "$(dirname "$0")/../.."
workspace_tmp=$(mktemp -d)
trap 'rm -rf "$workspace_tmp"' EXIT
# Override LOCAL_DB_CONTAINER when running against an isolated project_id (its container name differs).
local_db_container=${LOCAL_DB_CONTAINER:-supabase_db_ondina-erp}
psql_local() { docker exec -i "$local_db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }

supabase db reset --local --version 20261013000000
psql_local <<'SQL'
select set_config('request.jwt.claim.sub','20000000-0000-0000-0001-000000000004',false);
select public.registrar_venta('50000000-0000-0000-0000-000000000001','efectivo',
 '[{"producto_id":"40000000-0000-0000-0000-000000000001","cantidad":3,"precio_unitario":1000,"envases_recibidos":0}]');
insert into public.producciones(id,sucursal_id,producto_id,cantidad,creado_por)
values ('60000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',
 '40000000-0000-0000-0000-000000000001',7,'20000000-0000-0000-0001-000000000003');
insert into public.mermas(id,sucursal_id,producto_id,cantidad,motivo,creado_por)
values ('70000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',
 '40000000-0000-0000-0000-000000000001',2,'Synthetic upgrade rehearsal','20000000-0000-0000-0001-000000000003');
SQL

# Compare every public row and auth fixture, including balances, FK IDs and timestamps.
# Freeze baseline column names, so new nullable/default columns do not hide or
# falsely report changes to any existing field. New private metadata is tested
# separately; no public business table is added by B3.
psql_local -qAt <<'SQL' > "$workspace_tmp/fingerprint.sql"
select format('select %L as relation, count(*) as rows, md5(coalesce(string_agg((select jsonb_object_agg(k,v) from jsonb_each(to_jsonb(t)) j(k,v) where k=any(%L::text[]))::text, %L order by to_jsonb(t)::text), %L)) as digest from %I.%I t;',
 n.nspname||'.'||c.relname,
 array(select a.attname from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)::text,
 '', '', n.nspname,c.relname)
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where (n.nspname='public' and c.relkind='r') or (n.nspname='auth' and c.relname='users')
order by n.nspname,c.relname;
SQL
psql_local -qAt < "$workspace_tmp/fingerprint.sql" > "$workspace_tmp/before"
psql_local < supabase/migrations/20261013000100_align_repo_design.sql
psql_local -qAt < "$workspace_tmp/fingerprint.sql" > "$workspace_tmp/after"
diff -u "$workspace_tmp/before" "$workspace_tmp/after"
echo 'PASS: upgrade preserved all rows in 23 public tables and auth.users (counts + content hashes).'

# A second application must be harmless, not a second stock movement/backfill.
psql_local < supabase/migrations/20261013000100_align_repo_design.sql
psql_local -qAt < "$workspace_tmp/fingerprint.sql" > "$workspace_tmp/reapplied"
diff -u "$workspace_tmp/after" "$workspace_tmp/reapplied"
echo 'PASS: delta reapplied without duplicate objects or data/stock changes.'
psql_local -qAt <<'SQL'
select 'seller_load=' || cantidad from public.carga_vendedor
 where vendedor_id='20000000-0000-0000-0001-000000000004' and producto_id='40000000-0000-0000-0000-000000000001';
select 'warehouse_stock=' || cantidad from public.stock_bodega
 where sucursal_id='10000000-0000-0000-0000-000000000001' and producto_id='40000000-0000-0000-0000-000000000001';
select 'empty_packaging=' || cantidad from public.stock_envases
 where sucursal_id='10000000-0000-0000-0000-000000000001' and tipo_empaque_id='30000000-0000-0000-0000-000000000001';
SQL
# Append every later forward migration exactly once. Unlike B1's object additions,
# hardening deltas need not be idempotent (e.g. named NOT VALID constraints).
for forward_migration in supabase/migrations/*.sql; do
  if [[ "$(basename "$forward_migration")" > "20261013000100_align_repo_design.sql" ]]; then
    psql_local < "$forward_migration"
    if [[ "$(basename "$forward_migration")" == *b3_data_integrity.sql ]]; then
      psql_local <<'SQL'
do $$ begin
 if exists(select 1 from public.ventas where not envases_en_planta or idempotency_key is not null)
 or exists(select 1 from public.despachos where idempotency_key is not null)
 or exists(select 1 from private.solicitudes_devolucion) then
  raise exception 'B3 upgrade changed legacy movement provenance or created retry data';
 end if;
end $$;
SQL
    fi
    psql_local -qAt < "$workspace_tmp/fingerprint.sql" > "$workspace_tmp/forward"
    diff -u "$workspace_tmp/reapplied" "$workspace_tmp/forward"
    echo "PASS: $(basename "$forward_migration") preserved all row counts and content hashes."
  fi
done
# Return the local migration ledger and fixture state to the normal clean chain.
supabase db reset --local
supabase test db --local
