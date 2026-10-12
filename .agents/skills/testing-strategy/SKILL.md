---
name: testing-strategy
description: Design test strategies and test plans. Trigger with "how should we test", "test strategy for", "write tests for", "test plan", "what tests do we need", or when the user needs help with testing approaches, coverage, or test architecture.
---

# Testing Strategy

Adapted from `engineering:testing-strategy` 1.2.0. Select tests by behavior, risk and layer, balancing confidence with execution and maintenance cost.

## Test surfaces

| Layer | Evidence to collect |
| --- | --- |
| Pure logic | Validation, formatting, calculations, boundary and error cases through public interfaces. |
| React components/services | Vitest and Testing Library for user interactions, failed mutations, loading and session changes. |
| PostgreSQL/Supabase | Real isolated integration tests for RPC, triggers, RLS/grants, cross-sucursal access, concurrent stock changes and exactly-once reversal. |
| Browser | Authenticated critical flows by role, direct navigation, accessible forms and tablet layouts with a test account. |
| CI/operation | Reproducible checks and deployment/recovery verification when that behavior changes. |

Mocked Supabase calls do not certify database authorization or transaction integrity. Confirm the test environment before writes; never use production as a fixture. Use the available browser tooling; when Playwright MCP is unavailable, Computer Use can collect manual flow evidence.

## Deliverable

State the behavior at risk, the test type and environment, observable success/failure, necessary fixtures and existing coverage gaps. Prefer focused regression tests and realistic integration checks over arbitrary coverage percentages or tests of Markdown wording.

Use the existing runner and dependencies unless a missing capability warrants a separate implementation decision. Read [development](../../../docs/engineering/development.md) and [database](../../../docs/engineering/database.md) for project constraints.
