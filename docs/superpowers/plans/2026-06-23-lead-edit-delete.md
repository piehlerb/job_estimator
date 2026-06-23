# Lead Edit Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lead editing and soft deletion from the Leads page while preserving local-first sync behavior.

**Architecture:** Put lead edit/delete state transitions in a small pure utility so behavior can be tested without IndexedDB. Use the existing `updateLead` sync path for edits, add a `deleteLead` helper that soft-deletes and queues sync, and keep UI state local to `Leads.tsx`.

**Tech Stack:** React 18, TypeScript, IndexedDB, Supabase sync, Node test runner.

---

### Task 1: Lead Mutation Helpers

**Files:**
- Create: `src/lib/leadMutations.test.ts`
- Create: `src/lib/leadMutations.ts`
- Modify: `tsconfig.test.json`

- [ ] **Step 1: Write the failing test**

Create `src/lib/leadMutations.test.ts`:

```ts
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Lead } from '../types/index.js';
import { applyLeadEdit, softDeleteLead } from './leadMutations.js';

const baseLead: Lead = {
  id: 'lead-1',
  name: 'Original',
  phone: '5551112222',
  email: 'old@example.com',
  address: '1 Main St',
  source: 'Facebook',
  campaign: 'Spring',
  firstSeenAt: '2026-06-01T00:00:00.000Z',
  lastEventAt: '2026-06-02T00:00:00.000Z',
  stage: 'New',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-02T00:00:00.000Z',
};

describe('lead mutation helpers', () => {
  test('applies trimmed editable fields and updates timestamp', () => {
    const next = applyLeadEdit(baseLead, {
      name: '  Jane Lead  ',
      phone: ' 5553334444 ',
      email: ' jane@example.com ',
      address: ' 44 Oak Rd ',
      source: ' Google Ads ',
      campaign: ' Summer ',
      stage: 'Engaged',
    }, '2026-06-23T12:00:00.000Z');

    assert.equal(next.name, 'Jane Lead');
    assert.equal(next.phone, '5553334444');
    assert.equal(next.email, 'jane@example.com');
    assert.equal(next.address, '44 Oak Rd');
    assert.equal(next.source, 'Google Ads');
    assert.equal(next.campaign, 'Summer');
    assert.equal(next.stage, 'Engaged');
    assert.equal(next.updatedAt, '2026-06-23T12:00:00.000Z');
  });

  test('clears empty optional fields and non-applicable disposition fields', () => {
    const lostLead: Lead = {
      ...baseLead,
      stage: 'Lost',
      dispositionReason: 'Not Interested',
      dispositionNotes: 'No budget',
      closedAt: '2026-06-10T00:00:00.000Z',
    };

    const next = applyLeadEdit(lostLead, {
      name: '',
      phone: '',
      email: '',
      address: '',
      source: '',
      campaign: '',
      stage: 'Engaged',
      dispositionReason: 'Not Interested',
      dispositionNotes: 'Keep me',
    }, '2026-06-23T12:30:00.000Z');

    assert.equal(next.name, undefined);
    assert.equal(next.phone, undefined);
    assert.equal(next.email, undefined);
    assert.equal(next.address, undefined);
    assert.equal(next.source, undefined);
    assert.equal(next.campaign, undefined);
    assert.equal(next.stage, 'Engaged');
    assert.equal(next.dispositionReason, undefined);
    assert.equal(next.dispositionNotes, undefined);
    assert.equal(next.closedAt, undefined);
  });

  test('sets closed timestamp when moving to terminal stage', () => {
    const next = applyLeadEdit(baseLead, {
      stage: 'Disqualified',
      dispositionReason: 'Out of Territory',
      dispositionNotes: 'Outside service area',
    }, '2026-06-23T13:00:00.000Z');

    assert.equal(next.stage, 'Disqualified');
    assert.equal(next.dispositionReason, 'Out of Territory');
    assert.equal(next.dispositionNotes, 'Outside service area');
    assert.equal(next.closedAt, '2026-06-23T13:00:00.000Z');
  });

  test('soft deletes a lead and updates timestamp', () => {
    const next = softDeleteLead(baseLead, '2026-06-23T14:00:00.000Z');

    assert.equal(next.deleted, true);
    assert.equal(next.updatedAt, '2026-06-23T14:00:00.000Z');
    assert.equal(next.id, baseLead.id);
  });
});
```

- [ ] **Step 2: Add the test files to test compilation**

Modify `tsconfig.test.json` include list:

```json
"src/lib/leadMutations.ts",
"src/lib/leadMutations.test.ts"
```

- [ ] **Step 3: Run test compilation and verify RED**

Run: `npx tsc -p tsconfig.test.json`

Expected: FAIL because `src/lib/leadMutations.ts` does not exist or does not export the requested helpers.

- [ ] **Step 4: Implement the helpers**

Create `src/lib/leadMutations.ts`:

```ts
import type { Lead, LeadDispositionReason, LeadStage } from '../types';

export type LeadEditInput = {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  source?: string;
  campaign?: string;
  stage: LeadStage;
  dispositionReason?: LeadDispositionReason | '';
  dispositionNotes?: string;
};

const TERMINAL_STAGES = new Set<LeadStage>(['Won', 'Lost', 'Disqualified']);
const DISPOSITION_STAGES = new Set<LeadStage>(['Lost', 'Disqualified']);

function cleanOptional(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function applyLeadEdit(lead: Lead, input: LeadEditInput, nowIso = new Date().toISOString()): Lead {
  const next: Lead = {
    ...lead,
    name: cleanOptional(input.name),
    phone: cleanOptional(input.phone),
    email: cleanOptional(input.email),
    address: cleanOptional(input.address),
    source: cleanOptional(input.source),
    campaign: cleanOptional(input.campaign),
    stage: input.stage,
    updatedAt: nowIso,
  };

  if (TERMINAL_STAGES.has(input.stage)) {
    next.closedAt = lead.closedAt || nowIso;
  } else {
    next.closedAt = undefined;
  }

  if (DISPOSITION_STAGES.has(input.stage)) {
    next.dispositionReason = input.dispositionReason || undefined;
    next.dispositionNotes = cleanOptional(input.dispositionNotes);
  } else {
    next.dispositionReason = undefined;
    next.dispositionNotes = undefined;
  }

  return next;
}

export function softDeleteLead(lead: Lead, nowIso = new Date().toISOString()): Lead {
  return {
    ...lead,
    deleted: true,
    updatedAt: nowIso,
  };
}
```

- [ ] **Step 5: Run tests and verify GREEN**

Run:

```powershell
npx tsc -p tsconfig.test.json
node --test .tmp-tests\src\lib\leadMutations.test.js
```

Expected: TypeScript compilation succeeds and the lead mutation tests pass.

### Task 2: IndexedDB Soft Delete Helper

**Files:**
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Add `deleteLead` using the tested helper**

Update imports and add:

```ts
import { softDeleteLead } from './leadMutations';
```

Add near `updateLead`:

```ts
export async function deleteLead(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['leads'], 'readwrite');
    const store = transaction.objectStore('leads');
    const getRequest = store.get(id);

    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const lead = getRequest.result as Lead | undefined;
      if (lead) {
        const putRequest = store.put(softDeleteLead(lead));
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });

  await queueForSync('leads', id, 'delete');
  await triggerBackgroundSync();
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: typecheck succeeds.

### Task 3: Leads Page Edit And Delete UI

**Files:**
- Modify: `src/pages/Leads.tsx`

- [ ] **Step 1: Add imports and form state**

Import `Edit2`, `Trash2`, `Save`, `deleteLead`, and `applyLeadEdit`.

Add `LeadEditForm` type and component state for the active edit lead, form values, save/delete busy IDs, and modal error.

- [ ] **Step 2: Wire edit modal save**

Create helpers:

```ts
function formFromLead(lead: Lead): LeadEditForm
function openEditLead(lead: Lead): void
async function handleSaveEdit(): Promise<void>
```

`handleSaveEdit` calls `applyLeadEdit`, then `updateLead`, then updates local `leads`.

- [ ] **Step 3: Wire delete confirmation**

Create `handleDeleteLead(lead: Lead): Promise<void>`.

Use `window.confirm` with different copy when `jobByLead.get(lead.id)` exists. On confirmation, call `deleteLead(lead.id)` and remove the lead from local `leads`.

- [ ] **Step 4: Add Actions column**

Add an Actions header and row cell with icon buttons:

- edit button opens modal
- delete button runs confirmation

- [ ] **Step 5: Add edit modal markup**

Render modal when `editingLead` is set. Include labeled inputs for the approved fields, stage select, disposition select, notes textarea, Cancel, and Save buttons.

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`

Expected: typecheck succeeds.

### Task 4: Final Verification

**Files:**
- Modify: none unless verification reveals an issue.

- [ ] **Step 1: Run focused node tests**

Run:

```powershell
npx tsc -p tsconfig.test.json
node --test .tmp-tests\src\lib\inventoryActuals.test.js .tmp-tests\src\lib\leadPipeline.test.js .tmp-tests\src\lib\jobSyncPolicy.test.js .tmp-tests\src\lib\leadMutations.test.js
```

Expected: all tests pass.

- [ ] **Step 2: Run app typecheck**

Run: `npm run typecheck`

Expected: typecheck succeeds.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: build succeeds. Existing Vite chunk-size and dynamic-import warnings are acceptable.

- [ ] **Step 4: Review git diff**

Run:

```powershell
git diff --stat
git status --short --branch
```

Expected: only the plan, helper/test, DB, Leads page, and test config files are changed; the unrelated redesign zip remains untracked.
