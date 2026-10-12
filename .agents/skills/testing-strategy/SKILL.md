---
name: testing-strategy
description: Design test strategies and test plans. Trigger with "how should we test", "test strategy for", "write tests for", "test plan", "what tests do we need", or when the user needs help with testing approaches, coverage, or test architecture.
---

# Testing Strategy

Adaptación de engineering:testing-strategy 1.2.0 para Ondina.

Design effective testing strategies balancing coverage, speed, and maintenance.

## Testing Pyramid

```
        /  E2E  \         Few, slow, high confidence
       / Integration \     Some, medium speed
      /    Unit Tests  \   Many, fast, focused
```

## Strategy by Component Type

- **API endpoints**: Unit tests for business logic, integration tests for HTTP layer, contract tests for consumers
- **Data pipelines**: Input validation, transformation correctness, idempotency tests
- **Frontend**: Component tests, interaction tests, visual regression, accessibility
- **Infrastructure**: Smoke tests, chaos engineering, load tests

## What to Cover

Focus on: business-critical paths, error handling, edge cases, security boundaries, data integrity.

Skip: trivial getters/setters, framework code, one-off scripts.

## Output

Produce a test plan with: what to test, test type for each area, coverage targets, and example test cases. Identify gaps in existing coverage.

## Ondina
Use the existing Vitest/Testing Library suite for frontend behavior. Validate RPC, triggers, RLS, roles, another sucursal and stock effects against an isolated database; mocks cannot certify them. Browser flows need an available browser tool and a test account. Refer to [development](../../../docs/desarrollo.md) and [database](../../../docs/base-de-datos.md). Add tests for meaningful risks, not Markdown wording.
