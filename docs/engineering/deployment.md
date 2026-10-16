# CI and Deployment

This guide describes repository configuration. Verify live project settings, environment protections and access before relying on them; no remote settings are changed by this documentation. The repository state noted below was confirmed on 2026-10-15. External settings require separate owner approval; see the [O4 evidence and proposed controls](../archive/audits/2026-10-15/operacion/O4-plan-39.md).

## Declared workflows

| Source | Trigger and behavior |
| --- | --- |
| `.github/workflows/ci.yml` | PRs and pushes to develop/main run `build` (lint, typecheck/build, privileged-key scan of `dist/`, bundle budget, Vitest) and `migrations-check`; on a push to develop the `deploy-develop` job deploys to Vercel under the GitHub `development` environment only after both jobs succeed. |
| `.github/workflows/deploy-develop.yml` | Manual only: `workflow_dispatch` with a `ref` input (default `develop`) for a versioned redeploy or rollback of development; `verify` requires successful canonical CI for the resolved SHA before `deploy` can run. |
| `.github/workflows/deploy-prod.yml` | Push to main (`verify` requires successful canonical CI for the same SHA, reruns lint/build/bundle budget/unit tests, then `deploy` uses `needs: verify` under `production`) plus `workflow_dispatch` with a `ref` input for a versioned redeploy or rollback. |
| `.github/workflows/health.yml` | Scheduled every 30 minutes plus manual dispatch: checks production availability and Supabase Auth, and maintains the incident issue; see [Health monitoring](#health-monitoring). |
| `.github/workflows/security.yml` | PRs/pushes to develop/main run a checksum-verified Gitleaks scan and runtime fixture self-test; PRs also review dependencies with a high-severity runtime gate. See [CI security](security.md) for commands, credential response and proposed external controls. |

Workflows pin actions by commit SHA (`actions/checkout`, `actions/setup-node`) and the Vercel CLI by version (`vercel@63.1.2`), take Node from `frontend/.nvmrc` (22) with npm caching, and run deploy jobs only when `github.repository` is `Cristhian-S1/ondina-erp`. The migration job starts an isolated local Supabase stack, rebuilds migrations and synthetic seed, runs pgTAP and local role journeys, then stops the stack. It does not apply production migrations; deployment jobs apply no SQL. The `workflow_dispatch` triggers and their `ref` input appear in the Actions UI only once these files exist on the default branch (`main`).

`frontend/vercel.json` adds security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`) and an enforced `Content-Security-Policy` for all routes. O4 preserves the complete file, including the CSP.

## Repository deployment controls

`frontend/vercel.json` already declares `"git": { "deploymentEnabled": false }` (#39). Vercel documents this boolean as disabling automatic Git deployments for all branches; [official configuration reference](https://vercel.com/docs/project-configuration/git-configuration#turning-off-all-automatic-deployments). Keep it in every publishing branch. It does not disable CLI publication or remove the currently served deployment. Root Directory must be `frontend` in the intended project.

The automatic develop job remains in `ci.yml` with `needs: [build, migrations-check]`. Manual development and both production triggers resolve the requested ref once, then query the latest canonical `ci.yml` push run for that exact SHA (development accepts develop/main runs; production accepts main runs). A failed, cancelled, skipped or missing CI run prevents publication. A pending/missing run is polled for up to 15 minutes, after which the workflow fails closed. The read-only GitHub token needs `actions: read` only in `verify`; no Vercel secrets are exposed there. Old commits whose CI records expired cannot use this redeploy route until reviewed CI evidence is restored.

Each deploy job checks out the full verified SHA and asserts it before publishing. The development deploy job shares concurrency group `deploy-develop` with automatic CI publication; production uses `deploy-prod`. Verification holds no deployment lock. These groups serialize publication but do not deduplicate an explicitly requested redeploy or guarantee FIFO order; inspect pending runs before a rollback. GitHub may replace an older pending job in a concurrency group.

Manual redeploy commands, for an authorized operator **after the workflows are on main**:

```bash
# --ref selects trusted workflow code; -f ref selects the application commit.
gh workflow run deploy-develop.yml --ref main -f ref=<full-successful-develop-or-main-SHA>
gh workflow run deploy-prod.yml --ref main -f ref=<full-successful-main-SHA>
```

The production job declares `environment: production`; required reviewers, self-review prevention, branch restrictions and administrator bypass are external settings. The YAML declaration alone does not prove an effective approval gate. Scope Vercel secrets to protected environments and apply the owner-approved controls from the O4 plan before relying on them.

The CLI remains pinned to `vercel@63.1.2`; deploy workflows use its native `VERCEL_TOKEN` environment variable. Publication still uploads source for a Vercel build; it is the same verified commit, not a promoted CI-built artifact. Vercel project settings and environment variables can change the resulting build. Capture deployment ID, URL, SHA and environment when verifying a release. Prebuilt artifact promotion is a separate change.

Separate operational work: verified Supabase backups and recovery (#41), error tracking (#54), a justified need for stronger abuse protection (#55) and operational verification of the enforced CSP (#45). The repository migration/pgTAP job alone does not establish remote schema reconciliation or production readiness.

## Configuration

| Location | Required configuration |
| --- | --- |
| Vercel project | Root Directory `frontend`; use its `vercel.json`, SPA rewrites, security headers, lockfile install and `dist` output. |
| Vercel environments | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` for the selected development/preview/production project. These values reach the browser. |
| GitHub Actions environment secrets | `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_ORG_ID` in `development`/`production`; obtain values from the intended account/project rather than this document. Owner configuration is separate from this repository change. |
| GitHub Actions variables | `SUPABASE_URL` and `SUPABASE_ANON_KEY` (public values, used by the health check). Not secrets. |
| GitHub production environment | Required reviewers and release branch policy for `main`; verify the live controls and administrator behavior separately. |

Never place service-role keys, private credentials or copied tokens in frontend variables or Markdown. The `build` job fails when `frontend/dist` contains the strings `service_role` or `SUPABASE_SERVICE`.

## Bundle budget

`frontend/scripts/check-bundle-size.mjs` (run with `npm run size`, after `npm run build`) reads the entry script and stylesheet from `dist/index.html` and measures three values: entry JS gzip, entry CSS gzip and the largest JS chunk uncompressed. It compares each value with `frontend/bundle-budget.json` and exits 1 on regression.

The baseline is not arbitrary: it is the build measured on 2026-10-13 from commit `059172a` (entry JS 95,970 B gzip; entry CSS 43,502 B gzip; largest JS chunk 301,916 B) plus 10% headroom. The margin catches regressions such as the 911 kB entry recorded in the 2026-10 audit while tolerating small dependency updates. Update the baseline deliberately in a PR: rebuild, record the new bytes/date/commit in the JSON and justify the change; do not raise the headroom to silence a regression.

Mobile/tablet transfer and Core Web Vitals are deliberately outside CI: measure them manually with Lighthouse on a throttled connection against the preview or production URL, covering first load and the first navigation to each domain (#50); the latest measurement is recorded in [Mobile and tablet performance](performance.md).

## Health monitoring

`.github/workflows/health.yml` runs every 30 minutes (and on manual dispatch) and performs two read-only checks:

| Check | Request | What a failure means and first steps |
| --- | --- | --- |
| Production site | `GET https://ondina-erp.vercel.app` returns 200 and the HTML contains `<div id="root">` | The domain/alias is broken, the deployment is down, or the served shell is not the SPA. Open the run URL, review the latest Vercel deployment, and redeploy or roll back with the `ref` input of the deploy workflows. |
| Supabase Auth | `GET <SUPABASE_URL>/auth/v1/health` with the public anon key returns 200 | The Auth endpoint or the Supabase project is unavailable, or the repository variables point to the wrong project. Check the Supabase dashboard/status and the `SUPABASE_URL`/`SUPABASE_ANON_KEY` repository variables. The check is skipped with a warning when those variables are unset. |

On failure the workflow opens (or comments on) the issue `[Incidente] Health check fallido` with the label `incidente`, the failing check, its status code and the run URL; when the service recovers it comments and closes that issue. The workflow only issues GETs, creates no sales or writes, and holds no secrets (the anon key is public). Scheduled runs can be delayed by GitHub, so this is a coarse availability signal rather than an SLA. GitHub runs `schedule` workflows from the default branch (`main`), so the 30-minute cadence activates once this file reaches `main`; `workflow_dispatch` is available from the Actions UI from then on.

Error tracking (Sentry or similar) is deferred: it requires creating an account and a DSN, and no tool has been selected (#54); the health check does not cover session, query or business-flow failures.

## Abuse protection (decision, 2026-10-13)

The application has no public sign-up or public forms, only login, so no CDN proxy or CAPTCHA is added for now (#55). Reliance is on Supabase Auth rate limits and disabled public sign-ups (verify in the Supabase dashboard), Vercel's default DDoS mitigation, and Vercel Attack Challenge Mode during an incident. Cloudflare Turnstile stays deferred until a public form exists or abuse is observed; Supabase Auth supports a CAPTCHA provider natively when needed. A site WAF does not replace RLS/RPC authorization, and any future proxy must be evaluated for cache, Auth, Realtime and direct-origin bypass before adoption.

## Release sequence

1. Verify the target branch/project, quality checks and an authenticated preview against development data.
2. Complete the [database reconciliation gate](database.md); migrations are manual and are not applied by these Actions.
3. Publish/deploy within authorization and the configured release approvals.
4. Check direct SPA navigation, session restoration, role/sucursal access and critical stock flows in the intended environment.
5. Retain the deployment ID and verification evidence in Beads. Frontend rollback uses an approved prior deployment or a manual workflow redeploy (`ref` input); database rollback requires a separately reviewed data-safe plan.
