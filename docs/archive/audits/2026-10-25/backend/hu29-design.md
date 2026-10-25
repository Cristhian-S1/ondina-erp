# HU-29: warehouse losses and daily seller reconciliation

Date: 2026-10-25. Beads: OND-w76.10. GitHub: [#67](https://github.com/Cristhian-S1/ondina-erp/issues/67).
Source base: feature/T3, inspected HEAD `43a3bb2`. **Design only: none of the SQL below has been applied.**

Option B and the formula dispatched − sold − returned − losses are approved by the task brief. Additional approvals are enumerated in section 3; they are not implied by approval of this document. On 2026-10-25 the coordinator explicitly selected a narrowly gated SECURITY DEFINER report instead of broadening sales RLS, and accepted rejecting dispatch-container losses in favor of damaged returns (Orca message `msg_4bb856720aa6`).

## 1. Registration, origin, cancellation, and exact proposed SQL

### Evidence and movement decisions

Paths below are relative to the repository root. Citations are dated source evidence, not production guarantees.

| Evidence | Consequence |
| --- | --- |
| `supabase/migrations/20261013000000_remote_baseline.sql:1152-1165` | `mermas`: UUID id/default; required sucursal, positive integer cantidad, motivo, actor, timestamp; nullable despacho; XOR producto/tipo_empaque; anulado default false. NOT NULL motivo does **not** reject whitespace. There is no jornada, origin, return reference, or modification metadata column. |
| `supabase/migrations/20261013181647_harden_database_security.sql:5-40,130-138,825-835` | Active-profile role/branch helpers; branch-scoped loss SELECT/INSERT; only admin UPDATE; authenticated may update only anulado. Baseline policies are replaced, not effective alongside B2. |
| `supabase/migrations/20261013200000_b6_revision_fixes.sql:55-178` | Effective insert trigger: unlinked product lowers stock_bodega; dispatch product lowers carga_vendedor and checks dispatch outstanding and global seller availability; **any** container loss lowers stock_envases, even with despacho_id. |
| `supabase/migrations/20261013200000_b6_revision_fixes.sql:23-48,183-201` | Dispatch cancellation subtracts active linked product losses from returned stock; losses remain recorded. Loss cancellation on an already cancelled parent adds nothing to seller load. Other loss cancellations compensate OLD quantity/identity. |
| `supabase/migrations/20261013000100_align_repo_design.sql:131-132` | Loss annul trigger runs only on false → true. Repeating UPDATE must be avoided for audit idempotency as well as stock idempotency. |
| `supabase/migrations/20261013184049_b3_data_integrity.sql:28-71,91-119` | Parent → warehouse → seller → packaging locks; negative balance guard; immutable movement history; audit actor from auth.uid(), reason from transaction setting or row. |
| `supabase/migrations/20261013184049_b3_data_integrity.sql:159-222` | Product returns decrease seller load and credit warehouse; container estado='bueno' credits plant, estado='malo' does **not**. A damaged return must never create a stock-debiting loss too. Product-return bound currently ignores earlier losses. |
| `supabase/migrations/20261013184049_b3_data_integrity.sql:676-737` | crear_despacho serializes global operation keys with advisory locks and checks actor/branch; old null-key callers remain possible. |
| `supabase/migrations/20261025164905_hu26_ajustar_despacho.sql:3-12,30-60,108-115` | Private RLS ledger, no client table grants, actor/payload conflict rejection, atomic business write plus ledger, retry after window expiration. Use this stronger payload-checking pattern. |
| `frontend/src/domains/produccion/api.ts:152-167` | Production still inserts product losses directly. Do not revoke INSERT or silently break this caller. |

Proposed supported origins:

| RPC origin / item | despacho_id | Effect | Cancellation |
| --- | --- | --- | --- |
| bodega / product | null | −cantidad stock_bodega(sucursal,producto) | +OLD cantidad to same stock |
| despacho / product | required | −cantidad carga_vendedor(parent seller,producto), no warehouse movement | +OLD cantidad to load only if parent remains active |
| bodega / empty packaging | null | −cantidad stock_envases(sucursal,tipo) | +OLD cantidad to same stock |
| despacho / packaging | rejected | There is no seller packaging-balance table; existing trigger would debit the wrong pool | Use damaged-return workflow, not this RPC |
| damaged return / any duplicate loss | rejected | Existing estado='malo' return already records non-reusable containers without plant credit | Correct/annul the return using its existing admin workflow |

An unsaleable filled product is one product loss. Do not automatically add a packaging loss: production already consumed its packaging; empty plant packaging is a distinct physical stock pool. A dispatch product return followed by an actual warehouse loss is legitimate: return credits plant and lowers seller load, then the unlinked loss debits plant. It is not another dispatch loss.

`p_devolucion_envase_id` is an explicit rejection guard for a return-origin submission, not a provenance ledger. An operator can still misdescribe the same physical item as a new independent warehouse loss by omitting its return provenance. No current table identifies individual bottles; neither quantity equality nor a date-based heuristic can prove physical duplication. The UI must make warehouse stock and damaged returns separate origins, and never offer “create loss” on a return. A stronger physical-identity guarantee requires a separate approved provenance design; do not claim it here.

The following blocks form the proposed forward delta, in order. No migration filename is reserved by this design. Use postgres ownership, an empty search_path and explicit ACLs in the future migration.

### Private registration ledger and registration RPC

```sql
create table private.solicitudes_merma_bodega (
    idempotency_key uuid primary key,
    merma_id uuid not null unique references public.mermas(id),
    creado_por uuid not null references public.perfiles(id),
    creado_en timestamptz not null default now(),
    payload jsonb not null
);
alter table private.solicitudes_merma_bodega enable row level security;
revoke all on private.solicitudes_merma_bodega from public, anon, authenticated;

create function public.registrar_merma_bodega(
    p_sucursal_id uuid,
    p_origen text,
    p_despacho_id uuid,
    p_producto_id uuid,
    p_tipo_empaque_id uuid,
    p_cantidad integer,
    p_motivo text,
    p_idempotency_key uuid,
    p_devolucion_envase_id uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
    d public.despachos%rowtype;
    s private.solicitudes_merma_bodega%rowtype;
    v_payload jsonb;
    v_id uuid;
    v_motivo text := pg_catalog.btrim(p_motivo);
    v_previo text := pg_catalog.current_setting('ondina.motivo', true);
begin
    if auth.uid() is null
       or (private.es_rol('bodega') or private.es_rol('administrador')) is not true
       or (private.es_admin_global() or p_sucursal_id = private.mi_sucursal()) is not true then
        raise exception using errcode='42501',
          message='No tienes permisos para registrar mermas en esta sucursal.';
    end if;
    if p_sucursal_id is null then raise exception 'Selecciona una sucursal.'; end if;
    if p_idempotency_key is null then raise exception 'Indica la clave de reintento de la merma.'; end if;
    if p_devolucion_envase_id is not null then
        raise exception 'Los envases dañados en una devolución no se registran otra vez como merma.';
    end if;
    if p_origen is null or p_origen not in ('bodega','despacho') then
        raise exception 'Selecciona un origen de merma válido.';
    end if;
    if (p_origen='bodega' and p_despacho_id is not null)
       or (p_origen='despacho' and p_despacho_id is null) then
        raise exception 'El origen no coincide con el despacho indicado.';
    end if;
    if (p_producto_id is null) = (p_tipo_empaque_id is null) then
        raise exception 'Indica solo un producto o un tipo de envase.';
    end if;
    if p_despacho_id is not null and p_tipo_empaque_id is not null then
        raise exception 'Registra los envases dañados del despacho como devolución en estado malo.';
    end if;
    if p_cantidad is null or p_cantidad <= 0 then raise exception 'La cantidad debe ser un entero mayor que cero.'; end if;
    if v_motivo is null or v_motivo = '' then raise exception 'Indica el motivo de la merma.'; end if;
    v_payload := pg_catalog.jsonb_build_object(
        'sucursal_id',p_sucursal_id,'origen',p_origen,'despacho_id',p_despacho_id,
        'producto_id',p_producto_id,'tipo_empaque_id',p_tipo_empaque_id,
        'cantidad',p_cantidad,'motivo',v_motivo);
    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('registrar_merma_bodega:'||p_idempotency_key::text,0));
    select * into s from private.solicitudes_merma_bodega
      where idempotency_key=p_idempotency_key;
    if found then
        if s.creado_por is distinct from auth.uid() or s.payload is distinct from v_payload then
            raise exception 'La clave de reintento pertenece a otra operación.';
        end if;
        return s.merma_id;
    end if;
    -- Replay precedes mutable catalog/dispatch state checks: return the historical ID,
    -- even if the item was later deactivated or the loss/dispatch was annulled.
    if not exists(select 1 from public.sucursales where id=p_sucursal_id) then
        raise exception 'La sucursal no existe.';
    end if;
    if p_producto_id is not null and not exists(
        select 1 from public.productos where id=p_producto_id and activo
    ) then raise exception 'El producto no existe o está desactivado'; end if;
    if p_tipo_empaque_id is not null and not exists(
        select 1 from public.tipos_empaque where id=p_tipo_empaque_id and activo
    ) then raise exception 'El tipo de envase no existe o está desactivado.'; end if;
    if p_despacho_id is not null then
        select * into d from public.despachos where id=p_despacho_id for update;
        if not found then raise exception 'El despacho no existe'; end if;
        if d.sucursal_id is distinct from p_sucursal_id then
            raise exception using errcode='42501',
              message='No tienes permisos para registrar mermas en esta sucursal.';
        end if;
        if d.anulado then raise exception 'El despacho está anulado'; end if;
    end if;
    perform private.bloquear_saldos(p_sucursal_id,d.vendedor_id);
    perform pg_catalog.set_config('ondina.motivo',v_motivo,true);
    insert into public.mermas(sucursal_id,despacho_id,producto_id,tipo_empaque_id,
                             cantidad,motivo,creado_por)
    values(p_sucursal_id,p_despacho_id,p_producto_id,p_tipo_empaque_id,
           p_cantidad,v_motivo,auth.uid()) returning id into v_id;
    insert into private.solicitudes_merma_bodega(idempotency_key,merma_id,creado_por,payload)
    values(p_idempotency_key,v_id,auth.uid(),v_payload);
    perform pg_catalog.set_config('ondina.motivo',coalesce(v_previo,''),true);
    return v_id;
end;
$$;
revoke execute on function public.registrar_merma_bodega(uuid,text,uuid,uuid,uuid,integer,text,uuid,uuid)
  from public, anon;
grant execute on function public.registrar_merma_bodega(uuid,text,uuid,uuid,uuid,integer,text,uuid,uuid)
  to authenticated, service_role;
```

Keys are globally unique for this operation and retained for the life of the loss. Actor and canonical payload (trimmed reason, exact remaining fields) must match. Changed payload/actor with an existing key fails without revealing its original ID. Gate checks run on every retry; inactive or transferred callers lose access. The trigger makes the sole balance movement and existing audit triggers write the business/balance events; the RPC writes no duplicate public audit row. Insufficient stock rolls back both the loss and ledger. Null keys are rejected for this new API. Native UUID/integer decoding failures occur before function execution; the UI must not send fractions or numeric strings.

### BEFORE INSERT guards, including existing direct callers

The existing loss movement trigger is AFTER INSERT; lock the parent before its FK key-share check. Reject the misleading dispatch-container path at the table boundary, and reject blank reasons for direct clients as well. Existing historical rows are untouched.

```sql
create function private.validar_merma_hu29()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
    if new.motivo is null or pg_catalog.btrim(new.motivo)='' then
        raise exception 'Indica el motivo de la merma.';
    end if;
    if new.despacho_id is not null and new.tipo_empaque_id is not null then
        raise exception 'Registra los envases dañados del despacho como devolución en estado malo.';
    end if;
    if new.despacho_id is not null then
        perform 1 from public.despachos where id=new.despacho_id for update;
    end if;
    return new;
end;
$$;
revoke execute on function private.validar_merma_hu29() from public, anon, authenticated;
create trigger validar_merma_hu29 before insert on public.mermas
  for each row execute function private.validar_merma_hu29();

-- Close the reverse-order hole: return after loss must obey the same combined bound.
-- BEFORE trigger name sorts before trg_devolucion_producto, which owns stock effects.
create function private.validar_devolucion_mermas_hu29()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_despachado bigint; v_devuelto bigint; v_mermas bigint;
begin
    if new.anulado then return new; end if;
    perform 1 from public.despachos where id=new.despacho_id for update;
    select coalesce(sum(cantidad),0) into v_despachado from public.despacho_detalles
      where despacho_id=new.despacho_id and producto_id=new.producto_id;
    select coalesce(sum(cantidad),0) into v_devuelto from public.devoluciones_productos
      where despacho_id=new.despacho_id and producto_id=new.producto_id and not anulado;
    select coalesce(sum(cantidad),0) into v_mermas from public.mermas
      where despacho_id=new.despacho_id and producto_id=new.producto_id and not anulado;
    if v_devuelto+v_mermas+new.cantidad > v_despachado then
        raise exception 'La devolución y las mermas superan lo despachado de ese producto.';
    end if;
    return new;
end;
$$;
revoke execute on function private.validar_devolucion_mermas_hu29() from public, anon, authenticated;
create trigger a_validar_devolucion_mermas_hu29 before insert on public.devoluciones_productos
  for each row execute function private.validar_devolucion_mermas_hu29();
```

This additional return guard is necessary even when another dispatch leaves enough global carga: dispatch A=10, loss A=4, unrelated load=20 must not permit return A=7. Existing B6 validates loss-after-return; this closes return-after-loss, including registrar_devolucion and corregir_devolucion. Neither guard changes stock itself.

### Cancellation RPC: preserve movement triggers

Existing false→true compensation is sufficient for balances. Add an admin-only RPC for a mandatory cancellation reason, safe parent-first locks and retry without another audit event. Keep the original loss motivo unchanged; store the cancellation reason in the audit context. No cancellation ledger is needed: the operation is monotonic by merma ID, and a repeated cancellation returns the same UUID without UPDATE. A later different reason cannot overwrite the first audit event.

```sql
create function public.anular_merma_bodega(p_merma_id uuid,p_motivo text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
    m public.mermas%rowtype;
    v_previo text := pg_catalog.current_setting('ondina.motivo',true);
begin
    if auth.uid() is null or private.es_rol('administrador') is not true then
        raise exception using errcode='42501',message='Solo administración puede anular mermas.';
    end if;
    if p_motivo is null or pg_catalog.btrim(p_motivo)='' then
        raise exception 'Indica el motivo de la anulación.';
    end if;
    select * into m from public.mermas where id=p_merma_id;
    if not found then raise exception 'La merma no existe.'; end if;
    if (private.es_admin_global() or m.sucursal_id=private.mi_sucursal()) is not true then
        raise exception using errcode='42501',message='No tienes permisos para anular esta merma.';
    end if;
    if m.despacho_id is not null then
        perform 1 from public.despachos where id=m.despacho_id for update;
    end if;
    select * into m from public.mermas where id=p_merma_id for update;
    if m.anulado then return m.id; end if;
    perform pg_catalog.set_config('ondina.motivo',pg_catalog.btrim(p_motivo),true);
    update public.mermas set anulado=true where id=m.id;
    perform pg_catalog.set_config('ondina.motivo',coalesce(v_previo,''),true);
    return m.id;
end;
$$;
revoke execute on function public.anular_merma_bodega(uuid,text) from public, anon;
grant execute on function public.anular_merma_bodega(uuid,text) to authenticated, service_role;
-- Route client cancellation through the gate/reason/lock contract.
revoke update on public.mermas from authenticated;
revoke update (anulado) on public.mermas from authenticated;
```

No direct admin client cancellation was found in the production adapter. Future admin callers must use this RPC (it can cancel a production product loss too); existing RLS stays as defense in depth, but definer gates are authoritative. Service maintenance bypasses require their own reviewed procedure. Do not change B6 compensation or historical rows. An old dispatch-linked container loss remains cancellable under its original plant-stock semantics.

## 2. Daily reconciliation: exact proposed SQL and reporting semantics

`supabase/migrations/20261013184049_b3_data_integrity.sql:893-931` defines `v_cuadre_despacho` as invoker, **service_role SELECT only**. It groups dispatch products but joins seller/day sales, so two dispatches of 10 and 20 with one sale of 5 report 5 sold twice if summed. Returns/losses are attached to dispatch date there even when recorded later. Do not grant that view to clients or use it as the new daily source.

`supabase/migrations/20261013181647_harden_database_security.sql:73-83` denies bodega sales SELECT; sale-detail policy follows sales. A true invoker RPC would silently undercount sold units unless sales policies were widened. The invoker alternative suggested in `docs/status/sprint-2/e09-reports-and-closeout.md:18-27` is therefore rejected here at coordinator direction. Follow the narrow active-role/branch gate in `supabase/migrations/20261013200000_b6_revision_fixes.sql:270-281`, with only aggregated quantities returned. **Do not change sales RLS or expose sale IDs, customers, prices or money.**

Grain is `(sucursal_id,vendedor_id,fecha,producto_id)`; mixing product units without producto_id is not meaningful. Sales have no despacho_id: never allocate them to individual dispatches. Each event uses its own Santiago creation day: dispatch detail (including adjustment), sale header, return row, loss row. Every source excludes cancelled records, and dispatch children also exclude cancelled parents. This is a restatement of currently active facts, not an immutable accounting close: later cancellation changes earlier reports. Unlinked warehouse product losses and all empty-packaging losses are **not** seller mermas; query them separately in the loss history.

`esperado_en_carga = despachado-vendido-devuelto-mermas` is the approved daily movement net. It equals an absolute closing load only with zero opening load; otherwise closing expected load is `saldo_inicial+esperado_en_carga`. Negative daily net is valid for carry-over sales/returns and must not be clamped. `carga_actual` is current, not a historical snapshot.

For today only, derive an opening quantity from the first load audit OLD value (INSERT means zero), and require the latest audited NEW quantity to agree with the current load. If there was no load mutation today and its modificado_en precedes the day, the unchanged load is its opening quantity. Conservatively disable comparison whenever the seller has any cancelled sale/dispatch/product return/linked loss: active-fact restatement does not encode reversal timing. No historical comparison is asserted. The comparison is a database consistency check, not a physical count; a human physical-count workflow needs another story. If audit evidence is absent/inconsistent, return null comparison fields, never an invented zero opening.

```sql
create function public.cuadre_diario_bodega(
    p_sucursal_id uuid,p_desde date,p_hasta date,p_vendedor_id uuid default null
) returns table(
    sucursal_id uuid,vendedor_id uuid,fecha date,producto_id uuid,
    despachado bigint,vendido bigint,devuelto bigint,mermas bigint,
    esperado_en_carga bigint,saldo_inicial bigint,carga_actual bigint,
    diferencia_carga bigint,comparacion_disponible boolean
)
language plpgsql stable security definer set search_path = '' as $$
declare
    v_desde timestamptz;
    v_hasta timestamptz;
    v_hoy date := (now() at time zone 'America/Santiago')::date;
begin
    if auth.uid() is null
       or (private.es_rol('bodega') or private.es_rol('administrador')) is not true
       or (private.es_admin_global() or p_sucursal_id=private.mi_sucursal()) is not true then
        raise exception using errcode='42501',message='No tienes permisos para consultar este cuadre.';
    end if;
    if p_sucursal_id is null or p_desde is null or p_hasta is null
       or p_hasta<p_desde or p_hasta-p_desde>30 or p_hasta>v_hoy then
        raise exception 'Indica un rango válido de hasta 31 días, sin fechas futuras.';
    end if;
    if not exists(select 1 from public.sucursales s where s.id=p_sucursal_id) then
        raise exception 'La sucursal no existe.';
    end if;
    if p_vendedor_id is not null and not exists(
        select 1 from public.perfiles p where p.id=p_vendedor_id
          and p.rol='vendedor' and p.sucursal_id=p_sucursal_id
    ) then raise exception 'El vendedor no pertenece a esta sucursal.'; end if;
    -- Convert both local dates independently: DST days are not necessarily 24h.
    v_desde := p_desde::timestamp at time zone 'America/Santiago';
    v_hasta := (p_hasta+1)::timestamp at time zone 'America/Santiago';
    return query
    with mov as (
        select d.sucursal_id,d.vendedor_id,dd.producto_id,dd.creado_en ts,
               dd.cantidad::bigint nd,0::bigint nv,0::bigint nr,0::bigint nm
        from public.despachos d join public.despacho_detalles dd on dd.despacho_id=d.id
        where d.sucursal_id=p_sucursal_id and not d.anulado
          and dd.creado_en>=v_desde and dd.creado_en<v_hasta
          and (p_vendedor_id is null or d.vendedor_id=p_vendedor_id)
        union all
        select v.sucursal_id,v.vendedor_id,vd.producto_id,v.creado_en,
               0,vd.cantidad::bigint,0,0
        from public.ventas v join public.venta_detalles vd on vd.venta_id=v.id
        where v.sucursal_id=p_sucursal_id and not v.anulado
          and v.creado_en>=v_desde and v.creado_en<v_hasta
          and (p_vendedor_id is null or v.vendedor_id=p_vendedor_id)
        union all
        select d.sucursal_id,d.vendedor_id,r.producto_id,r.creado_en,0,0,r.cantidad::bigint,0
        from public.devoluciones_productos r join public.despachos d on d.id=r.despacho_id
        where d.sucursal_id=p_sucursal_id and not d.anulado and not r.anulado
          and r.creado_en>=v_desde and r.creado_en<v_hasta
          and (p_vendedor_id is null or d.vendedor_id=p_vendedor_id)
        union all
        select m.sucursal_id,d.vendedor_id,m.producto_id,m.creado_en,0,0,0,m.cantidad::bigint
        from public.mermas m join public.despachos d on d.id=m.despacho_id
        where m.sucursal_id=p_sucursal_id and d.sucursal_id=p_sucursal_id
          and not d.anulado and not m.anulado and m.producto_id is not null
          and m.creado_en>=v_desde and m.creado_en<v_hasta
          and (p_vendedor_id is null or d.vendedor_id=p_vendedor_id)
    ), claves as (
        select x.sucursal_id,x.vendedor_id,(x.ts at time zone 'America/Santiago')::date dia,x.producto_id
        from mov x
        union
        -- Include carry-over load even when there were no movements today.
        select p_sucursal_id,c.vendedor_id,v_hoy,c.producto_id
        from public.carga_vendedor c join public.perfiles p on p.id=c.vendedor_id
        where p.sucursal_id=p_sucursal_id and p.rol='vendedor'
          and v_hoy between p_desde and p_hasta
          and (p_vendedor_id is null or c.vendedor_id=p_vendedor_id)
    ), tot as (
        select k.sucursal_id,k.vendedor_id,k.dia,k.producto_id,
               coalesce(sum(x.nd),0)::bigint nd,coalesce(sum(x.nv),0)::bigint nv,
               coalesce(sum(x.nr),0)::bigint nr,coalesce(sum(x.nm),0)::bigint nm
        from claves k left join mov x on x.sucursal_id=k.sucursal_id
          and x.vendedor_id=k.vendedor_id and x.producto_id=k.producto_id
          and (x.ts at time zone 'America/Santiago')::date=k.dia
        group by k.sucursal_id,k.vendedor_id,k.dia,k.producto_id
    ), comparacion as (
        select t.*,c.cantidad::bigint actual,
          case when t.dia=v_hoy and c.vendedor_id is not null then
            case when a.primero is not null and a.ultimo=(c.cantidad::bigint)
                 then a.primero
                 when a.primero is null and c.modificado_en <
                      (v_hoy::timestamp at time zone 'America/Santiago')
                 then c.cantidad::bigint end
          end inicial,
          exists(select 1 from public.ventas v where v.sucursal_id=p_sucursal_id
                 and v.vendedor_id=t.vendedor_id and v.anulado)
          or exists(select 1 from public.despachos d where d.sucursal_id=p_sucursal_id
                 and d.vendedor_id=t.vendedor_id and (d.anulado
                   or exists(select 1 from public.devoluciones_productos r
                             where r.despacho_id=d.id and r.anulado)
                   or exists(select 1 from public.mermas m
                             where m.despacho_id=d.id and m.anulado))) hay_anulaciones
        from tot t left join public.carga_vendedor c
          on c.vendedor_id=t.vendedor_id and c.producto_id=t.producto_id
        left join lateral (
          select
            (array_agg(case when au.accion='INSERT' then 0::bigint
                     else (au.valores_anteriores->>'cantidad')::bigint end order by au.id))[1] primero,
            (array_agg((au.valores_nuevos->>'cantidad')::bigint order by au.id desc))[1] ultimo
          from public.auditoria au
          where t.dia=v_hoy and au.tabla='carga_vendedor'
            and au.registro_id=t.vendedor_id
            and (au.valores_nuevos->>'producto_id')::uuid=t.producto_id
            and au.creado_en >= (v_hoy::timestamp at time zone 'America/Santiago')
            and au.creado_en < ((v_hoy+1)::timestamp at time zone 'America/Santiago')
        ) a on true
    )
    select q.sucursal_id,q.vendedor_id,q.dia,q.producto_id,q.nd,q.nv,q.nr,q.nm,
           q.nd-q.nv-q.nr-q.nm,
           case when not q.hay_anulaciones then q.inicial end,
           case when q.dia=v_hoy then q.actual end,
           case when q.inicial is not null and not q.hay_anulaciones
                then q.actual-(q.inicial+q.nd-q.nv-q.nr-q.nm) end,
           q.inicial is not null and not q.hay_anulaciones
    from comparacion q order by q.dia,q.vendedor_id,q.producto_id;
end;
$$;
revoke execute on function public.cuadre_diario_bodega(uuid,date,date,uuid) from public, anon;
grant execute on function public.cuadre_diario_bodega(uuid,date,date,uuid) to authenticated, service_role;
```

No seller-active filter is applied to historical reporting: inactive sellers remain visible within the authorized branch, consistent with `supabase/migrations/20261025163734_r1_14_vendedores_historial.sql:1-20`. The caller must still be active. A global admin supplies an explicit sucursal; null does not mean unbounded all-branch reads. A stable function uses a statement snapshot; current load, source rows and audit evidence are read consistently. `diferencia_carga` is actual − expected closing, null when comparison is unsupported.

Audit opening reconstruction assumes the existing transactional audit triggers were continuously enabled for the day; it cannot certify pre-B3/missing/imported history. History with an imported timestamp or maintenance disabling audit must be flagged as unsupported operationally. Before implementation release, test the audit ordering assumption under concurrent transactions: sequence IDs are safe here only because same-load writers serialize their row lock before emitting audit events. Do not use timestamp order alone (`now()` is transaction-start time).

No hard row limit silently truncates a reconciliation. The 31-day maximum bounds the calendar; measure realistic branch cardinality and EXPLAIN plans before choosing indexes or pagination. A later pagination contract must preserve complete totals and deterministic ordering.

## 3. Schema/policy changes and approval checklist

The implementation task needs **explicit approval** for the following proposed delta; this design applies none of it:

1. Create `private.solicitudes_merma_bodega`, its PK/unique/FKs/RLS and lifetime retention; create the registration/cancellation/report RPCs and explicit EXECUTE ACLs. No public business table columns, data backfill or existing balance repair is proposed.
2. Attach `validar_merma_hu29` to `public.mermas`: require nonblank reasons for all new loss inserts, reject new dispatch-container losses, and acquire dispatch locks before FK checks. Existing production direct product inserts remain valid. Historic dispatch-container losses keep their original reversal semantics.
3. Attach `a_validar_devolucion_mermas_hu29` to `public.devoluciones_productos`: tighten its cumulative bound to include active product losses. This changes return/correction behavior and needs regression review of both workflows.
4. Revoke authenticated direct loss UPDATE (including the existing anulado column grant); require the reason-gated admin cancellation RPC. Preserve existing SELECT/INSERT policies and grants, and the UPDATE policy itself. Review any external admin clients before this permission change.
5. Approve the SECURITY DEFINER, STABLE aggregate report exception, with the stated explicit role/branch gate and output projection. **No sales/venta_detalles RLS policy changes are proposed.** A raw invoker report without new RLS is incorrect; widening sales RLS could expose prices/customer links and is rejected.
6. Ratify event-day reporting, product grain, restatement after cancellation, and optional audit-supported current-day load comparison. The approved four-term formula alone cannot establish a historical closing load or a physical count. Do not add a closing/jornada table without a new decision.
7. Ratify the product limitation: dispatch-container losses use existing damaged returns; only empty packaging physically held in plant can use the warehouse-packaging loss form. The explicit return-origin rejection prevents the known workflow double discount, but physical-item deduplication across falsely declared origins is not supported. Serialized containers or a new return/loss provenance model would need separate scope and approval.

No existing table shape or RLS policy must change for the recommended path. Existing tables **do** acquire the two guard triggers, and `mermas` loses direct client UPDATE permission. No change to `v_cuadre_despacho` or its service_role-only grant, no jornada column, no application password/key handling, and no remote release are included. Production migration deployment remains subject to `docs/engineering/database.md:3-7,25-29` reconciliation and isolated verification gates.

## 4. pgTAP plan and frontend contract

### Executable test cases for the implementation task

Add `supabase/tests/hu29_mermas_bodega.test.sql` using the suite's JWT/role fixtures, transaction rollback and private ledger inspection only as test owner. Test behavior under authenticated roles rather than only postgres. The issue's validation fixtures (warehouse/load loss, damaged packaging, insufficient balance, prior return, cancellation, reconciliation and audit) expand as follows:

| Case | Expected assertions |
| --- | --- |
| Warehouse product: initial stock 20, loss 3 | stock=17; seller load unchanged; one loss, one ledger entry, one loss INSERT audit plus the balance event, correct actor/reason. |
| Dispatch product: dispatch 10, sale 2, loss 3 | load=5; warehouse unchanged by loss; daily D=10,S=2,R=0,M=3,expected=5. A dispatch loss never re-enters warehouse. |
| Product vs empty packaging | XOR neither/both rejected; packaging bodega stock 8 minus 2 =6, no product/load movement. Product loss never implicitly consumes empty packaging. |
| Damaged return | estado='malo' return creates no plant credit; passing its ID to loss RPC rejected; despacho+tipo rejected through RPC and direct INSERT; no loss, ledger, extra balance/audit on failure. Existing good-container return still credits once. |
| Insufficient or absent stock/load | reviewed Spanish P0001; zero negative balances; no loss/ledger/business or balance audit persisted. Missing product in dispatch rejected even if another dispatch gives global load. |
| Prior return and reverse ordering | D=10,R=4 permits M=6, rejects M=7; D=10,M=4 permits R=6, rejects R=7 even with extra global load. Corrections enforce the same bound atomically. |
| Validation | null/zero/negative quantity, blank/null motivo, bad origin/dispatch pairing, inactive/missing catalog, null key; malformed UUID/fraction/overflow rejected at API type decoding. |
| Retry lifecycle | same key/actor/canonical payload returns same UUID; one movement/audit/ledger; changed amount/item/origin/branch/reason or actor rejects. Retry after catalog deactivation, loss annulment or dispatch annulment returns original ID after current authorization. Failed first call leaves key reusable. |
| Cancellation | admin cancels warehouse product, empty packaging and active dispatch product: +OLD once, original motivo retained, audit has cancellation reason; second call no UPDATE/audit. Inactive/wrong-branch admin and bodega cannot cancel. Reactivation/edit/delete remain denied. |
| Parent cancellation | D=10,R=2,M=3, no sales: parent cancellation restores only 5 to warehouse and clears remaining load; M stays active; later M cancellation adds nothing. Do not cancel/recreate historical losses to repair balances. |
| Daily grain | two dispatches D=10+20, sale=5, return=3, loss=2 → exactly one product row D=30,S=5,R=3,M=2,expected=20. Warehouse loss excluded; second product kept separate. |
| Santiago boundaries | rows immediately before/at local midnight; DST short/long day; late return/loss goes to its own day; adjustment crossing midnight belongs to detail day; browser/DB timezone changes do not change grouping. |
| Cancellation exclusion | cancelled sale, return, loss and dispatch children excluded; mixed active/cancelled fixtures retain active totals and do not double count compensations. Older reports restate rather than pretending immutable closes. |
| Carry and load comparison | opening 7,D=10,S=4,R=2,M=1 → daily net=3,expected closing=10; current=10 gives difference 0. No movement today retains opening/current. Past day/missing audit/cancelled history → unavailable/null comparison, not fabricated zero. Negative daily net retained. |
| Authorization and privacy | bodega A sees only A aggregate; B denied even with guessed seller/dispatch IDs; seller/production/anon/inactive denied; branch admin limited; global admin explicit branch permitted; inactive historical sellers included; report exposes no individual sales, prices or customers. Direct sales SELECT remains denied to bodega. |
| ACL/history | private ledger SELECT/INSERT/UPDATE/DELETE denied to clients; anon/PUBLIC cannot execute new RPCs; auth.uid null fails even with service role EXECUTE; client direct loss UPDATE denied; existing production product loss path still works. |
| Audit rollback | successful insert/cancel exact row-event counts, reason and actor; replay no events; failed bounds/permission checks roll back all writes; audit reason context restored after successful RPC. |

Use a separate two-session test (like `supabase/tests/concurrency-b3.py`) for simultaneous same-key registration, distinct-key losses exhausting one balance, loss vs return/correction, cancellation vs registration and repeated cancellation. Assert both receipts, final balances, parent bound, ledger uniqueness and no extra audit; pgTAP alone does not establish concurrency safety. Investigate long-open transactions crossing Santiago midnight because existing created_en defaults use transaction-start now(); preserve that convention unless a separately approved change chooses statement time.

Future verification from an isolated project: pinned CLI 2.111.0; local reset, pgTAP, `supabase db lint --local --schema public,private --fail-on error`, upgrade rehearsal and concurrency regression, then stop only that project's stack. Regenerate public TypeScript types. FE: lint/build/relevant Vitest and local API integration; responsive checks at 375/412px. No remote action follows from these checks.

### Frontend service contract

Put adapters/hooks under `frontend/src/domains/bodega/`; use the shared Supabase client and generated types. Do not compute or mutate stock in the browser.

- `registrar_merma_bodega`: all first eight arguments are required; explicitly send null for the unused dispatch/item IDs. `p_origen` is `bodega | despacho`; `p_cantidad` positive integer; `p_motivo` trimmed and required; `p_idempotency_key` caller-owned UUID; optional `p_devolucion_envase_id` defaults null and rejects return-origin submissions. Returns the UUID string of the recorded loss, including retries. Query the RLS-protected mermas row for timestamp/actor/current anulado after success.
- Keep one key for the same payload/identity after timeout/failure while the form is mounted. Generate a new key after successful completion or changed payload/identity. Disable parallel submit; do not generate the key inside the API adapter. Server trim canonicalizes incidental outer reason whitespace. Existing documentation does not promise key persistence across reload; an outbox/reload-safe retry is additional scope.
- `anular_merma_bodega({p_merma_id,p_motivo})`: admin only; returns UUID; retry by resource ID, no key argument. UI confirms the specific row and requires a distinct cancellation reason. Bodega sees cancellation status but cannot cancel. An original registration replay must not be displayed as a new active loss when the row is now annulled.
- `cuadre_diario_bodega({p_sucursal_id,p_desde,p_hasta,p_vendedor_id:null|uuid})`: inclusive ISO dates, at most 31 days, no future dates; returns the typed rows in section 2. All quantity columns are bigint: validate safe integer conversion or retain decimal strings according to the Supabase JSON response; never silently coerce beyond JS safe range. Render `esperado_en_carga` as “Saldo de movimientos del día”; show opening/expected closing/current/difference only when comparacion_disponible. Otherwise show “Comparación no disponible” with historical/opening-history context. `carga_actual` appears only for today; never label it a past snapshot.
- Seller selector: use vendedores_historial_sucursal for report/history (includes inactive); dispatch selector uses authorized active dispatch history. Actor is always auth.uid() server-side; no p_creado_por spoofable argument. Jornada is server timestamp in America/Santiago, never a backdated/browser-supplied day.
- Loss list: scoped SELECT on mermas with sucursal/date/origin/item/anulado filters; show creado_por and business date. Bodega cannot freely query seller perfiles after B6; resolve seller names using the historical roster. For non-seller actor names, display the actor UUID or current user's known display name unless a separate safe roster endpoint is approved; do not widen profile access.
- On success invalidate losses, stock_bodega/stock_envases, carga and daily reconciliation; cancellation also refreshes dispatch reconciliation. Existing branch-filtered mermas Realtime can refresh other mounted consumers (`frontend/src/domains/produccion/api.ts:180-188`).

Errors use P0001 for business validation and 42501 for authorization, with messages exactly as SQL above. Existing B6 movement errors remain: `La merma supera lo despachado pendiente de ese producto.`, `Cantidad de merma superior a la carga disponible. Disponible: N`, `Cantidad de merma superior al stock disponible. Disponible: N`, `Cantidad de merma superior a los envases disponibles. Disponibles: N`; negative-balance fallback `Stock o carga insuficiente para completar la operación.` Display reviewed messages through the existing safe Supabase error adapter; map native argument decoding failures to a form validation message. A deadlock/serialization/network retry reuses the same registration key; permission or changed-payload failures are not automatic retry loops.

## 5. Effort, verification evidence and handoff

| Work | Estimate | Includes |
| --- | --- | --- |
| Backend | 3–4 engineer days | Forward migration/ACL/guards/RPCs 1–1.5d; pgTAP and concurrency 1d; report/audit/DST fixtures, generated types and upgrade regression 1–1.5d. No remote rollout. |
| Frontend | 2–3 engineer days | Distinct-origin form, reason/key lifecycle, history/admin cancellation, daily product table and unavailable-comparison states, mobile and local integration. Coordinate ownership with HU-26/refactor #86. |
| Total | 5–7 engineer days | Approval wait, historical balance investigation, physical provenance/closing snapshot design and production deployment excluded. Removing optional audited comparison can save about 0.5–1 backend day but must retain the daily-net caveat. |

Read-only evidence on 2026-10-25: read AGENTS/README/database/sprint/story sources; `gh issue view 67` confirmed the validation/acceptance wording; `bd prime`, `bd show OND-w76.10`, `bd stats` confirmed the open implementation task (do not close it for design). `.codegraph/` was absent, so ordinary source search was used. The current branch descends from feature/T3. Source history and all later migrations were inspected for effective overrides.

An already-running local `supabase_db_ondina-erp` was observed; a single `BEGIN READ ONLY` / information_schema SELECT / COMMIT confirmed PostgreSQL 17.6, UTC server timezone, and the loss/load/audit column contracts. This worker did not start a stack, reset a database, apply SQL, run migrations, or stop another session's shared containers. A later read-only EXPLAIN attempt could not connect: `FATAL: role "postgres" does not exist`; no stack repair or role change was attempted. The proposed SQL was reviewed as text; no successful report-query compilation, pgTAP/build/runtime correctness claim is made for unimplemented SQL. Future isolated verification is mandatory before accepting implementation.

Primary SQL references checked: [PostgreSQL CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html) (STABLE and security/ACL semantics), [PostgreSQL date/time](https://www.postgresql.org/docs/17/functions-datetime.html) (named timezone conversion), and the [Supabase changelog](https://supabase.com/changelog) index (fetched as Markdown; no SQL-specific breaking change identified in the current entries inspected). These do not substitute for local migration regression.
