# Routewise Integration Design

## Goal

Integrate the local Routewise Planner into the Job Estimator app while preserving the planner's scheduling and route-ranking behavior. The integrated planner must use Google Calendar as its scheduling source and must not use Job Estimator job data, install dates, customers, or estimates when calculating availability.

## Source Behavior To Preserve

The existing Routewise app scans available appointment windows in 15-minute increments inside configured working hours. It excludes windows that overlap calendar events, verifies that travel plus configured buffer time fits before and after the appointment, and ranks candidates by:

1. Least extra drive time compared with the direct route between surrounding anchors.
2. Least total drive time.
3. Least idle time.
4. Earlier day.
5. Earlier start time.

The planner should continue to show the best five feasible slots, the selected day's appointment context, before/new/after ETA legs, buffer and idle metrics, and a clear live/offline ETA source.

## App Integration

Add a new `Route Planner` page to Job Estimator's existing React/Vite app. The page will be reachable from the main sidebar for users with calendar access. It will live inside the normal app shell and follow the existing Job Estimator styling conventions rather than carrying over the standalone Routewise shell unchanged.

The planner page will be implemented as React/TypeScript modules:

- A page component for state orchestration and UI.
- A route-planning logic module for slot generation, feasibility checks, scoring, sorting, and offline ETA estimates.
- A Google Calendar module for OAuth token flow and calendar event loading.
- A settings persistence module for Supabase reads/writes.
- An ETA client module that calls the Supabase Edge Function and falls back to offline estimates.

## Data Sources

Google Calendar is the only scheduling input. The planner will load future Google Calendar events with exact start/end times and locations, then hydrate them into Routewise calendar events. Events without a usable location or exact timed bounds will be skipped and counted in diagnostics.

Job Estimator job data is explicitly out of scope for planner calculations. The planner will not query `jobs`, `customers`, install schedules, reminders, or any other estimator records to build availability.

Manual event entry and ICS import from the standalone Routewise app can remain as optional local convenience features if they do not interfere with the Google Calendar source, but they will not be synced as authoritative scheduling data.

## Settings Persistence

Use the existing Supabase `route_planner_settings` table for synced configuration:

- `home_base_address`
- `home_base_lat`
- `home_base_lng`
- `default_duration_minutes`
- `lookahead_days`
- `buffer_minutes`
- `work_start_hour`
- `work_end_hour`
- `google_client_id`
- `user_id`
- `org_id`
- `created_at`
- `updated_at`
- `deleted`
- `synced_at`

Settings should be scoped the same way as existing synced app data: organization records when the user is in an organization context, otherwise personal records for the current user. The app should create a default settings row if none exists. Writes should update `updated_at` and preserve the current org/user ownership fields.

Planner search inputs and results are transient UI state. Calendar access tokens are in-memory only and should not be stored in Supabase.

## Live ETA

Add a batched Supabase Edge Function named `routewise-eta`. The React app will call it once per planner search with the appointment address, home base, calendar anchors, and candidate route legs needed for ranking. The function will geocode addresses and retrieve drive-time estimates, returning enough data for the client to preserve the existing Routewise ranking and display behavior.

The client must keep the original offline estimate path. If the Edge Function errors, times out, is unavailable, or returns incomplete data, the planner should still produce ranked options using the offline haversine-based estimate.

The Edge Function should avoid storing request addresses or route payloads in the database. Any logging should be minimal and should not include full calendar details.

## Error Handling

The UI should show clear states for:

- Missing Google OAuth client ID.
- Google Identity Services failing to load.
- Google Calendar authorization failure.
- No calendars/events found.
- Events skipped because they lack location or exact times.
- No feasible appointment windows.
- Live ETA unavailable, with offline ETA fallback in use.
- Settings load/save failure.

These states should not block offline route estimation unless the planner lacks a target appointment address or home base.

## Security And Privacy

The Google OAuth client ID may be stored in `route_planner_settings`, but OAuth access tokens must stay in memory. The Google Calendar scope should remain read-only. The planner should not store imported Google events in Supabase unless a future feature explicitly adds that behavior.

The Edge Function should be invoked through the existing Supabase project and should not require a service-role key in the browser. Public client code must continue to use only browser-safe Supabase configuration.

## Testing And Verification

Verification should include:

- Unit or focused script checks that slot scoring and sorting match the original Routewise algorithm.
- TypeScript typecheck.
- Production build.
- Manual browser smoke test for the new page, including settings display, Google connect error handling when no client ID is configured, and offline ETA fallback.

If live Edge Function deployment is not available in the local environment, verify the client fallback path and document the deployment step.

## Out Of Scope

- Using Job Estimator jobs as route-planning events.
- Writing Google Calendar events back to Google.
- Storing calendar event copies in Supabase.
- Adding address autocomplete beyond the existing typed address input.
- Replacing the existing Job Estimator calendar page.
