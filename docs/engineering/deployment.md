# CI and Deployment

This guide describes repository configuration. Verify live project settings, environment protections and access before relying on them; no remote settings are changed by this documentation. The repository state noted below was confirmed on 2026-10-13.

## Declared workflows

| Source | Trigger and behavior |
| --- | --- |
| `.github/workflows/ci.yml` | PRs and pushes to develop/main run `build` (lint, typecheck/build, privileged-key scan of `dist/`, bundle budget, Vitest) and `migrations-check`; on a push to develop the `deploy-develop` job deploys to Vercel under the GitHub `development` environment only after both jobs succeed. |
| `.github/workflows/deploy-develop.yml` | Manual only: `workflow_dispatch` with a `ref` input (default `develop`) for a versioned redeploy or rollback of development. |
| `.github/workflows/deploy-prod.yml` | Push to main (verification job first, then the production deployment under `production`) plus `workflow_dispatch` with a `ref` input for a versioned redeploy or rollback. |
| `.github/workflows/health.yml` | Scheduled every 30 minutes plus manual dispatch: checks production availability and Supabase Auth, and maintains the incident issue; see [Health monitoring](#health-monitoring). |
| `.github/workflows/security.yml` | PRs/pushes to develop/main run a checksum-verified Gitleaks scan and runtime fixture self-test; PRs also review dependencies with a high-severity runtime gate. See [CI security](security.md) for commands, credential response and proposed external controls. |

Workflows pin actions by commit SHA (`actions/checkout`, `actions/setup-node`) and the Vercel CLI by version (`vercel@63.1.2`), take Node from `frontend/.nvmrc` (22) with npm caching, and run deploy jobs only when `github.repository` is `Cristhian-S1/ondina-erp`. The migration job starts an isolated local Supabase stack, rebuilds migrations and synthetic seed, runs pgTAP and local role journeys, then stops the stack. It does not apply production migrations. The `workflow_dispatch` triggers and their `ref` input appear in the Actions UI only once these files exist on the default branch (`main`).

`frontend/vercel.json` adds security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`) and an enforced `Content-Security-Policy` for all routes. Confirm the effective deployment headers before relying on them.

## Vercel and repository controls (verified 2026-10-13)

- `frontend/vercel.json` declares `"git": { "deploymentEnabled": false }` (#39): the Vercel Git integration no longer creates Preview/Production deployments, so the GitHub Actions jobs are the only deployment path and the `production` approval gate is not bypassed by a parallel publication. CLI deployments (`vercel --prod`) are unaffected. Confirm the effective setting in the Vercel project panel.
- Branch protection on `main`: pull request required with 1 approval, stale reviews dismissed, conversation resolution required, strict required checks `Lint + typecheck + build + test` and `Validar migraciones Supabase (sintaxis, no aplica)`, no force-push and no deletion; administrators may bypass.
- Branch protection on `develop`: the same two required checks (not strict); no PR requirement, no force-push and no deletion.
- Secret scanning and push protection are enabled; Dependabot alerts and security updates are enabled.
- `.github/dependabot.yml` requests weekly version updates (Monday, America/Santiago) for npm (`/frontend`) and GitHub Actions (`/`), targeting `develop`, grouping minor+patch per ecosystem, with at most 5 open PRs and the label `dependencies`.
- Stale `feature/*` branches were archived as `archive/feature-*` tags and deleted on 2026-10-13; see the [development workflow](development.md).

Separate operational work: verified Supabase backups and recovery (#41), error tracking (#54), a justified need for stronger abuse protection (#55) and verifying effective CSP coverage (#45). The repository migration/pgTAP job alone does not establish remote schema reconciliation or production readiness.

## Configuration

| Location | Required configuration |
| --- | --- |
| Vercel project | Root Directory `frontend`; use its `vercel.json`, SPA rewrites, security headers, lockfile install and `dist` output. |
| Vercel environments | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` for the selected development/preview/production project. These values reach the browser. |
| GitHub Actions secrets | `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_ORG_ID`; obtain values from the intended account/project rather than this document. |
| GitHub Actions monitoring secrets | Optional `MONITOR_EMAIL`, `MONITOR_PASSWORD` for a dedicated effectively read-only account; see [Observability](observability.md#external-configuration-not-applied). |
| Optional frontend error collector | `VITE_ERROR_DSN` plus an explicitly registered adapter; no collector is active by default. See [transport/CSP proposal](observability.md#optional-transport-and-csp-proposal). |
| GitHub Actions variables | `SUPABASE_URL` and `SUPABASE_ANON_KEY` (public values, used by the health check). Not secrets. |
| GitHub production environment | Required reviewers and release branch policy for `main`; verified 2026-10-13 (4 reviewers, branch `main`). |

Never place service-role keys, private credentials or copied tokens in frontend variables or Markdown. The `build` job fails when `frontend/dist` contains the strings `service_role` or `SUPABASE_SERVICE`.

## Bundle budget

`frontend/scripts/check-bundle-size.mjs` (run with `npm run size`, after `npm run build`) reads the entry script and stylesheet from `dist/index.html` and measures three values: entry JS gzip, entry CSS gzip and the largest JS chunk uncompressed. It compares each value with `frontend/bundle-budget.json` and exits 1 on regression.

The baseline is not arbitrary: it is the build measured on 2026-10-13 from commit `059172a` (entry JS 95,970 B gzip; entry CSS 43,502 B gzip; largest JS chunk 301,916 B) plus 10% headroom. The margin catches regressions such as the 911 kB entry recorded in the 2026-10 audit while tolerating small dependency updates. Update the baseline deliberately in a PR: rebuild, record the new bytes/date/commit in the JSON and justify the change; do not raise the headroom to silence a regression.

Mobile/tablet transfer and Core Web Vitals are deliberately outside CI: measure them manually with Lighthouse on a throttled connection against the preview or production URL, covering first load and the first navigation to each domain (#50); the latest measurement is recorded in [Mobile and tablet performance](performance.md).

## Health monitoring

`.github/workflows/health.yml` runs every 30 minutes from the default branch and supports manual dispatch. It checks the production SPA shell and Supabase Auth health, then optionally signs in with a dedicated read-only monitoring account and reads exactly one catalog `productos.id` through PostgREST. The only application-data operation is a bounded GET; password login creates an Auth session. Missing monitoring secrets skip the synthetic step with a notice; no credentials, tokens or response bodies enter logs.

The run summary distinguishes frontend, Auth and database failures. Failure opens or updates `[Incidente] Health check fallido` with label `incidente` and a run link; a run with no failed enabled checks comments and closes it, with omissions retained in the summary. Stable healthy runs add no comments. Scheduled runs may be delayed by GitHub, and the schedule activates only after integration into the default branch (`main`). `workflow_dispatch` input `simular_fallo` exercises incident/recovery handling after separate execution approval; no remote rehearsal is included in the local implementation.

Read the [Observability runbook](observability.md) for thresholds, notification channel, operational owner placeholder, retention, excluded data, zero incremental subscription cost, optional service comparison and the complete external configuration checklist. Monitoring account/role creation, GitHub secrets/notifications and optional DSN/CSP changes remain owner actions. The local error reporter correlates render/mutation failures with operation UUID, build version and environment; the console is the default sink and no external error service is required or activated.

## Abuse protection (decision, 2026-10-13)

The application has no public sign-up or public forms, only login, so no CDN proxy or CAPTCHA is added for now (#55). Reliance is on Supabase Auth rate limits and disabled public sign-ups (verify in the Supabase dashboard), Vercel's default DDoS mitigation, and Vercel Attack Challenge Mode during an incident. Cloudflare Turnstile stays deferred until a public form exists or abuse is observed; Supabase Auth supports a CAPTCHA provider natively when needed. A site WAF does not replace RLS/RPC authorization, and any future proxy must be evaluated for cache, Auth, Realtime and direct-origin bypass before adoption.

## Release sequence

1. Verify the target branch/project, quality checks and an authenticated preview against development data.
2. Complete the [database reconciliation gate](database.md); migrations are manual and are not applied by these Actions.
3. Publish/deploy within authorization and the configured release approvals.
4. Check direct SPA navigation, session restoration, role/sucursal access and critical stock flows in the intended environment.
5. Retain the deployment ID and verification evidence in Beads. Frontend rollback uses an approved prior deployment or a manual workflow redeploy (`ref` input); database rollback requires a separately reviewed data-safe plan.
