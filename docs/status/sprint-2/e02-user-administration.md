# E2 — User Administration (HU-10)

[Sprint 2 index](README.md)

## Objective

Administrators create users, assign role and sucursal, and deactivate users from the app. No privileged key reaches the browser, and the database stays the authority on access.

## Covers

- HU-10 (#58, OND-w76.1), P1. All Beads blockers are closed.
- Shares Auth configuration with #44 (OND-d40, [E10](e10-platform-carry-over.md)).

**Roles:** Backend/Supabase (Edge Function, RPC, audit, pgTAP), Frontend (`frontend/src/domains/administracion/**`: new `api.ts`, `types.ts`, `schemas.ts`, pages), Security/review (mandatory). **Depends on:** E1 decisions on ambiguities 1–3 below.

## Repository evidence

- `perfiles` (`id` = `auth.users.id`, nullable `sucursal_id`, `rol` in four roles, `activo`): `supabase/migrations/20261013000000_remote_baseline.sql:1171-1182`.
- Every RLS helper (`private.es_rol`, `mi_sucursal`, `perfil_activo`, `perfil_en_ambito`) requires `perfiles.activo`, so deactivation stops data access immediately even with a valid JWT (`20261013181647_harden_database_security.sql:5-38`; [auth](../../engineering/auth.md)).
- After the B2 hardening, `perfiles` has no INSERT/UPDATE grant or policy for `authenticated`. Every admin write needs a new RPC (`harden_database_security.sql:40-61, 820-830`).
- `perfiles` is not covered by the audit trigger `fn_auditoria_simple` (`20261013184049_b3_data_integrity.sql:90-116`).
- No `supabase/functions/` directory and no auth hook exist. `frontend/.env.example` holds only the URL and anon key.
- `frontend/src/domains/administracion/` contains only placeholder pages.

## Ambiguities to resolve first

1. Global vs. branch administrator: an admin with `sucursal_id IS NULL` is global (`private.es_admin_global`). Can a branch admin create users or other admins?
2. HU-10 says the admin sets "credenciales", #58 asks for an invite flow, and AGENTS.md forbids storing application passwords. Invite only, or an initial password set through Auth?
3. The last-administrator rule: block demoting or deactivating the last active global admin, and self-deactivation?

## Options

| Option | Pros | Cons | Effort |
| --- | --- | --- | --- |
| A. Edge Function `admin-usuarios` holding the secret key in function secrets. It verifies the caller's JWT, rechecks admin status in SQL, calls `auth.admin.inviteUserByEmail` and inserts `perfiles` (deleting the Auth user if that fails). Role/sucursal/activo changes go through a `security definer` RPC with a last-admin guard and audit. Deactivation also sets `ban_duration`. | The supported way to create Auth users without exposing the key ([createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [inviteUserByEmail](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail), [Edge Function auth](https://supabase.com/docs/guides/functions/auth)); meets #58 | New deploy surface (functions, secrets, CI); Auth and DB are not one transaction, so it needs compensation and retry | M–L (5–7 d) |
| B. Invite from the Supabase Dashboard; in-app RPC manages role/sucursal/activo | No secret anywhere in Ondina's runtime | Operators need owner-level Dashboard access; does not meet "crear desde la app" | S–M (2–3 d) |
| C. Add a custom access token hook with role/sucursal claims (on top of A or B) | Fewer `perfiles` lookups | Claims refresh only at token issuance (up to 1 h), so a role change or deactivation lags ([custom access token hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook), [sessions](https://supabase.com/docs/guides/auth/sessions)); duplicates the source of truth | +3 d |

**Recommendation: A without C.**
- Keep authorization in `perfiles` through the existing helpers, which already use `(select …)` caching.
- Prefer invite so Ondina never handles a password.
- Add `perfiles` to the audit trigger.
- Treat the ban as defense in depth: `activo = false` is the real gate.

## Acceptance criteria

- [ ] A global admin can invite a user with role and sucursal, and the `perfiles` row exists afterwards.
- [ ] Inviting the same email twice does not duplicate users or profiles (Deno test).
- [ ] vendedor, bodega, produccion and `anon` callers of the function or RPC are denied (HTTP 401/403; pgTAP `42501`).
- [ ] A branch admin cannot act outside their sucursal (pgTAP).
- [ ] Demoting or deactivating the last active global admin fails, and so does self-deactivation (pgTAP).
- [ ] A deactivated user with a still-valid JWT gets no rows from any table (pgTAP).
- [ ] Each profile change writes one `auditoria` row with actor and reason (pgTAP).
- [ ] `grep -rniE "service_role|sb_secret" frontend/src` returns nothing.
- [ ] `npm run lint`, `npm run build` and `npm run test` pass from `frontend/`.
- [ ] Security/review verdict: pass.

## Verification

- `supabase db reset`, `supabase test db`, `supabase functions serve` with Deno tests (local only).
- The frontend commands.
- No remote function deploy or secret creation without the human gate in [handoffs](../../orchestration/handoffs.md).

## Risks

- A partial failure between the Auth user and the profile; mitigated by compensation and an idempotent email lookup.
- Invite-link expiry follows the Email OTP expiry, 1 h by default ([users guide](https://supabase.com/docs/guides/auth/users)).
- Overlap with #44 (SMTP, recovery and session settings) needs one owner.
- Lockout if the last-admin guard is missing.
