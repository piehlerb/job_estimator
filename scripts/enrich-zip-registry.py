#!/usr/bin/env python3
"""
Adds USPS-derived `county` and `zipType` to src/lib/nhMeZipRegistry.ts, and emits
the city-alias table the address parser needs.

WHY THIS IS AN ENRICHMENT AND NOT A GENERATOR
---------------------------------------------
Two datasets are in play and they do not agree:

  * GeoNames (scripts/generate-nh-me-zip-registry.mjs) supplies the postal place
    name and centroid. The reporting map is built on it, and docs/zip-geography-
    data.md commits to it as the source for what a town is called and where its
    marker sits.

  * The USPS-derived `zipcodes` package supplies `county` (the postal-city
    tiebreaker), `zip_code_type` (a PO Box or UNIQUE zip is never a job site),
    and the acceptable/unacceptable city lists that become aliases. GeoNames has
    none of those.

Comparing the two over all 766 ME/NH zips: city names agree exactly (0
differences), but 22 centroids differ -- a few substantially, Mount Washington
by 0.41 degrees of latitude, roughly 28 miles. Taking USPS wholesale would
silently walk those map markers.

So this script only ever ADDS fields. City, state, lat and lon are copied
through untouched, which makes the change reviewable: `git diff` on the
generated file must show added properties and nothing else.

Where USPS disagrees on a city name, or knows a zip the registry does not, that
is reported rather than applied. Silent reconciliation is how the two sources
would drift apart without anyone noticing.

INACTIVE ZIPS ARE EXCLUDED
--------------------------
USPS lists 772 ME/NH zips to the registry's 766. All 6 extras are retired
(`active: false`) and appear nowhere in the app's data. They are left out: a
retired zip resolving to a town that no longer receives mail is worse than no
match, and the town name path still resolves such an address anyway -- an old
"Newington NH 03805" matches on "Newington" even though 03805 is gone.

USAGE
-----
    pip install zipcodes
    python scripts/enrich-zip-registry.py

Idempotent -- re-running produces an identical file. To widen coverage beyond
ME/NH (if work ever moves into Massachusetts, say), add the code to STATES
below and re-run; nothing else needs to change.
"""

import io
import os
import re
import sys
from collections import Counter

try:
    import zipcodes
except ImportError:
    sys.exit("Missing dependency. Run: pip install zipcodes")

STATES = ("ME", "NH")

REGISTRY_PATH = os.path.join("src", "lib", "nhMeZipRegistry.ts")

# Written forms that turn up in hand-typed addresses but are not in the USPS
# acceptable/unacceptable lists.
DIRECTIONAL = {
    "North": ["N", "N."],
    "South": ["S", "S."],
    "East": ["E", "E."],
    "West": ["W", "W."],
    "Mount": ["Mt", "Mt."],
    "Saint": ["St", "St."],
    "Center": ["Ctr", "Ctr."],
    "Centre": ["Ctr", "Ctr."],
}

RECORD_RE = re.compile(
    r'"(?P<zip>\d{5})":\s*\{\s*'
    r'state:\s*"(?P<state>\w\w)",\s*'
    r'city:\s*"(?P<city>[^"]+)",\s*'
    r'lat:\s*(?P<lat>-?[\d.]+),\s*'
    r'lon:\s*(?P<lon>-?[\d.]+)'
    r'(?P<rest>[^}]*)\}'
)


def read_existing(path):
    """Parse the checked-in registry. Tolerates records already enriched."""
    text = io.open(path, encoding="utf-8", newline="").read()
    crlf = "\r\n" in text
    records = {}
    for m in RECORD_RE.finditer(text):
        records[m.group("zip")] = {
            "state": m.group("state"),
            "city": m.group("city"),
            # Kept as the original strings so the emitted numbers are
            # byte-identical to what is already committed -- float round-trips
            # would risk 43.6606 becoming 43.66060000000001.
            "lat": m.group("lat"),
            "lon": m.group("lon"),
        }
    return records, crlf


def alias_forms(city):
    words = city.split()
    if not words:
        return
    if words[0] in DIRECTIONAL:
        for short in DIRECTIONAL[words[0]]:
            yield " ".join([short] + words[1:])
    if len(words) > 1 and words[-1] in ("Center", "Centre"):
        yield " ".join(words[:-1] + ["Ctr"])


def ts_string(value):
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def main():
    if not os.path.exists(REGISTRY_PATH):
        sys.exit(f"Run from the repo root -- {REGISTRY_PATH} not found")

    existing, crlf = read_existing(REGISTRY_PATH)
    if not existing:
        sys.exit("Parsed 0 records; the registry format may have changed")

    usps_all = [r for r in zipcodes.list_all() if r["state"] in STATES]
    usps = {r["zip_code"]: r for r in usps_all if r["active"]}

    missing_from_usps = sorted(set(existing) - set(usps))
    # Compared against usps_all, not usps, so the count reflects every zip left
    # out rather than only those surviving the active filter.
    retired = sorted(r["zip_code"] for r in usps_all if not r["active"])
    unknown_active = sorted(set(usps) - set(existing))
    city_conflicts = []

    enriched = {}
    for zip_code in sorted(existing):
        base = existing[zip_code]
        u = usps.get(zip_code)
        if u is None:
            # Reported below. Emitted with empty attributes rather than dropped:
            # losing a zip would silently unmap jobs that map today.
            enriched[zip_code] = dict(base, county="", zip_type="STANDARD")
            continue
        if u["city"].strip().lower() != base["city"].strip().lower():
            city_conflicts.append((zip_code, base["city"], u["city"]))
        enriched[zip_code] = dict(
            base, county=u["county"] or "", zip_type=u["zip_code_type"]
        )

    # --- aliases -------------------------------------------------------------
    # An alias that is itself a real city in the same state is ambiguous and is
    # dropped: better unresolved than resolved to the wrong town.
    real_cities = {(r["city"].strip().lower(), r["state"]) for r in usps.values()}
    aliases = {}
    for r in usps.values():
        variants = set(r.get("acceptable_cities") or [])
        variants |= set(r.get("unacceptable_cities") or [])
        variants |= set(alias_forms(r["city"]))
        for v in variants:
            v = v.strip()
            key = v.lower()
            if not v or (key, r["state"]) in real_cities:
                continue
            aliases.setdefault(r["state"], {}).setdefault(key, r["city"])

    # --- emit ----------------------------------------------------------------
    out = []
    w = out.append
    w("/**")
    w(" * Exact Maine and New Hampshire ZIP registry: postal place names, centroid")
    w(" * coordinates, county, and ZIP type.")
    w(" *")
    w(" * GENERATED FILE -- do not hand-edit. See docs/zip-geography-data.md.")
    w(" *")
    w(" * Place name and centroid come from the GeoNames US postal-code export")
    w(" * (https://download.geonames.org/export/zip/US.zip), CC BY 4.0, generated")
    w(" * 2026-07-18 by scripts/generate-nh-me-zip-registry.mjs. Retain that")
    w(" * attribution.")
    w(" *")
    w(" * County and ZIP type are merged in from the USPS-derived `zipcodes` package")
    w(" * by scripts/enrich-zip-registry.py, which never alters a place name or")
    w(" * centroid -- the two sources agree on all 766 city names but differ on 22")
    w(" * centroids, and GeoNames wins because the reporting map is built on it.")
    w(" *")
    w(" * Retired ZIPs are excluded. This is not a ZIP boundary map.")
    w(" */")
    w("")
    w("/** STANDARD is street delivery; PO BOX and UNIQUE are never a job site. */")
    w("export type ZipType = 'STANDARD' | 'PO BOX' | 'UNIQUE';")
    w("")
    w("/** The shape the reporting map needs. */")
    w("export type ZipCentroid = { state: 'ME' | 'NH'; city: string; lat: number; lon: number };")
    w("")
    w("/**")
    w(" * A full registry entry. `county` is what lets the address parser tell a")
    w(" * legitimate postal-city alias (Newington mails as Portsmouth 03801) from a")
    w(" * genuine contradiction between a typed town and its ZIP.")
    w(" */")
    w("export type ZipRecord = ZipCentroid & { county: string; zipType: ZipType };")
    w("")
    w("export const NH_ME_ZIP_CENTROIDS: Record<string, ZipRecord> = {")
    for zip_code in sorted(enriched):
        r = enriched[zip_code]
        w(
            f'  "{zip_code}": {{ state: "{r["state"]}", city: {ts_string(r["city"])}, '
            f'lat: {r["lat"]}, lon: {r["lon"]}, '
            f'county: {ts_string(r["county"])}, zipType: "{r["zip_type"]}" }},'
        )
    w("};")
    w("")
    w("/**")
    w(" * Written variants mapped to the canonical place name, keyed by state then by")
    w(" * lower-cased alias. Sourced from the USPS acceptable/unacceptable city lists")
    w(" * (the unacceptable ones are known misspellings -- exactly what shows up in")
    w(" * hand-typed addresses) plus common directional abbreviations.")
    w(" *")
    w(" * An alias that is itself a real city in the same state is omitted: ambiguous")
    w(" * is worse than unresolved.")
    w(" */")
    w("export const NH_ME_CITY_ALIASES: Record<'ME' | 'NH', Record<string, string>> = {")
    for state in ("ME", "NH"):
        w(f"  {state}: {{")
        for alias in sorted(aliases.get(state, {})):
            w(f"    {ts_string(alias)}: {ts_string(aliases[state][alias])},")
        w("  },")
    w("};")
    w("")

    newline = "\r\n" if crlf else "\n"
    with io.open(REGISTRY_PATH, "w", encoding="utf-8", newline=newline) as f:
        f.write("\n".join(out))

    # --- report --------------------------------------------------------------
    types = Counter(r["zip_type"] for r in enriched.values())
    print(f"wrote {REGISTRY_PATH}")
    print(f"  records          : {len(enriched)}")
    print(f"  zip types        : {dict(types)}")
    print(f"  counties         : {len({r['county'] for r in enriched.values() if r['county']})}")
    print(f"  aliases          : ME={len(aliases.get('ME', {}))} NH={len(aliases.get('NH', {}))}")
    print(f"  retired excluded : {len(retired)} {retired}")
    if unknown_active:
        print(f"  NOTE: {len(unknown_active)} active USPS zips are not in the registry "
              f"and were NOT added (GeoNames is the membership authority): {unknown_active}")
    if missing_from_usps:
        print(f"  WARNING: {len(missing_from_usps)} registry zips absent from USPS "
              f"(emitted with empty county): {missing_from_usps}")
    if city_conflicts:
        print(f"  WARNING: {len(city_conflicts)} city-name conflicts; GeoNames kept:")
        for z, geo_city, usps_city in city_conflicts:
            print(f"    {z}  registry={geo_city!r}  usps={usps_city!r}")
    if not missing_from_usps and not city_conflicts:
        print("  no conflicts -- the two sources agree on every place name")


if __name__ == "__main__":
    main()
