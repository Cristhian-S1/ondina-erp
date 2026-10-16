# PR integration audit, 2026-10-16

Read-only review of the merge commits Codex published to resolve PR-branch conflicts against `develop`, checked against both parents per commit. Findings are recorded; nothing was changed or merged as part of this review. Reported CI status is the `CI` + `Security` workflow pair on each branch at the listed merge SHA.

## Merge order

#87 ✔ → #91 ✔ → #88 ✔ → #84 (squash, `f54a253`) ✔ → #89 (`37d87a5`) → #90 (`e54d31a` + `faa70a7`, stacked)

## Conflict rounds

| Round | PR (branch) | Conflicted files | Resolution | Merge SHA | CI |
| --- | --- | --- | --- | --- | --- |
| 1 | — (chore/vercel-unificar, O4) | `docs/engineering/deployment.md` | Kept branch version of the vercel/O4 side; added #87 content (security.yml, gitleaks scripts, O1 audit) | `0d5b63d` | success 2026-10-16 02:54Z |
| 1 | — (docs/supabase-backups-plan-pro) | `docs/README.md`, `docs/engineering/deployment.md` | Kept branch version of backups.md, X1-doc-41 and links; health.yml taken from develop-#87 | `9caf0c0` | success 2026-10-16 02:54Z |
| 1 | — (chore/observabilidad, O3) | `.github/workflows/health.yml`, `docs/README.md`, `docs/engineering/deployment.md` | Wove #87's 6-line health.yml edits into the branch's synthetic-journey version; README keeps both new rows | `bd2725d` | success 2026-10-16 02:56Z |
| 2 | #88 (docs/supabase-backups-plan-pro) | `docs/engineering/deployment.md` | Merged develop (#91): took #91's deployment.md restructure verbatim, re-applied the branch's single backup-link sentence | `c4ae093` | success 2026-10-16 03:46Z |
| 2 | #89 (chore/observabilidad) | `docs/engineering/deployment.md` | Took #91's exact-SHA/deployment-controls text plus "Confirm the effective deployment headers"; replaced develop's Health-monitoring table with the observability section that defers to observability.md | `fdc3a28` | success 2026-10-16 03:47Z |
| 3 | #89 (chore/observabilidad) | `frontend/src/App.tsx` (manual conflict). `--cc` confirms the resolution also carries `main.tsx`, `ErrorBoundary.tsx`, `docs/README.md` and `docs/engineering/deployment.md` | Kept #84's lazy/Suspense shell; added the observability banner (`useSyncExternalStore` + `descartarReferenciaMutacion`), `ErrorBoundary` and `onCaughtError` in `main.tsx` | `37d87a5` | success (CI verde) |
| 3 | #90 (chore/auth-recuperacion, stacked on #89) | `frontend/src/App.tsx`, `frontend/src/components/ProtectedRoute.tsx`, `frontend/src/pages/Login.tsx` | Two merge commits, no rebase: (a) develop merged into the branch, keeping the recovery routes over the lazy shell and the `recovery` guard in `ProtectedRoute`; (b) #89 merged into the branch so `App.tsx` carries both sides and no further conflict round is needed | `e54d31a` + `faa70a7` | success (CI verde) |

Tests at round 3 (reported by Codex, CI green): #89 — 839 unitarios + 22 integración; #90 — 878 unitarios + 24 integración. Local run of `npx vitest run` at `faa70a7` (clean worktree, no `frontend/.env.local`): 878 tests / 75 files, all passing.

## CSP wording rule

Use #91's wording: "operational verification of the enforced CSP (#45)" — present at `deployment.md:39` in both `c4ae093` and `fdc3a28` (see [../../../engineering/deployment.md](../../../engineering/deployment.md) after merge). Do not reintroduce the pre-#91 variants ("enforcing the CSP (#45)", "verifying effective CSP coverage (#45)").

## Expected remaining conflicts

- None, as long as #89 (chore/observabilidad) merges into `develop` before #90 (chore/auth-recuperacion), each as a merge commit. #90 is already stacked on top of #89 (`faa70a7` merges `37d87a5`), and `frontend/src/App.tsx` at `faa70a7` is byte-identical to the rehearsal branch tip (`426215c`), carrying #84's lazy shell, #89's observability banner and #90's recovery routes together. Merging #90 first would flip the stack and re-introduce an `App.tsx` conflict on #89.

## Review findings

Verdicts per merge SHA, evidence from `git show <sha>` compared against `git diff <sha>^1 <sha>` and `git diff <sha>^2 <sha>`:

- `0d5b63d` — PASS. Branch content intact vs parent 2 (deploy-develop.yml +68, deploy-prod.yml +46, O4-plan-39.md +211, deployment.md restructure dated 2026-10-15); #87 content (security.yml, .gitleaks.toml, scripts/ci/*, security.md, O1-ci-hardening.md, README row) added from parent 1.
- `9caf0c0` — PASS. Branch content intact vs parent 2 (backups.md +204, X1-doc-41.md, database.md links, deployment.md backup link, README row); `health.yml` identical to develop-#87 (`57503a9`).
- `bd2725d` — PASS. `health.yml` preserves #87's six-line edits inside the branch's 114-line synthetic-journey version (runbook pointer at `.github/workflows/health.yml:7`); README (def4265) holds both the CI-security and Observability rows.
- `c4ae093` — PASS. `deployment.md` equals the #91 (`70ff956`) version plus exactly one line: the backups link in "Separate operational work" (`deployment.md:39`). The #91 CSP wording survives (`deployment.md:39`); backups.md, X1-doc-41 and README row are preserved.
- `fdc3a28` — PASS. `health.yml` byte-identical to parent 1 (the branch version). `deployment.md` merges both sides cleanly: #91's exact-SHA verification text (line 23), the branch sentence "Confirm the effective deployment headers before relying on them." (line 17), and the observability Health-monitoring section (line 65) that supersedes develop's table; the replaced table's checks/first-steps live in `observability.md:11-12`, and the "coarse signal, not an SLA" nuance survives at `observability.md:49,51`.
- `37d87a5` — PASS (round 3, #89 vs parents `fdc3a28` + `f54a253`). `App.tsx` keeps #84's lazy/Suspense shell (lazy `AuthenticatedRoutes` with `ProtectedRoute` role guards and the `/*` route) and adds #89's observability banner (`useSyncExternalStore` over `observabilidad.ts`, `aside role="alert"` with the support code and dismiss button). `main.tsx` wraps the tree in `ErrorBoundary` and suppresses React's raw caught-error log via `onCaughtError`; `ErrorBoundary` reports through `reportarError`. No test files deleted; only the #89 suite was added (`observabilidad.test.ts`, `observabilidad-ui.test.tsx`).
- `e54d31a` — PASS (round 3, #90 first merge vs parents `55846b8` + `f54a253`). `App.tsx` = develop's lazy shell plus the public recovery routes `/recuperar` and `/restablecer` (lazy, with `recoveryFallback`) — no observability yet at this point (it stacks in `faa70a7`). `ProtectedRoute` gains a `recovery` guard that redirects to `/restablecer` while preserving the `roles` check. Adds the auth recovery pages, schemas/api, `AuthCard`, `AuthProvider` recovery handling and the integration journey `tests/integration/auth-recuperacion.journey.ts`; no test files deleted.
- `faa70a7` — PASS (round 3, #90 stacked on #89 vs parents `e54d31a` + `37d87a5`). `--cc` touches only `frontend/src/App.tsx`, and its final content is byte-identical to the rehearsal branch tip `426215c`: #84's lazy/Suspense shell + #89's banner + #90's recovery routes + `ProtectedRoute` guard all coexist. The #84 FB fixes survive: `Login.tsx:6,90` (`EyeIcon`/`EyeOffIcon`), `InputFecha.tsx:37,44` (native `::-webkit-calendar-picker-indicator` hidden, own 44px button always visible, disabled state included), `RegistrarCliente.tsx:45,105` (`creadoPara`), `icons.tsx:261,273` (`BidonIcon`, `HieloIcon`) — plus `icons-visibilidad.tsx` intact. No test files deleted.

Round 3 did not change any workflow file (`health.yml` was already reconciled at `bd2725d`; `devoluciones`-style visual capture additions under `docs/archive/audits/2026-10-14/` are doc assets only), so the YAML parse checks above remain valid, and the `CI` + `Security` pair reports success on all three round-3 merges.

Repository-wide checks at the five round-1/2 SHAs (round-3 merges introduce no workflow changes, so the same result holds there):

- Workflow YAML valid (ci, deploy-develop, deploy-prod, health, security): 25/25 parse OK.
- Relative links: the only broken link is pre-existing and not introduced by these merges — `docs/archive/audits/2026-10-13/workers/testing-documentacion.md` cites the deleted `audits/2026-10-09/kimi-k3-frontend-ventas.md` (removed by `a0a8f65`); all four merge parents already contained it.
- No duplicated sentences in the final deployment.md versions.

## Notes

- `docs/README.md` at #91 lacks the Backups row; it reaches `develop` with #88. At #88 it lacks the Observability row; it reaches with #89. This is chain order, not resolution loss.
- The production URL (`https://ondina-erp.vercel.app`) appears only in the workflows (health.yml `SITE_URL`, deploy-prod.yml summary) after the docs table consolidation; document readers follow the observability runbook instead.
