# Structured address normalization — implementation plan

Goal: every job, lead and customer carries a clean, structured `street / street2 /
city / state / zip`, and stays clean without ongoing manual effort.

This plan adapts the design proposed in `estimator_zip_cleanup.zip` (see
[Provenance](#provenance)). The data model from that proposal is kept almost
intact; the implementation is moved from Postgres into TypeScript because this
app reads exclusively from IndexedDB.

---

## Why not apply the SQL as delivered

| Delivered file | Disposition |
|---|---|
| `01_migration_address_fields.sql` | **Keep the column additions.** Drop `zip_reference`, `city_alias`, their RLS policies, and the incomplete-row partial indexes. |
| `02_zip_reference_seed.sql` | **Replace** with a generated TypeScript registry. |
| `03_parse_function.sql` | **Port to TypeScript.** The algorithm is good; the location is not. |
| `04_dryrun_and_backfill.sql` | **Replace** with a client-side gated pass. |
| `05_data_quality_views.sql` | **Drop.** Reimplemented as an in-memory selector. |
| `gen_seed.py` | **Repurpose** to emit TypeScript instead of SQL. |
| `dryrun_report_sample.csv` | **Keep as a test fixture** — 252 real strings with expected output. |

Three reasons:

1. **No UI can read a Postgres view.** `grep -rn "supabase" src/pages src/components`
   returns nothing — every screen reads IndexedDB. Backing a cleanup page with
   `data_quality_issues` would introduce an online-only data path no other
   feature uses, in a PWA used at jobsites.
2. **A SQL-only parser can't validate at entry.** Address quality is won at the
   keystroke, not in a nightly pass. The parser has to run where the form runs.
3. **A server-side backfill fights the sync engine.** `resolveConflict`
   ([syncHelpers.ts:73](../src/lib/syncHelpers.ts#L73)) is whole-record and
   local-wins-on-tie. `04`'s `updated_at = now()` forces remote to win, which
   means ~250 records get wholesale-overwritten on every device — discarding any
   unpushed offline edits. Writing through IndexedDB uses the normal path and
   carries no such risk.

---

## Phase 0 — Capture structure at ingest (do this first)

Highest value, smallest change.

> **Status: done.** Corrections learned while implementing it are folded in below.
>
> **Sequencing correction.** Phase 0 is *not* independent of Phase 3 as first
> written: there is nowhere to write `street/city/state/zip` until the columns
> exist. `supabase/migration_add_structured_address_fields.sql` (Phase 3) must be
> applied first. It is purely additive, so this costs nothing.
>
> **Result against real data.** Of 200 distinct GHL contacts, 151 (75%) project to
> tier A — full zip + city + state, deterministic, no parsing. But only **62 of
> those 151 carry a street**: GHL's `address1` is sparse, and when it is absent
> `full_address` holds just "City, ST ZIP", so there is genuinely no street to
> recover. Phase 2's parser cannot fix this either. **Street coverage is an
> upstream GHL form problem, not a code problem** — if the lead form doesn't ask
> for a street address, no amount of parsing invents one.

[`leadPipeline.ts:323`](../supabase/functions/_shared/leadPipeline.ts#L323)
currently flattens the address:

```ts
address: normalizeWhitespace(readFirstString(payload, ['address', 'full_address', 'fullAddress', 'location.fullAddress'])),
```

GHL sends `address1`, `city`, `state`, `postalCode` as separate fields. We are
discarding structure at the door and then proposing to reconstruct it by parsing
the concatenation.

Key names, confirmed against 238 stored payloads: all **top-level and
snake_case** — `address1`, `city`, `state`, `postal_code`, `full_address`,
`country`. The `contact` sub-object carries no address fields at all. `state` is
two-letter but sometimes mis-cased (`Nh`), `postal_code` is always exactly five
digits, `country` is always `US`.

1. Extend `NormalizedWebhookLead` with `street / city / state / zip`, read via
   `readFirstString` with those keys.
2. Set `addressParseTier = 'A'` only when GHL supplied zip **and** city **and**
   state. A partial set stays untiered so the client-side parser still visits it.
3. Keep writing the flattened `address` too. It stays the record of what arrived.
4. Normalize defensively — `normalizeStateCode` and `normalizeZipCode` must emit
   a two-letter uppercase code / five digits, or nothing. A spelled-out state is
   **dropped, not guessed**: the raw string survives for the parser to handle,
   and an unvalidated value would fail the CHECK constraint and take the whole
   batched sync upsert down with it.
5. Gate **every** address column, raw `address` included, behind the ratchet.
   `shouldOverwriteLeadValue` lets the last non-blank webhook value win, so
   without the gate the next event silently reverts a hand correction and the
   cleanup worklist never empties. Treat both a set `address_verified_at` and
   `address_parse_tier = 'M'` as protective.
6. **Decide the address columns as a group, never field by field.** This is the
   subtle one, and getting it wrong corrupts data rather than merely losing it.
   GHL routinely sends `city`/`state`/`postal_code` with **no** `address1`, so a
   per-field merge keeps the previous address's street and welds it onto the new
   town — then stamps tier `A`, telling everything downstream the row is
   deterministic and needs no review. `resolveLeadAddressMerge` therefore
   replaces the whole projection (nulling absent members, `street2` included)
   whenever any of city/state/zip contradicts what is stored, and fills field by
   field only when nothing disagrees. A blank field beats a confidently wrong one.
   It lives in `_shared/leadPipeline.ts` as an exported pure function
   specifically so it can be unit-tested; `mergeLeadRow` in the edge function
   cannot be, because `index.ts` has a top-level `Deno.serve`.
6. Add the new columns to the `LeadRow` type in the edge function — the write is
   a full-row upsert, so a column missing from that type is silently dropped, and
   a column present but left `null` overwrites the stored value. `street2` is
   never sent by GHL and must be seeded from the existing row for that reason.
7. **Apply the migration before deploying the edge function.** The write is a
   full-row upsert including the new columns, so against an un-migrated `leads`
   table every webhook fails with "column leads.street does not exist" and the
   events land as `failed`. Migration first, function second — not the reverse.
8. Mirror the change into [`src/lib/leadPipeline.ts`](../src/lib/leadPipeline.ts).
   These two files are near-duplicates today; they must not drift. Nothing
   enforces this — `tsconfig.app.json` includes only `src`, so the `_shared` copy
   is neither typechecked nor tested by any npm script. Verify by hand with
   `diff supabase/functions/_shared/leadPipeline.ts src/lib/leadPipeline.ts`,
   which should show only the two pre-existing additive blocks
   (`LEAD_DISPOSITION_REASONS`, `stageForLinkedJobStatus`).

The webhook deliberately does **not** import the zip registry — no parser
runs server-side, so there is nothing to keep in sync and nothing to bundle
into the edge function.

---

## Phase 1 — Reference data as generated TypeScript

### Source-of-truth problem to resolve first

Two datasets are in play and they disagree:

- [`nhMeZipRegistry.ts`](../src/lib/nhMeZipRegistry.ts) — 766 ME/NH records from
  **GeoNames**, with postal place names and centroids. Drives the reporting map.
- `gen_seed.py` — the **USPS-derived `zipcodes` package**, which additionally has
  `county`, `zip_code_type`, and `acceptable_cities`/`unacceptable_cities`.

The parser needs county (the postal-city tiebreaker), zip type (PO Box zips are
never a jobsite), and the alias lists. GeoNames has none of those. But swapping
sources wholesale would move map markers and change displayed town names —
[`zipGeography.test.ts:24`](../src/lib/zipGeography.test.ts#L24) pins Portland's
centroid, and that test is right to exist.

**Resolution: merge, don't replace.** For ME/NH, keep GeoNames' city name and
lat/lon and add USPS `county` / `zipType` / aliases alongside. For the newly
added states, use USPS wholesale. Reporting output is unchanged by construction.

### Work

1. Rewrite `scripts/generate-nh-me-zip-registry.mjs` (or add a sibling) to emit
   **two files from one snapshot**, so there is a single generator and no manual
   drift:
   - `src/lib/nhMeZipRegistry.ts` — ME/NH, eager, existing `NH_ME_ZIP_CENTROIDS`
     shape preserved, plus `county` and `zipType` on each record.
   - `src/lib/zipRegistryExtended.generated.ts` — the other northeast states
     (CT, MA, NY, RI, VT) plus the city-alias map, **lazy-loaded**.
2. Scope: northeast only. The national set is ~42,800 zips — unacceptable in a
   PWA bundle for the two out-of-region rows you actually have. Fix those by hand.
3. Bundle cost: ME/NH stays eager (already is, ~40KB). The extended chunk is
   loaded on demand and only when an ME/NH lookup misses. Add it to the
   `public/sw.js` precache list so offline still works after first load.
4. Update [`docs/zip-geography-data.md`](zip-geography-data.md) with the second
   source, its licence, and the merge rule above.
5. Run the generator and **review the ME/NH diff** before committing. Any change
   to a city name or centroid is a bug in the merge, not an improvement.

---

## Phase 2 — The parser

New file `src/lib/addressParse.ts`. Direct port of `parse_address()` and
`match_city_tail()` — the backward-tail-matching algorithm, longest-match-wins,
and the tier semantics all carry over unchanged.

```ts
export type AddressTier = 'A' | 'A!' | 'B' | 'C' | 'D' | 'M';

export interface AddressProposal {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  tier: AddressTier;
  note?: string;
}

export function parseAddress(raw: string | undefined, registry: ZipRegistry): AddressProposal;
```

Pure, synchronous, registry injected as a parameter — so it is trivially
testable and the caller decides eager vs lazy data.

Behaviour to preserve exactly:

- **Anchor on the last 5-digit token that exists in the registry**, so a house
  number can't false-fire.
- **County breaks the postal-city tie.** Same county ⇒ keep the typed
  municipality (that's the territory you work in), record the postal city in
  `note`. Different county ⇒ tier `A!`, resolve nothing.
- **Never auto-resolve a contradiction.** A blank field beats a confidently
  wrong one; `03528` vs `03258` is the case that matters.
- **Only `STANDARD` zips are candidates** when deriving a zip from a town.
- **No state given ⇒ the city must be unique across the whole registry.**
  "Raymond" exists in both ME and NH and must fail.

Tests in `src/lib/addressParse.test.ts` — see [Running the tests](#running-the-tests);
the new file must be added to `tsconfig.test.json`'s `include` array or it is
never compiled. Seed the corpus from
`dryrun_report_sample.csv` — 252 real strings with expected `street/city/state/zip/tier`
is a strong regression suite, and it lets us verify the port against the
original implementation row by row.

Known limitation to keep: street extraction is best-effort leftover text.
`"      By 34 Vrylenas Way, Hampton 03842"` yields street `"By 34 Vrylenas Way"`.
`street2` is not populated by the parser — unit/suite extraction is a later pass.

---

## Phase 3 — Schema and types

### Supabase

`supabase/migration_add_structured_address_fields.sql`, derived from `01`:

- Column additions on `jobs` (`customer_` prefixed), `leads`, `customers` —
  as delivered, including `address_parse_tier` and `address_verified_at`.
- Keep the format `CHECK` constraints, `NOT VALID`.
- Drop the reference tables, their policies, and the `*_addr_incomplete_idx`
  partial indexes — nothing queries server-side.

> **Sync hazard.** Push is a batched upsert
> ([sync.ts:384](../src/lib/sync.ts#L384)) and one constraint violation fails the
> **entire batch**, which would break sync for that whole table. The write helper
> in Phase 4 must therefore guarantee `^[A-Z]{2}$` / `^[0-9]{5}$` or `undefined`
> — never a partial or lowercase value. Validate the constraints only after the
> backfill reports clean.

### TypeScript

[`src/types/index.ts`](../src/types/index.ts): add optional fields to `Job`
(`customerStreet`, `customerStreet2`, `customerCity`, `customerState`,
`customerZip`, `addressParseTier`, `addressVerifiedAt`) and to `Lead` and
`Customer` (unprefixed). `objectToSnakeCase` maps these to the migration's column
names automatically.

**No `DB_VERSION` bump** — new fields on existing stores need no schema change,
and nothing here adds an IndexedDB index. Sync and backup pick the fields up at
the object level with no code change, per `.claude/CLAUDE.md`.

---

## Phase 4 — Write path

One helper, `src/lib/addressFields.ts`, used by every writer:

```ts
export function withNormalizedAddress<T>(entity: T, raw: string | undefined, registry: ZipRegistry): T;
```

Rules:

- Fills only empty structured fields from a tier `A`/`B`/`C` proposal.
- Never touches a record with `addressVerifiedAt` set — **this is the ratchet**,
  and without it every future pass silently reverts hand corrections.
- Never writes on tier `A!` or `D`; those go to the cleanup worklist.
- Emits format-valid values or `undefined`, per the sync hazard above.

Call sites: `JobForm` save ([JobForm.tsx:1932](../src/pages/JobForm.tsx#L1932)),
`Leads` save, `Customers` save, and
[`customerPersistence.ts:35`](../src/lib/customerPersistence.ts#L35) — which
today copies only the raw string and must copy the structured fields too.

Any **manual** edit of a structured field sets `addressParseTier = 'M'` and
`addressVerifiedAt = now()`. The ratchet is driven by ordinary use, not by a
separate chore.

---

## Phase 5 — Backfill

`backfillAddressFields()` in [`src/lib/jobMigration.ts`](../src/lib/jobMigration.ts),
matching the existing pattern (`migrateJobsDisableGasHeater` et al).

Deliberately **not** auto-run at startup like its siblings: the first pass
touches ~250 records across three stores and you should see the proposals before
they land. It is exposed as a gated action in the cleanup UI —
"Review 240 proposals → Apply" — with the tier breakdown shown first. Writes go
through `updateJob` / `updateLead` / `updateCustomer`, so they sync normally.

Idempotent and safe to re-run: it only fills empty fields and skips verified
rows. After the first pass, Phase 4 handles everything new, so this becomes a
tool rather than a migration.

---

## Phase 6 — UI

### Job form — [`JobForm.tsx:2459`](../src/pages/JobForm.tsx#L2459)

Keep the single paste-friendly input; the crew pastes from GHL and text messages
and four separate boxes would slow that down. Add beneath it:

- A resolved chip: `Stratham, NH 03885 ✓` — or amber `ZIP 03110 is Bedford NH,
  not York ME` on a contradiction.
- The chip expands to editable Street / Street2 / City / State / ZIP.
- Typing or pasting a zip auto-fills city and state (deterministic lookup).
- Editing any structured field stamps tier `M` + `addressVerifiedAt`.

Parse on blur and on save, not per keystroke — the extended registry is a lazy
chunk and there's no reason to block typing on it.

### Leads — [`Leads.tsx`](../src/pages/Leads.tsx)

Same resolved chip, so a lead that arrives ambiguous gets fixed where you are
already looking at it rather than in a separate queue.

### Address cleanup panel

New `src/components/AddressCleanupPanel.tsx`, hosted in
[`Reporting.tsx`](../src/pages/Reporting.tsx), reading IndexedDB like every other
screen. It replaces the `parse_address` + `data_quality_issues` +
`zip_fill_candidates` trio with an in-memory selector over records already
loaded.

Three sections:

1. **Bulk fill by town.** Group rows missing a zip by city+state; single-zip
   towns apply to the whole group in one click. Per the proposal's numbers, 602
   of 608 ME/NH towns are single-zip, so the worklist collapses fast — only
   Nashua, Manchester, Concord, Lebanon, Rochester and Portland need
   street-level disambiguation.
2. **Conflicts (tier `A!`).** One card per row showing the raw string and the
   two candidate readings, with `Keep typed town` / `Use ZIP's city` buttons.
   Either choice sets the ratchet.
3. **Unresolvable (tier `D`).** Open-the-record links, as today.

The existing "Addresses needing ZIP review" panel in
[`ZipGeographyReport.tsx:478`](../src/components/ZipGeographyReport.tsx#L478) is
a working prototype of exactly this, restricted to ME/NH job zips. The new panel
is a strict superset covering jobs, leads and customers — so it should
**replace** that block rather than sit beside it. Reuse its search + bulk-apply
interaction; it already works and the crew knows it.

### Job-site vs customer address

The proposal left this open. Decide it explicitly:

- **Job**: the job-site address. A customer can have two properties, so the
  duplication is intentional, not accidental.
- **Customer**: the primary/billing address.
- Add a **"same as customer"** toggle in JobForm so the common case stays linked
  and the divergent case is deliberate.

---

## Sequencing and verification

| Phase | Gate before moving on |
|---|---|
| 0 | A real GHL payload lands with `street/city/state/zip` populated. |
| 1 | Generator run; ME/NH diff is empty; `zipGeography.test.ts` green. |
| 2 | `addressParse.test.ts` reproduces the 252-row fixture. |
| 3 | Migration applied; a job round-trips a structured address to Supabase and back. |
| 4 | Manual edit sets tier `M`; re-running the pass leaves it alone. |
| 5 | Tier counts match the fixture; sync completes with no batch errors. |
| 6 | Backfill applied from the UI; worklist is short and every action sticks. |

### Running the tests

There is **no `npm test` script**, and `tsx` is not installed — the runner is
Node's built-in one over compiled output:

```bash
npx tsc -p tsconfig.test.json && node --test .tmp-tests/src/lib/leadPipeline.test.js .tmp-tests/src/lib/leadMutations.test.js
```

Two gotchas: a test file absent from `tsconfig.test.json`'s explicit `include`
array is never compiled and will appear to pass by not existing; and
`src/lib/coatingSkus.ts:7` currently emits a pre-existing `TS2834`
(extensionless relative import) during that compile. It does not block emit, so
tests still run — but it means "the compile printed an error" is not by itself a
signal that something is broken. CI (`.github/workflows/deploy.yml`) runs neither
tests nor typecheck.

Before Phase 5, **sync every device.** The backfill is a large write; any device
holding unpushed offline edits should flush them first.

Bump the version in all three files (`package.json`, `public/sw.js`,
`src/version.ts`) — `2.18.2` → `2.19.0` — when Phase 6 ships.

---

## Pre-existing gaps found while implementing

Neither is caused by this work; both affect it.

- **Leads are not backed up at all.** `lead` appears nowhere in
  [`backup.ts`](../src/lib/backup.ts), and `ExportData`
  ([types/index.ts](../src/types/index.ts)) has no `leads` array. Lead address
  data — structured or raw — will not survive an export/restore cycle. Worth
  fixing on its own merits, separately from this plan.
- **The `_shared` edge-function copy is unverified by any tooling.**
  `tsconfig.app.json` includes only `src`, and CI runs neither typecheck nor
  tests. `deno check supabase/functions/ghl-webhook/index.ts` does work (Deno 2.9
  is installed locally) and is the only way to typecheck it — it reports 2
  pre-existing library-generic errors at `index.ts:125` and `:329` that are
  unrelated to this work.

## Open decisions

1. **Registry scope** — northeast only (recommended) or national?
2. **Existing ZIP-review panel** — replace (recommended) or keep both?
3. **Backfill trigger** — gated review (recommended) or silent at startup like
   the other migrations?
4. **`street2`** — leave unpopulated for now (recommended) or add unit/suite
   extraction in Phase 2?

---

## Provenance

The data model, confidence tiers, county tiebreaker, verified-at ratchet, and
the decision to keep the raw column all come from `estimator_zip_cleanup.zip`,
authored by a separate agent session and reviewed 2026-08-10. Nothing from that
zip has been applied to the database. Its parser algorithm and
`dryrun_report_sample.csv` are carried forward; its Postgres runtime is not.
