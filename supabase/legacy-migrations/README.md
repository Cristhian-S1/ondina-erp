# Historical migration design

These ten SQL files are preserved byte-for-byte from the former `supabase/migrations/0001..0010` chain. They are reference material, not executable deployment migrations. Supabase CLI does not discover this directory.

The chain was never applied end-to-end to production and fails at 0007 because it recreates an existing sales trigger. Its data backfill can deduct already-recorded sales twice. Do not run these files manually, copy them back into the active migration directory, or mark their sequence numbers applied remotely.

The active chain is the supplied production schema baseline (`20261013000000`) plus forward-only reconciliation deltas. See [reconciliation and deployment procedure](../reconciliation.md) for the object decisions, known limits and the later authorized production procedure. Git history retains the original locations.
