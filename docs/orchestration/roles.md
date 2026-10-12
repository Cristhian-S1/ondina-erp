# Worker Roles and Ownership

This is a capacity catalog, not a default fleet. Models remain the user's choice.

| Area | Slots | Responsibility |
| --- | ---: | --- |
| Coordinator | 1 | Scope, Beads/Orca dependencies, ownership, validation and integration. |
| Frontend | 2 | UI/accessibility and data/services/forms; normally activate one. |
| Backend/Supabase | 2 | Schema/RLS and RPC/integrity/stock; normally activate one. |
| Testing | 1 | Component/browser behavior and real isolated database checks. |
| Documentation | 1 | Requirements, procedures, status evidence and references. |
| CI/CD and operation | 1 | Reproducible checks, releases, recovery and observability. |
| Security/review | 1 | Auth, access, secrets, integrity and independent review. |

**Capacity:** eight worker slots plus one coordinator. **Initial concurrency:** at most three workers plus the coordinator. Reduce it for small work; increase only for independent tasks and an explicit capacity/budget decision.

## Ownership

Assign explicit paths to every implementation task. Reserve one writer for shared client/types, lockfiles, migrations and root rules. Frontend UI/data workers coordinate shared forms; backend schema/RPC workers agree on contracts and migration order.
Testing owns assigned tests/fixtures and returns implementation defects to their owner. Documentation waits for verified decisions/results. Security is read-only by default; a fix requires an explicit task and ownership.
Workers use their own worktrees; a shared database still requires serialized migrations and isolated test data.

## Waves

1. Coordinator confirms scope, contracts, acceptance and dependencies.
2. Independent frontend/backend work proceeds; testing may prepare separate fixtures/tests.
3. Testing/security verify candidates; owners address findings and the coordinator checks the result.
4. Documentation/CI finish relevant delivery work; the coordinator integrates within authorization and settles each attempt.
