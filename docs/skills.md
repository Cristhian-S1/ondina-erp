# Project Skills

The canonical source is `.agents/skills/`; `.claude/skills/` provides relative symlinks for Claude. Load the skill relevant to the task rather than importing the catalog's contents.

| Task | Skills |
| --- | --- |
| Durable tasks, blockers and recovery | `beads` |
| Supabase/Auth and PostgreSQL | `supabase`, `supabase-postgres-best-practices` |
| React/Vite performance | `vercel-react-best-practices` |
| Module/interface design | `codebase-design` |
| Domain terms and architectural decisions | `domain-modeling` |
| Tests and review | `testing-strategy`, `code-review` |
| Clarification and exploration | `ask-matt`, `grill-with-docs`, `prototype`, `improve-codebase-architecture` |
| Specification, task breakdown and handoff | `to-spec`, `to-tickets`, `handoff` |
| Check setup or discover a missing capability | `setup-matt-pocock-skills`, `find-skills` |
| Orca worktrees and supervised execution | `orca-cli`, `orchestration` |

## Upstream and project adaptations

Comparison baseline: `main` commit `38b60b0`, checked on 2026-10-12. Six original skills retain their upstream content: beads, codebase-design, domain-modeling, handoff, prototype and supabase-postgres-best-practices.
Nine original skills retain project adaptations: installed-skill routing, self-contained clarification, proportionate specs, vertical slices with Beads dependencies, idempotent setup, source-based discovery, CodeGraph-first exploration, isolated Supabase writes and React/Vite applicability.
The four additions are code-review/testing-strategy, adapted from engineering 1.2.0, and the unchanged installed Orca discovery stubs. All 19 entrypoints use English; vendor reference files and existing metadata/invocation policies are preserved.

## Invocation and maintenance

`disable-model-invocation` remains on the explicitly invoked workflows. OpenCode 2 also recognizes it, but `metadata.opencode/autoinvoke` can override it; verify the installed version and permissions using its [skill documentation](https://dev.opencode.ai/v2/docs/skills/).
Check YAML, names, references and actual discovery before replacing a skill. Valid frontmatter does not certify every workflow or connected service. Read [tooling](agents/tools.md) for client-specific setup and [archived review](archive/audits/2026-10-12/skills-del-proyecto.md) only for earlier decisions.
