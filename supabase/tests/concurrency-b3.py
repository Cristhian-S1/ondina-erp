#!/usr/bin/env python3
"""Two real local sessions; run after db reset, then reset again before pgTAP.
Uses only supabase_db_ondina-erp, synthetic seed IDs and no remote connection.
"""
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor

DB = ['docker', 'exec', '-i', 'supabase_db_ondina-erp', 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']
S = '10000000-0000-0000-0000-000000000001'
V = '20000000-0000-0000-0001-000000000004'
B = '20000000-0000-0000-0001-000000000002'
C = '50000000-0000-0000-0000-000000000001'
P = '40000000-0000-0000-0000-000000000001'
P2 = '40000000-0000-0000-0000-000000000002'
D = '81000000-0000-0000-0000-000000000001'
D2 = '81000000-0000-0000-0000-000000000002'


def run(sql, ok=True):
    result = subprocess.run(DB, input=sql, text=True, capture_output=True, timeout=20)
    if ok and result.returncode:
        raise AssertionError(result.stderr)
    return result


def pair(first, second, actor=B, expect_error=False):
    """Hold first transaction after operation; prove second waits, then commit."""
    p = subprocess.Popen(DB, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
    try:
        p.stdin.write(f"begin; set application_name='b3-first'; set request.jwt.claim.sub='{actor}'; {first}; select 'B3_READY';\n")
        p.stdin.flush()
        first_output = []
        for line in p.stdout:
            if line.strip() == 'B3_READY':
                break
            first_output.append(line.strip())
        else:
            raise AssertionError(p.stderr.read())
        with ThreadPoolExecutor(max_workers=1) as executor:
            pending = executor.submit(run, f"begin; set application_name='b3-second'; set request.jwt.claim.sub='{actor}'; {second}; commit;", False)
            deadline = time.monotonic() + 8
            blocked = False
            while time.monotonic() < deadline:
                if run("select exists(select 1 from pg_stat_activity where application_name='b3-second' and wait_event_type='Lock');").stdout.strip() == 't':
                    blocked = True
                    break
                if pending.done():
                    break
                time.sleep(0.03)
            # Release even on assertion failures so no connection remains blocked.
            p.stdin.write('commit;\n\\q\n')
            p.stdin.flush()
            p.wait(timeout=10)
            result = pending.result(timeout=10)
            assert blocked, f'Second session never waited for the first: {result.stderr}'
            assert (result.returncode != 0) == expect_error, result.stderr
            return first_output[-1] if first_output else '', result
    finally:
        if p.poll() is None:
            p.kill()
            p.wait()


def dispatch(d):
    run(f"set request.jwt.claim.sub='{B}'; insert into public.despachos(id,sucursal_id,vendedor_id,despachador_id,creado_por) values('{d}','{S}','{V}','{B}','{B}'); insert into public.despacho_detalles(despacho_id,producto_id,cantidad) values('{d}','{P}',10);")


def returns(d, qty, key):
    return f"select public.registrar_devolucion('{d}','[{{\"producto_id\":\"{P}\",\"cantidad\":{qty}}}]','[]','{key}')"


def main():
    dispatch(D)
    # Direct inserts exercise BEFORE parent locks, not just RPC wrappers.
    direct = f"insert into public.devoluciones_productos(despacho_id,producto_id,cantidad,creado_por) values('{D}','{P}',7,'{B}')"
    _, failed = pair(direct, direct, expect_error=True)
    assert 'No se puede devolver más de lo despachado.' in failed.stderr
    assert run(f"select sum(cantidad) from public.devoluciones_productos where despacho_id='{D}';").stdout.strip() == '7'
    print('PASS: concurrent 7 + 7 against dispatch 10 serializes parent; second rejects; final returned=7.')
    dispatch(D2)
    rpc = returns(D2, 4, '82000000-0000-0000-0000-000000000001')
    original, retried = pair(rpc, rpc)
    assert original == retried.stdout.strip()
    assert run(f"select count(*) from public.devoluciones_productos where despacho_id='{D2}';").stdout.strip() == '1'
    print('PASS: simultaneous same-key return returns identical UUID; one return row and one stock movement.')
    sale = f"select public.registrar_venta('{C}','efectivo','[{{\"producto_id\":\"{P}\",\"cantidad\":1,\"precio_unitario\":1000}}]',0,null,'82000000-0000-0000-0000-000000000002')"
    original, retried = pair(sale, sale, actor=V)
    assert original == retried.stdout.strip()
    assert run("select count(*) from public.ventas where idempotency_key='82000000-0000-0000-0000-000000000002';").stdout.strip() == '1'
    # Separate connection retry simulates a lost response after successful commit.
    assert run(f"set request.jwt.claim.sub='{V}'; {sale};").stdout.strip() == original
    print('PASS: concurrent sale and post-commit retry reuse original UUID; only one sale persists.')
    def create(lines, key):
        return f"select public.crear_despacho('{S}','{V}','{B}','{B}','{lines}','[]','{key}')"
    forward = f'[{{"producto_id":"{P}","cantidad":1}},{{"producto_id":"{P2}","cantidad":1}}]'
    reverse = f'[{{"producto_id":"{P2}","cantidad":1}},{{"producto_id":"{P}","cantidad":1}}]'
    first = create(forward, '82000000-0000-0000-0000-000000000003')
    second = create(reverse, '82000000-0000-0000-0000-000000000004')
    pair(first, second)
    pair(first, first)
    assert run("select count(*) from public.despachos where idempotency_key in ('82000000-0000-0000-0000-000000000003','82000000-0000-0000-0000-000000000004');").stdout.strip() == '2'
    print('PASS: opposite product orders complete; dispatch retry creates no additional dispatch.')
    assert run(f"select cantidad from public.stock_bodega where sucursal_id='{S}' and producto_id='{P}';").stdout.strip() == '89'
    assert run(f"select cantidad from public.carga_vendedor where vendedor_id='{V}' and producto_id='{P}';").stdout.strip() == '30'
    print('PASS: exact final warehouse=89 and seller load=30; no stock backfill or duplicate effect.')


if __name__ == '__main__':
    main()
