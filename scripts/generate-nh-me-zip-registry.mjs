import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, '..');
const sourcePath = process.argv[2];

if (!sourcePath) {
  throw new Error('Usage: node scripts/generate-nh-me-zip-registry.mjs <path-to-US.txt>');
}

const source = await readFile(resolve(sourcePath), 'utf8');
const rows = new Map();

for (const line of source.split(/\r?\n/)) {
  if (!line) continue;

  const fields = line.split('\t');
  const [country, zip, city, , state, , , , , lat, lon] = fields;
  if (country !== 'US' || (state !== 'ME' && state !== 'NH')) continue;
  if (!/^\d{5}$/.test(zip) || !city || !lat || !lon) continue;
  if (rows.has(zip)) throw new Error(`Duplicate ZIP ${zip} in GeoNames source`);

  rows.set(zip, {
    state,
    city,
    lat: Number(lat),
    lon: Number(lon),
  });
}

const generatedAt = new Date().toISOString().slice(0, 10);
const entries = Array.from(rows.entries())
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([zip, value]) => (
    `  ${JSON.stringify(zip)}: { state: ${JSON.stringify(value.state)}, city: ${JSON.stringify(value.city)}, lat: ${value.lat}, lon: ${value.lon} },`
  ))
  .join('\n');

const output = `/**
 * Exact Maine and New Hampshire ZIP registry with postal place names and centroid coordinates.
 *
 * Source: GeoNames US postal-code export (https://download.geonames.org/export/zip/US.zip),
 * CC BY 4.0. Generated ${generatedAt} from rows whose state field is ME or NH.
 * See docs/zip-geography-data.md for attribution and regeneration notes.
 */
export type ZipCentroid = { state: 'ME' | 'NH'; city: string; lat: number; lon: number };

export const NH_ME_ZIP_CENTROIDS: Record<string, ZipCentroid> = {
${entries}
};
`;

await writeFile(resolve(projectRoot, 'src/lib/nhMeZipRegistry.ts'), output, 'utf8');
console.log(`Generated ${rows.size} NH/ME ZIP records.`);
