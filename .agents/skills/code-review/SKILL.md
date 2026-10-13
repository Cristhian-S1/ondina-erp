---
name: code-review
description: Review code changes for security, performance, and correctness. Trigger with a PR URL or diff, "review this before I merge", "is this code safe?", or when checking a change for N+1 queries, injection risks, missing edge cases, or error handling gaps.
argument-hint: "<PR URL, diff, or file path>"
---

# Code Review

Adapted from `engineering:code-review` 1.2.0. Review the supplied diff, commit range, PR or file; ask for the target only when it is missing. Consult [tooling](../../../docs/agents/tools.md) for available connections.

## Review

- Establish the intended behavior from the issue/specification and relevant project rules. Use `git diff` for change evidence and CodeGraph before understanding indexed code.
- **Security:** authentication, ownership/role/sucursal authorization, RLS/grants, exposed views/RPC, credentials and unsafe input handling.
- **Correctness:** edge cases, asynchronous races, failed mutations, cancellation, stock reversal, monetary history and data integrity.
- **Performance:** unbounded queries, N+1 work, unnecessary rendering, bundle cost, resource leaks and missing indexes when relevant.
- **Maintainability:** interface clarity, duplication, meaningful tests and documentation for non-obvious decisions.

When connected tools are available, inspect PR requirements and CI results. Do not assume a connector, runtime or production credential is available, and do not infer database correctness from mocked frontend tests.

## Report

Lead with actionable findings, ordered by impact. For each, include the verified file/line, trigger, consequence, evidence and proposed validation. State access limits and untested assumptions; a plausible concern is not a reproduced defect.

Keep the verdict proportional to the evidence. Record durable follow-up work in Beads under the project's workflow. A review request does not itself authorize code edits, external comments or deployment.
