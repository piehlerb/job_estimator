# NH/ME ZIP geography data

`src/lib/nhMeZipRegistry.ts` is a checked-in, runtime-local registry of 766 exact five-digit ZIP records for Maine and New Hampshire. Each entry has a postal place name, state, and ZIP centroid used to label and position the reporting visualization; it is not a ZIP boundary map or a municipal-boundary dataset.

Source: [GeoNames postal-code export](https://download.geonames.org/export/zip/US.zip), downloaded 2026-07-18. GeoNames provides the postal-code data under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); retain this attribution when regenerating. The displayed city/town is GeoNames' postal `place name`, which can differ from an incorporated municipality.

To regenerate, download `US.zip`, unpack `US.txt`, then run:

```powershell
node scripts/generate-nh-me-zip-registry.mjs C:\path\to\US.txt
```

The generator selects records whose state column is `ME` or `NH` and emits one exact ZIP/place/state/latitude/longitude record per line, sorted by ZIP. Do not substitute numeric ZIP ranges or state text parsing: only registry members are reportable.
