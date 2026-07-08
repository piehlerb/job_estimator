# Inventory Flavors & Job Allocation Plan

**Date:** 2026-07-07
**Status:** All phases implemented (Phase 4 in v2.10.0) — plan complete

> Phase 4 implementation notes (2026-07-08):
> - `InventoryActualsApplied.resolvedLines` stores the complete resolved deduction lines (chip/coating/tint/misc) with their targets; reversal uses stored lines verbatim, legacy snapshots without them still reverse via the old derivation.
> - Actual gallons resolve through the job's `materialAllocation`; the single entered actual-tint oz is distributed across planned tint lines proportionally (legacy single-color fallback when no planned lines).
> - Deliberately NOT built: a separate "actual allocation" editor in the actuals section — to record a different actual flavor mix, adjust the job's Material Allocation before applying actuals (the snapshot then locks it in).

> Phase 2–3 implementation notes (2026-07-07):
> - Resolver lives in `src/lib/materialAllocation.ts`; override types are `TopcoatAllocation { variant, share }` / `BaseCoatAllocation { variant, color, share, tintColor? }` on `Job.materialAllocation` (simpler than the generic `AllocationComponent` sketched below — topcoat flavors imply the A+B pair, so no `part` field is needed).
> - Base-tint behavior: legacy job-level mode (baseGallons × 12.8 oz to the job tint color when includeBasecoatTint, regardless of components) unless any override component has an explicit `tintColor` — then per-Clear-component tinting.
> - Recipes are name-based defaults in the resolver (Grey/Tan/Clear/Mocha); `BaseCoatColor.components` custom recipes are deferred until a color-management UI exists.
> - ⚠ Run `supabase/migration_add_material_allocation_to_jobs.sql` (and the Phase 1 coating_inventory migration if not yet applied) against the database.

> Phase 1 implementation notes (2026-07-07):
> - Shipped with a scope addition: the actuals apply path (JobForm), `inventoryActuals.ts` targets, JobSummaryModal on-hand reads, and the Inventory page all read/write the new `coatingInventory` SKU store already — the legacy TopCoat/BaseCoat singletons are no longer written by any UI path (only backup import still writes them for back-compat). This pulls part of Phase 4's bridging forward to avoid dual sources of truth.
> - Seed rows use deterministic ids (`coating-baseB-Normal-Grey` style) so multi-device seeding converges via sync; pure-default zero seeds carry a 2020-01-01 sentinel `updatedAt` so they always lose last-write-wins against real data.
> - ⚠ The Supabase migration `supabase/migration_add_coating_inventory_table.sql` must be run against the database before sync will succeed for the new table.

## Problem

Coating inventory is tracked in fixed, hard-coded buckets:

- `TopCoatInventory`: `topA`, `topB` (src/types/index.ts:435)
- `BaseCoatInventory`: `baseA`, `baseBGrey`, `baseBTan`, `baseBClear` (src/types/index.ts:442)

Reality is richer:

- **Topcoat** comes in *Original* and *Slow Cure* flavors, and a single job may use some of each.
- **Base B** comes in *Normal* and *Extended* flavors, in Grey, Tan, or Clear. Clear requires tint.
- **Mocha** is a finish color achieved by mixing — either Grey B + Tan B (1:1), or Grey B + Clear B + Tan tint. Today Mocha isn't a real base color in the allocation logic, so a Mocha job falls through the `else` branch and only commits Base A (with a warning in actuals).

The allocation math (Base A = 1/3 of base gallons, Base B = 2/3, split by `job.baseColor`; Top A/B = 50/50) is **duplicated in three places**:

1. `Inventory.tsx` — committed/potential calculations (~lines 334–405)
2. `JobSummaryModal.tsx` — per-job material rows (~lines 172–200)
3. `inventoryActuals.ts` — actuals deduction (`addSnapshotAmounts`, lines 141–188)

There is no way to say "this job uses 60% Original topcoat and 40% Slow Cure" or "make Mocha from Grey B + Clear B + Tan tint this time."

## Goals

1. Track coating inventory at the **SKU level** (part + flavor + color) instead of fixed fields.
2. Define **default allocation recipes** (finish color → component SKUs; topcoat flavor default) so day-to-day estimating stays as simple as it is today.
3. Allow a **per-job override** of the allocation (mix & match flavors, alternate Mocha recipe).
4. Consolidate the allocation math into **one shared resolver** used by commitments, the job summary, and actuals.

## Design

### 1. SKU-based coating inventory (new `CoatingInventory` store)

Follow the multi-record pattern already used by `ChipInventory` and `TintInventory`:

```typescript
export type CoatingPart = 'topA' | 'topB' | 'baseA' | 'baseB';

export interface CoatingInventory {
  id: string;
  part: CoatingPart;
  variant: string;        // 'Original' | 'Slow Cure' | 'Normal' | 'Extended' | ...
  color?: string;         // Base B only: 'Grey' | 'Tan' | 'Clear'
  gallons: number;
  sortOrder?: number;
  updatedAt: string;
  deleted?: boolean;
}
```

Notes:

- SKUs are user-managed rows (add/edit/delete on the Inventory page), exactly like tint colors. Variants are free-text with sensible seeds, so a new flavor never requires a code change.
- A SKU is identified for matching by a derived key: `` `${part}:${variant}:${color ?? ''}` ``.
- **Topcoat**: Slow Cure kits have their own A and B sides, so both `topA` and `topB` exist in Original and Slow Cure variants. A topcoat flavor choice always pulls the matching A+B pair.
- **Basecoat**: only the B side has flavors (Normal / Extended). Base A is a single SKU regardless of which B variant is used.
- **Cost is identical across variants** — job costing keeps using the flat `Costs.topCostPerGal` / `baseCostPerGal`; no per-SKU cost field is needed.

**Seed / migration SKUs** (from existing fields):

| Old field | New SKU |
|---|---|
| `topA` | Top A / Original |
| `topB` | Top B / Original |
| `baseA` | Base A (no variant) |
| `baseBGrey` | Base B / Normal / Grey |
| `baseBTan` | Base B / Normal / Tan |
| `baseBClear` | Base B / Normal / Clear |

Plus zero-quantity seed rows for the known flavors: Top A / Slow Cure, Top B / Slow Cure, and Base B / Extended in Grey, Tan, Clear (seeded so they're pickable in allocations immediately; any future flavor is added from the UI).

### 2. Kit ratios become configuration

The 1/3 A : 2/3 B base ratio and 1/2 : 1/2 top ratio move out of code into `Pricing` (or a new small `MaterialSettings` singleton — recommend `Pricing` since it already holds tuning knobs and syncs):

```typescript
// on Pricing
baseKitPartAFraction?: number; // default 1/3
topKitPartAFraction?: number;  // default 1/2
```

### 3. Default recipes on `BaseCoatColor`

`BaseCoatColor` is already the user-managed list of finish colors that chip blends map to. Extend it to carry its recipe:

```typescript
export interface BaseCoatComponent {
  color: 'Grey' | 'Tan' | 'Clear' | string; // Base B color
  share: number;                            // fraction of the B portion, components sum to 1
}

export interface BaseCoatColor {
  id: string;
  name: string;                    // 'Grey', 'Tan', 'Clear', 'Mocha', ...
  components?: BaseCoatComponent[]; // default when absent: [{ color: name, share: 1 }]
  requiresTint?: boolean;          // true when any Clear component is used (auto-suggest tint)
  defaultTintColor?: string;       // e.g. 'Tan' for the Clear-based Mocha recipe
  // ...existing fields
}
```

Defaults after migration:

- **Grey** → `[{ color: 'Grey', share: 1 }]`
- **Tan** → `[{ color: 'Tan', share: 1 }]`
- **Clear** → `[{ color: 'Clear', share: 1 }]`, `requiresTint: true`
- **Mocha** (new seeded color) → `[{ color: 'Grey', share: 0.5 }, { color: 'Tan', share: 0.5 }]`

Mocha's finish ratio is **always 1:1**; only the *sourcing* of each half varies. The default recipe is Grey B + Tan B; the per-job override (§4) covers the alternatives:

- Grey B + Clear B w/ Tan tint
- Tan B + Clear B w/ Grey tint
- Clear B w/ Grey tint + Clear B w/ Tan tint (all clear, two tints)

The recipe only picks **colors**; the **variant** (Normal vs Extended) is chosen at allocation time (default variant configurable, per-job overridable). This keeps the recipe about the finish, and the flavor about logistics.

Topcoat default: a `defaultTopcoatVariant` setting on `Pricing` (default `'Original'`).

### 4. Per-job override (`Job.materialAllocation`)

```typescript
export interface AllocationComponent {
  part: CoatingPart;
  variant: string;
  color?: string;      // Base B color
  share: number;       // fraction of that part's B-portion (base) or total (top); shares per part sum to 1
  tintColor?: string;  // when color === 'Clear': tint added to this component's gallons
}

export interface JobMaterialAllocation {
  base?: AllocationComponent[]; // overrides recipe + variant for Base B portion
  top?: AllocationComponent[];  // e.g. 60% Original / 40% Slow Cure
}

// on Job
materialAllocation?: JobMaterialAllocation; // absent = use defaults
```

**Multiple tint colors:** because a Clear-based component carries its own `tintColor`, a single job can consume several tints — e.g. all-Clear Mocha uses Clear B with *both* Grey tint and Tan tint (two Clear components at 0.5 share each, one per tint color). The resolver emits one tint line per tinted component, with oz proportional to that component's gallons (same `gallons × 128 × 0.1` formula, applied per component). The existing single `Job.tintColor` stays as the simple-case field and feeds the default recipe; the override supersedes it when present.

Rules:

- Absent (the normal case) → resolver derives allocation from `baseColor` recipe + default variants. **No behavior change for existing jobs.**
- Present → resolver uses it verbatim. Validation: shares per part sum to 1 (±epsilon).
- Base A is never listed; it's always `baseKitPartAFraction` of base gallons drawn from the single Base A SKU (only the B side has flavors).
- Topcoat components pair A and B automatically: a `top` share of 40% Slow Cure means 40% of `topGallons × topKitPartAFraction` from Top A / Slow Cure and 40% of the B portion from Top B / Slow Cure. The override UI exposes one share per *flavor*, not per part.

### 5. Shared resolver: `src/lib/materialAllocation.ts` (new)

One pure module that replaces the three duplicated splits:

```typescript
export interface ResolvedMaterialLine {
  key: string;          // 'coating:baseB:Normal:Grey', 'tint:Tan', 'chip:Tuscan'...
  part?: CoatingPart;
  variant?: string;
  color?: string;
  gallons: number;      // or lbs/oz for chip/tint lines
  unit: 'gal' | 'lbs' | 'oz';
  label: string;        // 'Base B – Normal – Grey'
}

export function resolveJobMaterials(input: {
  baseGallons: number;
  topGallons: number;
  tintOz: number;
  chipLbs: number;
  chipBlend?: string;
  baseColor?: string;
  tintColor?: string;
  baseCoatColors: BaseCoatColor[];     // for recipe lookup
  pricing: Pricing;                     // kit fractions, default variants
  override?: JobMaterialAllocation;     // Job.materialAllocation
}): ResolvedMaterialLine[]
```

Consumers:

1. **`Inventory.tsx` commitments** — replace the six hard-coded `CoatCommitment` states with a generic `Map<skuKey, CoatCommitment>` built by running `resolveJobMaterials` over Won/Pending jobs. Render dynamically (rows = union of inventory SKUs + committed SKUs), same as the chip/tint tables already do.
2. **`JobSummaryModal.tsx`** — per-job rows and totals come from the same resolver; columns become dynamic per SKU.
3. **`inventoryActuals.ts`** — actuals deduction resolves through the same function.

### 6. Actuals: snapshot the resolved lines

Today `InventoryActualsApplied` stores raw inputs (`actualBaseCoatGallons`, `baseColor`, ...) and re-derives buckets when reversing a previous application. Once recipes/overrides can change between applications, re-derivation is unsafe. Fix: store the **resolved lines** in the snapshot:

```typescript
export interface InventoryActualsApplied {
  // ...existing fields (kept for display/back-compat)
  resolvedLines?: { key: string; label: string; unit: string; amount: number }[];
}
```

- Reversal (`addSnapshotAmounts` with multiplier −1) uses `resolvedLines` when present; falls back to the current derivation for old snapshots.
- The JobForm actuals section gains optional flavor split inputs (defaulting to the job's allocation) so actual usage can differ from planned — e.g. planned all-Original but finished the last kit with Slow Cure.

### 7. Migration & compatibility

**IndexedDB** (bump `DB_VERSION`):

- New store `coatingInventory`.
- One-time conversion in `onupgradeneeded`/first-load: read `topCoatInventory` + `baseCoatInventory` singletons, create the six SKU rows (table above), keep the old stores read-only for backup back-compat (or delete after conversion — recommend keeping one release, then removing).
- Seed 'Mocha' `BaseCoatColor` with its Grey+Tan recipe if a color named Mocha doesn't already exist; if it exists (user data), attach the default recipe.

**Supabase:**

- `migration_add_coating_inventory_table.sql` — new `coating_inventory` table + RLS (mirror `tint_inventory`).
- `migration_add_material_allocation_to_jobs.sql` — `material_allocation JSONB` on `jobs`.
- `migration_add_recipe_to_base_coat_colors.sql` — `components JSONB`, `requires_tint BOOLEAN`, `default_tint_color TEXT` on `base_coat_colors`.
- Pricing columns for kit fractions / default variants (or fold into existing pricing JSONB if applicable).

**Sync / backup:** follow the standard new-entity checklist (storeGetters, tablesToSync, name mappings, pull list, backup export/import with `importData.coatingInventory || []`).

**Old jobs:** untouched. `materialAllocation` absent → resolver reproduces today's exact behavior (single-color recipe, Original topcoat, 1/3–2/3 and 50/50 splits). Jobs with `baseColor: 'Mocha'` *improve*: they now commit Grey+Tan B instead of silently committing nothing for the B portion.

### 8. UI changes

**Inventory page:**

- Replace the fixed Top Coat / Base Coat tables with a dynamic "Coating Inventory" table: columns On Hand / Committed / Available / Potential (as today), one row per SKU, grouped by part. "Add SKU" mirrors the tint add flow (part + variant + color pickers).

**JobForm:**

- No change to the default flow: pick chip blend → base color (now including Mocha as a first-class color) → tint auto-suggested when the recipe has `requiresTint`.
- New collapsible **"Material Allocation"** section (pattern: the Products section), collapsed by default, showing the resolved default allocation read-only. An **Override** toggle turns it into editable component rows (part, variant, color, share %) with a running sum indicator and a "Reset to default" button.
- Convenience presets for Mocha (always 1:1 — presets only change sourcing): "Grey B + Tan B", "Grey B + Clear B (Tan tint)", "Tan B + Clear B (Grey tint)", "All Clear (Grey + Tan tint)". One click populates the override.

**Settings/Pricing page:** inputs for kit fractions and default topcoat variant. **Base coat colors management** (wherever colors are edited) gains recipe component editing.

## Implementation Phases

Each phase ships independently and keeps the app working.

### Phase 1 — SKU inventory foundation
1. Types: `CoatingInventory`, `CoatingPart`; add to `ExportData`.
2. db.ts: bump `DB_VERSION`, new store, CRUD + `getAllCoatingInventoryForSync`, one-time conversion from the two singleton stores.
3. Sync + backup wiring; Supabase migration for `coating_inventory`.
4. Inventory page: render dynamic coating table from SKUs (commitments still computed the old way, mapped onto the migrated SKU keys).
5. Version bump ×3.

### Phase 2 — Shared resolver + recipes
1. Types: `BaseCoatComponent`, recipe fields on `BaseCoatColor`; kit-fraction + default-variant fields on `Pricing`.
2. New `src/lib/materialAllocation.ts` with unit tests (`materialAllocation.test.ts`) covering: plain Grey, Mocha via all four sourcings (including all-Clear with two tint lines), Clear + tint, mixed topcoat (Original/Slow Cure pairs), no-color fallback, share validation.
3. Seed/attach Mocha recipe; Supabase migration for base_coat_colors columns.
4. Switch `Inventory.tsx` commitments and `JobSummaryModal.tsx` to the resolver. Delete the duplicated split code.
5. Version bump.

### Phase 3 — Per-job override
1. Types: `JobMaterialAllocation`, `Job.materialAllocation`; Supabase `material_allocation JSONB`.
2. JobForm allocation section (read-only default view + override editor + Mocha presets).
3. Resolver honors overrides (already designed in; wire the job field through).
4. Version bump.

### Phase 4 — Actuals & deduction
1. `InventoryActualsApplied.resolvedLines`; snapshot builder resolves via the shared module (respecting the job override and any actual-usage flavor split entered).
2. `inventoryActuals.ts`: deltas target `{ kind: 'coating'; key }` SKU rows; reversal prefers `resolvedLines`, falls back to legacy derivation for old snapshots. Update `buildInventoryReviewRows` + tests.
3. JobForm actuals: optional actual flavor-split inputs.
4. Retire `TopCoatInventory` / `BaseCoatInventory` writes (keep read path for old backups; import converts to SKUs).
5. Version bump.

## Resolved Decisions

- **Slow Cure topcoat has its own A and B sides** → both `topA` and `topB` get Original and Slow Cure SKUs, and a topcoat flavor share always pulls the matching A+B pair.
- **Basecoat flavors (Normal / Extended) apply only to the B side** → Base A is one SKU with no variant.
- **Cost is identical across flavors** → no per-SKU cost field; costing continues to use `Costs.topCostPerGal` / `baseCostPerGal` unchanged.
- **Mocha is always 1:1 Grey:Tan in finish** — but each half can be sourced from tinted B or Clear B + tint, up to all-Clear with two tints. The recipe UI can therefore keep Mocha's shares fixed at 0.5/0.5 and only expose sourcing choices; the data model still stores shares generically.
- **Multiple tints per job are possible** (all-Clear Mocha) → tint is modeled per allocation component, and tint commitments/deductions aggregate across components. `Job.tintColor` remains for the simple single-tint case.

## Open Questions

None — all resolved above.
