# Worker Roles and Ownership

This catalog records the user's role/model assignment (2026-10-21) for supervised Orca work. It is a capacity catalog, not a default fleet: activate a role only when a task needs it. Model choices belong to the user; do not change them, substitute another model or invent a model ID. Handoffs, human review points and escalation are in [handoffs](handoffs.md).

## Assignment

| Role | Client | Model (user-selected) | Slots | Default access |
| --- | --- | --- | ---: | --- |
| Coordinator | Claude Code | Opus 5.5 (`claude-opus-5-5`) | 1 | Read all; write coordination files only |
| Frontend | Claude Code | Sonnet 5.5 (`claude-sonnet-5-5`) | 2 | Write assigned frontend paths |
| Backend/Supabase | Codex | GPT 6.1 Sol (`gpt-6.1-sol`) | 2 | Write assigned database paths |
| Testing | OpenCode | Client default (DeepSeek v4.1 Flash) | 1 | Write assigned tests/fixtures |
| Documentation | OpenCode | Client default (DeepSeek v4.1 Flash) | 1 | Write assigned docs |
| CI/CD and operation | Codex | GPT 6.1 Sol (`gpt-6.1-sol`) | 1 | Write assigned workflow/ops paths |
| Security/review | Claude Code | Sonnet 5.5 (`claude-sonnet-5-5`) | 1 | Read-only |

The IDs in parentheses are the ones this session's client documents; verify each against the client before launch and compare `launch.requested` with `launch.effective` ([clients](clients.md)). For the OpenCode roles, do not pass a model override: confirm that the effective default is DeepSeek v4.1 Flash and stop if it is not. If Codex quota is exhausted, ask the user before any fallback (the user's standing fallback is Haiku 5.5 for Codex roles, only while the quota is exhausted).
The ignored `profiles.local.json` predates this assignment (it lists a Sonnet coordinator, Codex frontend/security and OpenCode CI/CD). Reconcile it with this table before dispatch; neither profile file is native Orca configuration.

**Capacity:** eight worker slots plus one coordinator. **Initial concurrency:** at most three workers plus the coordinator. Reduce it for small work; increase only for independent tasks and an explicit capacity/budget decision.

## Role contracts

Every role reads `AGENTS.md`, its Beads issue and the [task specification](task-template.md). "Done" always includes a runtime `worker_done` for the active Dispatch with the report listed under Outputs; terminal liveness or a commit alone is not completion.

### Coordinator

- **Responsibilities:** select an independent wave from Beads, write each task specification, assign exclusive paths, verify effective models, answer worker questions, validate deliveries, integrate authorized changes into `develop` by cherry-pick and keep Beads current.
- **Inputs:** user request and authorization scope, Beads issues/dependencies, [story status](../status/user-stories.md), requirements, worker reports.
- **Outputs:** task specifications, settled Dispatches, integration commits within scope, Beads updates, a wave summary for the user.
- **Allowed files:** `docs/orchestration/**`, Beads state, and integration commits of already reviewed worker changes. No application code authored by the coordinator.
- **Done:** every Dispatch in the wave is settled; integrated changes passed the role's checks and security review where required; Beads reflects the verified result; open questions are listed for the user.

### Frontend

- **Responsibilities:** pages, components, hooks, forms, domain services (`api.ts`), Zod schemas and colocated unit tests, following [frontend conventions](../engineering/frontend.md) and the domain layout in `CLAUDE.md`.
- **Inputs:** task specification, the database contract (tables/RPC/policies) agreed with Backend, regenerated types, story acceptance criteria.
- **Outputs:** branch with the change and its colocated tests; report with lint/build/test results and responsive checks (375/768/1280 px).
- **Allowed files:** the assigned `frontend/src/domains/<domain>/**` paths; `frontend/src/components/**` and `frontend/src/lib/**` only when listed in the task. Never `frontend/src/types/database-generated.types.ts`, `package.json`/`package-lock.json`, `vercel.json` or `supabase/**` unless the task grants that path explicitly.
- **Done:** `npm run lint`, `npm run build` and `npm run test` pass from `frontend/`; no direct Supabase client use outside `api.ts`; stock, cancellation and audit logic not reimplemented in the frontend.

### Backend/Supabase

- **Responsibilities:** migrations, RLS/grants, RPC, triggers, Storage buckets and policies, Edge Functions, pgTAP tests and regenerated types, following [database](../engineering/database.md).
- **Inputs:** task specification, current migrations, `bd/` design, the security contract for identity/role/sucursal.
- **Outputs:** branch with migration(s), pgTAP tests and regenerated `database-generated.types.ts`; report with local reset/test results and the contract the frontend consumes.
- **Allowed files:** `supabase/migrations/**` (one writer per wave), `supabase/tests/**`, `supabase/functions/**`, `supabase/config.toml` when granted, `bd/**` design notes, `frontend/src/types/database-generated.types.ts` (sole writer).
- **Done:** migrations apply on a clean local stack; pgTAP passes, including foreign-identity, wrong-sucursal and wrong-role cases; no production `supabase db push` or remote change; secrets referenced only by name.

### Testing

- **Responsibilities:** integration and browser tests, role journeys against an isolated local Supabase, fixtures with synthetic data; reproduce and report defects.
- **Inputs:** candidate branch, acceptance criteria, contracts from Frontend/Backend.
- **Outputs:** tests and fixtures in owned paths; a report mapping each acceptance criterion to a passing/failing test; defect notes returned to the owning role.
- **Allowed files:** `frontend/tests/**`, assigned `*.test.ts(x)` files not being edited by an implementer in the same wave, `supabase/tests/**` only when granted. Implementation fixes go back to the owner.
- **Done:** every acceptance criterion has a named test or a recorded manual check with result; suite passes or failures are filed as defects; no real customer or supplier data in fixtures.

### Documentation

- **Responsibilities:** story status, procedures, operational and decision records after a decision or result is verified.
- **Inputs:** coordinator-approved results, Beads evidence, merged diffs.
- **Outputs:** documentation diff and a list of verified references.
- **Allowed files:** assigned paths under `docs/**` (not `docs/orchestration/**` unless granted), `README.md` files. Never application code.
- **Done:** English for engineering text, Spanish business wording preserved; links resolve; dates and evidence sources recorded; no unverified acceptance claim.

### CI/CD and operation

- **Responsibilities:** GitHub Actions, Vercel configuration, security headers, backups/recovery rehearsal, observability, following [deployment](../engineering/deployment.md), [security](../engineering/security.md) and [observability](../engineering/observability.md).
- **Inputs:** task specification, current workflows, provider settings documented by the user.
- **Outputs:** workflow/config diff and a dry-run or CI evidence report.
- **Allowed files:** `.github/**`, `frontend/vercel.json` when granted, `docs/engineering/{deployment,security,observability,backups}.md` when granted.
- **Done:** workflows validate and the relevant CI run passes on the branch; no secrets in Git; production deploys, secret changes and provider settings are left as human actions.

### Security/review

- **Responsibilities:** independent review of candidate diffs for auth, RLS/grants, Storage access, secrets, data privacy and integrity; uses the `code-review`/`security-review` skills.
- **Inputs:** candidate diff, contracts, test evidence.
- **Outputs:** findings ranked by severity with file/line and a pass/block verdict.
- **Allowed files:** none (read-only). A fix needs an explicit task assigned to the owning role.
- **Done:** verdict recorded for every candidate touching auth, RLS, Storage, external integrations or personal data; blocking findings are resolved or accepted by the user.

## Ownership

Assign explicit paths to every implementation task. Reserve one writer for shared client/types, lockfiles, migrations and root rules. Frontend workers coordinate shared forms; Backend workers agree on contracts and migration order.
Workers use their own worktrees from `origin/develop`; a shared database still requires serialized migrations and isolated test data.

## Waves

1. Coordinator confirms scope, contracts, acceptance and dependencies.
2. Backend lands the contract first when the frontend depends on it; independent frontend/backend work proceeds in parallel; testing may prepare separate fixtures.
3. Testing and Security/review verify candidates; owners address findings and the coordinator checks the result.
4. Documentation and CI/CD finish delivery work; the coordinator integrates within authorization and settles each attempt.
