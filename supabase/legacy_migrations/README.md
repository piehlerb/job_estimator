# Legacy migrations (reference only)

SQL files from before the migration baseline of 2026-09-28. They are kept for
history — to see why a column or policy exists — and must **not** be run.

- Most were applied by hand in the Supabase SQL Editor, in no recorded order.
- Some were never applied at all (e.g. `migration_add_backups_table.sql` and
  `migration_explicit_api_grants.sql`), and `schema.sql` / `policies.sql` were
  long out of date.

The current schema is `../migrations/20260928235900_baseline.sql`, generated from
production. New changes go in `../migrations/` — see `../README.md`.
