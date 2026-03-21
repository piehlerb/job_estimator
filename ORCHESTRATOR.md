# Job Estimator — Orchestrator Map

Living architectural reference for this AI orchestration thread. Updated as tasks complete and decisions are made.

---

## Versions (must stay in sync across all 3)
| File | Key | Value |
|------|-----|-------|
| `package.json` | `version` | 2.5.4 |
| `public/sw.js` | `CACHE_VERSION` | 2.5.4 |
| `src/version.ts` | `APP_VERSION` | 2.5.4 |

**Rule:** Bump all 3 before every deploy. Mismatch = stale service worker cache for users.

---

## Stack
- **React 18** + **TypeScript 5** + **Vite 5**
- **Tailwind CSS 3** with custom GF brand colors
- **Supabase** (auth + PostgreSQL remote DB)
- **IndexedDB** (offline-first local storage via custom wrapper in `src/lib/db.ts`)
- **PWA** with service worker at `public/sw.js`
- **Deployed** via `gh-pages` to GitHub Pages at base path `/job_estimator/`
- **No router** — state-based navigation via `currentPage` state in `App.tsx`

---

## Architecture: Three-Tier Data

```
IndexedDB (camelCase)  ←→  Sync Engine  ←→  Supabase (snake_case)
                                ↕
                         JSON Backups
```

1. **IndexedDB** — offline-first, camelCase keys, soft-delete pattern
2. **Supabase** — PostgreSQL, snake_case columns, RLS by `user_id` or `org_id`
3. **JSON Backups** — full export/import via `src/lib/backup.ts`

Sync is **bidirectional, debounced (2s)**, conflict resolution = last-write-wins on `updatedAt`.

---

## File Structure

```
src/
├── App.tsx                  # App shell, state-based routing, auth gate, reminder polling
├── version.ts               # APP_VERSION constant
├── types/index.ts           # All TypeScript interfaces
├── lib/
│   ├── db.ts                # IndexedDB wrapper (DB_VERSION=14, 17 stores, all CRUD)
│   ├── sync.ts              # Supabase sync engine (push/pull, conflict resolution)
│   ├── syncHelpers.ts       # camelCase↔snake_case converters, table name maps
│   ├── backup.ts            # JSON export/import (13 entity types)
│   ├── jobMigration.ts      # Legacy data migrations (run on app load)
│   └── supabase.ts          # Supabase client init (reads VITE_SUPABASE_*)
├── contexts/
│   ├── AuthContext.tsx      # User auth, org membership, orgAccessLevel
│   └── SyncContext.tsx      # Sync state (last sync time, errors)
├── hooks/
│   ├── useAutoSync.ts       # Polls sync every 5 min when online+authed
│   └── useOnlineStatus.ts   # navigator.onLine wrapper
├── pages/                   # 17 pages (see below)
└── components/              # 5 shared components (see below)

supabase/
├── schema.sql               # Full DB schema
├── policies.sql             # RLS policies
└── migration_*.sql          # ~50 migration files (append-only history)

public/
└── sw.js                    # Service worker, CACHE_VERSION must match version.ts
```

---

## Pages (`src/pages/`)

| File | Purpose | Data Entities |
|------|---------|---------------|
| `Dashboard.tsx` | Jobs list, search/filter, status management | Jobs, Customers |
| `JobForm.tsx` | Create/edit job — most complex page | Jobs, Systems, Costs, Laborers, Customers, Products, TintInventory |
| `JobSheet.tsx` | Printable job detail view (no sidebar) | Jobs |
| `ChipSystems.tsx` | CRUD for chip systems | ChipSystem |
| `ChipBlends.tsx` | CRUD for chip blends | ChipBlend |
| `Laborers.tsx` | CRUD for laborers | Laborer |
| `Costs.tsx` | Edit cost settings | Costs |
| `Pricing.tsx` | Edit pricing variables | PricingVariables |
| `Inventory.tsx` | Chip/topcoat/basecoat/misc/tint inventory | All inventory types |
| `Customers.tsx` | CRUD for customers + inline job stats | Customer, Jobs |
| `Products.tsx` | CRUD for products with margin display | Product |
| `Calendar.tsx` | Jobs on a calendar view | Jobs |
| `Reporting.tsx` | Revenue/margin analytics | Jobs |
| `Organization.tsx` | Org management, member invites, access levels | Organization |
| `Settings.tsx` | App settings, Google Drive, notifications | — |
| `Backup.tsx` | Import/export JSON backups | All entities |
| `Login.tsx` | Auth screen (email/password + offline mode) | — |

**Access control:** `inventory_only` org members can only see `inventory` and `organization` pages.

---

## Components (`src/components/`)

| File | Purpose |
|------|---------|
| `Layout.tsx` | Sidebar nav, header, page wrapper |
| `InstallDaySchedule.tsx` | Per-day hours/laborers scheduler (used in JobForm) |
| `JobSummaryModal.tsx` | Modal for inventory planning from job list |
| `SnapshotChangeBanner.tsx` | Warning when job snapshots are outdated |
| `SyncStatusIndicator.tsx` | Online/sync status pill in header |

---

## Data Model: TypeScript Interfaces (`src/types/index.ts`)

**Core entities** (all have `id`, `createdAt`, `updatedAt`, `deleted?`):
- `Job` — central entity; key fields: `name`, `customerName`, `address`, `systemSnapshots[]`, `installSchedule[]`, `jobHours`, `tintColor?`, `jobProducts[]`, `status`, `pricingSnapshot`, `costs`, `laborerSnapshots[]`, `reminders[]`, `tags?`, `probability?`, `notes?`, and many pricing/cost fields
- `ChipSystem` — name, costSnapshot, description
- `Costs` — laborRate, gasPerDay, customCosts[]
- `Laborer` — name, hourlyRate
- `Customer` — name, address?, phone?, email?, notes?
- `Product` — name, cost, price, description?
- `ChipBlend` — name, blendDetails[]
- `TintInventory` — color, ounces

**Inventory types:** ChipInventory, TopCoatInventory, BaseCoatInventory, MiscInventory

**Snapshot types** (frozen copies on job save):
- `SystemSnapshot`, `LaborerSnapshot`, `CostsSnapshot`, `PricingSnapshot`

**Supporting types:**
- `InstallDaySchedule` — day, hours, laborerIds[] (per-day labor scheduling)
- `JobProduct` — productId, productName, quantity, unitCost, unitPrice
- `JobReminder` — subject, details, dueAt/dueDate/dueTime, completed, notifiedAt
- `ExportData` — container for all 13 entity types in JSON backups

---

## IndexedDB (`src/lib/db.ts`)

- **DB_VERSION: 14** (bump when adding new stores or indexes)
- **17 stores:** systems, pricingVariables, jobs, costs, pricing, laborers, chipBlends, chipInventory, topCoatInventory, baseCoatInventory, miscInventory, customers, products, baseCoatColors, tintInventory, googleDriveAuth, metadata

**CRUD pattern per store:**
- `get(id)` — single record or undefined
- `getAll()` — non-deleted records only (for UI display)
- `get*ForSync()` — ALL records including deleted (for push to Supabase)
- `add(record)` — assigns id/timestamps, triggers `autoSync()`
- `update(record)` — merges, bumps `updatedAt`, triggers `autoSync()`
- `delete(id)` — soft delete: sets `deleted=true`, triggers `autoSync()`

---

## Sync Engine (`src/lib/sync.ts`)

**Push:** `getAll*ForSync()` → `objectToSnakeCase()` → upsert to Supabase with `user_id`/`org_id`

**Pull:** fetch records since `lastSync` → filter by `org_id` or `user_id` → `objectToCamelCase()` → update IndexedDB

**Conflict resolution:** last-write-wins on `updatedAt`

**Debounce:** 2000ms via `triggerBackgroundSync()` — rapid local writes batch into one sync

**tablesToSync order** (dependency-safe): systems, pricingVariables, costs, pricing, laborers, chipBlends, customers, products, baseCoatColors, jobs, chipInventory, topCoatInventory, baseCoatInventory, miscInventory, tintInventory

---

## Table Name Mappings (`src/lib/syncHelpers.ts`)

Non-obvious mappings (all others are direct):
- `chipBlends` ↔ `chip_blends`
- `pricingVariables` ↔ `pricing_variables`
- `topCoatInventory` ↔ `topcoat_inventory`
- `baseCoatInventory` ↔ `basecoat_inventory`
- `baseCoatColors` ↔ `basecoat_colors`
- `tintInventory` ↔ `tint_inventory`

---

## Supabase Schema

All tables have `user_id` (RLS), `created_at`, `updated_at`, `deleted` columns. Most also have `org_id`.

- **Core:** `jobs`, `systems`, `costs`, `pricing`, `pricing_variables`, `laborers`, `customers`, `products`, `chip_blends`, `tint_inventory`
- **Inventory:** `chip_inventory`, `topcoat_inventory`, `basecoat_inventory`, `misc_inventory`, `basecoat_colors`
- **Org:** `organizations`, `org_members`

~50 migration files in `supabase/` — **append-only, never delete or edit old migrations**.

---

## Env Variables

```
VITE_SUPABASE_URL=https://dffvakmdvjnsxhskjszc.supabase.co
VITE_SUPABASE_ANON_KEY=<jwt>
```
Stored in `.env.local` (git-ignored). Validated at startup in `src/lib/supabase.ts`.

---

## Brand Colors (Tailwind custom config in `tailwind.config.js`)

| Token | Hex | Usage |
|-------|-----|-------|
| `gf-electric` | `#4cfa3e` | Sidebar title, version badge, Online indicator |
| `gf-lime` | `#77bf43` | Primary buttons, focus rings, active nav |
| `gf-dark-green` | `#4d7820` | Hover/active states, text emphasis |
| `gf-grey` | `#817f7f` | Neutral/secondary |

Sidebar: `bg-black` with `gf-electric` title, `hover:text-gf-electric`, `bg-gray-900` hover.

---

## Key Conventions

1. **camelCase** in TypeScript/IndexedDB; **snake_case** in Supabase — conversion is automatic
2. **Soft delete** everywhere — never hard-delete; `ForSync` functions return deleted records
3. **Optional fields** (`field?: type`) for all new additions — prevents breakage on old data
4. **Snapshots** on job save — systems/laborers/costs/pricing frozen at time of job creation
5. **No router** — `currentPage` state in `App.tsx`; new pages added there + in `Layout.tsx`
6. **Migrations are append-only** — create new `.sql` files, never edit old ones
7. **autoSync()** is called automatically by `add()`/`update()`/`delete()` — don't call manually
8. **Backup uses `getForSync()`** — automatically includes all fields, no manual field lists
9. **Backup backward compat** — use `importData.newEntity || []` for entities missing in old backups

---

## Adding a New Entity — Full Checklist

1. Add interface to `src/types/index.ts` + add to `ExportData`
2. Bump `DB_VERSION` in `src/lib/db.ts`, add store in `onupgradeneeded`, add all CRUD functions
3. Import new type in `db.ts`
4. Add to `storeGetters` + `tablesToSync` in `src/lib/sync.ts`, import ForSync fn
5. Add name mappings in `getSupabaseTableName()` + `getIndexedDBStoreName()` in `syncHelpers.ts`
6. Add to pull tables list in `pullFromSupabase()` in `sync.ts`
7. Update `backup.ts`: import CRUD fns, add to exportAllData, generateImportPreview, executeImport
8. Create `supabase/migration_add_<entity>_table.sql` with RLS policy
9. Add page in `src/pages/`, add route in `App.tsx`, add nav entry in `Layout.tsx`
10. Bump version in all 3 files

---

## Known Fragile Areas

- **Version sync** — `package.json`, `sw.js`, `src/version.ts` must always match; mismatch = users stuck on old cached version
- **DB_VERSION** — forgetting to bump when adding stores = silent failure for existing users (store won't be created)
- **Snapshot types** — `JobForm.tsx` takes snapshots of systems/laborers/costs at save time; if type shapes change, old job snapshots may not render correctly
- **installSchedule migration** — old jobs without `installSchedule` are converted on-the-fly in `jobMigration.ts`; edge cases possible with very old data
- **org_id vs user_id scoping** — sync filters by `org_id` when org context exists; solo users use `user_id`; mixing causes data visibility issues
- **50+ migrations** — no automated runner; must be applied manually via Supabase dashboard or CLI
- **JobForm complexity** — largest file in codebase, touches 7 entity types; be careful with state initialization and snapshot logic

---

## Decisions Made

_(Recorded here as tasks are assigned and completed)_

---

## Task History

_(Recorded here as subagents complete work)_
