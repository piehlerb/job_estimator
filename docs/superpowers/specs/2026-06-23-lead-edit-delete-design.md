# Lead Edit And Delete Design

## Goal

Allow users to correct lead attribution details and remove bad or duplicate leads from the Leads page without breaking the existing webhook and sync model.

## User Experience

The Leads table gets an Actions column with icon buttons for editing and deleting a lead. Editing opens a modal over the table. Deleting opens a confirmation dialog, especially warning when the lead already has a linked job.

The edit modal supports these fields:

- Name
- Phone
- Email
- Address
- Source
- Campaign
- Stage
- Disposition reason
- Disposition notes

Stage and disposition behavior follows the existing Leads page rules: disposition reason is only meaningful for Lost or Disqualified leads, and changing a lead back to a non-terminal stage clears disposition fields.

## Data Behavior

Edits use the existing `updateLead` local database function so changes update IndexedDB, enqueue sync, and flow to Supabase during normal sync.

Deleting a lead is a soft delete. The app sets `deleted: true` and updates `updatedAt`, then queues the lead for sync. Deleted leads disappear from `getAllLeads()` and remain available to `getAllLeadsForSync()` so other devices and Supabase receive the deletion.

Deleting a lead does not delete linked jobs. Existing jobs keep their `leadId` value, but the lead no longer appears in the Leads page. This preserves job records and avoids surprising data loss.

## Components

- `src/lib/db.ts`: add `deleteLead(id)` matching the existing soft-delete pattern used by other synced stores.
- `src/pages/Leads.tsx`: add modal state, edit form state, save handling, delete confirmation handling, and an Actions column.

## Testing

Add focused tests for lead mutation helpers in a pure utility module:

- Applying an edit updates fields and `updatedAt`.
- Moving out of Lost or Disqualified clears disposition fields.
- Deleting produces a soft-deleted lead with `deleted: true` and a fresh `updatedAt`.

Run the existing TypeScript, node test, and production build checks after implementation.
