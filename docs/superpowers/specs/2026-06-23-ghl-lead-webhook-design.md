# GHL Lead Webhook Integration Design

## Goal

Add lead attribution and funnel reporting to Job Estimator without turning the app into a duplicate CRM. GoHighLevel remains the system for lead capture, forms, conversations, and workflow triggers. Job Estimator becomes the system for transparent lead measurement, estimate bookings, quote/job outcomes, and marketing performance.

The first integration path uses GoHighLevel outbound workflow webhooks. CSV import can remain a fallback for backfill or recovery, but the primary design is event-driven.

## Existing App Context

Job Estimator already has Supabase-backed `customers` and `jobs`, including estimate dates, decision dates, job status, pricing, and actual margin data. The app does not currently have a dedicated lead or marketing attribution layer. The new lead model should link into existing jobs instead of replacing the customer/job workflow.

## Data Ownership

GoHighLevel owns:

- Lead capture and contact creation.
- Forms, conversations, automations, and source fields available in GHL.
- Appointment triggers such as booked, rescheduled, and canceled events.

Job Estimator owns:

- Normalized lead records used for reporting.
- Raw webhook event history and processing status.
- Lead stage, disposition, and lead quality review.
- Estimate/job creation, quote amounts, won/lost outcomes, revenue, and margin.
- Marketing spend and funnel calculations.

GHL webhooks may create the top of the funnel, but they must not overwrite estimator-owned business outcomes such as job status, job value, decision date, or actual margin.

## Data Model

### `ghl_webhook_sources`

Stores webhook configuration for each connected GHL location or workflow group. This table lets the server endpoint map an incoming secret to the correct user or organization before storing lead data.

Recommended fields:

- `id`
- `user_id`
- `org_id`
- `name`
- `secret_hash`
- `is_active`
- `created_at`
- `updated_at`

The plaintext secret should be shown only when created or rotated. The database should store only a hash.

### `ghl_webhook_events`

Stores every inbound webhook exactly as received before any normalized updates happen.

Recommended fields:

- `id`
- `user_id`
- `org_id`
- `webhook_source_id`
- `event_type`
- `dedupe_key`
- `received_at`
- `processed_at`
- `processing_status`: `pending`, `processed`, `failed`, `needs_review`, `ignored`
- `error_message`
- `raw_payload`
- `source_workflow`

The event table is the audit trail for debugging, reprocessing, duplicate detection, and explaining why reports changed.

### `leads`

The normalized current-state record for reporting and app workflows.

Recommended fields:

- `id`
- `user_id`
- `org_id`
- `ghl_contact_id`
- `name`
- `phone`
- `email`
- `address`
- `source`
- `campaign`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `first_seen_at`
- `last_event_at`
- `stage`
- `disposition_reason`
- `disposition_notes`
- `closed_at`
- `customer_id`
- `created_at`
- `updated_at`
- `deleted`

Deduplication should prefer `ghl_contact_id`, then normalized phone, then normalized email. Leads with insufficient identity data should be preserved and marked for review instead of discarded.

### `lead_appointments`

Stores estimate booking lifecycle records from GHL.

Recommended fields:

- `id`
- `lead_id`
- `ghl_appointment_id`
- `scheduled_start_at`
- `scheduled_end_at`
- `status`: `booked`, `rescheduled`, `canceled`, `no_show`, `completed`
- `calendar_name`
- `assigned_user`
- `created_from_event_id`
- `last_event_id`
- `created_at`
- `updated_at`

Appointment history should remain visible even when an appointment is canceled or rescheduled.

### Existing `jobs`

Add a nullable `lead_id` on `jobs` so an estimate/job can be linked back to the originating lead. Reporting should use the job as the source of quote, won/lost, revenue, and margin truth.

### Later `marketing_spend`

Add a spend table when reporting needs cost metrics.

Recommended fields:

- `id`
- `user_id`
- `org_id`
- `period_start`
- `period_end`
- `source`
- `campaign`
- `amount`
- `notes`

This enables CPL, cost per booked estimate, cost per quote, and cost per won job.

## Lead Stages And Dispositions

Lead lifecycle stage and lead quality/disposition should be separate fields.

Recommended `stage` values:

- `New`
- `Contact Attempted`
- `Engaged`
- `Estimate Booked`
- `Estimate Completed`
- `Quoted`
- `Won`
- `Lost`
- `Disqualified`

Recommended `disposition_reason` values:

- `Not Interested`
- `Out of Territory`
- `Wrong Service`
- `Bad Contact Info`
- `Duplicate`
- `Spam`
- `Unresponsive`
- `Price/Budget`
- `Timing`
- `Other`

Every lead starts in `New`. GHL events can automatically move a lead forward only when a concrete event happens, such as appointment booking or cancellation. Human review inside Job Estimator should handle quality calls like disqualified, not interested, out of territory, and unresponsive.

## Webhook Contract

Use one authenticated webhook endpoint for GHL workflow events. The endpoint should accept a clear `event_type` and enough contact, attribution, and appointment data to normalize the event.

Initial event types:

- `lead.created`
- `appointment.booked`
- `appointment.rescheduled`
- `appointment.canceled`
- `appointment.completed`

The expected payload should include:

- Shared secret or signature field that resolves to an active webhook source.
- GHL contact id when available.
- Lead name, phone, email, and address when available.
- Source/campaign/UTM fields when available.
- Appointment id and scheduled time for appointment events.
- Workflow or trigger name for diagnostics.
- Stable dedupe key if GHL can send one; otherwise derive one from event type, contact id, appointment id, and scheduled time.

## Processing Flow

1. Validate the shared secret or signature and resolve it to an active `ghl_webhook_sources` row.
2. Insert the raw webhook into `ghl_webhook_events`.
3. Detect duplicate events using `dedupe_key`.
4. Normalize the event into `leads` and `lead_appointments`.
5. Mark the event `processed`, `ignored`, `failed`, or `needs_review`.

If an appointment event arrives before a lead-created event, create or update the lead from the appointment payload. The processor should be idempotent so repeated GHL sends do not double-count leads or bookings.

If a payload is missing required identity fields or appointment details, keep the raw event and mark it `needs_review`.

## App Behavior

Add a Leads page with:

- Search by name, phone, and email.
- Filters for stage, disposition, source, and campaign.
- Lead detail with event timeline, appointment history, linked customer, and linked job.
- Manual stage/disposition edits for quality review.
- Actions to create a job from a lead or link an existing job to a lead.

Update job creation/editing so a job can be linked to a lead. When a job is linked, the lead can move to `Quoted`. When the linked job becomes `Won` or `Lost`, reporting should reflect that outcome from the job data.

Customer data should remain separate. A lead can optionally create or update a customer when it becomes a job, but the lead record should remain as the marketing/funnel artifact.

## Reporting

Add lead funnel reporting that can answer:

- Leads by source and campaign.
- Booked estimates by source and campaign.
- Lead-to-booking rate.
- Booking-to-quote rate.
- Quote-to-won rate.
- Lost and disqualified reasons by source.
- Revenue and margin by source.
- Cost per lead, cost per booked estimate, and cost per won job once marketing spend is entered.

Lead quality reports should distinguish sales outcomes from bad-fit lead quality. For example, `Out of Territory`, `Wrong Service`, `Bad Contact Info`, and `Spam` should be visible separately from viable-but-lost leads.

## Security And Privacy

The webhook endpoint must run server-side, such as a Supabase Edge Function. It must not be implemented in browser-only code.

Security requirements:

- Require a shared secret or signature that maps to a configured webhook source.
- Do not expose service-role credentials in client code.
- Enable RLS on any exposed Supabase tables.
- Scope lead and event records using the `org_id` or `user_id` from the matched webhook source.
- Store only the GHL data needed for attribution and funnel reporting.

## Error Handling

The system should expose:

- Failed events with error messages.
- Events waiting for review.
- Duplicate events that were ignored.
- Unknown event types.
- Missing identity data.
- Missing appointment data.

Failed or incomplete webhooks should never be silently discarded. They should remain available for inspection and future reprocessing.

## Testing And Verification

Verification should include:

- Unit tests for event deduplication.
- Unit tests for lead matching by GHL contact id, phone, and email.
- Tests for out-of-order event handling.
- Tests for missing phone/email/name data.
- Tests for appointment reschedule and cancel behavior.
- Reporting checks for stage, disposition, source, and conversion math.
- TypeScript typecheck and production build.

Manual verification should include sending sample GHL webhooks for lead creation, appointment booking, appointment reschedule, and appointment cancel.

## Out Of Scope

- Replacing GHL conversations, tasks, or contact management.
- Syncing all GHL contact fields.
- Pulling data through the GHL API.
- Writing back into GHL.
- Building full marketing spend automation in the first pass.
- Letting GHL overwrite estimator-owned job outcomes.

## References

- HighLevel outbound webhook workflow action: https://help.gohighlevel.com/support/solutions/articles/155000003299-workflow-action-webhook-outbound-
- HighLevel inbound webhook workflow trigger: https://help.gohighlevel.com/support/solutions/articles/155000003147-workflow-trigger-inbound-webhook
- HighLevel contact CSV export fallback: https://help.gohighlevel.com/support/solutions/articles/48001238482-contacts-export-as-csv-upgrade
