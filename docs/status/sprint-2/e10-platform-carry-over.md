# E10 — Platform Carry-over (Parallel Track)

[Sprint 2 index](README.md)

## Objective

Finish the stabilization items that gate a safe Sprint 2 release, mainly the remote application of the new migrations.

## Covers

- #39 (OND-get): Vercel publication and required checks.
- #41 (OND-5gi.10): backup verification and recovery rehearsal (G1 gate).
- #44 (OND-d40): Supabase Auth recovery, sessions and protection.
- #46 (OND-o5g, in progress): CI secrets and dependency chain.
- #54 (OND-5a4, in progress): observability and alerts.
- #86, OND-c07.23 and OND-c07.24: mobile UX residue.

**Roles:** CI/CD and operation (#39, #41, #46, #54); Security/review (#44, #46); Frontend (#86, c07.24); Backend (c07.23, the RPC for inactive sellers' names).
**Depends on:** nothing. Use at most one slot so the three-worker cap holds.

## Options

| Option | Pros | Cons | Effort |
| --- | --- | --- | --- |
| A. One CI/CD slot running continuously alongside feature stages | #41 is ready before the first remote migration; steady progress | Permanently consumes one of three slots | M–L over the sprint |
| B. Dedicated stabilization wave before the feature stages | Clean baseline | Delays every story | M |
| C. Close only #41 and #44 in Sprint 2; move the rest to Sprint 3 | Smallest scope | CI and observability gaps persist | S–M |

**Recommendation: A, ordered #41 → #46 → #39 → #44 → #54 → UX residue.**
- #41 gates every remote migration from E2–E9.
- #46 and #39 protect the delivery pipeline those stages use.
- #44 overlaps E2 (Auth), so schedule it next to E2 with a single owner for Auth configuration.

## Acceptance criteria

- [ ] A restore rehearsal from backup is recorded in Beads with date, duration and data check, before any remote migration from E2–E9.
- [ ] Each listed issue meets its own acceptance criteria with linked CI run or rehearsal evidence.
- [ ] No secret appears in Git (`gitleaks` or the existing security workflow passes).
- [ ] For frontend items: `npm run lint`, `npm run build` and `npm run test` pass from `frontend/`.

## Verification

- CI runs on each branch and the security workflow results.
- The recorded rehearsal for #41.
- For #86: checks at 375, 412×915, 768 and 1280 px, as the issue asks.

## Risks

- Provider settings (Vercel, Supabase Auth, alerts) are human actions; prepare the steps, but the user applies them.
- Without #41, finished stories cannot reach the remote database, so the sprint result would stay local.
