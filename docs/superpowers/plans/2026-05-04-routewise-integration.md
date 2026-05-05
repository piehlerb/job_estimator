# Routewise Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Google Calendar sourced Route Planner page to Job Estimator while preserving Routewise's existing slot ranking and offline ETA fallback.

**Architecture:** Keep route planning deterministic and testable in a pure TypeScript module, then connect it to Google Calendar, Supabase settings, a batched Supabase Edge Function, and a React page. The planner must not read Job Estimator job/customer/install data.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS, lucide-react, Supabase JS v2, Supabase Edge Functions, Google Identity Services, Google Calendar API, Vitest.

---

## File Structure

- Create `src/lib/routePlanner.ts`: pure Routewise algorithm, date/time helpers, offline geocode fallback, offline route estimates, candidate generation, scoring, and live estimate refinement hook points.
- Create `src/lib/routePlanner.test.ts`: focused tests copied from the original Routwise behavior.
- Create `src/lib/routePlannerSettings.ts`: Supabase CRUD for `route_planner_settings`, scoped by user and current organization.
- Create `src/lib/googleCalendar.ts`: Google Identity Services loading, read-only token request, calendar list fetch, event fetch, event normalization.
- Create `src/lib/routewiseEta.ts`: client for the `routewise-eta` Supabase Edge Function with typed fallback behavior.
- Create `src/pages/RoutePlanner.tsx`: React UI for settings, Google connect/refresh, planner search, ranked slots, diagnostics, and ETA context.
- Create `supabase/functions/routewise-eta/index.ts`: batched geocode and drive-time function using Nominatim and OSRM with privacy-conscious logging.
- Modify `package.json`: add `test:route-planner` and Vitest dev dependency.
- Modify `src/App.tsx`: add `route-planner` page state and render path.
- Modify `src/components/Layout.tsx`: add sidebar navigation item.
- Modify `src/lib/permissions.ts`: add `route-planner` as a calendar-permitted page.
- Modify `src/types/index.ts`: add route planner settings and permission-neutral route planner types.

---

### Task 1: Test Harness And Route Planner Type Skeleton

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/lib/routePlanner.ts`
- Create: `src/lib/routePlanner.test.ts`

- [ ] **Step 1: Install Vitest**

Run:

```powershell
npm install -D vitest
```

Expected: `package.json` and `package-lock.json` update with `vitest` in `devDependencies`.

- [ ] **Step 2: Add a focused test script**

In `package.json`, add this script after `typecheck`:

```json
"test:route-planner": "vitest run src/lib/routePlanner.test.ts",
```

Expected scripts block includes:

```json
"typecheck": "tsc --noEmit -p tsconfig.app.json",
"test:route-planner": "vitest run src/lib/routePlanner.test.ts",
"predeploy": "npm run build"
```

- [ ] **Step 3: Create the failing route planner tests**

Create `src/lib/routePlanner.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  calculateRouteCandidates,
  compareCandidateSlots,
  estimateDrivingDetails,
  rankingScore,
  timeToMinutes,
} from './routePlanner';

const base = {
  address: '10 High Street, Medford, MA',
  lat: 42.4184,
  lng: -71.1062,
};

const target = {
  address: '75 Ames Street, Cambridge, MA',
  lat: 42.3633,
  lng: -71.0889,
};

const kendall = {
  id: 'existing-1',
  title: 'Client estimate',
  address: '1 Kendall Square, Cambridge, MA',
  dayOffset: 1,
  start: timeToMinutes('13:15'),
  end: timeToMinutes('14:00'),
  lat: 42.3678,
  lng: -71.0903,
};

describe('route planner helpers', () => {
  it('converts HH:mm to minutes', () => {
    expect(timeToMinutes('08:00')).toBe(480);
    expect(timeToMinutes('17:30')).toBe(1050);
  });

  it('scores lower detour before lower total drive time', () => {
    expect(rankingScore(1, 80, 0, 0, 480)).toBeLessThan(rankingScore(2, 1, 0, 0, 480));
  });

  it('sorts by Routewise ranking order', () => {
    const early = {
      id: 'early',
      dayOffset: 0,
      start: 600,
      end: 660,
      fromSource: 'Home base: 10 High Street, Medford, MA',
      toDestination: 'Home base: 10 High Street, Medford, MA',
      fromMinutes: 10,
      toMinutes: 10,
      fromMeters: 1000,
      toMeters: 1000,
      directMeters: 0,
      etaSource: 'offline estimate' as const,
      detourMinutes: 20,
      totalDriveMinutes: 20,
      bufferMinutes: 0,
      idleMinutes: 300,
      idleGap: 300,
      score: rankingScore(20, 20, 300, 0, 600),
    };
    const lessDetour = { ...early, id: 'less-detour', detourMinutes: 10, score: rankingScore(10, 40, 300, 0, 660) };
    const lowerDrive = { ...early, id: 'lower-drive', totalDriveMinutes: 12, score: rankingScore(20, 12, 300, 0, 660) };

    expect([early, lessDetour, lowerDrive].sort(compareCandidateSlots).map((slot) => slot.id)).toEqual([
      'less-detour',
      'lower-drive',
      'early',
    ]);
  });
});

describe('route candidate calculation', () => {
  it('excludes overlapping calendar events and returns ranked feasible slots', async () => {
    const candidates = await calculateRouteCandidates({
      address: target.address,
      target,
      homeBase: base.address,
      baseLocation: base,
      duration: 60,
      lookahead: 2,
      buffer: 15,
      startHour: '08:00',
      endHour: '17:30',
      calendarEvents: [kendall],
      refineEstimate: async (from, to) => estimateDrivingDetails(from, to),
    });

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates).toHaveLength(Math.min(candidates.length, 5));
    expect(candidates.some((slot) => slot.dayOffset === 1 && slot.start < kendall.end && slot.end > kendall.start)).toBe(false);
    expect(candidates[0].detourMinutes).toBeLessThanOrEqual(candidates[candidates.length - 1].detourMinutes);
  });

  it('returns no slot when working hours cannot fit duration plus travel', async () => {
    const candidates = await calculateRouteCandidates({
      address: target.address,
      target,
      homeBase: base.address,
      baseLocation: base,
      duration: 120,
      lookahead: 1,
      buffer: 15,
      startHour: '09:00',
      endHour: '10:00',
      calendarEvents: [],
      refineEstimate: async (from, to) => estimateDrivingDetails(from, to),
    });

    expect(candidates).toEqual([]);
  });
});
```

- [ ] **Step 4: Create the route planner skeleton**

Create `src/lib/routePlanner.ts`:

```ts
export interface RouteLocation {
  address: string;
  lat: number;
  lng: number;
}

export interface RouteCalendarEvent extends RouteLocation {
  id: string;
  title: string;
  dayOffset: number;
  start: number;
  end: number;
  calendarId?: string;
  googleEventId?: string;
}

export interface RouteEstimate {
  minutes: number;
  meters: number;
  source: 'offline estimate' | 'live OSRM' | 'mixed ETA' | string;
}

export interface RouteCandidate {
  id: string;
  dayOffset: number;
  start: number;
  end: number;
  previous?: RouteCalendarEvent;
  next?: RouteCalendarEvent;
  fromSource: string;
  toDestination: string;
  fromMinutes: number;
  toMinutes: number;
  fromMeters: number;
  toMeters: number;
  directMeters: number;
  etaSource: string;
  detourMinutes: number;
  totalDriveMinutes: number;
  bufferMinutes: number;
  idleMinutes: number;
  idleGap: number;
  score: number;
}

export interface CalculateRouteCandidatesInput {
  address: string;
  target: RouteLocation;
  homeBase: string;
  baseLocation: RouteLocation;
  duration: number;
  lookahead: number;
  buffer: number;
  startHour: string;
  endHour: string;
  calendarEvents: RouteCalendarEvent[];
  refineEstimate?: (from: RouteLocation, to: RouteLocation) => Promise<RouteEstimate>;
}

export function timeToMinutes(time: string): number {
  throw new Error(`Not implemented: ${time}`);
}

export function minutesToTime(total: number): string {
  throw new Error(`Not implemented: ${total}`);
}

export function estimateDrivingDetails(from: RouteLocation, to: RouteLocation): RouteEstimate {
  throw new Error(`Not implemented: ${from.address} -> ${to.address}`);
}

export function rankingScore(
  extraMinutes: number,
  totalDriveMinutes: number,
  idleGap: number,
  dayOffset: number,
  start: number
): number {
  throw new Error(`Not implemented: ${extraMinutes},${totalDriveMinutes},${idleGap},${dayOffset},${start}`);
}

export function compareCandidateSlots(a: RouteCandidate, b: RouteCandidate): number {
  throw new Error(`Not implemented: ${a.id},${b.id}`);
}

export async function calculateRouteCandidates(input: CalculateRouteCandidatesInput): Promise<RouteCandidate[]> {
  throw new Error(`Not implemented: ${input.address}`);
}
```

- [ ] **Step 5: Run the tests and verify they fail for missing implementation**

Run:

```powershell
npm run test:route-planner
```

Expected: FAIL with errors containing `Not implemented`.

- [ ] **Step 6: Commit the test harness**

Run:

```powershell
git add -- package.json package-lock.json src/lib/routePlanner.ts src/lib/routePlanner.test.ts
git commit -m "test: add route planner behavior tests"
```

Expected: commit succeeds and includes only these files.

---

### Task 2: Port Routewise Algorithm Into TypeScript

**Files:**
- Modify: `src/lib/routePlanner.ts`
- Modify: `src/lib/routePlanner.test.ts`

- [ ] **Step 1: Implement Routewise helpers and candidate generation**

Replace `src/lib/routePlanner.ts` with:

```ts
export interface RouteLocation {
  address: string;
  lat: number;
  lng: number;
}

export interface RouteCalendarEvent extends RouteLocation {
  id: string;
  title: string;
  dayOffset: number;
  start: number;
  end: number;
  calendarId?: string;
  googleEventId?: string;
}

export interface RouteEstimate {
  minutes: number;
  meters: number;
  source: 'offline estimate' | 'live OSRM' | 'mixed ETA' | string;
}

export interface RouteCandidate {
  id: string;
  dayOffset: number;
  start: number;
  end: number;
  previous?: RouteCalendarEvent;
  next?: RouteCalendarEvent;
  fromSource: string;
  toDestination: string;
  fromMinutes: number;
  toMinutes: number;
  fromMeters: number;
  toMeters: number;
  directMeters: number;
  etaSource: string;
  detourMinutes: number;
  totalDriveMinutes: number;
  bufferMinutes: number;
  idleMinutes: number;
  idleGap: number;
  score: number;
}

export interface CalculateRouteCandidatesInput {
  address: string;
  target: RouteLocation;
  homeBase: string;
  baseLocation: RouteLocation;
  duration: number;
  lookahead: number;
  buffer: number;
  startHour: string;
  endHour: string;
  calendarEvents: RouteCalendarEvent[];
  refineEstimate?: (from: RouteLocation, to: RouteLocation) => Promise<RouteEstimate>;
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function formatMiles(meters = 0): string {
  const miles = meters / 1609.344;
  if (!Number.isFinite(miles)) return '0 mi';
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

export function dateLabel(offset: number, baseDate = new Date()): string {
  const date = new Date(baseDate);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
}

export function dayOffsetFromDate(dateInput: string, baseDate = new Date()): number {
  const today = new Date(baseDate);
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${dateInput}T00:00:00`);
  date.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86400000);
}

export function geocodeAddressOffline(address: string): RouteLocation {
  let hash = 0;
  for (const char of address.toLowerCase()) {
    hash = (hash * 31 + char.charCodeAt(0)) % 100000;
  }
  return {
    address,
    lat: 42.32 + (hash % 900) / 10000,
    lng: -71.14 + (Math.floor(hash / 13) % 950) / 10000,
  };
}

export function estimateDrivingDetails(from: RouteLocation, to: RouteLocation): RouteEstimate {
  const miles = haversineMiles(from.lat, from.lng, to.lat, to.lng) * routeFactor(from, to);
  return {
    minutes: Math.ceil((miles / 21) * 60 + 6),
    meters: Math.round(miles * 1609.344),
    source: 'offline estimate',
  };
}

export function rankingScore(
  extraMinutes: number,
  totalDriveMinutes: number,
  idleGap: number,
  dayOffset: number,
  start: number
): number {
  return extraMinutes * 100000 + totalDriveMinutes * 1000 + Math.max(0, idleGap) + dayOffset * 0.1 + start / 10000;
}

export function compareCandidateSlots(a: RouteCandidate, b: RouteCandidate): number {
  return (
    a.detourMinutes - b.detourMinutes ||
    a.totalDriveMinutes - b.totalDriveMinutes ||
    a.idleMinutes - b.idleMinutes ||
    a.dayOffset - b.dayOffset ||
    a.start - b.start
  );
}

export async function calculateRouteCandidates(input: CalculateRouteCandidatesInput): Promise<RouteCandidate[]> {
  const workStart = timeToMinutes(input.startHour);
  const workEnd = timeToMinutes(input.endHour);
  const step = 15;
  const candidates: RouteCandidate[] = [];

  for (let dayOffset = 0; dayOffset < input.lookahead; dayOffset++) {
    const dayEvents = input.calendarEvents
      .filter((item) => item.dayOffset === dayOffset)
      .sort((a, b) => a.start - b.start);

    for (let start = workStart; start + input.duration <= workEnd; start += step) {
      const end = start + input.duration;
      const previous = [...dayEvents].reverse().find((item) => item.end <= start);
      const next = dayEvents.find((item) => item.start >= end);
      const overlaps = dayEvents.some((item) => start < item.end && end > item.start);
      if (overlaps) continue;

      const fromAnchor = previous ?? input.baseLocation;
      const toAnchor = next ?? input.baseLocation;
      const fromEstimate = estimateDrivingDetails(fromAnchor, input.target);
      const toEstimate = estimateDrivingDetails(input.target, toAnchor);
      const beforeWorks = previous
        ? previous.end + fromEstimate.minutes + input.buffer <= start
        : workStart + fromEstimate.minutes <= start;
      const afterWorks = next
        ? end + toEstimate.minutes + input.buffer <= next.start
        : end + toEstimate.minutes <= workEnd;
      if (!beforeWorks || !afterWorks) continue;

      const directEstimate = previous || next ? estimateDrivingDetails(fromAnchor, toAnchor) : undefined;
      candidates.push(
        buildCandidate({
          dayOffset,
          start,
          end,
          previous,
          next,
          fromEstimate,
          toEstimate,
          directEstimate,
          input,
        })
      );
    }
  }

  const promising = candidates.sort(compareCandidateSlots).slice(0, 16);
  const refined = await Promise.all(promising.map((slot) => refineCandidateWithEta(slot, input)));
  return refined.filter((slot): slot is RouteCandidate => Boolean(slot)).sort(compareCandidateSlots).slice(0, 5);
}

function buildCandidate(args: {
  dayOffset: number;
  start: number;
  end: number;
  previous?: RouteCalendarEvent;
  next?: RouteCalendarEvent;
  fromEstimate: RouteEstimate;
  toEstimate: RouteEstimate;
  directEstimate?: RouteEstimate;
  input: CalculateRouteCandidatesInput;
}): RouteCandidate {
  const direct = args.directEstimate?.minutes ?? 0;
  const detourMinutes = Math.max(0, args.fromEstimate.minutes + args.toEstimate.minutes - direct);
  const idleGap =
    (args.previous ? args.start - args.previous.end - args.fromEstimate.minutes : timeToMinutes(args.input.endHour) - timeToMinutes(args.input.endHour) + args.start - timeToMinutes(args.input.startHour) - args.fromEstimate.minutes) +
    (args.next ? args.next.start - args.end - args.toEstimate.minutes : timeToMinutes(args.input.endHour) - args.end - args.toEstimate.minutes);
  const bufferMinutes = slotBufferMinutes(args.previous, args.next, args.input.buffer);
  const idleMinutes = Math.max(0, idleGap - bufferMinutes);
  const totalDriveMinutes = args.fromEstimate.minutes + args.toEstimate.minutes;
  const score = rankingScore(detourMinutes, totalDriveMinutes, idleMinutes, args.dayOffset, args.start);

  return {
    id: `${args.dayOffset}-${args.start}`,
    dayOffset: args.dayOffset,
    start: args.start,
    end: args.end,
    previous: args.previous,
    next: args.next,
    fromSource: args.previous ? args.previous.title : `Home base: ${args.input.homeBase}`,
    toDestination: args.next ? args.next.title : `Home base: ${args.input.homeBase}`,
    fromMinutes: args.fromEstimate.minutes,
    toMinutes: args.toEstimate.minutes,
    fromMeters: args.fromEstimate.meters,
    toMeters: args.toEstimate.meters,
    directMeters: args.directEstimate?.meters ?? 0,
    etaSource: args.fromEstimate.source === args.toEstimate.source ? args.fromEstimate.source : 'mixed ETA',
    detourMinutes,
    totalDriveMinutes,
    bufferMinutes,
    idleMinutes,
    idleGap,
    score,
  };
}

async function refineCandidateWithEta(
  slot: RouteCandidate,
  input: CalculateRouteCandidatesInput
): Promise<RouteCandidate | null> {
  if (!input.refineEstimate) return slot;

  const workStart = timeToMinutes(input.startHour);
  const workEnd = timeToMinutes(input.endHour);
  const fromAnchor = slot.previous ?? input.baseLocation;
  const toAnchor = slot.next ?? input.baseLocation;
  const [fromEstimate, toEstimate, directEstimate] = await Promise.all([
    input.refineEstimate(fromAnchor, input.target),
    input.refineEstimate(input.target, toAnchor),
    slot.previous || slot.next
      ? input.refineEstimate(fromAnchor, toAnchor)
      : Promise.resolve({ minutes: 0, meters: 0, source: 'not needed' }),
  ]);

  const beforeWorks = slot.previous
    ? slot.previous.end + fromEstimate.minutes + input.buffer <= slot.start
    : workStart + fromEstimate.minutes <= slot.start;
  const afterWorks = slot.next
    ? slot.end + toEstimate.minutes + input.buffer <= slot.next.start
    : slot.end + toEstimate.minutes <= workEnd;
  if (!beforeWorks || !afterWorks) return null;

  return buildCandidate({
    dayOffset: slot.dayOffset,
    start: slot.start,
    end: slot.end,
    previous: slot.previous,
    next: slot.next,
    fromEstimate,
    toEstimate,
    directEstimate,
    input,
  });
}

function slotBufferMinutes(previous: RouteCalendarEvent | undefined, next: RouteCalendarEvent | undefined, buffer: number): number {
  return (previous ? buffer : 0) + (next ? buffer : 0);
}

function routeFactor(from: RouteLocation, to: RouteLocation): number {
  return Math.abs(from.lat - to.lat) > Math.abs(from.lng - to.lng) ? 1.28 : 1.42;
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadius = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

- [ ] **Step 2: Tighten the idle-gap calculation**

In `buildCandidate`, replace the `idleGap` expression with this clearer equivalent:

```ts
  const workStart = timeToMinutes(args.input.startHour);
  const workEnd = timeToMinutes(args.input.endHour);
  const idleGap =
    (args.previous ? args.start - args.previous.end - args.fromEstimate.minutes : args.start - workStart - args.fromEstimate.minutes) +
    (args.next ? args.next.start - args.end - args.toEstimate.minutes : workEnd - args.end - args.toEstimate.minutes);
```

Expected: no `timeToMinutes(args.input.endHour) - timeToMinutes(args.input.endHour)` expression remains.

- [ ] **Step 3: Add a regression test for live refinement filtering**

Append to `src/lib/routePlanner.test.ts`:

```ts
it('drops promising offline slots that fail live ETA refinement', async () => {
  const candidates = await calculateRouteCandidates({
    address: target.address,
    target,
    homeBase: base.address,
    baseLocation: base,
    duration: 60,
    lookahead: 1,
    buffer: 15,
    startHour: '08:00',
    endHour: '17:30',
    calendarEvents: [],
    refineEstimate: async () => ({ minutes: 600, meters: 100000, source: 'live OSRM' }),
  });

  expect(candidates).toEqual([]);
});
```

- [ ] **Step 4: Run route planner tests**

Run:

```powershell
npm run test:route-planner
```

Expected: PASS for all route planner tests.

- [ ] **Step 5: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the algorithm port**

Run:

```powershell
git add -- src/lib/routePlanner.ts src/lib/routePlanner.test.ts
git commit -m "feat: port Routewise planning logic"
```

Expected: commit succeeds.

---

### Task 3: Supabase Settings Persistence

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/lib/routePlannerSettings.ts`
- Create: `src/lib/routePlannerSettings.test.ts`

- [ ] **Step 1: Add route planner settings types**

Append to `src/types/index.ts` before the sync types section:

```ts
export interface RoutePlannerSettings {
  id: string;
  userId?: string;
  orgId?: string | null;
  homeBaseAddress: string;
  homeBaseLat?: number | null;
  homeBaseLng?: number | null;
  defaultDurationMinutes: number;
  lookaheadDays: number;
  bufferMinutes: number;
  workStartHour: string;
  workEndHour: string;
  googleClientId?: string | null;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
  syncedAt?: string | null;
}
```

- [ ] **Step 2: Add settings tests for mapping/defaults**

Create `src/lib/routePlannerSettings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDefaultRoutePlannerSettings, mapRoutePlannerSettingsFromSupabase, mapRoutePlannerSettingsToSupabase } from './routePlannerSettings';

describe('route planner settings mapping', () => {
  it('creates stable defaults for a personal account', () => {
    const now = '2026-05-04T12:00:00.000Z';
    expect(createDefaultRoutePlannerSettings({ userId: 'user-1', orgId: null, now })).toMatchObject({
      id: 'current',
      userId: 'user-1',
      orgId: null,
      homeBaseAddress: '',
      defaultDurationMinutes: 60,
      lookaheadDays: 7,
      bufferMinutes: 15,
      workStartHour: '08:00',
      workEndHour: '17:30',
      googleClientId: '',
      createdAt: now,
      updatedAt: now,
      deleted: false,
    });
  });

  it('maps Supabase snake_case to app camelCase', () => {
    const mapped = mapRoutePlannerSettingsFromSupabase({
      id: 'current',
      user_id: 'user-1',
      org_id: 'org-1',
      home_base_address: '10 High Street, Medford, MA',
      home_base_lat: 42.4184,
      home_base_lng: -71.1062,
      default_duration_minutes: 45,
      lookahead_days: 10,
      buffer_minutes: 20,
      work_start_hour: '09:00',
      work_end_hour: '16:30',
      google_client_id: 'client.apps.googleusercontent.com',
      created_at: '2026-05-04T12:00:00.000Z',
      updated_at: '2026-05-04T12:01:00.000Z',
      deleted: false,
      synced_at: '2026-05-04T12:02:00.000Z',
    });

    expect(mapped.homeBaseAddress).toBe('10 High Street, Medford, MA');
    expect(mapped.defaultDurationMinutes).toBe(45);
    expect(mapped.googleClientId).toBe('client.apps.googleusercontent.com');
  });

  it('maps app settings to Supabase snake_case with ownership fields', () => {
    const now = '2026-05-04T12:00:00.000Z';
    const row = mapRoutePlannerSettingsToSupabase(
      createDefaultRoutePlannerSettings({ userId: 'user-1', orgId: 'org-1', now }),
      now
    );

    expect(row).toMatchObject({
      id: 'current',
      user_id: 'user-1',
      org_id: 'org-1',
      default_duration_minutes: 60,
      lookahead_days: 7,
      buffer_minutes: 15,
      work_start_hour: '08:00',
      work_end_hour: '17:30',
      updated_at: now,
      deleted: false,
    });
  });
});
```

- [ ] **Step 3: Add `routePlannerSettings.test.ts` to the script**

In `package.json`, update the route planner script:

```json
"test:route-planner": "vitest run src/lib/routePlanner.test.ts src/lib/routePlannerSettings.test.ts",
```

- [ ] **Step 4: Create the settings service**

Create `src/lib/routePlannerSettings.ts`:

```ts
import { supabase } from './supabase';
import { getCurrentUser } from './auth';
import { getSyncOrgContext } from './sync';
import type { RoutePlannerSettings } from '../types';

interface SupabaseRoutePlannerSettingsRow {
  id: string;
  user_id: string;
  org_id: string | null;
  home_base_address: string | null;
  home_base_lat: number | null;
  home_base_lng: number | null;
  default_duration_minutes: number | null;
  lookahead_days: number | null;
  buffer_minutes: number | null;
  work_start_hour: string | null;
  work_end_hour: string | null;
  google_client_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted: boolean | null;
  synced_at: string | null;
}

export function createDefaultRoutePlannerSettings(args: {
  userId: string;
  orgId: string | null;
  now?: string;
}): RoutePlannerSettings {
  const now = args.now ?? new Date().toISOString();
  return {
    id: 'current',
    userId: args.userId,
    orgId: args.orgId,
    homeBaseAddress: '',
    homeBaseLat: null,
    homeBaseLng: null,
    defaultDurationMinutes: 60,
    lookaheadDays: 7,
    bufferMinutes: 15,
    workStartHour: '08:00',
    workEndHour: '17:30',
    googleClientId: '',
    createdAt: now,
    updatedAt: now,
    deleted: false,
    syncedAt: null,
  };
}

export function mapRoutePlannerSettingsFromSupabase(row: SupabaseRoutePlannerSettingsRow): RoutePlannerSettings {
  const now = new Date().toISOString();
  return {
    id: row.id,
    userId: row.user_id,
    orgId: row.org_id,
    homeBaseAddress: row.home_base_address ?? '',
    homeBaseLat: row.home_base_lat,
    homeBaseLng: row.home_base_lng,
    defaultDurationMinutes: row.default_duration_minutes ?? 60,
    lookaheadDays: row.lookahead_days ?? 7,
    bufferMinutes: row.buffer_minutes ?? 15,
    workStartHour: row.work_start_hour ?? '08:00',
    workEndHour: row.work_end_hour ?? '17:30',
    googleClientId: row.google_client_id ?? '',
    createdAt: row.created_at ?? now,
    updatedAt: row.updated_at ?? now,
    deleted: row.deleted ?? false,
    syncedAt: row.synced_at,
  };
}

export function mapRoutePlannerSettingsToSupabase(settings: RoutePlannerSettings, now = new Date().toISOString()) {
  return {
    id: settings.id,
    user_id: settings.userId,
    org_id: settings.orgId ?? null,
    home_base_address: settings.homeBaseAddress || null,
    home_base_lat: settings.homeBaseLat ?? null,
    home_base_lng: settings.homeBaseLng ?? null,
    default_duration_minutes: settings.defaultDurationMinutes,
    lookahead_days: settings.lookaheadDays,
    buffer_minutes: settings.bufferMinutes,
    work_start_hour: settings.workStartHour,
    work_end_hour: settings.workEndHour,
    google_client_id: settings.googleClientId || null,
    created_at: settings.createdAt,
    updated_at: now,
    deleted: settings.deleted ?? false,
    synced_at: now,
  };
}

export async function getRoutePlannerSettings(): Promise<RoutePlannerSettings> {
  const user = await getCurrentUser();
  if (!user) throw new Error('User not authenticated');

  const orgId = getSyncOrgContext();
  let query = supabase.from('route_planner_settings').select('*').eq('id', 'current').eq('deleted', false);
  query = orgId ? query.eq('org_id', orgId) : query.eq('user_id', user.id).is('org_id', null);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (data) return mapRoutePlannerSettingsFromSupabase(data as SupabaseRoutePlannerSettingsRow);

  const settings = createDefaultRoutePlannerSettings({ userId: user.id, orgId });
  await saveRoutePlannerSettings(settings);
  return settings;
}

export async function saveRoutePlannerSettings(settings: RoutePlannerSettings): Promise<RoutePlannerSettings> {
  const user = await getCurrentUser();
  if (!user) throw new Error('User not authenticated');

  const orgId = getSyncOrgContext();
  const now = new Date().toISOString();
  const normalized: RoutePlannerSettings = {
    ...settings,
    id: 'current',
    userId: user.id,
    orgId,
    updatedAt: now,
  };

  const { data, error } = await supabase
    .from('route_planner_settings')
    .upsert(mapRoutePlannerSettingsToSupabase(normalized, now), { onConflict: 'id' })
    .select('*')
    .single();

  if (error) throw error;
  return mapRoutePlannerSettingsFromSupabase(data as SupabaseRoutePlannerSettingsRow);
}
```

- [ ] **Step 5: Run settings tests**

Run:

```powershell
npm run test:route-planner
```

Expected: PASS for route planner and settings tests.

- [ ] **Step 6: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit settings persistence**

Run:

```powershell
git add -- package.json src/types/index.ts src/lib/routePlannerSettings.ts src/lib/routePlannerSettings.test.ts
git commit -m "feat: add route planner settings service"
```

Expected: commit succeeds.

---

### Task 4: Google Calendar Module

**Files:**
- Create: `src/lib/googleCalendar.ts`
- Modify: `src/lib/routePlanner.test.ts`

- [ ] **Step 1: Create Google Calendar integration module**

Create `src/lib/googleCalendar.ts`:

```ts
import { dayOffsetFromDate, timeToMinutes, type RouteCalendarEvent } from './routePlanner';
import { geocodeWithRoutewiseEta } from './routewiseEta';

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt: string;
            callback: (response: { access_token?: string; scope?: string; error?: string; error_description?: string }) => void;
            error_callback?: (error: { message?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

export interface GoogleCalendarDiagnostics {
  calendarsChecked: number;
  totalEvents: number;
  timedEvents: number;
  withLocation: number;
  skipped: number;
  loaded: number;
}

export interface GoogleCalendarLoadResult {
  events: RouteCalendarEvent[];
  diagnostics: GoogleCalendarDiagnostics;
}

let googleToken = '';
let googleTokenScope = '';
let googleScriptPromise: Promise<void> | null = null;

export async function loadGoogleCalendarEvents(args: {
  googleClientId: string;
  lookaheadDays: number;
}): Promise<GoogleCalendarLoadResult> {
  if (!args.googleClientId.trim()) throw new Error('Add your Google OAuth client ID first.');

  await requestGoogleToken(args.googleClientId, 'https://www.googleapis.com/auth/calendar.readonly');
  const { events, diagnostics } = await fetchGoogleCalendarEvents(args.lookaheadDays);
  const hydrated = await hydrateCalendarEvents(events, args.lookaheadDays);

  return {
    events: hydrated,
    diagnostics: {
      ...diagnostics,
      loaded: hydrated.length,
    },
  };
}

async function requestGoogleToken(clientId: string, scope: string): Promise<string> {
  await waitForGoogleIdentity();
  if (googleToken && googleTokenScope.includes(scope)) return googleToken;

  return new Promise((resolve, reject) => {
    const tokenClient = window.google?.accounts?.oauth2?.initTokenClient({
      client_id: clientId,
      scope,
      prompt: googleToken ? '' : 'consent',
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        googleToken = response.access_token || '';
        googleTokenScope = response.scope || scope;
        resolve(googleToken);
      },
      error_callback: (error) => reject(new Error(error.message || 'Google authorization failed.')),
    });
    if (!tokenClient) {
      reject(new Error('Google Identity Services did not load.'));
      return;
    }
    tokenClient.requestAccessToken();
  });
}

async function waitForGoogleIdentity(): Promise<void> {
  if (window.google?.accounts?.oauth2) return;
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity="true"]');
      const script = existing ?? document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentity = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Google Identity Services did not load.'));
      if (!existing) document.head.appendChild(script);
    });
  }
  await googleScriptPromise;
  if (!window.google?.accounts?.oauth2) throw new Error('Google Identity Services did not load.');
}

async function fetchGoogleCalendarEvents(lookaheadDays: number) {
  const timeMin = new Date();
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + lookaheadDays);

  const calendars = await fetchGoogleCalendarList();
  const usableCalendars = calendars.filter(
    (calendar) =>
      !calendar.deleted &&
      !calendar.hidden &&
      calendar.accessRole !== 'freeBusyReader' &&
      calendar.accessRole !== 'none'
  );
  const eventGroups = await Promise.all(
    usableCalendars.map((calendar) => fetchGoogleCalendarEventsForCalendar(calendar, timeMin, timeMax))
  );
  const rawEvents = eventGroups.flat();
  const timed = rawEvents.filter((event) => event.start?.dateTime && event.end?.dateTime);
  const withLocation = timed.filter((event) => event.location);

  return {
    events: withLocation,
    diagnostics: {
      calendarsChecked: usableCalendars.length,
      totalEvents: rawEvents.length,
      timedEvents: timed.length,
      withLocation: withLocation.length,
      skipped: rawEvents.length - withLocation.length,
      loaded: 0,
    },
  };
}

async function fetchGoogleCalendarList(): Promise<any[]> {
  const url = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList');
  url.searchParams.set('maxResults', '250');
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${googleToken}` },
  });
  if (!response.ok) throw new Error(`Google Calendar list failed (${response.status}).`);
  const payload = await response.json();
  return payload.items || [];
}

async function fetchGoogleCalendarEventsForCalendar(calendar: any, timeMin: Date, timeMax: Date): Promise<any[]> {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events`);
  url.searchParams.set('timeMin', timeMin.toISOString());
  url.searchParams.set('timeMax', timeMax.toISOString());
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '250');

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${googleToken}` },
  });
  if (!response.ok) return [];
  const payload = await response.json();
  return (payload.items || []).map((event: any) => ({
    ...event,
    calendarId: calendar.id,
    calendarSummary: calendar.summary,
  }));
}

async function hydrateCalendarEvents(events: any[], lookaheadDays: number): Promise<RouteCalendarEvent[]> {
  const hydrated = await Promise.all(
    events.map(async (event) => {
      const start = new Date(event.start.dateTime);
      const end = new Date(event.end.dateTime);
      const place = await geocodeWithRoutewiseEta(event.location);
      return {
        id: `google-${event.id}`,
        calendarId: event.calendarId,
        googleEventId: event.id,
        title: event.calendarSummary ? `${event.summary || 'Calendar event'} (${event.calendarSummary})` : event.summary || 'Calendar event',
        address: event.location,
        dayOffset: dayOffsetFromDate(start.toISOString().slice(0, 10)),
        start: start.getHours() * 60 + start.getMinutes(),
        end: end.getHours() * 60 + end.getMinutes(),
        lat: place.lat,
        lng: place.lng,
      };
    })
  );

  return hydrated.filter((event) => event.dayOffset >= 0 && event.dayOffset < lookaheadDays && event.end > event.start);
}

export function parseManualEventTime(time: string): number {
  return timeToMinutes(time);
}
```

- [ ] **Step 2: Ensure typecheck exposes the missing ETA dependency**

Run:

```powershell
npm run typecheck
```

Expected: FAIL because `./routewiseEta` does not exist yet. This confirms Task 5 is the next dependency.

- [ ] **Step 3: Commit Google Calendar module after Task 5 dependency exists**

Do not commit yet. Commit this file together with Task 5 after typecheck passes.

---

### Task 5: Routewise ETA Client And Supabase Edge Function

**Files:**
- Create: `src/lib/routewiseEta.ts`
- Create: `supabase/functions/routewise-eta/index.ts`
- Modify: `src/lib/googleCalendar.ts`

- [ ] **Step 1: Create the browser ETA client**

Create `src/lib/routewiseEta.ts`:

```ts
import { supabase } from './supabase';
import { estimateDrivingDetails, geocodeAddressOffline, type RouteEstimate, type RouteLocation } from './routePlanner';

interface EtaFunctionResponse {
  geocoded?: RouteLocation[];
  routes?: Array<{
    key: string;
    minutes: number;
    meters: number;
    source: string;
  }>;
}

const geocodeCache = new Map<string, Promise<RouteLocation>>();
const routeCache = new Map<string, Promise<RouteEstimate>>();

export async function geocodeWithRoutewiseEta(address: string): Promise<RouteLocation> {
  if (geocodeCache.has(address)) return geocodeCache.get(address)!;
  const request = invokeEtaFunction({ addresses: [address], routes: [] })
    .then((payload) => payload.geocoded?.[0] ?? geocodeAddressOffline(address))
    .catch(() => geocodeAddressOffline(address));
  geocodeCache.set(address, request);
  return request;
}

export async function estimateDrivingDetailsLive(from: RouteLocation, to: RouteLocation): Promise<RouteEstimate> {
  const key = routeKey(from, to);
  if (routeCache.has(key)) return routeCache.get(key)!;
  const fallback = estimateDrivingDetails(from, to);
  const request = invokeEtaFunction({ addresses: [], routes: [{ key, from, to }] })
    .then((payload) => {
      const route = payload.routes?.find((item) => item.key === key);
      if (!route) return fallback;
      return {
        minutes: Number(route.minutes) || fallback.minutes,
        meters: Number(route.meters) || fallback.meters,
        source: route.source || 'live OSRM',
      };
    })
    .catch(() => fallback);
  routeCache.set(key, request);
  return request;
}

export async function invokeEtaFunction(body: {
  addresses: string[];
  routes: Array<{ key: string; from: RouteLocation; to: RouteLocation }>;
}): Promise<EtaFunctionResponse> {
  const { data, error } = await supabase.functions.invoke<EtaFunctionResponse>('routewise-eta', { body });
  if (error) throw error;
  return data ?? {};
}

function routeKey(from: RouteLocation, to: RouteLocation): string {
  return `${from.lat.toFixed(5)},${from.lng.toFixed(5)}>${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
}
```

- [ ] **Step 2: Create the Supabase Edge Function**

Create `supabase/functions/routewise-eta/index.ts`:

```ts
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

interface RouteLocation {
  address: string;
  lat: number;
  lng: number;
}

interface RouteRequest {
  key: string;
  from: RouteLocation;
  to: RouteLocation;
}

interface EtaRequest {
  addresses?: string[];
  routes?: RouteRequest[];
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as EtaRequest;
    const addresses = Array.from(new Set((body.addresses ?? []).filter((address) => address.trim()).slice(0, 20)));
    const routes = (body.routes ?? []).slice(0, 64);

    const [geocoded, routeResults] = await Promise.all([
      Promise.all(addresses.map(geocodeAddress)),
      Promise.all(routes.map(routeDriveTime)),
    ]);

    return json(200, {
      geocoded: geocoded.filter(Boolean),
      routes: routeResults.filter(Boolean),
    });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Routewise ETA failed' });
  }
});

async function geocodeAddress(address: string): Promise<RouteLocation | null> {
  const upstream = new URL('https://nominatim.openstreetmap.org/search');
  upstream.searchParams.set('format', 'jsonv2');
  upstream.searchParams.set('limit', '1');
  upstream.searchParams.set('q', address);

  const result = await fetch(upstream, {
    headers: {
      'User-Agent': 'JobEstimatorRoutewise/1.0',
    },
  });
  if (!result.ok) return null;
  const places = await result.json();
  if (!places.length) return null;

  return {
    address,
    lat: Number(places[0].lat),
    lng: Number(places[0].lon),
  };
}

async function routeDriveTime(route: RouteRequest) {
  const upstream = `https://router.project-osrm.org/route/v1/driving/${route.from.lng},${route.from.lat};${route.to.lng},${route.to.lat}?overview=false`;
  const result = await fetch(upstream);
  if (!result.ok) return null;
  const payload = await result.json();
  const selectedRoute = payload.routes?.[0];
  if (!selectedRoute) return null;

  return {
    key: route.key,
    minutes: Math.max(1, Math.ceil(selectedRoute.duration / 60)),
    meters: Math.round(selectedRoute.distance),
    source: 'live OSRM',
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
```

- [ ] **Step 3: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS for app TypeScript. The Deno Edge Function is outside `tsconfig.app.json`, so this command does not typecheck it.

- [ ] **Step 4: Run route planner tests**

Run:

```powershell
npm run test:route-planner
```

Expected: PASS.

- [ ] **Step 5: Commit Google Calendar and ETA layers**

Run:

```powershell
git add -- src/lib/googleCalendar.ts src/lib/routewiseEta.ts supabase/functions/routewise-eta/index.ts
git commit -m "feat: add Google Calendar and live ETA clients"
```

Expected: commit succeeds.

---

### Task 6: Route Planner React Page

**Files:**
- Create: `src/pages/RoutePlanner.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/Layout.tsx`
- Modify: `src/lib/permissions.ts`

- [ ] **Step 1: Add the React page**

Create `src/pages/RoutePlanner.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Clock, MapPin, Navigation, RefreshCw, Save, Settings, TriangleAlert } from 'lucide-react';
import { loadGoogleCalendarEvents, type GoogleCalendarDiagnostics } from '../lib/googleCalendar';
import {
  calculateRouteCandidates,
  dateLabel,
  estimateDrivingDetails,
  formatMiles,
  geocodeAddressOffline,
  minutesToTime,
  type RouteCalendarEvent,
  type RouteCandidate,
} from '../lib/routePlanner';
import { estimateDrivingDetailsLive, geocodeWithRoutewiseEta } from '../lib/routewiseEta';
import { getRoutePlannerSettings, saveRoutePlannerSettings } from '../lib/routePlannerSettings';
import type { RoutePlannerSettings } from '../types';

const defaultDiagnostics: GoogleCalendarDiagnostics = {
  calendarsChecked: 0,
  totalEvents: 0,
  timedEvents: 0,
  withLocation: 0,
  skipped: 0,
  loaded: 0,
};

export default function RoutePlanner() {
  const [settings, setSettings] = useState<RoutePlannerSettings | null>(null);
  const [address, setAddress] = useState('');
  const [duration, setDuration] = useState(60);
  const [calendarEvents, setCalendarEvents] = useState<RouteCalendarEvent[]>([]);
  const [diagnostics, setDiagnostics] = useState(defaultDiagnostics);
  const [candidates, setCandidates] = useState<RouteCandidate[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [notice, setNotice] = useState('');
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [searching, setSearching] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    getRoutePlannerSettings()
      .then((loaded) => {
        setSettings(loaded);
        setDuration(loaded.defaultDurationMinutes);
      })
      .catch((error) => setNotice(error.message || 'Could not load route planner settings.'))
      .finally(() => setLoadingSettings(false));
  }, []);

  const selectedSlot = useMemo(
    () => candidates.find((slot) => slot.id === selectedSlotId) ?? candidates[0],
    [candidates, selectedSlotId]
  );

  const updateSetting = <K extends keyof RoutePlannerSettings>(key: K, value: RoutePlannerSettings[K]) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    setNotice('');
    try {
      const base = settings.homeBaseAddress ? await geocodeWithRoutewiseEta(settings.homeBaseAddress) : null;
      const saved = await saveRoutePlannerSettings({
        ...settings,
        homeBaseLat: base?.lat ?? settings.homeBaseLat ?? null,
        homeBaseLng: base?.lng ?? settings.homeBaseLng ?? null,
      });
      setSettings(saved);
      setDuration(saved.defaultDurationMinutes);
      setNotice('Route planner settings saved.');
    } catch (error: any) {
      setNotice(error.message || 'Could not save route planner settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleConnectCalendar = async () => {
    if (!settings) return;
    setLoadingCalendar(true);
    setNotice('');
    try {
      const result = await loadGoogleCalendarEvents({
        googleClientId: settings.googleClientId || '',
        lookaheadDays: settings.lookaheadDays,
      });
      setCalendarEvents(result.events);
      setDiagnostics(result.diagnostics);
      setNotice(`Loaded ${result.events.length} located Google Calendar event${result.events.length === 1 ? '' : 's'}.`);
    } catch (error: any) {
      setNotice(error.message || 'Could not load Google Calendar events.');
    } finally {
      setLoadingCalendar(false);
    }
  };

  const handleFindSlots = async () => {
    if (!settings) return;
    if (!address.trim()) {
      setNotice('Enter an appointment address.');
      return;
    }
    if (!settings.homeBaseAddress.trim()) {
      setNotice('Set a home base before searching.');
      return;
    }

    setSearching(true);
    setNotice('');
    setUsedFallback(false);

    try {
      const [target, baseLocation] = await Promise.all([
        geocodeWithRoutewiseEta(address.trim()).catch(() => {
          setUsedFallback(true);
          return geocodeAddressOffline(address.trim());
        }),
        geocodeWithRoutewiseEta(settings.homeBaseAddress.trim()).catch(() => {
          setUsedFallback(true);
          return geocodeAddressOffline(settings.homeBaseAddress.trim());
        }),
      ]);

      const results = await calculateRouteCandidates({
        address: address.trim(),
        target,
        homeBase: settings.homeBaseAddress,
        baseLocation,
        duration,
        lookahead: settings.lookaheadDays,
        buffer: settings.bufferMinutes,
        startHour: settings.workStartHour,
        endHour: settings.workEndHour,
        calendarEvents,
        refineEstimate: async (from, to) => {
          try {
            return await estimateDrivingDetailsLive(from, to);
          } catch {
            setUsedFallback(true);
            return estimateDrivingDetails(from, to);
          }
        },
      });

      setCandidates(results);
      setSelectedSlotId(results[0]?.id ?? '');
      if (!results.length) setNotice('No feasible windows found. Try shorter duration, lower buffer, or wider work hours.');
    } catch (error: any) {
      setNotice(error.message || 'Could not calculate route options.');
    } finally {
      setSearching(false);
    }
  };

  if (loadingSettings || !settings) {
    return (
      <div className="min-h-full bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">Loading route planner...</div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">
      <div className="mx-auto grid max-w-7xl gap-4 xl:grid-cols-[360px_minmax(420px,1fr)_360px]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-gf-lime">Route Planner</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">Find the best day and time.</h1>
            </div>
            <Navigation className="mt-1 text-slate-400" size={22} />
          </div>

          <label className="block text-sm font-semibold text-slate-700">
            Appointment address
            <input className="form-input mt-2" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="123 Main Street, City, ST" />
          </label>

          <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
            <label className="block text-sm font-semibold text-slate-700">
              Duration
              <div className="mt-2 flex items-center rounded-lg border border-slate-300">
                <input className="w-full rounded-lg px-4 py-2" type="number" min={15} max={240} step={15} value={duration} onChange={(event) => setDuration(Number(event.target.value))} />
                <span className="pr-3 text-sm text-slate-500">min</span>
              </div>
            </label>
          <button className="btn-primary mt-7 inline-flex items-center gap-2 disabled:opacity-60" onClick={handleFindSlots} disabled={searching}>
              {searching ? <RefreshCw className="animate-spin" size={18} /> : <Clock size={18} />}
              {searching ? 'Finding' : 'Find'}
            </button>
          </div>

          <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
            <p>Home base: {settings.homeBaseAddress || 'Not set'}</p>
            <p>{settings.bufferMinutes} min buffer</p>
            <p>{settings.workStartHour} - {settings.workEndHour}</p>
            <p>{calendarEvents.length} Google Calendar event{calendarEvents.length === 1 ? '' : 's'} loaded</p>
          </div>

          {notice && (
            <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <TriangleAlert size={18} />
              <span>{notice}</span>
            </div>
          )}
          {usedFallback && <p className="mt-3 text-xs font-semibold text-slate-500">Live ETA unavailable for part of this search; offline ETA fallback was used.</p>}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase text-gf-lime">Best options</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">{candidates.length ? 'Ranked by ETA fit' : 'No slots yet'}</h2>
              <p className="mt-1 text-sm text-slate-500">Sorted by least extra drive time first, then total drive time.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{candidates.length} shown</span>
          </div>

          <div className="space-y-3">
            {candidates.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">Connect Google Calendar, enter an address, then find best slots.</div>}
            {candidates.map((slot, index) => (
              <button
                key={slot.id}
                className={`w-full rounded-lg border p-4 text-left transition-colors ${slot.id === selectedSlot?.id ? 'border-gf-lime bg-lime-50' : 'border-slate-200 hover:bg-slate-50'}`}
                onClick={() => setSelectedSlotId(slot.id)}
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-sm font-bold text-white">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-slate-900">{dateLabel(slot.dayOffset)}</strong>
                      <span className="font-semibold text-slate-700">{minutesToTime(slot.start)} - {minutesToTime(slot.end)}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <Metric label="Travel" value={`${slot.totalDriveMinutes} min`} />
                      <Metric label="Buffer" value={`${slot.bufferMinutes} min`} />
                      <Metric label="Idle" value={`${slot.idleMinutes} min`} />
                    </div>
                    <p className="mt-3 text-sm text-slate-500">{slot.detourMinutes} min extra travel - {formatMiles(slot.fromMeters + slot.toMeters)} total - from {slot.fromSource}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Settings size={18} className="text-gf-lime" />
              <h2 className="font-bold text-slate-900">Settings</h2>
            </div>
            <div className="space-y-3">
              <Input label="Home base" value={settings.homeBaseAddress} onChange={(value) => updateSetting('homeBaseAddress', value)} />
              <Input label="Google OAuth client ID" value={settings.googleClientId || ''} onChange={(value) => updateSetting('googleClientId', value)} />
              <NumberInput label="Default duration" value={settings.defaultDurationMinutes} suffix="min" onChange={(value) => updateSetting('defaultDurationMinutes', value)} />
              <NumberInput label="Lookahead" value={settings.lookaheadDays} suffix="days" onChange={(value) => updateSetting('lookaheadDays', value)} />
              <NumberInput label="Buffer" value={settings.bufferMinutes} suffix="min" onChange={(value) => updateSetting('bufferMinutes', value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Starts after" type="time" value={settings.workStartHour} onChange={(value) => updateSetting('workStartHour', value)} />
                <Input label="Ends before" type="time" value={settings.workEndHour} onChange={(value) => updateSetting('workEndHour', value)} />
              </div>
              <button className="btn-secondary inline-flex w-full items-center justify-center gap-2 disabled:opacity-60" onClick={handleSaveSettings} disabled={savingSettings}>
                <Save size={17} />
                {savingSettings ? 'Saving...' : 'Save settings'}
              </button>
              <button className="btn-primary inline-flex w-full items-center justify-center gap-2 disabled:opacity-60" onClick={handleConnectCalendar} disabled={loadingCalendar}>
                {loadingCalendar ? <RefreshCw className="animate-spin" size={17} /> : <CalendarClock size={17} />}
                {loadingCalendar ? 'Loading calendar...' : 'Connect Google Calendar'}
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-bold text-slate-900">Calendar diagnostics</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Metric label="Calendars" value={String(diagnostics.calendarsChecked)} />
              <Metric label="Events" value={String(diagnostics.totalEvents)} />
              <Metric label="Located" value={String(diagnostics.withLocation)} />
              <Metric label="Loaded" value={String(diagnostics.loaded)} />
            </div>
            {diagnostics.skipped > 0 && <p className="mt-3 text-sm text-slate-500">{diagnostics.skipped} event{diagnostics.skipped === 1 ? '' : 's'} skipped because they were missing location or exact times.</p>}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            {selectedSlot ? (
              <div>
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h2 className="font-bold text-slate-900">{dateLabel(selectedSlot.dayOffset)}</h2>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{selectedSlot.etaSource}</span>
                </div>
                <EtaLeg label="Before" title={selectedSlot.fromSource} meta={`${selectedSlot.fromMinutes} min drive - ${formatMiles(selectedSlot.fromMeters)}`} />
                <EtaLeg label="New" title={address || 'New appointment'} meta={`${minutesToTime(selectedSlot.start)} - ${minutesToTime(selectedSlot.end)}`} />
                <EtaLeg label="After" title={selectedSlot.toDestination} meta={`${selectedSlot.toMinutes} min drive - ${formatMiles(selectedSlot.toMeters)}`} />
              </div>
            ) : (
              <div className="text-center text-sm text-slate-500">
                <MapPin className="mx-auto mb-2 text-slate-300" />
                Select a slot to see ETA context.
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <span className="block text-xs font-semibold uppercase text-slate-500">{label}</span>
      <strong className="mt-1 block text-slate-900">{value}</strong>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input className="form-input mt-1" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberInput({ label, value, suffix, onChange }: { label: string; value: number; suffix: string; onChange: (value: number) => void }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <div className="mt-1 flex items-center rounded-lg border border-slate-300">
        <input className="w-full rounded-lg px-4 py-2" type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
        <span className="pr-3 text-sm text-slate-500">{suffix}</span>
      </div>
    </label>
  );
}

function EtaLeg({ label, title, meta }: { label: string; title: string; meta: string }) {
  return (
    <div className="mb-3 rounded-lg border border-slate-200 p-3">
      <span className="text-xs font-bold uppercase text-gf-lime">{label}</span>
      <strong className="mt-1 block text-slate-900">{title}</strong>
      <span className="mt-1 block text-sm text-slate-500">{meta}</span>
    </div>
  );
}
```

- [ ] **Step 2: Add app routing**

In `src/App.tsx`, add:

```ts
import RoutePlanner from './pages/RoutePlanner';
```

Add this render block before the organization page block:

```tsx
      {currentPage === 'route-planner' && (
        <RoutePlanner />
      )}
```

- [ ] **Step 3: Add route planner page permission**

In `src/lib/permissions.ts`, add `'route-planner'` to `AppPage` after `'calendar'` and add this switch branch next to calendar:

```ts
    case 'route-planner':
      return p.calendar !== 'none';
```

- [ ] **Step 4: Add sidebar navigation**

In `src/components/Layout.tsx`, import `Route` from lucide-react:

```ts
import { Menu, X, Wifi, WifiOff, Cog, Users, DollarSign, Home, Plus, Package, CalendarDays, LogOut, User, RefreshCw, Layers, SlidersHorizontal, BarChart3, Contact, Handshake, ShoppingBag, ShoppingCart, Building2, HardDrive, Route } from 'lucide-react';
```

Extend the `onNavigate` page union with `'route-planner'`.

Add this button after the Calendar button:

```tsx
            {canSeeCalendar && (
              <button
                onClick={() => onNavigate('route-planner')}
                className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
              >
                <Route size={18} className="md:w-5 md:h-5" />
                <span>Route Planner</span>
              </button>
            )}
```

- [ ] **Step 5: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Run route planner tests**

Run:

```powershell
npm run test:route-planner
```

Expected: PASS.

- [ ] **Step 7: Commit route planner page**

Run:

```powershell
git add -- src/pages/RoutePlanner.tsx src/App.tsx src/components/Layout.tsx src/lib/permissions.ts
git commit -m "feat: add route planner page"
```

Expected: commit succeeds.

---

### Task 7: Build Verification And Deployment Notes

**Files:**
- Modify: `supabase/README.md`
- Modify: `docs/superpowers/specs/2026-05-04-routewise-integration-design.md`

- [ ] **Step 1: Add Edge Function deployment note**

Append to `supabase/README.md`:

```md
## Routewise ETA Edge Function

The integrated Route Planner uses the `routewise-eta` Edge Function for batched geocoding and drive-time estimates. Deploy it with:

```bash
supabase functions deploy routewise-eta
```

The browser client keeps an offline ETA fallback, so the planner still works when the function is unavailable.
```

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm run test:route-planner
npm run typecheck
npm run build
```

Expected:

```text
route planner tests pass
typecheck passes
vite build completes successfully
```

- [ ] **Step 3: Start local dev server**

Run:

```powershell
npm run dev -- --host 127.0.0.1
```

Expected: Vite reports a local URL such as `http://127.0.0.1:5173/job_estimator/`.

- [ ] **Step 4: Manual smoke test**

Open the local app and verify:

```text
Login/offline mode still works.
Sidebar shows Route Planner for users with calendar permission.
Route Planner loads without reading jobs.
Saving settings updates the page state.
Connect Google Calendar without a client ID shows "Add your Google OAuth client ID first."
Entering appointment and home base addresses can produce offline fallback slots.
No feasible slots state appears for impossible duration/work-hour combinations.
```

- [ ] **Step 5: Commit documentation and verification fixes**

Run:

```powershell
git add -- supabase/README.md docs/superpowers/specs/2026-05-04-routewise-integration-design.md
git commit -m "docs: document Routewise ETA deployment"
```

Expected: commit succeeds if documentation changed. If only verification was run and no docs changed, skip this commit.

---

## Self-Review Checklist

- Spec coverage: Tasks cover the new page, Google Calendar-only source, Supabase `route_planner_settings`, batched Edge Function, offline fallback, error states, and verification.
- No job-data usage: No task imports `getAllJobs`, `jobs`, `customers`, install schedules, or estimator records into Route Planner.
- Type consistency: `RouteCalendarEvent`, `RouteCandidate`, `RoutePlannerSettings`, and ETA client names are defined before use.
- Verification: `npm run test:route-planner`, `npm run typecheck`, `npm run build`, and manual smoke testing are included.
