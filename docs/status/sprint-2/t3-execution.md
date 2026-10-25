# T3 Execution Plan — Bodega, Platform and GPS

[Sprint 2 index](README.md) · Owner: Cristhian-S1 · Prepared 2026-10-25 on `develop` at `42042e8`.

Supervised Orca execution of the T3 share of Sprint 2 (E5, E8, E10), ordered from the smallest to the largest item. Roles and models follow [roles](../../orchestration/roles.md); handoffs and human gates follow [handoffs](../../orchestration/handoffs.md).

## Re-baseline (verified 2026-10-25)

The E10 text predates these facts; they change the order and scope.

| Item | Verified state | Remaining T3 work |
| --- | --- | --- |
| #41 / OND-5gi.10 | G1 ran 2026-10-13 (fresh backup, repair, push of 5 deltas, validation); Beads notes only the production environment approval as pending | Confirm a restore rehearsal is recorded; human approval |
| #46 / OND-o5g | Repository work merged (PR #87, `e9eac74`, `3ced55a`) | Verify live checks; Vercel secret migration and required Security check are human settings |
| #54 / OND-5a4 | Repository work merged (PR #89) | Monitoring identity, secrets/notifications and alert rehearsal are human settings |
| #39 / OND-get | `develop` now requires the CI and migration checks (`enforce_admins=false`) | Gate deploys on CI for every path; versioned rollback |
| #86 | N-01, N-02, R1-12 and R2-13 closed (OND-c07.13, PR #84) | Only OND-c07.23 and OND-c07.24 |
| OND-c07.23 | Reviewed proposal `docs/archive/audits/2026-10-15/frontend-c07-13/R1-14-propuesta.md` (additive RPC `vendedores_historial_sucursal`) | Migration, pgTAP, types, then frontend label |
| OND-c07.24 | `DashboardLayout.tsx:40` keeps `mobileOpen` across breakpoints | Reset on breakpoint change plus test |
| #66 HU-26, #67 HU-29 | See [E5](e05-bodega-adjustments-and-losses.md) | RPC + UI; HU-29 needs the reconciliation formula ratified |
| #64 HU-16 | Decision pending ([E8](e08-map-and-gps.md)) | Not started without user approval |

## Waves (at most three workers)

| Wave | Worker | Role / client | Task | Size |
| --- | --- | --- | --- | --- |
| W1 | A | Frontend / Claude Code Sonnet 5.5 | OND-c07.24 mobile menu reset | XS |
| W1 | B | CI/CD / Codex GPT 6.1 Sol | Read-only verification of #41, #46, #54, #39; list of human actions; #39 repo-side plan | S |
| W1 | C | Backend / Codex GPT 6.1 Sol | OND-c07.23 migration + pgTAP + regenerated types | S–M |
| W2 | D | Frontend / Claude Code Sonnet 5.5 | OND-c07.23 UI ("Nombre (inactivo)") on C's branch | S |
| W2 | E | Security / Claude Code Sonnet 5.5 | Review of C (RPC, grants, exposure) | S |
| W2 | F | Testing / OpenCode default | Browser/role checks for A and D at 375/412/768/1280 | S |
| W3 | G | CI/CD / Codex | #39 deploy gating and rollback | M |
| W3 | H | Backend / Codex | HU-26 `ajustar_despacho` RPC + pgTAP | M |
| W4 | I | Frontend / Claude Code | HU-26 UI on H's branch | M |
| W4+ | — | Backend + Frontend | HU-29 after the formula is ratified | M–L |
| — | — | Documentation / OpenCode default | Story status and E10 evidence after each accepted result | S |

## Progress (Orca Run `run_2840182c9f21`, 2026-10-25)

Every Task settled with `succeeded`. All commits are integrated by cherry-pick on `feature/T3` and pushed to `origin/feature/T3`; none is on `develop` (`develop` matches `origin/develop`). They reach `develop` only through a PR from `feature/T3`. The SHAs below are the `feature/T3` SHAs.

| Item | Result | Commits on `feature/T3` | Evidence |
| --- | --- | --- | --- |
| OND-c07.24 | Done (Beads closed) | `f502994`, `c3a9c31` | 879 tests; browser report `docs/archive/audits/2026-10-25/frontend/c07-24/` |
| OND-c07.23 | Done (Beads closed); Security PASS | `6bb0414`, `923e642`, `21f5603`, `dba7023`, `d66dacb` | 677 pgTAP; browser report `.../frontend/c07-23/` |
| #39 step 1 | Release receipts | `9f055fa`, `5e33efd` | actionlint 1.7.7 |
| #41, #46, #54, #39 | Verified state, human actions listed | `e2c627d` | `docs/archive/audits/2026-10-25/operacion/T3-platform-state.md` |
| HU-26 (#66) | Backend + UI; Security PASS | `a1e66b2`, `764d8d0`, `bba939b`, `43a3bb2` | 711 pgTAP, 937 tests, browser report `.../frontend/hu26/` |
| HU-26 window | Configurable window (default 15, CHECK 5–60 instead of the client's passing 10–20 idea), server clock for the hint; Security PASS | `7479dbc`, `51e7b53`, `e7ccba2`, `3bf9b54`, `6030115`, `46a0447` | pgTAP 008; remote value `'15'` conforms |
| #39 step 2 | Publishers require the exact-SHA CI and Security result; step 3 (artifact promotion) deferred by documented decision | `0da8152` | `docs/engineering/deployment.md` |
| HU-29 (#67) | Backend, UI, hardening (design §3 items 2–4 and review F1–F5, approved 2026-10-25); Security PASS + re-verification PASS | `9398a30`, `f395e28`, `ccafbda`, `002d12e`, `094f397`, `590d281`, `91c57dc` | 919 pgTAP (009: 175, 0 SKIP), concurrency 6/6, 1041 tests, browser 18/18 `.../frontend/hu29/`, reviews `.../backend/hu29-*review*.md` |

Gates on `feature/T3` at `91c57dc` without `frontend/.env`: lint 0, build 0, vitest 81 files / 1041 tests. Two workers each saw one intermittent vitest failure that did not reproduce.

Waiting on the user: PR `feature/T3` → `develop`; remote `supabase db push` of `20261025175810`, `20261025180901` and `20261025223257` behind the gates in `docs/engineering/database.md`; owner settings in GitHub/Vercel (`docs/archive/audits/2026-10-25/operacion/T3-platform-state.md`); closing #86 after the merge; HU-16 (#64) decision. HU-29 follow-ups (LOW/INFO) are in Beads OND-w76.10.

## Rules for this track

- Each worker uses its own worktree from `feature/T3` and only its listed paths. One migration writer per wave; one Docker user at a time (the local Supabase containers share names).
- Local Supabase only (`supabase db reset`, `supabase test db`); no `supabase db push`, deploy, secrets or provider settings.
- Workers commit locally on their branch. The coordinator validates, then integrates into `feature/T3` by cherry-pick and pushes `feature/T3`. `develop` is left to the other two team members; PRs and `develop` changes need the user's approval.
- Frontend checks from `frontend/`: `npm run lint`, `npm run build`, `npm run test`.
