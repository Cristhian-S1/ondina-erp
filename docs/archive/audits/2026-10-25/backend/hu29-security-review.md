> Date: 2026-10-25 · Reviewer role: Security/review (Claude Code Sonnet 5.5) · Commit: 66dd3e3 (integrated as 9398a30 on feature/T3).

# HU-29 security review (OND-w76.10) - commit 66dd3e3

VERDICT: PASS for items 1, 5, 6, 7 (in scope). No exploitable defect found in the three SECURITY DEFINER functions or the private ledger.
Items 2-4 left out leave three confirmed MEDIUM integrity gaps (none is a privilege escalation, none is new). Details below.

Method: static review of every listed file, plus runtime on a local stack started from this worktree (supabase start; DB reset before probes).
Runtime: pgTAP 002_security 459/459 ok; 009_hu29 123 ok, 0 "not ok", 3 intentional SKIP (items 2-4); concurrency-hu29.py 3/3 PASS; PostgREST probes; 23 mutation runs against 009. All probes ran inside rollback transactions; DB reset after concurrency run. No files edited.

## Items reviewed - results
- SECURITY DEFINER hygiene (all 3): `set search_path=''`, every object schema-qualified, owner postgres, ACL = postgres+authenticated+service_role (anon/PUBLIC revoked; verified in pg_proc.proacl). Actor is always `auth.uid()`; no actor argument. Gate = active role + sucursal/global admin, evaluated first (migration:33-38, 116-126, 155-159). `auth.uid() is null` blocks service_role (tested).
- Private ledger: RLS on, no policies, anon/authenticated/service_role have no table privilege (has_table_privilege all false), PostgREST: `Accept-Profile: private` -> PGRST106, public path -> PGRST205. anon RPC calls -> 401 42501.
- Idempotency: lock `pg_advisory_xact_lock(hash('registrar_merma_bodega:'||key))` then ledger lookup (63-72); replay requires same actor AND same canonical payload (incl. sucursal, trimmed motivo); gate runs before replay so lost authorization or inactive actor cannot replay (test 109); replay after cancellation/deactivation/dispatch annulment returns the original id (tests 36, 58, 84). Failed first call leaves key reusable (test 40/41). Different actor -> "pertenece a otra operación" without revealing the id (test 158).
- Lock order: advisory -> despacho FOR UPDATE -> bloquear_saldos (bodega, carga, envases) -> insert; anular: despacho -> merma -> trigger (bloquear_saldos). Consistent with the B3 order; no cycle found; concurrency script exercises same-key, shared balance and double cancellation.
- cuadre_diario_bodega: returns only (sucursal_id, vendedor_id, fecha, producto_id, 4 sums, esperado, 3 null comparison columns, flag); proargnames asserted by test 150; every source filtered by p_sucursal_id; sale/return/loss/dispatch cancelled rows excluded; range <=31 days and no future enforced after the gate (migration:160-163), both edges mutation-killed except see F7. Global admin must pass an explicit sucursal.
- Cancellation: admin only (not bodega), reason mandatory (btrim), branch/global scope, repeated call returns without UPDATE (no 2nd audit), compensation exactly once (stock 19, not 22), audit ANULACION carries the new trimmed reason and admin actor (tests 44-56, 172-175).
- Error messages: fixed Spanish strings; only own-branch balances ("Disponible: N") are disclosed after authorization.

## Findings

### F1 MEDIUM (confirmed at runtime) - Direct UPDATE of mermas.anulado still allowed (item 4 omitted)
Where: supabase/migrations/20261013181647_harden_database_security.sql:136-138,835 (`mermas_update_b2` + `grant update (anulado)`), not revoked by 20261025180901_hu29_mermas_bodega.sql (design hu29-design.md:243-244 not carried over).
Probe: branch admin `update public.mermas set anulado=true where id=...` via authenticated succeeded; stock compensated once (87->90) BUT the ANULACION audit row stored motivo = the original loss reason ("rotura original"), not a cancellation reason. Bodega (non-admin) direct UPDATE affected 0 rows (RLS). Reactivation is denied by proteger_movimiento_b3.
Impact: the "admin-only, mandatory reason" guarantee of anular_merma_bodega is advisory, not enforced at the DB boundary; a branch admin (or a PostgREST client using an admin JWT) can annul losses without a cancellation reason and without the despacho-first lock. Admin-only, pre-existing capability, no stock corruption, no privilege escalation.
Fix: `revoke update (anulado) on public.mermas from authenticated; revoke update on public.mermas from authenticated;` (keep policy), after checking no frontend caller does a direct PATCH (design says none exists in produccion/api.ts). Alternative without revoke: BEFORE UPDATE trigger on mermas that requires `current_setting('ondina.motivo')` non-blank when anulado flips. Add a pgTAP test replacing the SKIP at 009:121.

### F2 MEDIUM (confirmed) - No BEFORE INSERT guard on public.mermas (item 2 omitted)
Where: absent trigger (design hu29-design.md:161-178); test 009:120-121 skips it.
Probe (bodega, direct INSERT through RLS): (a) `motivo='   '` accepted; (b) loss with despacho_id + tipo_empaque_id accepted and debited the plant packaging pool (stock_envases 50 -> 45), exactly the double-discount the RPC refuses. Direct inserts also have no idempotency key and skip the registrar_merma_bodega rules (origin, active catalog, p_devolucion_envase_id guard).
Impact: every rule the new RPC enforces for losses is bypassable by any bodega/admin user via PostgREST, so audit/reconciliation of mermas cannot rely on the RPC. Actors are already authorized and rows keep creado_por=auth.uid(); this is business-rule/integrity risk (stock inflation/deflation, unexplained losses), pre-existing, not a new privilege.
Fix: add `private.validar_merma_hu29` BEFORE INSERT trigger as in the design (nonblank motivo; reject despacho+tipo_empaque; lock despacho first) or, stronger, drop the INSERT grant/policy for bodega/administrador once produccion's direct product-loss path (frontend/src/domains/produccion/api.ts:152-167) is migrated.

### F3 MEDIUM (confirmed) - Return-after-loss bound missing on devoluciones_productos (item 3 omitted)
Where: absent `a_validar_devolucion_mermas_hu29`; devoluciones_productos triggers today: auditoria_b3, proteger_movimiento_b3, trg_devolucion_producto, trg_devolucion_producto_anular.
Probe: dispatch of 10; RPC loss 4 (ok) then registrar_devolucion 7 (ok): devuelto 7 + mermas 4 = 11 > 10 despachado, no error.
Impact: one phantom unit credited to bodega stock; negative esperado_en_carga in the report. Requires a bodega/admin to enter both movements, so it is an insider-fraud/integrity vector (hides a missing unit), pre-existing combination but now reachable through the supported RPC. Loss-after-return is already bounded by B6; the reverse order is not.
Fix: add the BEFORE INSERT trigger from the design (hu29-design.md:182-202) on devoluciones_productos and cover corregir_devolucion in pgTAP; replace the SKIP at 009:121.

### F4 LOW - pgTAP does not prove several guards (mutation survivors)
009 killed 18 of 23 mutations. Survivors (guard removed, suite still green):
- registrar role gate (migration:34): no test that vendedor/produccion are denied by the RPC (only the report is tested for those roles, 009:96-101).
- registrar cross-branch despacho check (migration:87-90): tests only use another p_sucursal_id (009:95), never a guessed despacho_id from another branch.
- registrar annulled-dispatch rejection (migration:91): only replay after annulment is tested.
- cuadre p_vendedor_id/branch check (migration:167-170) and sales sucursal filter (migration:186): no fixture with another branch's activity, so the claim "A sees only A" (design 4.1, case "Authorization and privacy") is not proven; a regression leaking other-branch sales with p_vendedor_id=null would pass.
- 31-day boundary: only the rejecting side is tested (31 days); `>30` -> `>29` survives. Add a positive 31-day call.
- advisory lock: cannot be seen in pgTAP; covered only by concurrency-hu29.py (not mutation-run).
- 009:112 and 114 use lives_ok, so "inactive seller included" / "global admin" do not assert returned rows.
Fix: add the listed cases with a second-branch synthetic fixture; assert row counts in 112/114.

### F5 LOW (info) - Existence oracles after the gate
registrar: "El despacho no existe" vs 42501 for a dispatch of another branch (migration:86-90); anular: "La merma no existe." vs 42501 (migration:123-126); replay "pertenece a otra operación" confirms a key exists. Requires guessing UUIDs, low impact; unify to the 42501 message if desired.

### F6 INFO - Assumptions to keep
Report intentionally bypasses sales RLS for bodega (approved item 5); keep the projection test (009:150) when columns change. Replay returns an id that may now be annulled; the UI must read anulado (design 4.2). 009 depends on seed fixtures and wall-clock days; 105 uses current_date (UTC) but still asserts the same message when the Santiago date differs.

## Answer: do items 2-4 create an exploitable gap?
Yes, three integrity gaps (F1-F3, MEDIUM, confirmed), reachable only by already-authorized bodega/administrador users (F1: administrador only) and all pre-existing. There is no cross-branch access, no privilege escalation, no anon exposure and no way to bypass the gates of the new RPCs' own reads. Risk of NOT adding the mermas trigger: blank-reason and dispatch-container losses via direct INSERT (stock_envases debited wrongly). Risk of NOT adding the devoluciones_productos trigger: return + loss may exceed dispatched quantity (phantom warehouse credit). Risk of KEEPING UPDATE on mermas: annulment without cancellation reason/despacho-first lock (audit shows original loss reason). Recommendation: acceptable to merge items 1,5,6,7 behind the existing deployment gate; schedule items 2-4 (or document the ratified acceptance) before relying on the RPCs as the only loss path or before production release.
