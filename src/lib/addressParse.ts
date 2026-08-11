import {
  NH_ME_CITY_ALIASES,
  NH_ME_PLACE_NAMES,
  NH_ME_ZIP_CENTROIDS,
  type ZipRecord,
} from './nhMeZipRegistry.js';
import type { AddressParseTier } from '../types/index.js';

/**
 * Address parser: turns a free-text address into a structured proposal plus a
 * confidence tier saying how the values were derived.
 *
 * Pure and synchronous. Reads only the checked-in registry, writes nothing, and
 * never mutates its input — the caller decides whether to accept a proposal.
 *
 * THE CORE TRICK
 * Rather than one regex per address "dialect", the parser walks BACKWARD from the
 * end of the string, testing progressively longer trailing word-sequences against
 * known place names, longest match wins. That is why all of these parse through
 * one code path:
 *
 *   "18 Blake Rd, Raymond, NH 03077, USA"     comma-delimited, trailing country
 *   "38 Muirfield Dr Stratham NH 03885"       space-delimited
 *   "222 Burnham Rd Gorham 04038"             no state
 *   "62 Emery Circle in Buxton Maine"         prose, spelled-out state
 *
 * It never assumes where the delimiters are. Whatever is left on the front is the
 * street.
 *
 * WHAT IT REFUSES TO DO
 * When the ZIP and the typed town disagree in a way that cannot be explained as a
 * postal-city alias, the parser stops and reports tier 'A!' rather than trusting
 * either one. Silently trusting the ZIP would launder a data-entry error into
 * clean-looking structured data, which is worse than a blank field because
 * nothing downstream would ever question it.
 */

export interface AddressProposal {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  tier: AddressParseTier;
  /** Why the tier is what it is, when that needs explaining. */
  note?: string;
}

type StateCode = 'ME' | 'NH';

/** A resolved town: what to record, and which registry city backs it. */
interface TownMatch {
  /** The name to store. For a preserved place this is the typed town, not the postal city. */
  city: string;
  state: StateCode;
  /** The registry city whose ZIPs and county serve this town. Differs from `city` only for preserved places. */
  registryCity: string;
  wordsUsed: number;
  /** The leftover front of the string, which becomes the street. */
  head: string;
}

const STATE_CODES: Record<string, StateCode> = {
  ME: 'ME',
  NH: 'NH',
  MAINE: 'ME',
  'NEW HAMPSHIRE': 'NH',
};

// A trailing state token, so it can be lifted off before matching a town.
const TRAILING_STATE = /[,\s]+(ME|NH|MAINE|N\.?H\.?)\.?\s*$/i;

// A 5-digit ZIP must be isolated from other digits; a ZIP+4 suffix is allowed.
const ZIP_TOKEN = /(?<![0-9-])([0-9]{5})(?:-[0-9]{4})?(?![0-9-])/g;

const TRAILING_COUNTRY = /,?\s*(USA|U\.S\.A\.|US|United States)\s*$/i;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function trimPunctuation(value: string): string {
  return value.replace(/^[\s,.]+|[\s,.]+$/g, '');
}

/** Registry cities, indexed for lookup by lower-cased name. */
const CITY_INDEX: Record<StateCode, Record<string, string>> = { ME: {}, NH: {} };
/** How many states a given city name appears in — used when no state was typed. */
const CITY_STATE_COUNT: Record<string, Set<StateCode>> = {};
/** STANDARD (street-delivery) ZIPs per registry city. PO Box and UNIQUE are never a job site. */
const STANDARD_ZIPS: Record<StateCode, Record<string, string[]>> = { ME: {}, NH: {} };

for (const [zip, record] of Object.entries(NH_ME_ZIP_CENTROIDS)) {
  const key = record.city.toLowerCase();
  CITY_INDEX[record.state][key] = record.city;
  (CITY_STATE_COUNT[key] ??= new Set()).add(record.state);
  if (record.zipType === 'STANDARD') {
    (STANDARD_ZIPS[record.state][key] ??= []).push(zip);
  }
}
for (const state of ['ME', 'NH'] as const) {
  for (const zips of Object.values(STANDARD_ZIPS[state])) zips.sort();
}

function registryRecordForCity(state: StateCode, registryCity: string): ZipRecord | undefined {
  const zips = STANDARD_ZIPS[state][registryCity.toLowerCase()];
  if (zips?.length) return NH_ME_ZIP_CENTROIDS[zips[0]];
  // Fall back to any ZIP for the town, so a PO-Box-only town still yields a county.
  return Object.values(NH_ME_ZIP_CENTROIDS).find(
    (r) => r.state === state && r.city.toLowerCase() === registryCity.toLowerCase()
  );
}

/**
 * Resolve a candidate town name.
 *
 * Order matters. An exact registry city wins outright. Then preserved place names
 * — a real town that mails under a neighbour's ZIP, which must keep its own name.
 * Only then the misspelling table, which rewrites what it matches.
 */
function resolveTown(candidate: string, state: StateCode): Omit<TownMatch, 'wordsUsed' | 'head'> | undefined {
  const key = candidate.toLowerCase();

  const exact = CITY_INDEX[state][key];
  if (exact) return { city: exact, state, registryCity: exact };

  const place = NH_ME_PLACE_NAMES[state][key];
  if (place) return { city: place.name, state, registryCity: place.postalCity };

  const canonical = NH_ME_CITY_ALIASES[state][key];
  if (canonical) return { city: canonical, state, registryCity: canonical };

  return undefined;
}

/**
 * Resolve a candidate town with no state to go on.
 *
 * Only accepts a name that is unambiguous across the whole registry. "Raymond"
 * exists in both ME and NH, so it correctly fails here instead of guessing.
 */
function resolveTownWithoutState(candidate: string): Omit<TownMatch, 'wordsUsed' | 'head'> | undefined {
  const key = candidate.toLowerCase();

  const states = CITY_STATE_COUNT[key];
  if (states?.size === 1) {
    const state = [...states][0];
    return { city: CITY_INDEX[state][key], state, registryCity: CITY_INDEX[state][key] };
  }

  const hits: Array<Omit<TownMatch, 'wordsUsed' | 'head'>> = [];
  for (const state of ['ME', 'NH'] as const) {
    const place = NH_ME_PLACE_NAMES[state][key];
    if (place) hits.push({ city: place.name, state, registryCity: place.postalCity });
    const canonical = NH_ME_CITY_ALIASES[state][key];
    if (canonical) hits.push({ city: canonical, state, registryCity: canonical });
  }
  // Ambiguity across states is left unresolved rather than guessed.
  return hits.length === 1 ? hits[0] : undefined;
}

/**
 * Find a town name at the tail of `text`, testing 1–4 word tails, longest first
 * so "Old Orchard Beach" beats "Beach".
 */
export function matchTownTail(text: string, state?: StateCode): TownMatch | undefined {
  const cleaned = normalizeWhitespace(text.replace(/,/g, ' '));
  if (!cleaned) return undefined;

  const words = cleaned.split(' ');
  for (let size = Math.min(4, words.length); size >= 1; size--) {
    const candidate = trimPunctuation(words.slice(words.length - size).join(' ')).replace(/[#]/g, '');
    if (!candidate) continue;

    const hit = state ? resolveTown(candidate, state) : resolveTownWithoutState(candidate);
    if (!hit) continue;

    const head = trimPunctuation(words.slice(0, words.length - size).join(' '))
      // Drop a dangling preposition left by prose like "in Buxton".
      .replace(/\s+(in|at|of)$/i, '');
    return { ...hit, wordsUsed: size, head: trimPunctuation(head) };
  }
  return undefined;
}

function readTrailingState(text: string): { state?: StateCode; rest: string } {
  const match = text.match(TRAILING_STATE);
  if (!match) return { rest: text };
  const token = match[1].toUpperCase().replace(/\./g, '');
  const state = STATE_CODES[token] ?? (token === 'NH' ? 'NH' : undefined);
  return { state, rest: trimPunctuation(text.slice(0, match.index)) };
}

export function parseAddress(raw: string | undefined): AddressProposal {
  if (!raw?.trim()) return { tier: 'D', note: 'empty' };

  let text = normalizeWhitespace(raw);
  text = trimPunctuation(text.replace(TRAILING_COUNTRY, ''));
  if (!text) return { tier: 'D', note: 'empty' };

  // ---------------------------------------------------------------------------
  // Tier A: anchor on a ZIP we can look up.
  //
  // Prefer the LAST 5-digit token that exists in the registry, so a house number
  // cannot false-fire and an out-of-scope ZIP earlier in the string is ignored.
  // ---------------------------------------------------------------------------
  let anchorZip: string | undefined;
  let anchorIndex = -1;
  for (const match of text.matchAll(ZIP_TOKEN)) {
    if (NH_ME_ZIP_CENTROIDS[match[1]]) {
      anchorZip = match[1];
      anchorIndex = match.index ?? -1;
    }
  }

  if (anchorZip) {
    const zipRecord = NH_ME_ZIP_CENTROIDS[anchorZip];
    const before = trimPunctuation(text.slice(0, anchorIndex));
    const { state: typedState, rest } = readTrailingState(before);
    const town = matchTownTail(rest, zipRecord.state) ?? matchTownTail(rest);
    const street = (town ? town.head : rest) || undefined;

    const proposal: AddressProposal = {
      street,
      city: zipRecord.city,
      state: zipRecord.state,
      zip: anchorZip,
      tier: 'A',
    };

    if (town && town.registryCity.toLowerCase() !== zipRecord.city.toLowerCase()) {
      // The typed town and the ZIP's postal city genuinely differ. County is the
      // tiebreaker: same county means this is a postal-district artifact, not an
      // error, so the typed town stands. Different county means the two really
      // disagree and a human has to decide.
      const townRecord = registryRecordForCity(town.state, town.registryCity);
      const sameCounty =
        !!townRecord?.county && !!zipRecord.county && townRecord.county === zipRecord.county;

      if (sameCounty && town.state === zipRecord.state) {
        proposal.city = town.city;
        proposal.note = `postal city for ${anchorZip} is ${zipRecord.city}`;
      } else {
        proposal.tier = 'A!';
        proposal.note = `typed "${town.city}, ${town.state}" but ZIP ${anchorZip} is ${zipRecord.city}, ${zipRecord.state}`;
      }
    } else if (town && town.city.toLowerCase() !== zipRecord.city.toLowerCase()) {
      // Same registry city, different label: a preserved place mailing under this
      // very ZIP. Newington under Portsmouth 03801. Keep the typed town.
      proposal.city = town.city;
      proposal.note = `postal city for ${anchorZip} is ${zipRecord.city}`;
    } else if (!town && typedState && typedState !== zipRecord.state) {
      proposal.tier = 'A!';
      proposal.note = `typed state ${typedState} but ZIP ${anchorZip} is in ${zipRecord.state}`;
    }

    if (!proposal.street && !proposal.note) proposal.note = 'city/state only (no street)';
    return proposal;
  }

  // ---------------------------------------------------------------------------
  // No usable ZIP. Identify a trailing state, then match a town.
  // ---------------------------------------------------------------------------
  const { state: typedState, rest } = readTrailingState(text);
  const town = typedState ? matchTownTail(rest, typedState) : matchTownTail(rest);

  if (!town) {
    return {
      street: text,
      state: typedState,
      tier: 'D',
      note: typedState
        ? `state ${typedState} found, town not recognized`
        : 'no town, state or ZIP recognized',
    };
  }

  // Tier C infers the state purely from a town name being unique in the registry.
  // Because the registry is ME/NH only, a place that is unique *here* need not be
  // unique nationally: "New Kensington" (Pennsylvania) otherwise resolves to
  // Kensington NH with "New" left over as the street. A leftover that is neither
  // empty nor contains a house number is not a street line, so treat the whole
  // match as unsafe rather than write a confident wrong answer.
  if (!typedState && town.head && !/\d/.test(town.head)) {
    return {
      street: text,
      tier: 'D',
      note: `"${town.city}" matched but "${town.head}" is not a street - may be a place outside ME/NH`,
    };
  }

  const proposal: AddressProposal = {
    street: town.head || undefined,
    city: town.city,
    state: town.state,
    // B = the state was given. C = it was inferred from a town unique across the
    // registry, which is a weaker claim.
    tier: typedState ? 'B' : 'C',
  };

  const standard = STANDARD_ZIPS[town.state][town.registryCity.toLowerCase()] ?? [];
  if (standard.length === 1) {
    proposal.zip = standard[0];
  } else if (standard.length > 1) {
    proposal.note = `${standard.length} ZIPs serve ${town.registryCity}, ${town.state} - street needed`;
  } else {
    proposal.note = 'no street-delivery ZIP on file for this town';
  }

  if (!proposal.note && town.city.toLowerCase() !== town.registryCity.toLowerCase()) {
    proposal.note = `mails under ${town.registryCity}`;
  }
  if (!proposal.street && !proposal.note) proposal.note = 'city/state only (no street)';
  return proposal;
}
