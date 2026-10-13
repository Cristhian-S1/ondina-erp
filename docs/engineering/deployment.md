# CI and Deployment

This guide describes repository configuration. Verify live project settings, environment protections and access before relying on them; no remote settings are changed by this documentation.

## Declared workflows

| Source | Trigger and behavior |
| --- | --- |
| `.github/workflows/ci.yml` | PRs and pushes to develop/main run `build` (lint, typecheck/build, Vitest) and `migrations-check`; on a push to develop the `deploy-develop` job deploys to Vercel under the GitHub `development` environment only after both jobs succeed. |
| `.github/workflows/deploy-develop.yml` | Manual only: `workflow_dispatch` with a `ref` input (default `develop`) for a versioned redeploy or rollback of development. |
| `.github/workflows/deploy-prod.yml` | Push to main (verification job first, then the production deployment under `production`) plus `workflow_dispatch` with a `ref` input for a versioned redeploy or rollback. |

Workflows pin actions by commit SHA (`actions/checkout`, `actions/setup-node`) and the Vercel CLI by version (`vercel@63.1.2`), and take Node from `frontend/.nvmrc` (22) with npm caching. The SQL check still only looks for semicolons. The `workflow_dispatch` triggers and their `ref` input appear in the Actions UI only once these files exist on the default branch (`main`). Required reviewers/branch protection must be checked in GitHub settings; declaring an environment does not establish an approval gate.

`frontend/vercel.json` adds security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`) and a `Content-Security-Policy-Report-Only` for all routes; the CSP is not enforced yet.

Not done and pending a user decision: the Vercel Git integration still publishes in parallel with these workflows (#39), `develop` still has no branch protection or required checks (#39), and secret scanning, push protection and Dependabot alerts remain disabled (#46).

## Configuration

| Location | Required configuration |
| --- | --- |
| Vercel project | Root Directory `frontend`; use its `vercel.json`, SPA rewrites, security headers, lockfile install and `dist` output. |
| Vercel environments | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` for the selected development/preview/production project. These values reach the browser. |
| GitHub Actions secrets | `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_ORG_ID`; obtain values from the intended account/project rather than this document. |
| GitHub production environment | Required reviewers and allowed release branches, verified against the team's release policy. |

Never place service-role keys, private credentials or copied tokens in frontend variables or Markdown. Confirm which deployment path is authoritative when Git integration and Actions coexist; see the open CI/CD issues.

## Release sequence

1. Verify the target branch/project, quality checks and an authenticated preview against development data.
2. Complete the [database reconciliation gate](database.md); migrations are manual and are not applied by these Actions.
3. Publish/deploy within authorization and the configured release approvals.
4. Check direct SPA navigation, session restoration, role/sucursal access and critical stock flows in the intended environment.
5. Retain the deployment ID and verification evidence in Beads. Frontend rollback uses an approved prior deployment or a manual workflow redeploy (`ref` input); database rollback requires a separately reviewed data-safe plan.
