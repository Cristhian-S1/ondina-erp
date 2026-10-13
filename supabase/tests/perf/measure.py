#!/usr/bin/env python3
"""B4 / OND-5gi.8 / #47: EXPLAIN (ANALYZE, BUFFERS) of frontend read paths under RLS.

Local-only harness. It runs the filters used by frontend/src/domains/*/api.ts and
frontend/src/lib/*.ts as `authenticated` with a synthetic JWT for each actor role,
so RLS is applied exactly as PostgREST would apply it. Run it after synthetic_volume.psql.

Usage (local stack only):
  PGHOST=127.0.0.1 PGPORT=55322 PGPASSWORD=postgres \
    python3 supabase/tests/perf/measure.py --out /path/to/result.json [--runs 5]

The statements are equivalent to the PostgREST requests (same predicates and ordering),
not byte-identical SQL. Timings are medians of --runs executions after one warm-up.
"""

import argparse
import json
import os
import statistics
import subprocess
import sys

# Fixture actors from supabase/seed.sql plus one synthetic seller from synthetic_volume.psql.
ACTORS = {
    "vendedor_A": "20000000-0000-0000-0001-000000000100",
    "bodega_A": "20000000-0000-0000-0001-000000000002",
    "produccion_A": "20000000-0000-0000-0001-000000000003",
    "admin_A": "20000000-0000-0000-0001-000000000001",
    "admin_global": "20000000-0000-0000-0000-000000000001",
}
SUC_A = "10000000-0000-0000-0000-000000000001"
PROD = "40000000-0000-0000-0000-000000000001"
DAY_FROM, DAY_TO = "2026-06-01T00:00:00-04:00", "2026-06-02T00:00:00-04:00"
MONTH_FROM, MONTH_TO = "2026-06-01", "2026-07-01"


def psql(sql, env_db):
    cmd = ["psql", "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1", "-d", env_db.get("db", "postgres")]
    result = subprocess.run(cmd, input=sql, capture_output=True, text=True, env=os.environ.copy(), check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "psql failed")
    return result.stdout


def fetch_ids(env_db, sql):
    return [line.strip() for line in psql(sql + ";", env_db).splitlines() if line.strip()]


def literal_list(values):
    return ",".join(f"'{v}'" for v in values)


def build_queries(env_db):
    dispatch_ids = fetch_ids(env_db, f"select id from public.despachos where sucursal_id='{SUC_A}' order by creado_en desc limit 200")
    seller_ids = fetch_ids(env_db, f"select id from public.perfiles where sucursal_id='{SUC_A}' and rol='vendedor' and activo")
    vendedor = ACTORS["vendedor_A"]
    ids_d = literal_list(dispatch_ids)
    ids_v = literal_list(seller_ids)
    # name, actor, sql. Each entry mirrors one frontend call (file reference in the comment).
    return [
        # ventas/api.ts obtenerCantidadVentasJornada
        ("ventas_jornada_count", "vendedor_A",
         f"select count(id) from public.ventas where vendedor_id='{vendedor}' and anulado=false "
         f"and creado_en>='{DAY_FROM}' and creado_en<'{DAY_TO}'"),
        # ventas/api.ts obtenerClientesRuta
        ("clientes_ruta", "vendedor_A",
         f"select id,nombre,telefono,direccion,numero_local,tipo,activo,creado_en from public.clientes "
         f"where vendedor_id='{vendedor}' and activo=true and sucursal_id='{SUC_A}' order by nombre"),
        # ventas/api.ts obtenerProductosVenta
        ("productos_venta", "vendedor_A",
         "select p.id,p.nombre,p.tipo,p.precio_base,t.id,t.nombre,t.categoria from public.productos p "
         "left join public.tipos_empaque t on t.id=p.tipo_empaque_id where p.activo=true order by p.nombre"),
        # ventas/api.ts obtenerCargaVendedor
        ("carga_vendedor_propia", "vendedor_A",
         f"select producto_id,vendedor_id,cantidad,modificado_en from public.carga_vendedor where vendedor_id='{vendedor}'"),
        # ventas/api.ts obtenerGastosHoy
        ("gastos_hoy", "vendedor_A",
         f"select id,tipo,monto,motivo,creado_en,anulado,vendedor_id,sucursal_id from public.gastos_extras "
         f"where vendedor_id='{vendedor}' and creado_en>='{DAY_FROM}' and creado_en<'{DAY_TO}' order by creado_en desc"),
        # ventas/api.ts obtenerMiComision (view reads ventas, venta_detalles, reglas_comision)
        ("mi_comision", "vendedor_A",
         f"select * from public.v_comision_vendedor where vendedor_id='{vendedor}' order by jornada desc"),
        # ventas/api.ts obtenerRankingVendedores
        ("ranking_mes", "admin_A",
         f"select * from public.v_ranking_vendedores where mes>='{MONTH_FROM}' and mes<'{MONTH_TO}' order by total_vendido desc"),
        # bodega/api.ts obtenerVendedores
        ("vendedores_sucursal", "bodega_A",
         f"select * from public.perfiles where sucursal_id='{SUC_A}' and rol='vendedor' and activo=true order by nombres"),
        # bodega/api.ts obtenerDespachos (no LIMIT: full branch history, newest first)
        ("despachos_sucursal", "bodega_A",
         f"select * from public.despachos where sucursal_id='{SUC_A}' order by creado_en desc"),
        # bodega/api.ts obtenerDetallesDespacho / obtenerEnvasesDespacho (200 most recent dispatches)
        ("despacho_detalles_in", "bodega_A",
         f"select * from public.despacho_detalles where despacho_id in ({ids_d})"),
        ("despacho_envases_in", "bodega_A",
         f"select * from public.despacho_envases where despacho_id in ({ids_d})"),
        # bodega/api.ts obtenerDevolucionesProducto / obtenerDevolucionesEnvase
        ("devoluciones_productos_in", "bodega_A",
         f"select * from public.devoluciones_productos where despacho_id in ({ids_d}) and anulado=false"),
        ("devoluciones_envases_in", "bodega_A",
         f"select * from public.devoluciones_envases where despacho_id in ({ids_d}) and anulado=false"),
        # bodega/api.ts obtenerStockBodega / obtenerStockEnvases / obtenerCargaVendedores
        ("stock_bodega", "bodega_A", f"select * from public.stock_bodega where sucursal_id='{SUC_A}'"),
        ("stock_envases", "bodega_A", f"select * from public.stock_envases where sucursal_id='{SUC_A}'"),
        ("carga_vendedores_in", "bodega_A",
         f"select * from public.carga_vendedor where vendedor_id in ({ids_v})"),
        # lib/catalog.ts obtenerProductos / obtenerTiposEmpaque / obtenerSucursales
        ("productos_catalogo", "bodega_A", "select * from public.productos where activo=true order by nombre"),
        ("sucursales_activas", "admin_global", "select * from public.sucursales where activa=true order by nombre"),
        # AuthProvider.tsx profile load
        ("perfil_propio", "vendedor_A", f"select * from public.perfiles where id='{vendedor}'"),
        # produccion/api.ts obtenerProducciones (limit 30)
        ("producciones_recientes", "produccion_A",
         f"select * from public.producciones where sucursal_id='{SUC_A}' and anulado=false order by creado_en desc limit 30"),
        # produccion/api.ts obtenerHistorialProduccion (filters on branch, product and date)
        ("historial_producciones", "admin_A",
         f"select * from public.producciones where sucursal_id='{SUC_A}' and anulado=false "
         f"and creado_en>='{DAY_FROM}' and creado_en<'{MONTH_TO}T00:00:00-04:00' order by creado_en desc limit 200"),
        ("historial_producciones_producto", "admin_A",
         f"select * from public.producciones where sucursal_id='{SUC_A}' and anulado=false and producto_id='{PROD}' "
         f"and creado_en>='{DAY_FROM}' and creado_en<'{MONTH_TO}T00:00:00-04:00' order by creado_en desc limit 200"),
        # produccion/api.ts obtenerMermas (product mermas without dispatch, limit 30)
        ("mermas_recientes", "produccion_A",
         f"select * from public.mermas where sucursal_id='{SUC_A}' and anulado=false and despacho_id is null "
         f"and producto_id is not null order by creado_en desc limit 30"),
        # produccion/api.ts obtenerIndicadoresProduccion
        ("indicadores_produccion", "produccion_A",
         f"select * from public.v_indicadores_produccion_diarios where sucursal_id='{SUC_A}' "
         f"and fecha>='2026-06-01' and fecha<='2026-07-01' order by fecha desc"),
    ]


def run_explain(name, actor_key, sql, env_db, runs):
    uid = ACTORS[actor_key]
    claims = json.dumps({"sub": uid, "role": "authenticated"})
    # Warm-up plus measured runs in one session as the authenticated role (RLS applies).
    body = [
        "set role authenticated;",
        f"do $$ begin perform set_config('request.jwt.claims', '{claims}', false); end $$;",
    ]
    for _ in range(runs + 1):
        body.append(f"explain (analyze, buffers, format json) {sql};")
    raw = psql("\n".join(body), env_db)
    decoder = json.JSONDecoder()
    plans, idx = [], 0
    text = raw.strip()
    while idx < len(text):
        obj, end = decoder.raw_decode(text, idx)
        plans.append(obj[0])
        idx = end
        while idx < len(text) and text[idx] in " \n\r\t":
            idx += 1
    measured = plans[1:]  # first plan is warm-up
    times = [p["Execution Time"] for p in measured]
    root = measured[0]["Plan"]
    nodes, indexes = [], set()

    def walk(node):
        if "Index Name" in node:
            indexes.add(node["Index Name"])
        nodes.append(node["Node Type"] + (f" on {node['Relation Name']}" if "Relation Name" in node else ""))
        for child in node.get("Plans", []):
            walk(child)

    walk(root)
    buffers = 0
    def sum_buffers(node):
        nonlocal buffers
        buffers += node.get("Shared Hit Blocks", 0) + node.get("Shared Read Blocks", 0)
        for child in node.get("Plans", []):
            sum_buffers(child)
    sum_buffers(root)
    return {
        "query": name,
        "actor": actor_key,
        "rows": root.get("Actual Rows"),
        "median_ms": round(statistics.median(times), 3),
        "min_ms": round(min(times), 3),
        "max_ms": round(max(times), 3),
        "shared_buffers": buffers,
        "indexes_used": sorted(indexes),
        "top_nodes": sorted(set(nodes))[:12],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--runs", type=int, default=5)
    parser.add_argument("--label", default="run")
    args = parser.parse_args()
    env_db = {"db": "postgres"}
    queries = build_queries(env_db)
    results = []
    for name, actor, sql in queries:
        results.append(run_explain(name, actor, sql, env_db, args.runs))
        print(f"{name:34} {actor:14} median={results[-1]['median_ms']:>9} ms rows={results[-1]['rows']}", file=sys.stderr)
    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump({"label": args.label, "runs": args.runs, "results": results}, handle, indent=2, ensure_ascii=False)
    print(f"wrote {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
