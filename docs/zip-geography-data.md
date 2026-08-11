# NH/ME ZIP geography data

`src/lib/nhMeZipRegistry.ts` is a checked-in, runtime-local registry of 766 exact five-digit ZIP records for Maine and New Hampshire. It is a generated file — do not hand-edit it. Each entry carries a postal place name, state, ZIP centroid, county, and ZIP type. It is not a ZIP boundary map or a municipal-boundary dataset.

The same module exports **two** alias tables, because the two USPS city lists mean different things and must not be merged:

- `NH_ME_CITY_ALIASES` (ME 123, NH 126) — misspellings and abbreviations of a postal city, from the USPS *unacceptable* list plus directional abbreviations. Typing one is an error, so the parser **replaces** it: "N Berwick" becomes "North Berwick".
- `NH_ME_PLACE_NAMES` (ME 387, NH 97) — real places with no ZIP of their own, from the USPS *acceptable* list. Each maps to `{ name, postalCity }`. The parser **keeps** `name` and uses `postalCity` only to reach the county and the ZIP. Newington NH mails as Portsmouth 03801, but the work is in Newington, and that is what territory reporting counts.

Collapsing these into one table silently rewrites 18 real addresses in the current data to their postal district — Brentwood and Kensington to Exeter, Lyman to Alfred, Arundel to Kennebunkport, Middleton to Union.

## Two sources, and which one wins

The file is built from two datasets that do not agree, so the merge rule matters.

**GeoNames — place name and centroid.** [Postal-code export](https://download.geonames.org/export/zip/US.zip), downloaded 2026-07-18, under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); retain this attribution when regenerating. The displayed city/town is GeoNames' postal `place name`, which can differ from an incorporated municipality. The reporting map is built on this, so **GeoNames is authoritative for city, state, lat and lon, and for registry membership.**

**USPS-derived `zipcodes` package — county, ZIP type, aliases.** GeoNames has none of these, and the address parser needs all three:

- `county` distinguishes a legitimate postal-city alias from a real contradiction. Cape Neddick (03902) and York are both York County, so a ZIP/town mismatch between them is a naming artifact, not a data-entry error.
- `zipType` — a `PO BOX` or `UNIQUE` ZIP is never a job site, so only `STANDARD` ZIPs are candidates when deriving a ZIP from a town name.
- Aliases come from the USPS acceptable/unacceptable city lists. The *unacceptable* ones are USPS-known misspellings — exactly what turns up in hand-typed addresses.

Compared across all 766 ME/NH ZIPs: the two sources agree on **every city name** (0 differences), but **22 centroids differ** — a few substantially, Mount Washington by 0.41° of latitude (~28 miles), China Village by 0.37°. Taking USPS wholesale would silently walk those map markers, which is why the enrichment step never touches a name or a coordinate.

## Regenerating

Two steps, in order. Each is idempotent.

**1. GeoNames base** (only when refreshing place names, centroids, or membership). Download `US.zip`, unpack `US.txt`, then:

```powershell
node scripts/generate-nh-me-zip-registry.mjs C:\path\to\US.txt
```

Selects records whose state column is `ME` or `NH` and emits one ZIP/place/state/lat/lon record per line, sorted by ZIP. Do not substitute numeric ZIP ranges or state text parsing: only registry members are reportable. Note this step emits records *without* county or zipType, so step 2 must follow.

**2. USPS enrichment** (always, and safe to run alone):

```bash
pip install zipcodes && python scripts/enrich-zip-registry.py
```

Adds `county` and `zipType` and rebuilds the alias table, copying city/state/lat/lon through untouched. `git diff` on the result must show only added properties — anything else is a bug in the merge. The script reports, rather than silently applies, any case where USPS disagrees on a city name or knows a ZIP the registry does not.

## Deliberate exclusions

**Retired ZIPs.** USPS lists 772 ME/NH ZIPs to the registry's 766; all 6 extras are `active: false` (03107, 03274, 03805, 04075, 04467, 04846) and appear nowhere in the app's data. They are excluded. A retired ZIP resolving to a town that no longer receives mail is worse than no match, and such an address still resolves through the town-name path — an old "Newington NH 03805" matches on the name even though 03805 is gone.

**Everything outside ME and NH.** Extending to the full northeast would mean 4,418 records (~532 KB of TypeScript), and New York alone is 2,151 of them. Real non-ME/NH volume in the data is about six addresses. Out-of-region addresses land in the address cleanup worklist as tier `D`, get corrected once by hand, and are then protected by the `address_verified_at` ratchet. To widen coverage — if work moves into Massachusetts, say — add the code to `STATES` in `scripts/enrich-zip-registry.py` and re-run; the eager-bundle cost is the reason not to do it speculatively.

## Shape of the data

| | count |
|---|---|
| records | 766 |
| `STANDARD` (street delivery) | 620 |
| `PO BOX` | 129 |
| `UNIQUE` | 17 |
| distinct counties | 26 |
| towns with at least one `STANDARD` ZIP | 606 |
| — of those, served by exactly one ZIP | 600 |
| — served by several | 6 |

The six multi-ZIP towns are Manchester NH (5), Nashua NH (4), Portland ME (4), Rochester NH (3), Concord NH (2), Lebanon NH (2). Everywhere else, a town name determines a ZIP unambiguously — which is what makes bulk-filling missing ZIPs by town safe.

## A place unique here is not unique nationally

Because the registry stops at ME and NH, a town name can be unambiguous *within it* while being a real place elsewhere. "New Kensington" is in Pennsylvania, but matching backward from the end of the string finds "Kensington" (NH). The parser guards against this — see the tier C rule in `src/lib/addressParse.ts` — but it is the standing cost of the narrow scope, and worth remembering before widening or narrowing `STATES`.
