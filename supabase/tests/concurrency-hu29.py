#!/usr/bin/env python3
"""HU-29 real two-session checks. Local synthetic stack only; reset before/after.
Run: python3 supabase/tests/concurrency-hu29.py
Reuses the B3 lock-wait harness; no remote URLs or credentials are accepted.
Use --lock-only to isolate the BEFORE INSERT parent-lock regression test.
Mutation: remove only the despacho FOR UPDATE statement from
private.validar_merma_hu29, run --lock-only (must fail), then restore the function.
"""
import importlib.util
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
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


def check_merma_parent_lock():
    """Prove the parent lock precedes FK/AFTER work, not just the stock trigger.

    NO KEY UPDATE permits the FK's KEY SHARE but blocks FOR UPDATE. An AFTER
    probe, ordered before trg_merma_insert, marks that INSERT has passed the
    FK stage. Without the BEFORE parent lock the marker appears while the
    stock trigger waits; with it the INSERT waits before reaching the marker.
    This controlled interleaving avoids relying on a probabilistic deadlock.
    """
    dispatch_id = str(uuid4())
    b3.dispatch(dispatch_id)
    b3.run(f"""
        create function private.hu29_after_insert_probe() returns trigger
        language plpgsql security definer set search_path='' as $$
        begin
            if new.despacho_id='{dispatch_id}'::uuid then
                perform pg_catalog.pg_advisory_xact_lock(29025,29);
            end if;
            return new;
        end; $$;
        revoke all on function private.hu29_after_insert_probe() from public,anon,authenticated;
        create trigger a_hu29_after_insert_probe after insert on public.mermas
        for each row execute function private.hu29_after_insert_probe();
    """)
    holder = subprocess.Popen(b3.DB, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE, text=True, bufsize=1)
    try:
        holder.stdin.write(
            f"begin; select id from public.despachos where id='{dispatch_id}' for no key update; "
            "select 'HU29_PARENT_READY';\n")
        holder.stdin.flush()
        for line in holder.stdout:
            if line.strip() == 'HU29_PARENT_READY':
                break
        else:
            raise AssertionError(holder.stderr.read())
        with ThreadPoolExecutor(max_workers=1) as executor:
            pending = executor.submit(b3.run, f"""
                begin; set application_name='hu29-direct-loss-lock';
                set request.jwt.claim.sub='{B}'; set local role authenticated;
                insert into public.mermas(sucursal_id,despacho_id,producto_id,cantidad,motivo,creado_por)
                values('{S}','{dispatch_id}','{P}',1,'parent lock probe','{B}');
                commit;
            """, False)
            try:
                deadline = time.monotonic() + 8
                blocked = False
                while time.monotonic() < deadline:
                    blocked = scalar("select exists(select 1 from pg_stat_activity where "
                                     "application_name='hu29-direct-loss-lock' and wait_event_type='Lock')") == 't'
                    if blocked or pending.done():
                        break
                    time.sleep(0.03)
                reached_after_insert = scalar(
                    "select exists(select 1 from pg_locks l join pg_stat_activity a on a.pid=l.pid "
                    "where a.application_name='hu29-direct-loss-lock' and l.locktype='advisory' "
                    "and l.classid=29025 and l.objid=29 and l.objsubid=2 and l.granted)") == 't'
            finally:
                # Always release the parent before awaiting the INSERT, including failures.
                holder.stdin.write('rollback;\n\\q\n')
                holder.stdin.flush()
                holder.wait(timeout=10)
            result = pending.result(timeout=10)
        assert result.returncode == 0, result.stderr
        assert blocked, 'Direct loss never waited for the parent lock'
        assert not reached_after_insert, (
            'Direct loss reached AFTER INSERT before acquiring the despacho FOR UPDATE lock')
        assert scalar(f"select sum(cantidad) from public.mermas where despacho_id='{dispatch_id}'") == '1'
        print('PASS: direct loss blocks BEFORE FK/AFTER INSERT under parent NO KEY UPDATE; parent-first lock proven.')
    finally:
        if holder.poll() is None:
            holder.kill()
            holder.wait()
        b3.run('drop trigger a_hu29_after_insert_probe on public.mermas; '
               'drop function private.hu29_after_insert_probe();')


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

    # Exercise the new table guards, not merely the RPC's parent lock.
    # Unrelated load must not fund returns/losses beyond a single dispatch.
    b3.run(f"update public.stock_bodega set cantidad=100 where sucursal_id='{S}' and producto_id='{P}';")
    for suffix, loss_first in [('10', True), ('11', False)]:
        dispatch_id = f'98000000-0000-0000-0000-0000000000{suffix}'
        b3.dispatch(dispatch_id)
        direct_loss = (
            'set local role authenticated; '
            'insert into public.mermas(sucursal_id,despacho_id,producto_id,cantidad,motivo,creado_por) '
            f"values('{S}','{dispatch_id}','{P}',4,'concurrent direct loss','{B}')")
        direct_return = (
            'set local role authenticated; '
            'insert into public.devoluciones_productos(despacho_id,producto_id,cantidad,creado_por) '
            f"values('{dispatch_id}','{P}',7,'{B}')")
        first, second = (direct_loss, direct_return) if loss_first else (direct_return, direct_loss)
        _, rejected = b3.pair(first, second, expect_error=True)
        expected = ('La devolución y las mermas superan lo despachado de ese producto.' if loss_first
                    else 'La merma supera lo despachado pendiente de ese producto.')
        assert expected in rejected.stderr, rejected.stderr
        assert scalar(
            f"select coalesce((select sum(cantidad) from public.mermas where despacho_id='{dispatch_id}' and not anulado),0)"
            f"+coalesce((select sum(cantidad) from public.devoluciones_productos where despacho_id='{dispatch_id}' and not anulado),0)"
        ) == ('4' if loss_first else '7')
        print(f'PASS: concurrent direct {"loss then return" if loss_first else "return then loss"} waits on parent; second rejects, combined bound preserved.')

    check_merma_parent_lock()


if __name__ == '__main__':
    if sys.argv[1:] == ['--lock-only']:
        check_merma_parent_lock()
    elif not sys.argv[1:]:
        main()
    else:
        raise SystemExit('Usage: concurrency-hu29.py [--lock-only]')
