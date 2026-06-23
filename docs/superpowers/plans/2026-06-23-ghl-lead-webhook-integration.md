# GHL Lead Webhook Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable GHL lead webhook vertical slice: secure event ingestion, normalized leads/appointments, sync support, a Leads page, and job linking.

**Architecture:** Add Supabase tables for webhook sources, raw events, leads, and appointments, then implement a testable TypeScript normalization/processing module used by a Supabase Edge Function. Mirror normalized lead and appointment records into the existing IndexedDB/Supabase sync path, and add a focused Leads page for review, filtering, and job linking.

**Tech Stack:** React 18, Vite, TypeScript, IndexedDB, Supabase Postgres/RLS, Supabase Edge Functions, Node built-in test runner.

---

## File Structure

- Create `src/lib/leadPipeline.ts`: pure lead/webhook normalization, dedupe, stage transition, and reporting helper logic.
- Create `src/lib/leadPipeline.test.ts`: Node test runner tests for the pipeline.
- Modify `src/types/index.ts`: add lead, appointment, webhook source/event, and job link types.
- Modify `src/lib/db.ts`: add IndexedDB stores and CRUD for `leads` and `leadAppointments`.
- Modify `src/lib/syncHelpers.ts` and `src/lib/sync.ts`: include lead tables in sync mapping, push, and pull.
- Create `src/pages/Leads.tsx`: searchable/filterable lead review page with stage/disposition editing.
- Modify `src/lib/permissions.ts`, `src/components/Layout.tsx`, and `src/App.tsx`: route and navigation for Leads.
- Modify `src/pages/JobForm.tsx`: allow creating/editing a job with a linked `leadId`.
- Create `supabase/migration_add_ghl_leads.sql`: schema, indexes, grants, RLS policies, job link column.
- Create `supabase/functions/ghl-webhook/index.ts`: authenticated webhook endpoint that stores raw events and upserts normalized records.
- Modify `tsconfig.test.json`: include the new pipeline test.

---

### Task 1: Pure Pipeline Tests And Implementation

**Files:**
- Create: `src/lib/leadPipeline.test.ts`
- Create: `src/lib/leadPipeline.ts`
- Modify: `tsconfig.test.json`

- [ ] **Step 1: Write failing tests**

Create tests covering:

```ts
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildDedupeKey,
  normalizeGhlWebhook,
  nextLeadStageForEvent,
  shouldOverwriteLeadValue,
} from './leadPipeline.js';

describe('GHL lead pipeline', () => {
  test('derives appointment dedupe key from event contact appointment and scheduled time', () => {
    assert.equal(
      buildDedupeKey({
        eventType: 'appointment.booked',
        ghlContactId: 'contact-1',
        ghlAppointmentId: 'appt-1',
        scheduledStartAt: '2026-07-01T14:00:00.000Z',
      }),
      'appointment.booked:contact-1:appt-1:2026-07-01T14:00:00.000Z'
    );
  });

  test('normalizes source and identity fields from common GHL payload shapes', () => {
    const normalized = normalizeGhlWebhook({
      event_type: 'lead.created',
      contact_id: 'abc',
      full_name: '  Jane Doe  ',
      phone: '(555) 222-1111',
      email: 'JANE@EXAMPLE.COM',
      source: 'Facebook',
      campaign: 'Garage Floors',
    });

    assert.equal(normalized.eventType, 'lead.created');
    assert.equal(normalized.lead.name, 'Jane Doe');
    assert.equal(normalized.lead.phone, '5552221111');
    assert.equal(normalized.lead.email, 'jane@example.com');
    assert.equal(normalized.lead.source, 'Facebook');
  });

  test('moves new lead to booked but never moves won lead backward', () => {
    assert.equal(nextLeadStageForEvent('New', 'appointment.booked'), 'Estimate Booked');
    assert.equal(nextLeadStageForEvent('Won', 'appointment.canceled'), 'Won');
  });

  test('does not overwrite existing attribution with blank webhook values', () => {
    assert.equal(shouldOverwriteLeadValue('Facebook', ''), false);
    assert.equal(shouldOverwriteLeadValue(undefined, 'Google Ads'), true);
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `npx tsc -p tsconfig.test.json && node --test .tmp-tests/src/lib/leadPipeline.test.js`

Expected: TypeScript fails because `leadPipeline.ts` does not exist.

- [ ] **Step 3: Implement minimal pipeline**

Implement exported constants for stage/disposition values and the functions under test. Keep the module pure and free of Supabase/browser dependencies.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npx tsc -p tsconfig.test.json && node --test .tmp-tests/src/lib/leadPipeline.test.js`

Expected: all `leadPipeline` tests pass.

---

### Task 2: Types And Local Persistence

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Add lead types**

Add `LeadStage`, `LeadDispositionReason`, `Lead`, `LeadAppointment`, `GhlWebhookEvent`, and `GhlWebhookSource` interfaces. Add `leadId?: string` to `Job` and `leadAppointments`/`leads` to `ExportData` only if backup/export is updated in the same pass.

- [ ] **Step 2: Add IndexedDB stores**

Increment `DB_VERSION`, create `leads` and `leadAppointments` stores, and add indexes for `stage`, `updatedAt`, `source`, `leadId`, and `scheduledStartAt`.

- [ ] **Step 3: Add CRUD helpers**

Add `getAllLeads`, `getAllLeadsForSync`, `updateLead`, `getAllLeadAppointments`, `getAllLeadAppointmentsForSync`, and `updateLeadAppointment` following the customers/products pattern.

- [ ] **Step 4: Typecheck focused files**

Run: `npx tsc --noEmit -p tsconfig.app.json`

Expected: no new type errors from the added types and db helpers.

---

### Task 3: Supabase Sync Mapping

**Files:**
- Modify: `src/lib/syncHelpers.ts`
- Modify: `src/lib/sync.ts`

- [ ] **Step 1: Add mappings**

Map `leads` to `leads` and `leadAppointments` to `lead_appointments` in both mapping functions.

- [ ] **Step 2: Include getters**

Import the new sync getters and add them to `storeGetters`, `tablesToSync`, and pull table order. Pull `leads` before `lead_appointments`.

- [ ] **Step 3: Typecheck sync**

Run: `npx tsc --noEmit -p tsconfig.app.json`

Expected: sync compiles with the new stores.

---

### Task 4: Supabase Schema

**Files:**
- Create: `supabase/migration_add_ghl_leads.sql`

- [ ] **Step 1: Add migration**

Create `ghl_webhook_sources`, `ghl_webhook_events`, `leads`, `lead_appointments`, and `jobs.lead_id`. Include indexes, `updated_at` triggers where this project already uses them, explicit grants to `anon`, `authenticated`, and `service_role`, RLS, and org/member policies matching existing table patterns.

- [ ] **Step 2: Review for Supabase 2026 Data API change**

Confirm the migration includes explicit grants for every new public table.

---

### Task 5: Edge Function Webhook Receiver

**Files:**
- Create: `supabase/functions/ghl-webhook/index.ts`

- [ ] **Step 1: Implement receiver**

Use Deno/Supabase Edge Function style. Accept POST JSON, validate a secret, resolve active `ghl_webhook_sources`, insert raw `ghl_webhook_events`, dedupe by `(webhook_source_id, dedupe_key)`, upsert `leads` and `lead_appointments`, and return a JSON processing result.

- [ ] **Step 2: Add CORS and error responses**

Support `OPTIONS`, `405`, `401`, `409/200 ignored duplicate`, and `422 needs_review` style statuses.

---

### Task 6: Leads Page

**Files:**
- Create: `src/pages/Leads.tsx`
- Modify: `src/lib/permissions.ts`
- Modify: `src/components/Layout.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add page route**

Add `leads` to `AppPage`, allow it for users with `customers` or `reporting` access, add sidebar navigation using a lucide icon, and render `Leads`.

- [ ] **Step 2: Build lead table**

Load `getAllLeads`, `getAllLeadAppointments`, and `getAllJobs`. Show summary counts, search, source/stage/disposition filters, appointment status, and linked job status/revenue.

- [ ] **Step 3: Add stage/disposition editing**

Allow manual stage and disposition updates through `updateLead`, preserving `updatedAt` and sync queue behavior.

---

### Task 7: Job Linking

**Files:**
- Modify: `src/pages/JobForm.tsx`
- Modify: `src/types/index.ts`
- Modify: `src/lib/db.ts` if helper lookup is needed

- [ ] **Step 1: Accept optional lead id**

Allow `JobForm` to receive an optional `leadId` when creating a job from the Leads page.

- [ ] **Step 2: Store job lead link**

Include `leadId` when loading and saving jobs. When saving a linked job, update the lead stage to `Quoted`, `Won`, or `Lost` based on the saved job status without letting GHL own job status.

---

### Task 8: Verification

**Files:**
- All touched files

- [ ] **Step 1: Run pipeline tests**

Run: `npx tsc -p tsconfig.test.json && node --test .tmp-tests/src/lib/leadPipeline.test.js`

- [ ] **Step 2: Run app typecheck**

Run: `npm run typecheck`

- [ ] **Step 3: Run production build**

Run: `npm run build`

- [ ] **Step 4: Inspect working tree**

Run: `git status --short`

Expected: only intentional files changed, plus pre-existing unrelated worktree changes.

---

## Self-Review

Spec coverage:

- Event ledger: Task 4 and Task 5.
- Normalized leads/appointments: Tasks 1, 2, 3, 4, 5, and 6.
- Stage/disposition quality layer: Tasks 1, 2, and 6.
- Job linking and outcome ownership: Task 7.
- RLS/security/source secret mapping: Tasks 4 and 5.
- Reporting first slice: Task 6, with advanced marketing spend intentionally left for a later feature.

No placeholders remain in the executable task list. Marketing spend automation is intentionally not part of this first vertical slice, matching the design's out-of-scope section.
