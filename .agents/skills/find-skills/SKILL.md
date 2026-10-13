---
name: find-skills
description: Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for X", "is there a skill that can...", or express interest in extending capabilities. This skill should be used when the user is looking for functionality that might exist as an installable skill.
---

# Find Skills

Discover a reusable capability when the installed catalog does not already cover the user's task.

## Search and evaluate

1. Identify the concrete task and required client/tools; check [installed skills](../../../docs/skills.md) before searching.
2. Search the [Skills registry](https://skills.sh/) or the source project's maintained repository. The [CLI reference](https://skills.sh/docs/cli) documents installation; check the installed CLI's help before relying on version-specific flags.
3. Read the actual instructions and references. Assess task fit, dependencies, maintenance, license and compatibility with Beads, CodeGraph, React/Vite and the chosen agent client. Installs and stars are discovery signals, not evidence of correctness.
4. Present the useful candidates with source, capability and material trade-offs. Avoid installing a broad collection for a single missing capability.

## Installation

Install within the request's authorization. Prefer project scope and the shared `.agents/skills/` source; global installation requires an explicit request. Review the diff before replacing a working skill and verify names, references and discovery afterward.

```bash
npx skills add <owner/repository>
```

Select only the needed skill using options supported by that CLI version. Do not run a bulk update as part of ordinary discovery. If no candidate fits, explain the gap and continue the authorized task with available tools.
