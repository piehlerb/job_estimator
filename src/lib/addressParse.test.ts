import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseAddress } from './addressParse.js';

// Every expectation below is checked against the real checked-in registry, not a
// fixture, so a regeneration that moves the data will surface here.
describe('address parser', () => {
  test('parses the four address dialects through one code path', () => {
    const comma = parseAddress('18 Blake Rd, Raymond, NH 03077, USA');
    assert.equal(comma.street, '18 Blake Rd');
    assert.equal(comma.city, 'Raymond');
    assert.equal(comma.state, 'NH');
    assert.equal(comma.zip, '03077');
    assert.equal(comma.tier, 'A');

    const spaced = parseAddress('38 Muirfield Dr Stratham NH 03885');
    assert.equal(spaced.street, '38 Muirfield Dr');
    assert.equal(spaced.city, 'Stratham');
    assert.equal(spaced.zip, '03885');
    assert.equal(spaced.tier, 'A');

    const noState = parseAddress('222 Burnham Rd Gorham 04038');
    assert.equal(noState.street, '222 Burnham Rd');
    assert.equal(noState.city, 'Gorham');
    assert.equal(noState.state, 'ME');
    assert.equal(noState.zip, '04038');
    assert.equal(noState.tier, 'A');

    const prose = parseAddress('62 Emery Circle in Buxton Maine');
    assert.equal(prose.street, '62 Emery Circle');
    assert.equal(prose.city, 'Buxton');
    assert.equal(prose.state, 'ME');
    assert.equal(prose.zip, '04093');
    assert.equal(prose.tier, 'B');
  });

  test('anchors on the last registry ZIP, so a house number cannot false-fire', () => {
    // 03101 is a real ZIP but appears as an earlier reference; 04101 is the destination.
    const later = parseAddress('Old reference 03101; ship to Portland, ME 04101-9999');
    assert.equal(later.zip, '04101');
    assert.equal(later.city, 'Portland');

    // A five-digit house number must not be mistaken for the ZIP.
    const houseNumber = parseAddress('03885 Main St Stratham NH');
    assert.equal(houseNumber.zip, '03885');
    assert.equal(houseNumber.city, 'Stratham');
  });

  test('ignores an out-of-scope ZIP rather than treating it as the anchor', () => {
    // 02110 is Boston -- not in the ME/NH registry, so it is not an anchor.
    const result = parseAddress('12 Elm St, Boston, MA 02110');
    assert.equal(result.zip, undefined);
    assert.equal(result.tier, 'D');
  });

  test('matches the longest town name, not a trailing fragment', () => {
    const result = parseAddress('5 Ocean Ave Old Orchard Beach ME 04064');
    assert.equal(result.city, 'Old Orchard Beach');
    assert.equal(result.street, '5 Ocean Ave');
  });

  // The decision this parser was asked to make: a town that mails under a
  // neighbour's ZIP keeps its own name.
  test('keeps a typed town that has no ZIP of its own instead of the postal city', () => {
    const result = parseAddress('12 Fox Run Rd, Newington, NH 03801');
    assert.equal(result.city, 'Newington', 'the work is in Newington, not Portsmouth');
    assert.equal(result.zip, '03801');
    assert.equal(result.state, 'NH');
    assert.equal(result.tier, 'A');
    assert.match(result.note ?? '', /postal city for 03801 is Portsmouth/);
  });

  test('derives a ZIP for a preserved town from the town it mails under', () => {
    // No ZIP given. Portsmouth has exactly one STANDARD ZIP, so this is unambiguous.
    const result = parseAddress('12 Fox Run Rd, Newington, NH');
    assert.equal(result.city, 'Newington');
    assert.equal(result.zip, '03801');
    assert.equal(result.tier, 'B');
  });

  test('keeps a village name when its county matches the ZIP', () => {
    // Cape Neddick is part of York; both are York County, so this is a postal
    // artifact rather than a contradiction.
    const result = parseAddress('4 Shore Rd Cape Neddick ME 03909');
    assert.equal(result.city, 'Cape Neddick');
    assert.equal(result.zip, '03909');
    assert.equal(result.tier, 'A');
  });

  test('normalizes a misspelled or abbreviated town', () => {
    const abbreviated = parseAddress('10 Main St, N Berwick, ME 03906');
    assert.equal(abbreviated.city, 'North Berwick');
    assert.equal(abbreviated.tier, 'A');

    const alsoAbbreviated = parseAddress('10 Main St, No Berwick, ME 03906');
    assert.equal(alsoAbbreviated.city, 'North Berwick');
  });

  test('refuses to resolve a ZIP that contradicts the typed town', () => {
    // Chichester is Merrimack County; 03820 is Dover, Strafford County.
    const result = parseAddress('83 Dover Rd, Chichester, NH 03820');
    assert.equal(result.tier, 'A!');
    assert.match(result.note ?? '', /Chichester/);
    assert.match(result.note ?? '', /Dover/);
  });

  test('refuses to resolve a ZIP in a different state from the typed town', () => {
    // 03110 is Bedford NH; York is in Maine.
    const result = parseAddress('11 Rockfall Way York ME 03110');
    assert.equal(result.tier, 'A!');
  });

  test('will not guess between two states for an ambiguous town', () => {
    // Raymond exists in both ME and NH, and Gorham in both too.
    assert.equal(parseAddress('4 Depot Rd Raymond').tier, 'D');
    assert.equal(parseAddress('222 Burnham Rd Gorham').tier, 'D');
  });

  test('does not resolve a place that is unique only because the registry is ME/NH', () => {
    // "New Kensington" is in Pennsylvania. Matching its last word would resolve it
    // to Kensington NH with "New" left over as the street -- and tier C is applied
    // automatically, so a wrong answer here would land silently.
    const result = parseAddress('New Kensington');
    assert.equal(result.tier, 'D');
    assert.equal(result.city, undefined);
    assert.match(result.note ?? '', /not a street/);

    // The guard must not reject a genuine street line.
    assert.equal(parseAddress('9 Cascade Rd Old Orchard Beach').tier, 'C');
    // ...nor a bare town name with nothing left over.
    assert.equal(parseAddress('Old Orchard Beach').tier, 'C');
  });

  test('resolves a town that is unique across the registry without a state', () => {
    const result = parseAddress('9 Cascade Rd Old Orchard Beach');
    assert.equal(result.city, 'Old Orchard Beach');
    assert.equal(result.state, 'ME');
    assert.equal(result.zip, '04064');
    assert.equal(result.tier, 'C', 'no state was given, so this is a weaker claim than B');
  });

  test('will not pick a ZIP for a town served by several', () => {
    // Manchester NH has five STANDARD ZIPs; the street is needed to choose.
    const result = parseAddress('Manchester NH');
    assert.equal(result.city, 'Manchester');
    assert.equal(result.zip, undefined);
    assert.equal(result.tier, 'B');
    assert.match(result.note ?? '', /5 ZIPs serve Manchester, NH/);
  });

  test('never derives a ZIP from a PO Box town', () => {
    // Bar Mills ME has only a PO Box ZIP, which is never a job site.
    const result = parseAddress('Bar Mills ME');
    assert.equal(result.city, 'Bar Mills');
    assert.equal(result.zip, undefined);
    assert.match(result.note ?? '', /no street-delivery ZIP/);
  });

  test('reports city/state only when there is no street', () => {
    const result = parseAddress('Seabrook, NH 03874');
    assert.equal(result.street, undefined);
    assert.equal(result.city, 'Seabrook');
    assert.equal(result.zip, '03874');
    assert.equal(result.tier, 'A');
    assert.match(result.note ?? '', /no street/);
  });

  test('gives up rather than inventing anything', () => {
    // A digit transposition of 03258: not a registry ZIP, and no town to fall back on.
    const transposed = parseAddress('245 horse corner rd, 03528');
    assert.equal(transposed.zip, undefined);
    assert.equal(transposed.tier, 'D');

    assert.equal(parseAddress('53 Magnolia Lane').tier, 'D');
    assert.equal(parseAddress('48 Emele Ave, Epsm, NH').tier, 'D');
    assert.equal(parseAddress(undefined).tier, 'D');
    assert.equal(parseAddress('   ').tier, 'D');
  });

  test('tolerates messy but recoverable input', () => {
    const messy = parseAddress('      By 34 Vrylenas Way, Hampton 03842');
    assert.equal(messy.city, 'Hampton');
    assert.equal(messy.zip, '03842');
    assert.equal(messy.tier, 'A');
  });
});
