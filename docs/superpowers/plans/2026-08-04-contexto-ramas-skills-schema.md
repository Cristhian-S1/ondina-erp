# Repository Context And Schema Review Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with verification after each repository change.

**Goal:** Publish the approved repository context across the domain branches, rename `dev` to `develop`, audit local skills against Superpowers, and document the actionable gaps in the v2 schema.

**Architecture:** Keep the existing README content intact and append context sections. Use one shared repository-context commit on the current base, then add a short branch-specific README section on each final branch. Treat the v2 SQL as a proposal: report missing policies, triggers, indexes, and cross-branch integrity rules without guessing authorization semantics.

**Tech Stack:** Git/GitHub, Markdown, PostgreSQL/Supabase SQL, local Beads, Mem0, CodeGraph, Superpowers skills, and repository MCP integrations.

## Global Constraints

- Do not remove or rewrite existing README information.
- Final branches are `main`, `develop`, `feature/ventas`, `feature/bodega`, `feature/produccion`, and `feature/administracion`.
- Delete remote `dev` only after `develop` is published and verified.
- Do not claim an MCP is connected unless the current environment exposes it.
- Do not apply the SQL to a remote Supabase project.
- Do not invent RLS policies where the business authorization model is unresolved.
- Preserve unrelated user changes and generated local databases.

## Tasks

### Task 1: Record repository context

**Files:**
- Create: `docs/superpowers/plans/2026-08-04-contexto-ramas-skills-schema.md`

- [x] Record branch, tooling, skills, MCP, and schema-review scope.
- [x] Record the no-live-MCP limitation and no-deployment constraint.

### Task 2: Add shared README context

**Files:**
- Modify: `README.md`

- [ ] Append a branch context table without changing existing paragraphs.
- [ ] Append the verified local skills and the distinct Superpowers workflow skills.
- [ ] Append CodeGraph, Mem0, Beads, and MCP status.
- [ ] Append a concise schema readiness note that links to the review findings.

### Task 3: Review the v2 schema

**Files:**
- Create: `docs/revision-esquema-v2.md`

- [ ] Identify syntax-level facts from the complete SQL file.
- [ ] Record that RLS is enabled but no policies are defined in v2.
- [ ] Record missing triggers/RPCs for inventory, adjustment windows, audit, and totals.
- [ ] Record missing foreign-key indexes and cross-sucursal constraints that need design confirmation.
- [ ] Separate blockers for application work from follow-up migration work.

### Task 4: Publish branch-specific README context

**Files:**
- Modify: `README.md` on `main`, `develop`, `feature/ventas`, `feature/bodega`, `feature/produccion`, and `feature/administracion`.

- [ ] Add a short role-specific paragraph to each branch without deleting existing content.
- [ ] Keep the shared tooling and skill sections consistent across all six branches.

### Task 5: Rename and verify branches

- [ ] Push the shared base to `main`.
- [ ] Create `develop` from the current `dev` history plus the approved repository changes.
- [ ] Push the four domain branches with the approved repository changes.
- [ ] Delete remote `dev` only after `develop` is visible.
- [ ] Verify all six final branches exist and the old `dev` ref is absent.

### Task 6: Quality gates and handoff

- [ ] Validate Markdown links and SQL structure with available repository tools.
- [ ] Run `git status`, inspect the final diff, and verify branch heads with `git ls-remote`.
- [ ] Close the Beads issue and push all commits, including Beads synchronization changes.
