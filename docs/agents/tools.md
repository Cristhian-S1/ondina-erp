# Agent Tools

## Instructions and discovery

`CLAUDE.md` imports the common `AGENTS.md`; `.claude/rules/` scopes additional guidance by path. Skills share `.agents/skills/` through relative symlinks. Confirm loaded context with `/context` and connections with `/mcp` in the relevant client.
Codex, Claude Code and OpenCode have independent credentials, MCP and memory configuration. Availability in one client does not establish it in another.

## Beads

Beads is the durable task tracker: `bd prime`, `bd ready`, `bd show`, `bd update --claim`, `bd stats`, `bd close`. Use native blocking edges with `bd dep add <issue> <blocker>`.
Keep acceptance and evidence on the issue; link GitHub with `external_ref` when used. Publish or update external issues only within authorization. Do not create a Markdown tracker or close a parent merely because child tasks were created.
The embedded database and passive exports are local/ignored. Recovery and separate Dolt sync are documented in [.beads/README.md](../../.beads/README.md); never reinitialize the existing database or import a branch's stale export.

## CodeGraph

When `.codegraph/` exists, begin code discovery with `codegraph explore "symbol or question"` or its configured MCP. Use `codegraph sync` to update the existing index and `codegraph status` to inspect it; do not initialize/upgrade it as incidental setup.
An index answers structural questions; compilation, integration tests and runtime evidence establish correctness.

## Mem0 and client configuration

Use the client's configured user identity and project/application filter. Keep credentials and personal conversation history out of Git. The repo declares `@mem0/opencode-plugin`; verify compatibility with the installed client, since [OpenCode 2 changed its plugin API](https://dev.opencode.ai/v2/docs/migrate-v1/). Claude requires its own verified connection rather than inheriting another client's access.
Share portable settings, rules, skills and environment templates. Ignore personal settings, local profiles, caches and databases. Add `.mcp.json` only for real shared servers with environment-based credentials.

## Supervised work

Read [Orca orchestration](../orchestration/README.md) only when requested. Beads tracks product work; Orca Run/Task/Dispatch tracks execution attempts and references the Beads ID. Treat historical memories as dated evidence and use the documentation index for current paths.
