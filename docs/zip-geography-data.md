# NH/ME ZIP geography data

`src/lib/nhMeZipRegistry.ts` is a checked-in, runtime-local registry of 766 exact five-digit ZIP records for Maine and New Hampshire. Each entry has a state and ZIP centroid used only to position the reporting visualization; it is not a ZIP boundary map.

Source: [GeoNames postal-code export](https://download.geonames.org/export/zip/US.zip), downloaded 2026-07-17. GeoNames provides the postal-code data under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/); retain this attribution when regenerating.

To regenerate, download `US.zip`, unpack `US.txt`, select records whose state column is `ME` or `NH`, then emit one exact ZIP/state/latitude/longitude record per line (sorted by ZIP) into `src/lib/nhMeZipRegistry.ts`. Do not substitute numeric ZIP ranges or state text parsing: only registry members are reportable.
