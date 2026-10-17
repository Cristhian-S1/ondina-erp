# Mem0 plugin for OpenCode v2 (project-local port)

Local port of [`@mem0/opencode-plugin`](https://www.npmjs.com/package/@mem0/opencode-plugin)
0.4.1 (Apache-2.0, `mem0ai/mem0`) to the **OpenCode v2 plugin API**.

## Why this port exists

Every published version of `@mem0/opencode-plugin` (0.1.0 – 0.4.1) implements the
**v1** plugin API: the module default-exports a function that returns a hook map.
OpenCode v2 requires the default export to be a definition object
(`{ id, setup(ctx) }`, i.e. `Plugin.define`); v1 implementations do not run in v2.
The server rejected the package on load with:

```
PluginModule.LoadError: Plugin must export a default definition with an id
and an effect or setup function. (SchemaError(Expected object at ["default"]))
```

Upstream tracking issue: [mem0ai/mem0#7602](https://github.com/mem0ai/mem0/issues/7602).

## What it provides

- **Tools** (JSON Schema, registered via `ctx.tool.transform`):
  `add_memory`, `search_memories`, `get_memories`, `get_memory`, `update_memory`,
  `delete_memory`, `delete_all_memories`, `delete_entities`, `list_entities`,
  `get_event_status`.
- **Automatic context injection** (`ctx.session.hook("context")`): project
  guidance, prior session state and semantically relevant memories are injected
  into the model call as a `## Mem0 Memory Context` system block.
- **Session lifecycle**: memory recall per user prompt, remember/resume detection,
  auto-capture every 3rd prompt, session state saved before compaction and
  memory context preserved across compaction.
- **Environment for shell tools** (`ctx.shell.hook("create.before")`):
  `MEM0_USER_ID`, `MEM0_APP_ID`, `MEM0_SESSION_ID`, `MEM0_BRANCH`, `MEM0_GLOBAL_SEARCH`.
- **`MEMORY.md` write guard** (`ctx.tool.hook("execute.before")`): writing memory
  files is blocked in favour of the `add_memory` tool.
- **Skills and slash commands**: the 7 mem0 skills vendored under `skills/` are
  registered as skills and as `/mem0-*` commands.

## Identity and scopes

| Value     | Default                            | Override        |
| --------- | ---------------------------------- | --------------- |
| `user_id` | OS username (`cristhian`)          | `MEM0_USER_ID`  |
| `app_id`  | `owner-repo` from the git remote (this repo: `Cristhian-S1-ondina-erp`) | `MEM0_APP_ID` |
| `run_id`  | generated per plugin load          | –               |

Scopes: `project` (default, `user_id` + `app_id`), `session` (`+ run_id`) and
`global` (reads across projects). `/mem0-scope` changes the default scope
persisted in `~/.mem0/settings.json`.

## Credentials

`MEM0_API_KEY` from the environment, falling back to a `MEM0_API_KEY=...` line
in `~/.zshrc`, `~/.bashrc`, `~/.zprofile`, `~/.bash_profile` or `~/.profile`.
Text sent to mem0 is redacted for common credential patterns before leaving the
machine.

## Layout

```
index.ts       plugin implementation (zero runtime dependencies, fetch-based)
index.test.ts  test suite (bun test)
skills/        vendored mem0 skills (Apache-2.0, from @mem0/opencode-plugin 0.4.1)
```

The plugin is discovered automatically from `.opencode/plugins/` by OpenCode v2.
The npm package entry was removed from `.opencode/opencode.json` because it can
never load on v2.

## Tests

```sh
bun test ./.opencode/plugins/mem0/index.test.ts
```
