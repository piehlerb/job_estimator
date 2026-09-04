import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Customer, Job, Lead } from '../types/index.js';
import {
  markAddressVerified,
  resolveAddressFields,
  withCustomerAddressFields,
  withJobAddressFields,
  withLeadAddressFields,
} from './addressFields.js';

const NOW = '2026-08-11T12:00:00.000Z';

function baseJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    name: 'Test Job',
    systemId: 'sys-1',
    floorFootage: 500,
    verticalFootage: 0,
    crackFillFactor: 0,
    travelDistance: 0,
    installDate: '2026-08-20',
    installDays: 1,
    jobHours: 8,
    totalPrice: 5000,
    status: 'Pending',
    laborersSnapshot: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as Job;
}

describe('structured address write path', () => {
  test('derives the whole group from a new raw address', () => {
    const job = withJobAddressFields(
      baseJob({ customerAddress: '38 Muirfield Dr, Stratham, NH 03885' })
    );

    assert.equal(job.customerStreet, '38 Muirfield Dr');
    assert.equal(job.customerCity, 'Stratham');
    assert.equal(job.customerState, 'NH');
    assert.equal(job.customerZip, '03885');
    assert.equal(job.addressParseTier, 'A');
    // Raw is the source and is never rewritten from the projection.
    assert.equal(job.customerAddress, '38 Muirfield Dr, Stratham, NH 03885');
  });

  test('canonicalizes a town that arrived in the wrong case', () => {
    // GHL passes through whatever the lead typed, so towns arrive shouting.
    // "PORTLAND" and "Portland" must not count as two towns in a report.
    const lead = withLeadAddressFields({
      id: 'lead-1',
      address: '1 Congress St, PORTLAND, ME 04101',
      city: 'PORTLAND',
      state: 'me',
      zip: '04101',
      firstSeenAt: NOW,
      stage: 'New',
      createdAt: NOW,
      updatedAt: NOW,
    } as Lead);

    assert.equal(lead.city, 'Portland');
    assert.equal(lead.state, 'ME');
  });

  test('rebuilds the group when the raw address changes, without inheriting the old one', () => {
    const previous = withJobAddressFields(
      baseJob({ customerAddress: '38 Muirfield Dr, Stratham, NH 03885' })
    );
    previous.customerStreet2 = 'Unit 4';

    const edited = withJobAddressFields(
      { ...previous, customerAddress: 'Dover, NH 03820' },
      previous
    );

    assert.equal(edited.customerCity, 'Dover');
    assert.equal(edited.customerZip, '03820');
    assert.equal(edited.customerStreet, undefined, 'the old street must not survive a new town');
    assert.equal(edited.customerStreet2, undefined, 'a unit number belongs to its own address');
  });

  test('leaves a confirmed address alone when the raw text has not changed', () => {
    const confirmed = baseJob({
      customerAddress: '38 Muirfield Dr, Stratham, NH 03885',
      customerStreet: '38 Muirfield Dr',
      customerCity: 'Newington',
      customerState: 'NH',
      customerZip: '03801',
      addressParseTier: 'M',
      addressVerifiedAt: NOW,
    });

    const result = withJobAddressFields(confirmed, confirmed);

    assert.equal(result.customerCity, 'Newington', 'a hand correction must survive');
    assert.equal(result.customerZip, '03801');
    assert.equal(result.addressParseTier, 'M');
    assert.equal(result.addressVerifiedAt, NOW);
  });

  test('re-derives even a confirmed address once the raw text is edited', () => {
    // The ratchet protects a correction, not a stale projection of a different
    // address. Editing the raw text means this is somewhere else now.
    const confirmed = baseJob({
      customerAddress: '38 Muirfield Dr, Stratham, NH 03885',
      customerCity: 'Stratham',
      customerState: 'NH',
      customerZip: '03885',
      addressParseTier: 'M',
      addressVerifiedAt: NOW,
    });

    const moved = withJobAddressFields(
      { ...confirmed, customerAddress: '9 Cascade Rd, Old Orchard Beach, ME 04064' },
      confirmed
    );

    assert.equal(moved.customerCity, 'Old Orchard Beach');
    assert.equal(moved.customerZip, '04064');
    assert.equal(moved.addressVerifiedAt, undefined, 'the confirmation was about the old address');
  });

  test('fills only the gaps when the raw text is unchanged', () => {
    const partial = baseJob({
      customerAddress: '38 Muirfield Dr, Stratham, NH 03885',
      customerCity: 'Stratham',
      customerState: 'NH',
    });

    const result = withJobAddressFields(partial, partial);

    assert.equal(result.customerZip, '03885', 'the empty ZIP is filled');
    assert.equal(result.customerStreet, '38 Muirfield Dr');
    assert.equal(result.customerCity, 'Stratham');
  });

  test('writes no values for a ZIP that contradicts the typed town', () => {
    // Chichester is Merrimack County; 03820 is Dover, Strafford County.
    const job = withJobAddressFields(
      baseJob({ customerAddress: '83 Dover Rd, Chichester, NH 03820' })
    );

    assert.equal(job.addressParseTier, 'A!');
    assert.equal(job.customerCity, undefined, 'a blank field beats a confidently wrong one');
    assert.equal(job.customerZip, undefined);
    assert.equal(job.customerStreet, undefined);
    // The raw text survives so a human can resolve it later.
    assert.equal(job.customerAddress, '83 Dover Rd, Chichester, NH 03820');
  });

  test('records tier D for an address it cannot resolve', () => {
    const job = withJobAddressFields(baseJob({ customerAddress: '53 Magnolia Lane' }));
    assert.equal(job.addressParseTier, 'D');
    assert.equal(job.customerCity, undefined);
  });

  test('keeps the typed town rather than the postal city', () => {
    const job = withJobAddressFields(
      baseJob({ customerAddress: '12 Fox Run Rd, Newington, NH 03801' })
    );
    assert.equal(job.customerCity, 'Newington');
    assert.equal(job.customerZip, '03801');
  });

  test('never emits a value that would violate the CHECK constraints', () => {
    // One violation fails an entire batched sync upsert, not just its own row.
    const cases: Array<Partial<Job>> = [
      { customerAddress: 'Somewhere, ZZ 999' },
      { customerAddress: '12 Rue Foo, Montreal, QC H3Z 2Y7' },
      { customerAddress: 'Reading MA 01867' },
      { customerCity: 'Nowhere', customerState: 'maine', customerZip: '123' },
      { customerState: 'Massachusetts', customerZip: '01867-1234' },
    ];

    for (const overrides of cases) {
      const job = withJobAddressFields(baseJob(overrides), baseJob(overrides));
      if (job.customerState !== undefined) {
        assert.match(job.customerState, /^[A-Z]{2}$/, `bad state from ${JSON.stringify(overrides)}`);
      }
      if (job.customerZip !== undefined) {
        assert.match(job.customerZip, /^[0-9]{5}$/, `bad zip from ${JSON.stringify(overrides)}`);
      }
    }
  });

  test('keeps an out-of-scope town instead of discarding it', () => {
    // Unrecognized is not the same as wrong; the cleanup worklist handles it.
    const result = resolveAddressFields('23 John Carver Rd, Reading, MA 01867', { city: 'Reading' }, false);
    assert.equal(result.city, 'Reading');
    assert.equal(result.state, undefined, 'MA is not in the registry, so no state is claimed');
  });

  test('marking an address verified puts it beyond automated reach', () => {
    const marked = markAddressVerified({ city: 'PORTLAND', state: 'me', zip: '04101' }, NOW);
    assert.equal(marked.tier, 'M');
    assert.equal(marked.verifiedAt, NOW);
    // Canonicalization still applies to what the human typed.
    assert.equal(marked.city, 'Portland');
    assert.equal(marked.state, 'ME');

    // ...and a later automated pass leaves it alone.
    const later = resolveAddressFields('somewhere else entirely', marked, false);
    assert.deepEqual(later, marked);
  });

  test('a customer created from a job inherits the structured address', () => {
    const customer = withCustomerAddressFields({
      id: 'cust-1',
      name: 'Jane Doe',
      address: '9 Cascade Rd, Old Orchard Beach, ME 04064',
      createdAt: NOW,
      updatedAt: NOW,
    } as Customer);

    assert.equal(customer.city, 'Old Orchard Beach');
    assert.equal(customer.state, 'ME');
    assert.equal(customer.zip, '04064');
    assert.equal(customer.addressParseTier, 'A');
  });
});
