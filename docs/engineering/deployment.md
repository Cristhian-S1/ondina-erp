# CI and Deployment

This guide describes repository configuration. Verify live project settings, environment protections and access before relying on them; no remote settings are changed by this documentation.

## Declared workflows

| Source | Trigger and behavior |
| --- | --- |
| `.github/workflows/ci.yml` | PRs and pushes to develop/main; lint, build and Vitest plus a basic migration-text check. |
| `.github/workflows/deploy-develop.yml` | Push to develop; Vercel preview deployment under the GitHub `development` environment. |
| `.github/workflows/deploy-prod.yml` | Push to main; verification first, then production deployment under `production`. |

The SQL check only looks for semicolons. Development deployment does not currently depend on the CI job. Required reviewers/branch protection must be checked in GitHub settings; declaring an environment does not establish an approval gate.

## Configuration

| Location | Required configuration |
| --- | --- |
| Vercel project | Root Directory `frontend`; use its `vercel.json`, SPA rewrites, lockfile install and `dist` output. |
| Vercel environments | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` for the selected development/preview/production project. These values reach the browser. |
| GitHub Actions secrets | `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_ORG_ID`; obtain values from the intended account/project rather than this document. |
| GitHub production environment | Required reviewers and allowed release branches, verified against the team's release policy. |

Never place service-role keys, private credentials or copied tokens in frontend variables or Markdown. Confirm which deployment path is authoritative when Git integration and Actions coexist; see the open CI/CD issues.

## Release sequence

1. Verify the target branch/project, quality checks and an authenticated preview against development data.
2. Complete the [database reconciliation gate](database.md); migrations are manual and are not applied by these Actions.
3. Publish/deploy within authorization and the configured release approvals.
4. Check direct SPA navigation, session restoration, role/sucursal access and critical stock flows in the intended environment.
5. Retain the deployment ID and verification evidence in Beads. Frontend rollback uses an approved prior deployment; database rollback requires a separately reviewed data-safe plan.
