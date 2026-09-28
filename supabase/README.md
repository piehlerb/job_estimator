# Supabase

Database schema, migrations and edge functions for the Job Estimator.

```
supabase/
├── config.toml           # CLI config (edge function settings)
├── migrations/           # Ordered migrations — the source of truth for the schema
├── legacy_migrations/    # SQL from before the baseline, kept for reference only
└── functions/            # Edge functions (ghl-webhook)
```

## How migrations work

`migrations/` holds timestamped SQL files that run once each, in filename order.
Production records every applied version in `supabase_migrations.schema_migrations`,
so the Supabase CLI can tell which files are new.

- **`20260928235900_baseline.sql`** is a full snapshot of the production `public`
  schema (tables, constraints, indexes, triggers, RLS policies, functions, grants)
  taken on 2026-09-28. It was generated from the live catalog and verified by
  loading it into an empty database and comparing it object-by-object with
  production. It is recorded as applied in production; it only ever runs against
  a fresh database.
- The ten files dated before the baseline are **empty placeholders** for versions
  production had already recorded. Their changes are inside the baseline; each
  one names the legacy file that held its original SQL.
- Everything after the baseline is a normal incremental migration.

Before the baseline, most schema changes were pasted into the dashboard SQL Editor,
so the repo's SQL files and the live database drifted apart. Going through the CLI
keeps them in step.

## Making a schema change

One-time setup:

```bash
npm install -g supabase            # or: brew install supabase/tap/supabase
supabase login
supabase link --project-ref <project-ref>
```

Each change:

```bash
supabase migration new add_notes_to_jobs     # creates migrations/<timestamp>_add_notes_to_jobs.sql
# write the SQL, then check what production is missing:
supabase migration list
supabase db push                             # applies new files and records them
```

Rules:

- Never edit a migration that has been applied — add a new one.
- Don't run schema SQL in the dashboard SQL Editor; it bypasses the history.
- New org-scoped tables need RLS policies in the same shape as the existing ones
  (see the "Org-aware" policies and `org_can_write()` in the baseline).

## Setting up a new database

On an empty Supabase project (or `supabase start` locally), `supabase db push`
(or `supabase db reset` locally) runs the placeholders, then the baseline, then
any later migrations, and produces the current schema.

## Edge functions

`functions/ghl-webhook` receives GoHighLevel webhooks. It must be deployed with
JWT verification off, which `config.toml` pins:

```bash
supabase functions deploy ghl-webhook
```

## Security model

Every table has RLS enabled. For org-scoped data tables:

- **Read:** your own personal rows (`org_id IS NULL`), or any row in an org you belong to.
- **Insert / update:** personal rows you own, or org rows where your member
  permissions allow writing that table (`org_can_write()`, which mirrors
  `resolvePermissions()` in `src/lib/permissions.ts`). Admins can write everything.
- **Delete:** personal rows you own, or org rows if you are an org admin.
- Org membership is created only through the `create_organization()` and
  `accept_invite()` functions.

Column names are snake_case in SQL and camelCase in TypeScript; the sync layer
converts between them.
