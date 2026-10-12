# Beads in Ondina

The embedded Dolt database in `.beads/embeddeddolt/` owns issues with prefix `OND`. Git tracks portable configuration/hooks; machine metadata, database files and passive exports remain ignored.

## Recover and work

```bash
bash scripts/bootstrap-beads.sh
bd prime
bd stats
bd ready
```

The bootstrap validates an existing database without reinitializing it, or restores a fresh clone with `bd bootstrap --yes`. It installs hooks, sets a contributor role only when missing, and preserves the final config newline omitted by bd 1.0.4. `bd` must be on PATH; no external Dolt server is needed in embedded mode.

## Configuration and sync

- `repos.primary: "."`; retain the agreed remote and do not add another repository as incidental setup.
- `import.auto: false` prevents stale branch exports from reviving old state.
- `export.auto: true` and `export.git-add: false` keep JSONL as a passive local export.
- Dolt sync uses `refs/dolt/data` on `git+ssh://git@github.com/Cristhian-S1/ondina-erp.git`: `bd dolt pull` / `bd dolt push`. Code `git push` does not publish the issue database.

Public Dolt publication was authorized on 2026-10-09. Sync changes within that scope; never put credentials or unrelated personal data in task records. Do not treat a skipped remote or failed push as success.

## Diagnose safely

Use `bd stats`, `bd ready`, `bd lint`, `bd orphans`, `bd hooks list` and `bd dolt remote list`. Do not use `bd init --force` or reimport a branch's JSONL to repair an existing database.
For this verified embedded installation, `bd statistics` is absent and `bd doctor`/`bd dolt test` do not establish database health. A federation/external-Dolt config error alone does not prove corruption.
Keep backups private and compare issues/memories after restoration. Generic `bd prime` closeout defaults do not override the user's commit/publication scope; see [agent tools](../docs/agents/tools.md).
