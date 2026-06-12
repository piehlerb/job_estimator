# Job Actuals Inventory Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a save-time inventory update prompt for job actual material changes, with an editable review popup that applies only the net delta since the last inventory update.

**Architecture:** Put the inventory delta math in a focused pure helper so it can be tested without React or IndexedDB. Persist a job-level `inventoryActualsApplied` baseline, add a Supabase JSONB column for it, and keep inventory writes in `JobForm` using the existing `save*Inventory` and `updateJob` helpers. The React changes stay inside `JobForm` and reuse the current save flow: save the job first, optionally review/apply inventory, then return via `onBack`.

**Tech Stack:** React 18, TypeScript, Vite, IndexedDB helper APIs in `src/lib/db.ts`, Supabase sync through snake_case column mapping, Node built-in `node:test` for the new pure helper test.

---

## File Structure

- Create `src/lib/inventoryActuals.ts`: pure snapshot, delta, and review-row helpers for actual material inventory updates.
- Create `src/lib/inventoryActuals.test.ts`: Node test coverage for first update, accumulated "No" saves, increases, decreases, identity changes, and missing inventory rows.
- Create `tsconfig.test.json`: emits only the inventory helper test files to `.tmp-tests` so `node --test` can run without adding a full test framework.
- Modify `.gitignore`: ignore `.tmp-tests/`.
- Modify `src/types/index.ts`: add `InventoryActualsApplied` and add `inventoryActualsApplied?: InventoryActualsApplied` to `Job`.
- Modify `src/pages/JobForm.tsx`: import inventory helpers and inventory save/load APIs, preserve the baseline while saving, prompt after material actual changes, show the review popup, and apply inventory updates.
- Modify `supabase/schema.sql`: add `inventory_actuals_applied JSONB`.
- Create `supabase/migration_add_inventory_actuals_applied_to_jobs.sql`: add the JSONB column for existing Supabase databases.

---

### Task 1: Add Test Harness And Failing Inventory Delta Tests

**Files:**
- Create: `tsconfig.test.json`
- Create: `src/lib/inventoryActuals.test.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Add `.tmp-tests/` to `.gitignore`**

Add this near the existing build output ignores:

```gitignore
.tmp-tests/
```

- [ ] **Step 2: Create `tsconfig.test.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": ".tmp-tests",
    "rootDir": ".",
    "types": ["node"]
  },
  "include": [
    "src/lib/inventoryActuals.ts",
    "src/lib/inventoryActuals.test.ts"
  ]
}
```

- [ ] **Step 3: Create the failing tests**

Create `src/lib/inventoryActuals.test.ts` with this content:

```ts
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildInventoryActualDeltaRows,
  buildInventoryActualsSnapshot,
  buildInventoryReviewRows,
  hasInventoryActualsDelta,
  type InventoryActualsSource,
} from './inventoryActuals.js';

const baseSource: InventoryActualsSource = {
  actualBaseCoatGallons: 18,
  actualTopCoatGallons: 12,
  actualTintOz: 24,
  actualChipBoxes: 7,
  actualCrackRepairOz: 64,
  chipBlend: 'shoreline',
  baseColor: 'Grey',
  tintColor: 'Slate Gray',
  includeBasecoatTint: true,
  includeTopcoatTint: false,
};

describe('inventory actual delta rows', () => {
  test('first inventory update subtracts full current actuals from a zero baseline', () => {
    const current = buildInventoryActualsSnapshot(baseSource, '2026-06-12T10:00:00.000Z');
    const rows = buildInventoryActualDeltaRows(current, undefined);
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row.usedDelta]));

    assert.equal(hasInventoryActualsDelta(current, undefined), true);
    assert.equal(byKey['chip:Shoreline'], 280);
    assert.equal(byKey['base:baseA'], 6);
    assert.equal(byKey['base:baseBGrey'], 12);
    assert.equal(byKey['top:topA'], 6);
    assert.equal(byKey['top:topB'], 6);
    assert.equal(byKey['tint:Slate Gray'], 24);
    assert.equal(byKey['misc:crackRepair'], 0.5);
  });

  test('saving with No leaves the baseline unchanged so a later Yes applies accumulated delta', () => {
    const baseline = buildInventoryActualsSnapshot({ ...baseSource, actualChipBoxes: 3 }, '2026-06-12T09:00:00.000Z');
    const current = buildInventoryActualsSnapshot({ ...baseSource, actualChipBoxes: 8 }, '2026-06-12T11:00:00.000Z');

    const chipRow = buildInventoryActualDeltaRows(current, baseline).find((row) => row.key === 'chip:Shoreline');
    assert.equal(chipRow?.usedDelta, 200);
  });

  test('later actual increases subtract only the increase', () => {
    const baseline = buildInventoryActualsSnapshot(baseSource, '2026-06-12T09:00:00.000Z');
    const current = buildInventoryActualsSnapshot({ ...baseSource, actualTopCoatGallons: 16 }, '2026-06-12T11:00:00.000Z');

    assert.deepEqual(
      buildInventoryActualDeltaRows(current, baseline)
        .filter((row) => row.key.startsWith('top:'))
        .map((row) => [row.key, row.usedDelta]),
      [
        ['top:topA', 2],
        ['top:topB', 2],
      ]
    );
  });

  test('later actual decreases add inventory back', () => {
    const baseline = buildInventoryActualsSnapshot(baseSource, '2026-06-12T09:00:00.000Z');
    const current = buildInventoryActualsSnapshot({ ...baseSource, actualChipBoxes: 6 }, '2026-06-12T11:00:00.000Z');

    const chipRow = buildInventoryActualDeltaRows(current, baseline).find((row) => row.key === 'chip:Shoreline');
    assert.equal(chipRow?.usedDelta, -40);
  });

  test('changed material identities reverse old inventory and apply new inventory', () => {
    const baseline = buildInventoryActualsSnapshot(baseSource, '2026-06-12T09:00:00.000Z');
    const current = buildInventoryActualsSnapshot(
      {
        ...baseSource,
        chipBlend: 'Creek Bed',
        baseColor: 'Tan',
        tintColor: 'Warm Umber',
      },
      '2026-06-12T11:00:00.000Z'
    );

    const byKey = Object.fromEntries(buildInventoryActualDeltaRows(current, baseline).map((row) => [row.key, row.usedDelta]));
    assert.equal(byKey['chip:Creek Bed'], 280);
    assert.equal(byKey['chip:Shoreline'], -280);
    assert.equal(byKey['base:baseBGrey'], -12);
    assert.equal(byKey['base:baseBTan'], 12);
    assert.equal(byKey['tint:Slate Gray'], -24);
    assert.equal(byKey['tint:Warm Umber'], 24);
    assert.equal(byKey['base:baseA'], undefined);
  });

  test('review rows default missing inventory to zero and calculate editable new values', () => {
    const current = buildInventoryActualsSnapshot(baseSource, '2026-06-12T10:00:00.000Z');
    const rows = buildInventoryReviewRows({
      deltas: buildInventoryActualDeltaRows(current, undefined),
      chipInventory: [],
      tintInventory: [],
      topCoatInventory: null,
      baseCoatInventory: null,
      miscInventory: null,
    });

    const chipRow = rows.find((row) => row.key === 'chip:Shoreline');
    assert.equal(chipRow?.currentValue, 0);
    assert.equal(chipRow?.newValue, -280);
    assert.equal(chipRow?.isMissingInventory, true);
  });
});
```

- [ ] **Step 4: Run the tests and verify they fail because the helper is missing**

Run:

```powershell
node node_modules\typescript\bin\tsc -p tsconfig.test.json
```

Expected: TypeScript fails with an error like `Cannot find module './inventoryActuals.js'`.

- [ ] **Step 5: Commit the failing tests**

```powershell
git add .gitignore tsconfig.test.json src/lib/inventoryActuals.test.ts
git commit -m "Add inventory actuals delta tests"
```

---

### Task 2: Implement Pure Inventory Actuals Helper

**Files:**
- Create: `src/lib/inventoryActuals.ts`
- Modify: `src/types/index.ts`
- Test: `src/lib/inventoryActuals.test.ts`

- [ ] **Step 1: Add baseline type support in `src/types/index.ts`**

Add this near the actuals types:

```ts
export interface InventoryActualsApplied {
  actualBaseCoatGallons?: number;
  actualTopCoatGallons?: number;
  actualCyclo1Gallons?: number;
  actualTintOz?: number;
  actualChipBoxes?: number;
  actualCrackRepairOz?: number;
  chipBlend?: string;
  baseColor?: string;
  tintColor?: string;
  appliedAt: string;
}
```

Then add this field to `Job` near the actual execution fields:

```ts
  inventoryActualsApplied?: InventoryActualsApplied;
```

- [ ] **Step 2: Create `src/lib/inventoryActuals.ts` with minimal implementation**

```ts
import type {
  BaseCoatInventory,
  ChipInventory,
  InventoryActualsApplied,
  MiscInventory,
  TintInventory,
  TopCoatInventory,
} from '../types';
import { normalizeChipBlendName } from './syncHelpers';

export interface InventoryActualsSource {
  actualBaseCoatGallons?: number;
  actualTopCoatGallons?: number;
  actualCyclo1Gallons?: number;
  actualTintOz?: number;
  actualChipBoxes?: number;
  actualCrackRepairOz?: number;
  chipBlend?: string;
  baseColor?: string;
  tintColor?: string;
  includeBasecoatTint?: boolean;
  includeTopcoatTint?: boolean;
}

export type InventoryTarget =
  | { kind: 'chip'; blend: string }
  | { kind: 'base'; field: keyof Pick<BaseCoatInventory, 'baseA' | 'baseBGrey' | 'baseBTan' | 'baseBClear'> }
  | { kind: 'top'; field: keyof Pick<TopCoatInventory, 'topA' | 'topB'> }
  | { kind: 'tint'; color: string }
  | { kind: 'misc'; field: keyof Pick<MiscInventory, 'crackRepair'> };

export interface InventoryActualDeltaRow {
  key: string;
  productName: string;
  unit: 'lbs' | 'gal' | 'oz';
  usedDelta: number;
  target: InventoryTarget;
  warning?: string;
}

export interface InventoryReviewRow extends InventoryActualDeltaRow {
  currentValue: number;
  newValue: number;
  isMissingInventory: boolean;
  inventoryId?: string;
}

export interface InventoryReviewInputs {
  deltas: InventoryActualDeltaRow[];
  chipInventory: ChipInventory[];
  tintInventory: TintInventory[];
  topCoatInventory: TopCoatInventory | null;
  baseCoatInventory: BaseCoatInventory | null;
  miscInventory: MiscInventory | null;
}

const ZERO_EPSILON = 0.000001;

function numeric(value: number | undefined): number | undefined {
  return value && Number.isFinite(value) ? value : undefined;
}

export function buildInventoryActualsSnapshot(
  source: InventoryActualsSource,
  appliedAt: string
): InventoryActualsApplied {
  const hasTint = Boolean(source.includeBasecoatTint || source.includeTopcoatTint);

  return {
    actualBaseCoatGallons: numeric(source.actualBaseCoatGallons),
    actualTopCoatGallons: numeric(source.actualTopCoatGallons),
    actualCyclo1Gallons: numeric(source.actualCyclo1Gallons),
    actualTintOz: numeric(source.actualTintOz),
    actualChipBoxes: numeric(source.actualChipBoxes),
    actualCrackRepairOz: numeric(source.actualCrackRepairOz),
    chipBlend: source.chipBlend ? normalizeChipBlendName(source.chipBlend) : undefined,
    baseColor: source.baseColor || undefined,
    tintColor: hasTint && source.tintColor ? source.tintColor : undefined,
    appliedAt,
  };
}

function addAmount(map: Map<string, InventoryActualDeltaRow>, row: InventoryActualDeltaRow): void {
  if (Math.abs(row.usedDelta) < ZERO_EPSILON) return;

  const existing = map.get(row.key);
  if (existing) {
    existing.usedDelta += row.usedDelta;
    return;
  }

  map.set(row.key, { ...row });
}

function addSnapshotAmounts(
  map: Map<string, InventoryActualDeltaRow>,
  snapshot: InventoryActualsApplied | undefined,
  multiplier: 1 | -1
): void {
  if (!snapshot) return;

  if (snapshot.chipBlend && snapshot.actualChipBoxes) {
    addAmount(map, {
      key: `chip:${snapshot.chipBlend}`,
      productName: `${snapshot.chipBlend} Chips`,
      unit: 'lbs',
      usedDelta: snapshot.actualChipBoxes * 40 * multiplier,
      target: { kind: 'chip', blend: snapshot.chipBlend },
    });
  }

  if (snapshot.actualBaseCoatGallons) {
    const baseColor = snapshot.baseColor;
    if (baseColor === 'Grey' || baseColor === 'Tan' || baseColor === 'Clear') {
      const field = baseColor === 'Grey' ? 'baseBGrey' : baseColor === 'Tan' ? 'baseBTan' : 'baseBClear';
      const label = baseColor === 'Grey' ? 'Base B - Grey' : baseColor === 'Tan' ? 'Base B - Tan' : 'Base B - Clear';

      addAmount(map, {
        key: 'base:baseA',
        productName: 'Base A',
        unit: 'gal',
        usedDelta: (snapshot.actualBaseCoatGallons / 3) * multiplier,
        target: { kind: 'base', field: 'baseA' },
      });
      addAmount(map, {
        key: `base:${field}`,
        productName: label,
        unit: 'gal',
        usedDelta: ((snapshot.actualBaseCoatGallons * 2) / 3) * multiplier,
        target: { kind: 'base', field },
      });
    } else {
      addAmount(map, {
        key: 'base:baseA',
        productName: 'Base A',
        unit: 'gal',
        usedDelta: snapshot.actualBaseCoatGallons * multiplier,
        target: { kind: 'base', field: 'baseA' },
        warning: 'No matching Base B inventory bucket exists for this base color.',
      });
    }
  }

  if (snapshot.actualTopCoatGallons) {
    addAmount(map, {
      key: 'top:topA',
      productName: 'Top A',
      unit: 'gal',
      usedDelta: (snapshot.actualTopCoatGallons / 2) * multiplier,
      target: { kind: 'top', field: 'topA' },
    });
    addAmount(map, {
      key: 'top:topB',
      productName: 'Top B',
      unit: 'gal',
      usedDelta: (snapshot.actualTopCoatGallons / 2) * multiplier,
      target: { kind: 'top', field: 'topB' },
    });
  }

  if (snapshot.tintColor && snapshot.actualTintOz) {
    addAmount(map, {
      key: `tint:${snapshot.tintColor}`,
      productName: `${snapshot.tintColor} Tint`,
      unit: 'oz',
      usedDelta: snapshot.actualTintOz * multiplier,
      target: { kind: 'tint', color: snapshot.tintColor },
    });
  }

  if (snapshot.actualCrackRepairOz) {
    addAmount(map, {
      key: 'misc:crackRepair',
      productName: 'Crack Repair',
      unit: 'gal',
      usedDelta: (snapshot.actualCrackRepairOz / 128) * multiplier,
      target: { kind: 'misc', field: 'crackRepair' },
    });
  }
}

export function buildInventoryActualDeltaRows(
  current: InventoryActualsApplied,
  baseline: InventoryActualsApplied | undefined
): InventoryActualDeltaRow[] {
  const map = new Map<string, InventoryActualDeltaRow>();
  addSnapshotAmounts(map, baseline, -1);
  addSnapshotAmounts(map, current, 1);

  return Array.from(map.values())
    .map((row) => ({ ...row, usedDelta: Math.abs(row.usedDelta) < ZERO_EPSILON ? 0 : row.usedDelta }))
    .filter((row) => Math.abs(row.usedDelta) >= ZERO_EPSILON)
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function hasInventoryActualsDelta(
  current: InventoryActualsApplied,
  baseline: InventoryActualsApplied | undefined
): boolean {
  return buildInventoryActualDeltaRows(current, baseline).length > 0;
}

export function buildInventoryReviewRows(inputs: InventoryReviewInputs): InventoryReviewRow[] {
  return inputs.deltas.map((delta) => {
    let currentValue = 0;
    let inventoryId: string | undefined;

    if (delta.target.kind === 'chip') {
      const item = inputs.chipInventory.find((inv) => normalizeChipBlendName(inv.blend) === delta.target.blend);
      currentValue = item?.pounds ?? 0;
      inventoryId = item?.id;
    } else if (delta.target.kind === 'tint') {
      const item = inputs.tintInventory.find((inv) => inv.color === delta.target.color);
      currentValue = item?.ounces ?? 0;
      inventoryId = item?.id;
    } else if (delta.target.kind === 'top') {
      currentValue = inputs.topCoatInventory?.[delta.target.field] ?? 0;
      inventoryId = inputs.topCoatInventory?.id;
    } else if (delta.target.kind === 'base') {
      currentValue = inputs.baseCoatInventory?.[delta.target.field] ?? 0;
      inventoryId = inputs.baseCoatInventory?.id;
    } else {
      currentValue = inputs.miscInventory?.[delta.target.field] ?? 0;
      inventoryId = inputs.miscInventory?.id;
    }

    return {
      ...delta,
      currentValue,
      newValue: currentValue - delta.usedDelta,
      isMissingInventory: inventoryId === undefined,
      inventoryId,
    };
  });
}
```

- [ ] **Step 3: Run the helper tests**

Run:

```powershell
node node_modules\typescript\bin\tsc -p tsconfig.test.json
node --test .tmp-tests\src\lib\inventoryActuals.test.js
```

Expected: all six tests pass.

- [ ] **Step 4: Commit the helper**

```powershell
git add src/types/index.ts src/lib/inventoryActuals.ts
git commit -m "Add inventory actuals delta helper"
```

---

### Task 3: Persist The Job Inventory Baseline In Supabase

**Files:**
- Modify: `supabase/schema.sql`
- Create: `supabase/migration_add_inventory_actuals_applied_to_jobs.sql`
- Test: `src/lib/inventoryActuals.test.ts`

- [ ] **Step 1: Add the Supabase column to `supabase/schema.sql`**

Inside the `CREATE TABLE IF NOT EXISTS jobs` column list, after `reminders JSONB DEFAULT '[]'::jsonb,`, add:

```sql
  inventory_actuals_applied JSONB,
```

- [ ] **Step 2: Add migration SQL**

Create `supabase/migration_add_inventory_actuals_applied_to_jobs.sql`:

```sql
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS inventory_actuals_applied JSONB;

COMMENT ON COLUMN public.jobs.inventory_actuals_applied IS
'Actual material quantities and identities already applied to inventory for delta-based inventory updates.';
```

- [ ] **Step 3: Run typecheck/test**

Run:

```powershell
node node_modules\typescript\bin\tsc -p tsconfig.test.json
node --test .tmp-tests\src\lib\inventoryActuals.test.js
npm run typecheck
```

Expected: helper tests pass and `npm run typecheck` exits 0.

- [ ] **Step 4: Commit the persistence changes**

```powershell
git add supabase/schema.sql supabase/migration_add_inventory_actuals_applied_to_jobs.sql
git commit -m "Persist inventory actuals baseline"
```

---

### Task 4: Wire JobForm Save Prompt And Editable Review Popup

**Files:**
- Modify: `src/pages/JobForm.tsx`
- Test: `src/lib/inventoryActuals.test.ts`

- [ ] **Step 1: Expand `JobForm` imports**

In `src/pages/JobForm.tsx`, add these DB imports:

```ts
  getTopCoatInventory,
  saveTopCoatInventory,
  getBaseCoatInventory,
  saveBaseCoatInventory,
  getMiscInventory,
  saveMiscInventory,
  saveChipInventory,
  saveTintInventory,
```

Add these type imports:

```ts
  BaseCoatInventory,
  InventoryActualsApplied,
  MiscInventory,
  TopCoatInventory,
```

Add this helper import:

```ts
import {
  buildInventoryActualDeltaRows,
  buildInventoryActualsSnapshot,
  buildInventoryReviewRows,
  type InventoryReviewRow,
} from '../lib/inventoryActuals';
```

- [ ] **Step 2: Add popup state near the actuals state**

```ts
  const [showInventoryUpdateModal, setShowInventoryUpdateModal] = useState(false);
  const [inventoryReviewRows, setInventoryReviewRows] = useState<InventoryReviewRow[]>([]);
  const [pendingInventoryJob, setPendingInventoryJob] = useState<Job | null>(null);
  const [pendingInventoryBaseline, setPendingInventoryBaseline] = useState<InventoryActualsApplied | undefined>(undefined);
  const [inventoryUpdateError, setInventoryUpdateError] = useState('');
  const [applyingInventoryUpdate, setApplyingInventoryUpdate] = useState(false);
```

- [ ] **Step 3: Add small default inventory helpers inside `JobForm` before `handleSubmit`**

```ts
  const createDefaultTopCoatInventory = (): TopCoatInventory => ({
    id: 'current',
    topA: 0,
    topB: 0,
    updatedAt: new Date().toISOString(),
  });

  const createDefaultBaseCoatInventory = (): BaseCoatInventory => ({
    id: 'current',
    baseA: 0,
    baseBGrey: 0,
    baseBTan: 0,
    baseBClear: 0,
    updatedAt: new Date().toISOString(),
  });

  const createDefaultMiscInventory = (): MiscInventory => ({
    id: 'current',
    crackRepair: 0,
    silicaSand: 0,
    shot: 0,
    updatedAt: new Date().toISOString(),
  });
```

- [ ] **Step 4: Add a `prepareInventoryReview` helper inside `JobForm` before `handleSubmit`**

```ts
  const prepareInventoryReview = async (job: Job): Promise<InventoryReviewRow[]> => {
    const currentSnapshot = buildInventoryActualsSnapshot(
      {
        actualBaseCoatGallons: job.actualBaseCoatGallons,
        actualTopCoatGallons: job.actualTopCoatGallons,
        actualCyclo1Gallons: job.actualCyclo1Gallons,
        actualTintOz: job.actualTintOz,
        actualChipBoxes: job.actualChipBoxes,
        actualCrackRepairOz: job.actualCrackRepairOz,
        chipBlend: job.chipBlend,
        baseColor: job.baseColor,
        tintColor: job.tintColor,
        includeBasecoatTint: job.includeBasecoatTint,
        includeTopcoatTint: job.includeTopcoatTint,
      },
      new Date().toISOString()
    );

    const deltas = buildInventoryActualDeltaRows(currentSnapshot, job.inventoryActualsApplied);
    if (deltas.length === 0) return [];

    const [
      chipInv,
      tintInv,
      topInv,
      baseInv,
      miscInv,
    ] = await Promise.all([
      getAllChipInventory(),
      getAllTintInventory().catch(() => [] as TintInventory[]),
      getTopCoatInventory(),
      getBaseCoatInventory(),
      getMiscInventory(),
    ]);

    return buildInventoryReviewRows({
      deltas,
      chipInventory: chipInv,
      tintInventory: tintInv,
      topCoatInventory: topInv,
      baseCoatInventory: baseInv,
      miscInventory: miscInv,
    });
  };
```

- [ ] **Step 5: Preserve the inventory baseline when building `job` in `handleSubmit`**

In the `job: Job = { ... }` object, add:

```ts
        inventoryActualsApplied: existingJob?.inventoryActualsApplied,
```

- [ ] **Step 6: Replace the `onBack()` after save with inventory prompt logic**

Replace:

```ts
      if (jobId) {
        await updateJob(job);
      } else {
        await addJob(job);
      }

      onBack();
```

With:

```ts
      if (jobId) {
        await updateJob(job);
      } else {
        await addJob(job);
      }

      const currentSnapshot = buildInventoryActualsSnapshot(
        {
          actualBaseCoatGallons: job.actualBaseCoatGallons,
          actualTopCoatGallons: job.actualTopCoatGallons,
          actualCyclo1Gallons: job.actualCyclo1Gallons,
          actualTintOz: job.actualTintOz,
          actualChipBoxes: job.actualChipBoxes,
          actualCrackRepairOz: job.actualCrackRepairOz,
          chipBlend: job.chipBlend,
          baseColor: job.baseColor,
          tintColor: job.tintColor,
          includeBasecoatTint: job.includeBasecoatTint,
          includeTopcoatTint: job.includeTopcoatTint,
        },
        new Date().toISOString()
      );
      const deltaRows = buildInventoryActualDeltaRows(currentSnapshot, job.inventoryActualsApplied);

      if (deltaRows.length > 0) {
        const wantsInventoryUpdate = window.confirm('Actual material values changed. Update inventory from these actuals now?');
        if (wantsInventoryUpdate) {
          let reviewRows: InventoryReviewRow[];
          try {
            reviewRows = await prepareInventoryReview({ ...job, inventoryActualsApplied: job.inventoryActualsApplied });
          } catch (error) {
            console.error('Error loading inventory for actuals update:', error);
            alert('Job saved, but inventory could not be loaded. Inventory was not changed.');
            onBack();
            return;
          }

          if (reviewRows.length > 0) {
            setPendingInventoryJob(job);
            setPendingInventoryBaseline(currentSnapshot);
            setInventoryReviewRows(reviewRows);
            setInventoryUpdateError('');
            setShowInventoryUpdateModal(true);
            setSaving(false);
            return;
          }
        }
      }

      onBack();
```

- [ ] **Step 7: Add editable row update and cancel/apply handlers before the render return**

```ts
  const updateInventoryReviewNewValue = (rowKey: string, value: string) => {
    const parsed = parseFloat(value);
    setInventoryReviewRows((rows) =>
      rows.map((row) =>
        row.key === rowKey
          ? { ...row, newValue: Number.isFinite(parsed) ? parsed : 0 }
          : row
      )
    );
  };

  const handleCancelInventoryUpdate = () => {
    setShowInventoryUpdateModal(false);
    setPendingInventoryJob(null);
    setPendingInventoryBaseline(undefined);
    setInventoryReviewRows([]);
    setInventoryUpdateError('');
    onBack();
  };

  const handleApplyInventoryUpdate = async () => {
    if (!pendingInventoryJob || !pendingInventoryBaseline) return;
    setApplyingInventoryUpdate(true);
    setInventoryUpdateError('');

    try {
      const now = new Date().toISOString();
      const chipInv = await getAllChipInventory();
      const tintInv = await getAllTintInventory().catch(() => [] as TintInventory[]);
      const topInv = (await getTopCoatInventory()) || createDefaultTopCoatInventory();
      const baseInv = (await getBaseCoatInventory()) || createDefaultBaseCoatInventory();
      const miscInv = (await getMiscInventory()) || createDefaultMiscInventory();
      let topChanged = false;
      let baseChanged = false;
      let miscChanged = false;

      for (const row of inventoryReviewRows) {
        if (row.target.kind === 'chip') {
          const existing = chipInv.find((inv) => normalizeChipBlendName(inv.blend) === row.target.blend);
          await saveChipInventory({
            id: existing?.id || generateId(),
            blend: existing?.blend || row.target.blend,
            pounds: row.newValue,
            updatedAt: now,
            deleted: false,
          });
        } else if (row.target.kind === 'tint') {
          const existing = tintInv.find((inv) => inv.color === row.target.color);
          await saveTintInventory({
            id: existing?.id || generateId(),
            color: existing?.color || row.target.color,
            ounces: row.newValue,
            updatedAt: now,
            deleted: false,
          });
        } else if (row.target.kind === 'top') {
          topInv[row.target.field] = row.newValue;
          topChanged = true;
        } else if (row.target.kind === 'base') {
          baseInv[row.target.field] = row.newValue;
          baseChanged = true;
        } else {
          miscInv[row.target.field] = row.newValue;
          miscChanged = true;
        }
      }

      const singletonSaves: Promise<void>[] = [];
      if (topChanged) singletonSaves.push(saveTopCoatInventory({ ...topInv, updatedAt: now }));
      if (baseChanged) singletonSaves.push(saveBaseCoatInventory({ ...baseInv, updatedAt: now }));
      if (miscChanged) singletonSaves.push(saveMiscInventory({ ...miscInv, updatedAt: now }));
      await Promise.all(singletonSaves);

      await updateJob({
        ...pendingInventoryJob,
        inventoryActualsApplied: pendingInventoryBaseline,
        updatedAt: now,
        synced: false,
      });

      setShowInventoryUpdateModal(false);
      setPendingInventoryJob(null);
      setPendingInventoryBaseline(undefined);
      setInventoryReviewRows([]);
      onBack();
    } catch (error) {
      console.error('Error updating inventory from actuals:', error);
      setInventoryUpdateError('Inventory update failed. Your job was saved, but inventory was not changed.');
    } finally {
      setApplyingInventoryUpdate(false);
    }
  };
```

- [ ] **Step 8: Add the review popup JSX near the end of the returned JSX**

Place this before the closing root `</div>` of the `JobForm` return:

```tsx
      {showInventoryUpdateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Review Inventory Updates</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Edit the new inventory values before applying these actual material changes.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancelInventoryUpdate}
                className="p-1 text-slate-400 hover:text-slate-700"
                aria-label="Close inventory update review"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-auto px-5 py-4">
              {inventoryUpdateError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {inventoryUpdateError}
                </div>
              )}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 pr-3 font-semibold text-slate-600">Product</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-600">Current</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-600">Used From Actuals</th>
                    <th className="text-right py-2 pl-3 font-semibold text-slate-600">New Inventory</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inventoryReviewRows.map((row) => (
                    <tr key={row.key}>
                      <td className="py-3 pr-3">
                        <div className="font-medium text-slate-900">{row.productName}</div>
                        <div className="text-xs text-slate-500">
                          {row.unit}{row.isMissingInventory ? ' · will be created' : ''}
                        </div>
                        {row.warning && <div className="text-xs text-amber-700 mt-1">{row.warning}</div>}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-700">{row.currentValue.toFixed(row.unit === 'lbs' ? 0 : 2)}</td>
                      <td className={`py-3 px-3 text-right font-medium ${row.usedDelta < 0 ? 'text-green-700' : 'text-slate-800'}`}>
                        {row.usedDelta.toFixed(row.unit === 'lbs' ? 0 : 2)}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <input
                          type="number"
                          step={row.unit === 'lbs' ? '1' : '0.1'}
                          value={Number.isFinite(row.newValue) ? row.newValue : 0}
                          onChange={(e) => updateInventoryReviewNewValue(row.key, e.target.value)}
                          className="w-28 px-2 py-1 border border-slate-300 rounded text-right"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelInventoryUpdate}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-white"
                disabled={applyingInventoryUpdate}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyInventoryUpdate}
                className="px-4 py-2 rounded-lg bg-gf-lime text-white font-medium hover:bg-gf-dark-green disabled:bg-slate-300"
                disabled={applyingInventoryUpdate}
              >
                {applyingInventoryUpdate ? 'Applying...' : 'Apply Updates'}
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 9: Run tests and typecheck**

Run:

```powershell
node node_modules\typescript\bin\tsc -p tsconfig.test.json
node --test .tmp-tests\src\lib\inventoryActuals.test.js
npm run typecheck
```

Expected: helper tests pass and `npm run typecheck` exits 0.

- [ ] **Step 10: Commit JobForm integration**

```powershell
git add src/pages/JobForm.tsx
git commit -m "Add actuals inventory update review flow"
```

---

### Task 5: Build And Browser Verify The Full Flow

**Files:**
- Modify only if verification finds issues.

- [ ] **Step 1: Run full build**

Run:

```powershell
npm run build
```

Expected: Vite build exits 0.

- [ ] **Step 2: Start the dev server**

Run:

```powershell
npm run dev -- --port 5173
```

Expected: Vite prints a local URL such as `http://localhost:5173/job_estimator/`.

- [ ] **Step 3: Browser smoke test**

Open the app in the in-app browser. Use an existing won job or create a test job in offline mode. On the Actuals tab, change actual material values and save.

Verify:

- Save still persists the job.
- The "Actual material values changed" prompt appears after save.
- Choosing "No" returns without changing inventory.
- Reopening the job and choosing "Yes" shows the review popup with chip, base, top, tint, and crack repair rows when those actuals are populated.
- Editing a new inventory value changes the value applied.
- Applying updates returns to the previous page.
- Reopening the job and increasing/decreasing actuals applies only the difference.

- [ ] **Step 4: Final status check**

Run:

```powershell
git status --short --branch
```

Expected: only intentional changes are present, or clean if all task commits have been created.
