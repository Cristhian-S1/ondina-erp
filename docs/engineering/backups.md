# Backups, PITR and Recovery (Supabase)

Status 2026-10-14. Decision recorded in GitHub #41 / Beads OND-u8c and OND-uxi: managed backups and
point-in-time recovery (PITR) require the Supabase **Pro** plan, which is not contracted for now, so
OND-uxi stays deferred. This page is the interim operations runbook (manual logical dumps plus a
rehearsed local restore) and the requirement list for the Pro upgrade. It is documentation, not a
claim that the procedures have been run against production; the 2026-10-13 remote rehearsal evidence
is referenced in [reconciliation](../../supabase/reconciliation.md).

Related pages: [database](database.md), [deployment](deployment.md), [auth configuration](auth.md).

## 1. Current state — free plan (checked against official documentation, 2026-10-14)

- The project runs on the Supabase **Free** plan. Per [Supabase pricing](https://supabase.com/pricing)
  (retrieved 2026-10-14): automatic backups — Free: *not included*; Pro: daily backups kept 7 days
  (Team: 14). PITR — Free: *not included*; Pro/Team: paid add-on, *$100 per month per 7 days retention*.
  Free projects are paused after 1 week of inactivity.
- Per [Database Backups](https://supabase.com/docs/guides/platform/backups) (retrieved 2026-10-14):
  daily managed backups cover Pro, Team and Enterprise projects only. For free projects Supabase
  recommends exporting regularly with the CLI `db dump` command and keeping off-site backups.
  Deleting a project permanently deletes its stored backups too.
- Consequence: there is no downloadable managed backup, no PITR and no automatic restore path today.
  The data-loss window equals the time since the last manual dump; keeping the window small depends
  entirely on the schedule in section 2.
- Known coverage limits from the same page: database backups never include Storage API objects (only
  metadata — a restored backup does not bring back objects deleted after it), and daily backups do
  not store custom-role passwords. The project has no Storage buckets today; if Storage is adopted,
  object copies must be arranged separately (this is an open OND-uxi acceptance criterion).

## 2. Manual backup procedure (CLI 2.111.0, verified locally 2026-10-14)

The CLI runs `pg_dump` in a container ([CLI reference](https://supabase.com/docs/reference/cli/supabase-db-dump))
and adds Supabase-specific filtering: the **schema** dump excludes Supabase-managed schemas (auth,
storage, extension schemas) while the **data** dump carries `auth` rows, and reserved platform roles
are stripped from the role dump. The canonical three-file backup is documented by Supabase in
[Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
The CI guide at [docs/guides/deployment/ci/backups](https://supabase.com/docs/guides/deployment/ci/backups)
adds the repository rule: *never back up your data to a public repository*.

Prerequisites: Docker running, CLI 2.111.0 (the version pinned in `.github/workflows/ci.yml`), and the
target connection string only as an environment variable — never written into the repository:

```bash
export SUPABASE_DB_URL='postgresql://postgres:<PASSWORD>@db.<project-ref>.supabase.co:5432/postgres'
BACKUP_DIR="$HOME/backups/ondina/$(date +%F)"   # outside every repository worktree
mkdir -p "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR"
```

Three separate files — roles first, then schema, then data:

```bash
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$BACKUP_DIR/roles.sql" --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$BACKUP_DIR/schema.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$BACKUP_DIR/data.sql" --use-copy --data-only \
  -x "storage.buckets_vectors" -x "storage.vector_indexes"
```

CLI 2.111.0 flag notes (verified with `--help` and by running the commands against the local stack;
no `--schema-only` flag exists — a schema-only dump is the default form):

| Flag | Effect |
| --- | --- |
| *(none)* | Dumps schema only (DDL, RLS policies, functions, views, sequences). |
| `--data-only` | Dumps only rows, wrapped with `SET session_replication_role = replica` so restoring does not fire triggers or re-derive stock/audit. |
| `--role-only` | Dumps role settings; platform-reserved roles are stripped. |
| `--use-copy` | Uses `COPY` instead of `INSERT` (faster, as in the official guide). |
| `-x <schema.table>` | Excludes the given table from the data dump. |

Verified local output (2026-10-14, local stack, no remote credentials — sizes and coverage only):

- `roles.sql` — 370 B: `ALTER ROLE` statement-timeout settings for `anon`/`authenticated`/`authenticator`
  and one `GRANT SET ON PARAMETER`; no custom application roles exist.
- `schema.sql` — 141 kB: 24 `CREATE TABLE IF NOT EXISTS` (23 `public` tables + 1 `private`), the
  `private` schema, extensions `pg_net`, `btree_gist`, `pg_stat_statements`, `pgcrypto`,
  `supabase_vault`, `uuid-ossp`, plus policies/functions/views. `auth`, `storage` and
  `supabase_functions` tables are absent (platform-managed; they must pre-exist in the target).
- `data.sql` — 2.4 MB: `COPY` rows for all 23 `public` tables, 22 `auth` tables (including
  `auth.users`), `private.solicitudes_devolucion`, 5 `storage` tables and `supabase_functions.hooks`;
  the platform ledgers `storage.migrations` and `supabase_functions.migrations` are excluded.

Where to store, every time:

- Outside every repository worktree; never in Git (secret scanning and push protection exist, but do
  not rely on them). Directory `700`, files `600`.
- Encrypt before leaving the machine, and record a checksum for tamper evidence:

  ```bash
  tar czf - -C "$BACKUP_DIR" . | age -r "$BACKUPS_RECIPIENT" > "$BACKUP_DIR.tar.gz.age"
  sha256sum "$BACKUP_DIR"/*.sql
  ```

  `gpg --encrypt` is an equivalent alternative. Custody of the encryption keys and the off-site copy
  destination: **decide el responsable**.
- Frequency (proposal, pending ratification — **decide el responsable**): a fresh three-file dump is
  mandatory immediately before every remote database change (migration push, project or auth/storage
  configuration change), and a scheduled full set at least weekly (daily data-only is better) until
  the Pro plan provides managed backups. A cron job or a GitHub Action on a private runner can
  schedule it; the output must still land outside Git.

## 3. Restore into an isolated local target (rehearsed 2026-10-14)

Canonical restore, one psql session per the official guide — roles, then schema, then data with
triggers disabled:

```bash
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql --dbname "$TARGET_DB_URL"
```

Target requirements (all verified locally on 2026-10-14, CLI 2.111.0):

- The platform-managed pieces must pre-exist in the target: schemas `auth`, `storage`,
  `supabase_functions`, `extensions`, `vault` and the `supabase_realtime` publication. Any real
  Supabase project — new or existing — already has them; an empty scratch database does not.
- The local stack's `postgres` role is not a superuser and fails in `roles.sql`
  (`permission denied for parameter log_min_messages`); the stack superuser `supabase_admin`
  succeeds. On the platform follow the official guide's connection string; if that single grant
  fails, apply `roles.sql` as the platform superuser or drop that one line — the two application
  settings (`statement_timeout` for `anon`/`authenticated`) can also be re-applied manually.
- Vault/column-encryption caveat from the official guide: dump files hold only encrypted data; copy
  the root encryption key from the old project before it is paused or deleted, or restored secrets
  cannot be decrypted. The project does not use Vault today.
- A dump/restore does **not** carry the `supabase_migrations` migration ledger. To keep the CLI
  migrations workflow in the restored target, dump it separately (`--schema supabase_migrations`,
  then its data) per the official guide.

Verified scratch-database rehearsal (local stack, no remote credentials):

```bash
docker cp roles.sql supabase_db_ondina-erp:/tmp/roles.sql    # schema.sql, data.sql likewise
docker exec supabase_db_ondina-erp psql -X -q -U supabase_admin -d postgres \
  -c 'drop database if exists restore_rehearsal' -c 'create database restore_rehearsal'
# Platform scaffolding from the local stack itself (real Supabase targets already have it):
docker exec supabase_db_ondina-erp pg_dump -U supabase_admin -d postgres \
  --schema-only -n auth -n storage -n supabase_functions -f /tmp/platform.sql
docker exec supabase_db_ondina-erp psql -X -U supabase_admin -d restore_rehearsal \
  --single-transaction --variable ON_ERROR_STOP=1 \
  --command 'CREATE SCHEMA IF NOT EXISTS "extensions"' \
  --command 'CREATE SCHEMA IF NOT EXISTS "vault"' \
  --command 'CREATE PUBLICATION supabase_realtime' \
  --file /tmp/platform.sql --file /tmp/roles.sql --file /tmp/schema.sql \
  --command 'SET session_replication_role = replica' --file /tmp/data.sql
```

Verification after restore (OND-uxi acceptance criterion "restauración aislada ... con evidencia"):

1. Compare every table's row count and content digest between source and restored copy, exactly as
   [rehearse-upgrade.sh](../../supabase/tests/rehearse-upgrade.sh) fingerprints the baseline
   (per-row JSON serialized and md5-hashed). Verified round trip on 2026-10-14: dump → restore →
   re-dump → restore again, and all 37 fingerprinted relations (counts and content digests) matched
   identically between the two restored copies.
2. Spot-check business balances and counts (`ventas`, `despachos`, `perfiles`, `auth.users`,
   `stock_bodega`, `stock_envases`, `carga_vendedor`); they must equal the pre-restore values.
3. The full functional rehearsal (RLS journeys, critical stock flows after restore) is the deferred
   OND-uxi work; the local round trip covers relations, permissions (grants/policies restored with
   the schema) and data integrity, not the browser-level flows.
4. A live database is a moving target: during this verification the shared local DB was being
   written by other sessions, so source counts drifted between dump and compare. `pg_dump` is
   transactionally consistent at dump time; always compare dumps against quiet copies, and take the
   real backup from the remote only with writers serialized (see the reconciliation release gate).

## 4. Requirement when the Pro plan is contracted (pending #41 criteria)

Activate, in order, once Pro is signed:

1. Pro includes daily managed backups kept 7 days — verify them in Dashboard → Database → Backups
   and rehearse one dashboard restore into a scratch target.
2. Enable PITR as the paid add-on ($100 per month per 7-day retention) with at least the Small
   compute add-on; verify the recovery window in Dashboard → Point in Time. Note from the docs:
   enabling PITR stops daily backups — PITR then provides the recovery mechanism, which is why the
   manual off-site dump stays necessary as an independent copy.
3. Propose and ratify targets (**decide el responsable**): with managed daily backups RPO ≤ 24 h and
   RTO ≤ 4 h; with PITR, RPO ≤ 2 min (the official worst case documented by Supabase) and RTO ≤ 2 h.
4. Rehearse quarterly: restore the latest managed backup/PITR point into an isolated target, run the
   section 3 verification, and record the measured data loss and elapsed time against the agreed
   RPO/RTO.

GitHub #41 acceptance criteria (all still pending until Pro; tracked in Beads OND-uxi):

| Criterion | Status |
| --- | --- |
| What is backed up and what needs a separate copy (Storage objects are not in DB backups) | Documented above; Storage not used yet. |
| Isolated restore recovering relations, permissions and critical flows with evidence | Local round-trip verified 2026-10-14; full flow/RLS rehearsal pending. |
| Measured maximum data loss and recovery time vs agreed RPO/RTO | Pending; needs the schedule ratified (or Pro/PITR) and a measured rehearsal. |
| Restricted access, encryption/retention defined, backups never published in Git | Procedure defined above; storage location, keys and retention pending owner decision. |
| An incident/recovery procedure another person can follow | This document plus [reconciliation](../../supabase/reconciliation.md); owner to ratify and sign off. |

## 5. Risks meanwhile

- **No automatic safety net:** the data-loss window is exactly the time since the last manual dump;
  a skipped schedule silently grows the window.
- **Single-host copies:** a dump kept only on the same machine is not off-site. Encrypted off-site
  custody is the missing half until an owner ratifies it.
- **Storage is not covered** by any database backup; adopting Storage without a separate object
  copy would create unbackupable data.
- **Config outside dumps:** Auth provider settings, SMTP and JWT/API keys are not in `db dump`
  output (see the [self-hosting restore notes](https://supabase.com/docs/guides/self-hosting/restore-from-platform));
  they must be recorded in the recovery runbook ([auth.md](auth.md) is the current reference).
- **Project deletion destroys provider backups:** never delete or pause the project casually; also
  beware the free-plan 1-week inactivity pause.
- **Single-operator dependency:** the schedule, custody and rehearsals need one accountable person —
  **decide el responsable**.
