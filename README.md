# Job Estimator

Offline-first PWA for estimating, scheduling and tracking epoxy/chip floor
coating jobs: estimates and pricing, job actuals, inventory, calendar, leads
(from GoHighLevel), customers and reporting. Multi-user organizations share data
with per-member permissions.

**Stack:** React 18 + TypeScript + Vite + Tailwind, IndexedDB for local data,
Supabase (Postgres + RLS + Auth + Edge Functions) for sync, deployed to GitHub
Pages.

## Development

```bash
npm install
cp .env.example .env    # then fill in the two values
npm run dev
```

`.env` needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Supabase
dashboard → Project Settings → API).

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the dev server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check of `src/` |
| `npm test` | Unit tests (`src/lib/**/*.test.ts`, Node's test runner) |
| `npm run build` | Production build to `dist/` |
| `npm run gen:types` | Regenerate `src/types/database.ts` from the linked Supabase project |

CI runs lint, typecheck, tests and the build on every branch and pull request.
Pushing to `main` deploys to GitHub Pages once those pass.

## Layout

```
src/
├── pages/          # One component per screen
├── components/     # Shared UI
├── contexts/       # Auth/org + sync state
├── lib/            # Business logic, IndexedDB (db.ts), sync engine (sync.ts)
└── types/          # App types (index.ts) and generated DB types (database.ts)
supabase/
├── migrations/     # Database migrations (see supabase/README.md)
└── functions/      # Edge functions (ghl-webhook)
docs/               # Design notes and plans
```

## Navigation

Each screen has a hash URL (`#/inventory`, `#/jobs/new`, `#/jobs/<id>`,
`#/jobs/<id>/sheet`, …), defined in `src/lib/routes.ts`. Browser back/forward
and bookmarks work, and a link opened while signed out lands on that screen after
sign-in. Permission checks still apply to links opened directly.

## Conventions

- **Version:** bump `package.json` only; the build stamps it into the UI and the
  service worker.
- **Database changes:** add a migration under `supabase/migrations/` and apply it
  with `supabase db push` — see `supabase/README.md`.
- More detail on adding fields, sync and backups: `.claude/claude.md`.
