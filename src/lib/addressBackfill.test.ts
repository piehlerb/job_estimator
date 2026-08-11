import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Customer, Job, Lead } from '../types/index.js';
import {
  buildAddressBackfillPreview,
  buildZipFillGroups,
  resolveByHand,
} from './addressBackfill.js';

const NOW = '2026-08-11T12:00:00.000Z';

function job(overrides: Partial<Job>): Job {
  return {
    id: 'job-1',
    name: 'Job',
    systemId: 's',
    floorFootage: 1,
    verticalFootage: 0,
    crackFillFactor: 0,
    travelDistance: 0,
    installDate: '2026-08-20',
    installDays: 1,
    jobHours: 8,
    totalPrice: 1,
    status: 'Pending',
    laborersSnapshot: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as Job;
}

function lead(overrides: Partial<Lead>): Lead {
  return {
    id: 'lead-1',
    firstSeenAt: NOW,
    stage: 'New',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as Lead;
}

function customer(overrides: Partial<Customer>): Customer {
  return { id: 'cust-1', name: 'Cust', createdAt: NOW, updatedAt: NOW, ...overrides } as Customer;
}

describe('address backfill', () => {
  test('sorts records into applicable, conflicts and unresolved', () => {
    const preview = buildAddressBackfillPreview(
      [
        job({ id: 'a', customerAddress: '38 Muirfield Dr, Stratham, NH 03885' }),
        job({ id: 'b', customerAddress: '83 Dover Rd, Chichester, NH 03820' }),
        job({ id: 'c', customerAddress: '53 Magnolia Lane' }),
      ],
      [],
      []
    );

    assert.deepEqual(preview.applicable.map((r) => r.id), ['a']);
    assert.deepEqual(preview.conflicts.map((r) => r.id), ['b']);
    assert.deepEqual(preview.unresolved.map((r) => r.id), ['c']);
    assert.equal(preview.tierCounts.A, 1);
    assert.equal(preview.tierCounts['A!'], 1);
    assert.equal(preview.tierCounts.D, 1);
  });

  test('covers all three entity types', () => {
    const preview = buildAddressBackfillPreview(
      [job({ id: 'j', customerName: 'Jane', customerAddress: 'Seabrook, NH 03874' })],
      [lead({ id: 'l', name: 'Lead Co', address: '9 Cascade Rd, Old Orchard Beach, ME 04064' })],
      [customer({ id: 'c', name: 'Cust Co', address: '38 Muirfield Dr, Stratham, NH 03885' })]
    );

    assert.deepEqual(
      preview.applicable.map((r) => [r.entityType, r.label]).sort(),
      [
        ['customer', 'Cust Co'],
        ['job', 'Jane'],
        ['lead', 'Lead Co'],
      ]
    );
  });

  test('leaves already-complete and confirmed records out of the worklist', () => {
    const complete = job({
      id: 'done',
      customerAddress: '38 Muirfield Dr, Stratham, NH 03885',
      customerStreet: '38 Muirfield Dr',
      customerCity: 'Stratham',
      customerState: 'NH',
      customerZip: '03885',
      addressParseTier: 'A',
    });
    const confirmed = job({
      id: 'confirmed',
      customerAddress: 'somewhere odd',
      customerCity: 'Newington',
      customerState: 'NH',
      customerZip: '03801',
      customerStreet: '1 Main St',
      addressParseTier: 'M',
      addressVerifiedAt: NOW,
    });

    const preview = buildAddressBackfillPreview([complete, confirmed], [], []);
    assert.equal(preview.applicable.length, 0);
    assert.equal(preview.conflicts.length, 0);
    assert.equal(preview.unresolved.length, 0);
    assert.equal(preview.settledCount, 2);
  });

  test('is idempotent — applying the proposals leaves nothing to do', () => {
    const first = buildAddressBackfillPreview(
      [job({ id: 'a', customerAddress: '38 Muirfield Dr, Stratham, NH 03885' })],
      [],
      []
    );
    const row = first.applicable[0];

    // Feed the proposal back in as the record's stored state.
    const second = buildAddressBackfillPreview(
      [
        job({
          id: 'a',
          customerAddress: '38 Muirfield Dr, Stratham, NH 03885',
          customerStreet: row.proposed.street,
          customerCity: row.proposed.city,
          customerState: row.proposed.state,
          customerZip: row.proposed.zip,
          addressParseTier: row.proposed.tier,
        }),
      ],
      [],
      []
    );

    assert.equal(second.applicable.length, 0, 're-running must propose nothing');
    assert.equal(second.settledCount, 1);
  });

  test('skips soft-deleted records', () => {
    const preview = buildAddressBackfillPreview(
      [job({ id: 'gone', customerAddress: '38 Muirfield Dr, Stratham, NH 03885', deleted: true })],
      [lead({ id: 'gone-lead', address: 'Seabrook, NH', deleted: true })],
      [customer({ id: 'gone-cust', address: 'Seabrook, NH', deleted: true })]
    );
    assert.equal(preview.applicable.length, 0);
    assert.equal(preview.settledCount, 0);
  });

  test('the parser already fills a single-ZIP town, leaving nothing to bulk-fill', () => {
    // Worth pinning: bulk-fill by town is NOT the main path. When the raw text
    // names a town served by one street-delivery ZIP, the parser derives it
    // directly, so these rows never reach the worklist.
    const preview = buildAddressBackfillPreview(
      [job({ id: 's1', customerAddress: '1 Main St, Seabrook, NH' })],
      [],
      []
    );
    assert.equal(preview.applicable[0].proposed.zip, '03874');
    assert.equal(buildZipFillGroups(preview.applicable).length, 0);
  });

  test('groups by town when a town is known but the raw text yields no ZIP', () => {
    // The case bulk-fill exists for: GHL supplied city and state as discrete
    // fields, but the free-text address has no town in it to parse.
    const preview = buildAddressBackfillPreview(
      [
        job({ id: 's1', customerAddress: 'PO Box 12', customerCity: 'Seabrook', customerState: 'NH' }),
        job({ id: 's2', customerAddress: 'PO Box 34', customerCity: 'Seabrook', customerState: 'NH' }),
        // Manchester NH has five STANDARD ZIPs, so the street is needed to choose
        // and this must never be bulk-filled.
        job({ id: 'm1', customerAddress: 'PO Box 9', customerCity: 'Manchester', customerState: 'NH' }),
      ],
      [],
      []
    );

    const groups = buildZipFillGroups([...preview.applicable, ...preview.unresolved]);
    assert.equal(groups.length, 1, 'only the unambiguous town groups');
    assert.equal(groups[0].city, 'Seabrook');
    assert.equal(groups[0].zip, '03874');
    assert.deepEqual(groups[0].rows.map((r) => r.id).sort(), ['s1', 's2']);
  });

  test('groups a preserved town under the ZIP it mails from', () => {
    // Newington has no ZIP of its own; it must still be fillable from Portsmouth's.
    const preview = buildAddressBackfillPreview(
      [job({ id: 'n', customerAddress: '10 Shipwright Way, Newington, NH' })],
      [],
      []
    );
    const groups = buildZipFillGroups(preview.applicable);

    // The parser already derives it, so there is nothing left to bulk-fill...
    assert.equal(groups.length, 0);
    // ...precisely because the ZIP came through.
    assert.equal(preview.applicable[0].proposed.zip, '03801');
    assert.equal(preview.applicable[0].proposed.city, 'Newington');
  });

  test('a hand resolution is stamped so no later pass can undo it', () => {
    const resolved = resolveByHand(
      { city: 'Chichester', state: 'NH' },
      { zip: '03258' },
      NOW
    );
    assert.equal(resolved.zip, '03258');
    assert.equal(resolved.city, 'Chichester');
    assert.equal(resolved.tier, 'M');
    assert.equal(resolved.verifiedAt, NOW);
  });
});
