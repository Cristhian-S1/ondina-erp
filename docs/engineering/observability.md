# Observability

Repository implementation reviewed on 2026-10-15 for #54 / OND-5a4. This guide describes code and local evidence, not an activated production guarantee. See [deployment](deployment.md#health-monitoring) and the [dated O3 report](../archive/audits/2026-10-14/operacion/O3-observabilidad-54.md).

## Signals and thresholds

`.github/workflows/health.yml` runs every 30 minutes from the default branch, or on manual dispatch. GitHub may delay scheduled runs. One failed check opens or updates `[Incidente] Health check fallido` with label `incidente`; no consecutive-failure delay is applied. A successful run comments and closes it; optional skipped probes remain explicit in its summary. The job is serialized with `cancel-in-progress: false` to avoid simultaneous incident updates.

| Signal | Success threshold | Diagnosis |
| --- | --- | --- |
| Frontend | HTTP 200 within 30 seconds and HTML contains `<div id="root">` | Inspect the Vercel alias, deployment and shell. This does not execute the SPA. |
| Auth health | `/auth/v1/health`, HTTP 200 within 30 seconds | Inspect Supabase availability and public repository variables. Missing variables produce a warning. |
| Synthetic Auth | Password grant `/auth/v1/token?grant_type=password`, HTTP 200 within 30 seconds, nonempty bearer access token | Inspect account enablement, password, Auth provider and rate limits. No response or exception details are logged. |
| Synthetic database | Authenticated `GET /rest/v1/productos?select=id&limit=1`, HTTP 200 within 30 seconds, exactly one visible row with only `id` | Inspect PostgREST availability, grants/RLS and catalog fixture visibility. Empty results are a failure so an inaccessible catalog is not silently accepted. |
| Frontend exceptions | Every caught render error and exhausted React Query mutation failure | Find `ondina.error` in the browser console using the displayed operation UUID, version, environment and operation class. No backend trace header is added. |

The synthetic step omits itself with `::notice` when either monitoring secret is absent; it does not fail for absent secrets. It reports Auth and database separately, with database explicitly not executed when login fails. A configured account plus missing/invalid public configuration is an Auth failure. Redirects are rejected, HTTP is accepted only for loopback local rehearsals, and response reads are capped at 64 KiB. No response body, access/refresh token or credential is printed or persisted to runner files. Login creates an Auth session; the only application-data operation is the bounded catalog GET. There are no sales, RPC calls, writes to business tables, refreshes or automatic login retries.

Recovery means no failure in the enabled probes. Missing monitoring secrets do not fail a run and therefore do not prevent incident closure; the recovery comment explicitly asks the responder to inspect omitted probes. Such a closure does not establish synthetic Auth/database availability. Configure all probes before accepting the operational rehearsal. An unconfigured Auth-health probe also remains visibly skipped in the run summary. The current signal covers API authentication and one catalog read, not browser login, all roles/sucursales, business transactions, latency percentiles or stock correctness. Frontend mutation correlation is local to the error event and user reference; server-side correlation remains a separate extension.

## Safe frontend reporting

`frontend/src/lib/observabilidad.ts` provides `reportarError(error, contexto)`. It returns a random operation UUID and emits exactly this allowlist to `console.error('ondina.error', evento)`:

```json
{
  "operacionId": "a random UUID",
  "version": "build __APP_VERSION__",
  "entorno": "Vite MODE",
  "operacion": "render | mutacion | desconocida",
  "tipo": "built-in error class or UnknownError"
}
```

No raw error is serialized. Error messages, stack traces, causes, custom names, URLs, query keys, mutation variables and arbitrary context are discarded. `depurar` preserves bounded container structure (five levels, twenty entries per object) while replacing every scalar and original field name. This deliberately sacrifices text diagnostics to remove opaque passwords/tokens and financial values that pattern matching cannot identify. Getters and `toJSON` are not called. Unit tests cover JWTs, opaque credentials, email, Chilean RUT, phone numbers, currency and amounts, nested/circular data and getters.

`ErrorBoundary` shows the same UUID as the logged render event plus the build version. React's raw caught-error logging is suppressed at `createRoot`. `MutationCache.onError` reports the final mutation failure without replacing the existing domain callback. `App` retains the current screen and adds a persistent, dismissible Spanish support-reference notice; domain form feedback remains in place. Only the latest UUID lives in memory, until dismissal, replacement or reload. The console is the default sink; this implementation supplies no central error dashboard or automatic error-volume alert.

## Optional transport and CSP proposal

No error SDK, account, fetch or beacon is enabled by default. `configurarAdaptador(adapter)` registers an interface `(readonlyEvent, dsn) => void | Promise<void>`. It is called only when **both** an adapter is registered and the public build variable `VITE_ERROR_DSN` is nonempty. Setting the variable alone makes no network request. Adapter failures are swallowed without recursively logging their details. The event is frozen and contains only the allowlisted metadata.

An owner may separately implement a reviewed transport to a controlled same-origin endpoint such as `/api/errors`. The endpoint, authentication, rate limiting and retention are not implemented here. A Sentry DSN is not a generic JSON URL: a future Sentry adapter must implement its ingestion protocol or use a reviewed SDK. Never put a private ingestion token in a `VITE_*` variable. Do not add user breadcrumbs, automatic request capture, stack/DOM/session replay or attachments without a new privacy review.

The current `frontend/vercel.json` **enforces** `Content-Security-Policy`, with `connect-src 'self' https://*.supabase.co wss://*.supabase.co`. A new external collector origin would require a separately reviewed exact-origin addition to `connect-src`, CORS validation and verification against the effective deployment headers. This is a proposal only; O3 does not change the CSP, Vercel or any remote configuration.

## Alert ownership and response

The agreed repository channel is the issue labeled `incidente` and GitHub notifications for watchers/subscribers. Email, Slack, SMS or paging is an operational-owner decision; no additional channel is configured. Stable healthy runs neither open issues nor add comments. Repeated failures append a summary to the existing incident every 30 minutes; the signal is intentionally coarse and has no escalation policy.

Operational owner: **"decide el responsable" (to be assigned by the owner)**. That person must subscribe to the repository/issue notifications, name a backup, decide response hours and acknowledge incidents. Proposed response target: inspect the next notification within 30 minutes during agreed coverage; it is not an accepted SLA. The report lists frontend, Auth and database status independently so the responder can route the problem.

1. Open the linked workflow run and identify the failed layer or explicit simulation marker.
2. For frontend failure, inspect the alias and last deployment; use the approved rollback process.
3. For Auth failure, inspect Supabase status, public variables and the monitoring account without copying credentials into an issue.
4. For database failure, inspect availability and the dedicated account's effective grants/RLS; do not expand permissions to silence the check.
5. For a user error reference, search the local structured console event by UUID and match the deployed version/environment. Ask for the code only, not console dumps or business data.
6. Verify a full subsequent success and the recovery comment/closure. A skipped synthetic probe is not Auth/database recovery evidence, even if the enabled checks close the incident.

## External configuration (not applied)

- Integrate/release the workflow to the default branch through the normal review process. A workflow in a local branch does not activate scheduling.
- Ensure label `incidente` exists and Actions has `issues: write`; verify GitHub notification delivery with the assigned responder.
- Set public repository variables `SUPABASE_URL` and `SUPABASE_ANON_KEY` for the intended project. Never use a service-role key.
- Create a dedicated Supabase monitoring account with **effective read-only authorization** and an appropriate trusted profile/role, able to read one catalog `productos.id` and unable to invoke writes/RPCs across any sucursal. Existing vendedor/admin roles are not read-only monitoring roles. A label or editable `user_metadata` is not authorization; verify every effective grant, RLS policy and RPC entry point before configuring the secrets. If current policies require a new role/profile model, that needs a separately authorized SQL/security change; no account, role, policy or migration is created by O3.
- Store its credentials as GitHub Actions secrets `MONITOR_EMAIL` and `MONITOR_PASSWORD`, rotate/revoke them under the owner's policy, and account for Auth session creation/expiry. Secrets enter the script through `env`, never expressions embedded in `run:`. Do not reuse the local UX account in production.
- Optionally choose and register an error adapter and set public `VITE_ERROR_DSN` at build time; review transport/CSP/retention first. No DSN or collector exists by default.

## Controlled alert rehearsal

Run this only after the owner authorizes GitHub execution and the configuration above is complete; it was **not executed remotely** for O3.

1. In Actions → Health check → Run workflow, choose the approved deployed revision and set `simular_fallo=true`.
2. Confirm the run summary marks the controlled simulation, the run fails, and the incident issue opens (or is updated) with the failing layer and run URL. Have the designated responder confirm receipt through GitHub notifications.
3. Dispatch again with `simular_fallo=false` (or await the next schedule). Require frontend, Auth health and synthetic Auth/database success; confirm a recovery comment and closure of the same issue.
4. Retain run/issue links and responder acknowledgment in the dated evidence. If the synthetic is omitted, configure it and repeat; do not manually call the exercise complete.

For a safe local synthetic rehearsal, extract the exact `run` string of step `id: synthetic` from the YAML, supply loopback `SUPABASE_URL`, local public key and the local UX account through environment variables, plus temporary `RUNNER_TEMP`, `GITHUB_OUTPUT` and `GITHUB_STEP_SUMMARY` paths, then run `bash -e -c <extracted-script>`. Do not run the whole workflow locally with a real `gh` binary/token: issue create/comment/close steps must use mocks. The O3 report records successful local login/read, omission, Auth/BD failure and local mocked incident open/recovery evidence.

## Retention, excluded data and cost

| Data | Current behavior / owner decision |
| --- | --- |
| Error events | Console only; no application storage or server retention. Browser/devtools retention is controlled by the browser/user. Clear console captures after diagnosis. |
| Latest user error reference | One UUID in process memory; cleared on dismissal/reload and replaced by the next failure. |
| Health summaries and job logs | No explicit retention override is applied by O3; actual log retention follows repository/organization settings. Proposed target: 14 days, to be configured by the owner. No artifacts or response bodies are uploaded. |
| Incident issues/comments | Persist under GitHub issue retention. Proposed quarterly review/archive; deletion/legal retention policy is for the owner to decide. |
| Optional collector | Disabled. Proposed maximum 14 days of sanitized events; approve actual vendor retention, residency and access before activation. |

Never record passwords, API/session/access/refresh tokens, JWTs, RUT, phones, email, customer names/addresses, transaction amounts, receipts, forms, request/response bodies, DOM/session replay or user/sucursal identifiers. Do not paste raw console/network dumps in incident issues.

Incremental service subscription cost is **0** with this implementation: existing GitHub Actions/issues plus the browser console, no paid service/account. The repository's existing Actions allowance and platform usage still apply; no billing plan was modified. No automatic paid upgrade is authorized.

Options for an owner decision (official pages reviewed 2026-10-15; terms/quotas can change):

| Option | Benefit | Limits and decision |
| --- | --- | --- |
| Current console + Actions/issues | No new vendor, minimal events and dependency cost | No centralized frontend aggregation; someone must collect the safe support reference. |
| [Sentry Developer](https://sentry.io/pricing/) | Free entry plan and centralized error triage | Account/DSN and protocol adapter/SDK required; confirm current event/user/retention quotas and privacy defaults. [Developer-plan guidance](https://www.sentry.help/en/articles/13965037-can-i-set-up-an-on-demand-pay-as-you-go-budget-for-my-free-developer-plan) should be checked before enabling any spend. |
| [BugSnag Free](https://www.bugsnag.com/pricing/) | Free entry option for individual projects with error triage | Account/project integration and current user/event/retention limits require review; paid tiers are not authorized. |

Official API references: [Supabase Auth password endpoint](https://supabase.github.io/auth/#post-token) and [Auth OpenAPI](https://github.com/supabase/auth/blob/master/openapi.yaml). Review current API exposure/grants as well as RLS; a successful Auth token does not establish database access.
