# Claude Code and OpenCode Clients

Orca owns workspaces, execution and the message/lifecycle protocol. Claude Code and OpenCode are agent clients; providers/models are configured for the client running each role. Claude can coordinate OpenCode without sharing its MCP, credentials or memory automatically.

## Instructions and tools

Claude uses `CLAUDE.md` and its imported common instructions, path-scoped rules and shared skill symlinks. OpenCode retains its existing configuration/plugins and discovers the shared `.agents/skills/` source.
Check `opencode --version` and the installed CLI/API documentation before choosing a diagnostic. OpenCode 2 removed the V1 `debug skill`/`--pure` commands. Inspect the registered catalog through its skill API with the intended project location, and verify returned paths/content rather than accepting a global catalog as project discovery.
OpenCode 2 recognizes `disable-model-invocation`; its `metadata.opencode/autoinvoke` can override that setting. Verify version-specific behavior and permissions; the worker specification retains explicit workflow and authorization boundaries.

## Model overrides

Leave models unset until chosen by the user, then verify the exact available ID and client/host support. Compare `launch.requested` with `launch.effective`; arguments alone do not establish the effective model.
The installed guide permits `--model` for a new Claude terminal; `--effort` requires a supported model. OpenCode's documented override requires an existing worktree and host validation, and does not accept `--effort`. Reload the version-matched guide before relying on these constraints.

Workers ask blocking questions through the Dispatch preamble and retain exact Run/Task/Dispatch/terminal identities. The coordinator verifies results before integration/publication; a chosen model does not replace evidence.

Sources: [Claude instructions](https://code.claude.com/docs/en/memory), [OpenCode 2 agents](https://dev.opencode.ai/v2/docs/agents/) and [skills](https://dev.opencode.ai/v2/docs/skills/), plus the selected Orca executable's guide.
