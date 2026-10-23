# Handoffs, Review and Escalation

Applies to the roles in [roles](roles.md). Orca's runtime protocol (Run/Task/Dispatch, `worker_done`, `question`, `escalation`) carries every handoff; the selected executable's guide is authoritative for command syntax.

## Handoff rules

1. **Coordinator → worker:** a complete [task specification](task-template.md) with Beads ID, role, verified model, exclusive paths, contract, acceptance criteria and validation commands. A worker without exclusive paths does not start.
2. **Backend → Frontend:** the contract (table/RPC/Storage path names, argument and error shapes, policies) plus regenerated `database-generated.types.ts`, delivered as a reviewed branch. Frontend starts against that branch, not against an assumed schema.
3. **Implementer → Testing:** branch name/commit, the acceptance criteria covered and how to run the change locally. Testing returns defects to the implementer through the coordinator; it does not patch implementation files.
4. **Candidate → Security/review:** required for any change to auth, RLS/grants, Storage, Edge Functions, external integrations, secrets handling or personal data. The reviewer returns pass/block with findings.
5. **Verified result → Documentation:** only after the coordinator accepts the result; documentation cites the Beads issue and the evidence date.
6. **Worker → Coordinator:** `worker_done` with changed files, commands run with results, limits and open questions. The coordinator validates the diff and evidence before settling the Dispatch.
7. **Integration:** worker branches reach `develop` by cherry-pick of reviewed commits, not by merge, preserving other sessions' work.

## Human review points

The coordinator stops and asks the user before:

- approving scope for a story marked as a decision (`question` label) or changing acceptance criteria;
- any migration that changes existing tables or policies, and before any remote database action (`supabase db push`, `apply_migration`, branch merge) — see [database](../engineering/database.md);
- creating or changing secrets, provider accounts (Meta/WhatsApp, Vercel, Supabase), paid services or data-retention rules;
- adding or upgrading dependencies;
- push, pull request, deployment, issue closing or GitHub comments;
- switching a role's model or client, including the Codex-quota fallback;
- accepting an unresolved Security/review block.

## Escalation

A worker sends `question` (blocking) or `escalation` to the coordinator when:

- the task needs a path it does not own, a dependency, or a schema change outside its contract;
- the effective model differs from the assignment, or the client cannot start (quota, login, hook review prompt);
- acceptance criteria conflict with code, requirements or another task;
- a validation command fails twice for a reason outside the task;
- data could leave the system (external API, sharing, export) or real personal data would be needed.

The coordinator resolves the question within the authorized scope or forwards it to the user. Stop a worker after three failed attempts at the same step and report the evidence instead of retrying. For `outcome_unknown` or timeouts, inspect the worker and follow the guide's recovery action.
