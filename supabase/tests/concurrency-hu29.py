#!/usr/bin/env python3
"""HU-29 real two-session checks. Local synthetic stack only; reset before/after.
Run: python3 supabase/tests/concurrency-hu29.py
Reuses the B3 lock-wait harness; no remote URLs or credentials are accepted.
"""
import importlib.util
import sys
sys.dont_write_bytecode = True
from pathlib import Path

spec = importlib.util.spec_from_file_location('b3', Path(__file__).with_name('concurrency-b3.py'))
b3 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b3)
S, P, B = b3.S, b3.P, b3.B
A = B[:-1] + '1'


def loss(quantity, key):
    return ("set local role authenticated; select public.registrar_merma_bodega("
            f"'{S}','bodega',null,'{P}',null,{quantity},'concurrency','{key}')")


def scalar(sql):
    return b3.run(sql).stdout.strip()


def main():
    b3.run(f"update public.stock_bodega set cantidad=10 where sucursal_id='{S}' and producto_id='{P}';")
    rpc = loss(3, '98000000-0000-0000-0000-000000000001')
    original, retry = b3.pair(rpc, rpc)
    assert original == retry.stdout.strip(), retry.stdout
    assert scalar('select count(*) from private.solicitudes_merma_bodega') == '1'
    assert scalar(f"select cantidad from public.stock_bodega where sucursal_id='{S}' and producto_id='{P}'") == '7'
    assert scalar(f"select count(*) from public.auditoria where tabla='mermas' and registro_id='{original}'") == '1'
    print('PASS: simultaneous same-key authenticated requests wait, return identical UUID, one ledger/movement/audit.')
    _, rejected = b3.pair(loss(5, '98000000-0000-0000-0000-000000000002'),
                          loss(5, '98000000-0000-0000-0000-000000000003'), expect_error=True)
    assert 'Cantidad de merma superior al stock disponible. Disponible: 2' in rejected.stderr
    assert scalar('select count(*) from private.solicitudes_merma_bodega') == '2'
    assert scalar(f"select cantidad from public.stock_bodega where sucursal_id='{S}' and producto_id='{P}'") == '2'
    print('PASS: distinct keys serialize shared balance; second fails; stock=2, no failed ledger or loss audit.')
    cancel = f"set local role authenticated; select public.anular_merma_bodega('{original}','concurrent cancellation')"
    first, repeated = b3.pair(cancel, cancel, actor=A)
    assert first == repeated.stdout.strip() == original
    assert scalar(f"select cantidad from public.stock_bodega where sucursal_id='{S}' and producto_id='{P}'") == '5'
    assert scalar(f"select count(*) from public.auditoria where tabla='mermas' and registro_id='{original}' and accion='ANULACION'") == '1'
    print('PASS: simultaneous admin cancellations wait; compensate once, one cancellation audit.')


if __name__ == '__main__':
    main()
