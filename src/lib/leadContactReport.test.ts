import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Lead, LeadStage } from '../types/index.js';
import { buildLeadContactReport, daysSinceLocalDay } from './leadContactReport.js';

// Built from local components so calendar-day assertions hold in any timezone
function localIso(y: number, m: number, d: number, h = 12): string {
  return new Date(y, m - 1, d, h).toISOString();
}

const now = new Date(2026, 10, 16, 15); // Nov 16 2026, 3 PM local

function lead(id: string, stage: LeadStage, contacts: string[] = [], extra: Partial<Lead> = {}): Lead {
  return {
    id,
    name: id,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    stage,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    contactLog: contacts.length
      ? contacts.map((at, index) => ({ id: `${id}-${index}`, channel: index % 2 ? 'text' : 'call', at }))
      : null,
    ...extra,
  };
}

const ids = (rows: { lead: Lead }[]) => rows.map((row) => row.lead.id);

describe('buildLeadContactReport', () => {
  const leads = [
    lead('recent', 'Engaged', [localIso(2026, 11, 10), localIso(2026, 11, 15)]),
    lead('stale', 'Contact Attempted', [localIso(2026, 10, 20)]),
    lead('never', 'New'),
    lead('dq', 'Disqualified', [localIso(2026, 9, 1)]),
    lead('gone', 'New', [], { deleted: true }),
    lead('won', 'Won', [localIso(2026, 11, 1)]),
  ];

  test('leaves out disqualified and deleted leads', () => {
    const rows = buildLeadContactReport(leads, { now });
    assert.deepEqual(ids(rows).sort(), ['never', 'recent', 'stale', 'won']);
  });

  test('stalest first puts never-contacted leads at the top', () => {
    assert.deepEqual(ids(buildLeadContactReport(leads, { now })), ['never', 'stale', 'won', 'recent']);
  });

  test('most recent first puts never-contacted leads at the bottom', () => {
    assert.deepEqual(ids(buildLeadContactReport(leads, { now, order: 'recent' })), ['recent', 'won', 'stale', 'never']);
  });

  test('summarizes calls, texts and days since the latest contact', () => {
    const [row] = buildLeadContactReport([leads[0]], { now });
    assert.equal(row.calls, 1);
    assert.equal(row.texts, 1);
    assert.equal(row.lastContactedAt, localIso(2026, 11, 15));
    assert.equal(row.daysSinceContact, 1);
  });

  test('never-contacted rows carry no last contact', () => {
    const [row] = buildLeadContactReport([leads[2]], { now });
    assert.equal(row.lastContactedAt, undefined);
    assert.equal(row.daysSinceContact, undefined);
    assert.equal(row.calls + row.texts, 0);
  });

  test('a stage filter narrows the rows but can never bring back disqualified leads', () => {
    const rows = buildLeadContactReport(leads, { now, stages: new Set<LeadStage>(['New', 'Disqualified']) });
    assert.deepEqual(ids(rows), ['never']);
  });

  test('ties fall back to the oldest lead first', () => {
    const rows = buildLeadContactReport(
      [
        lead('newer', 'New', [], { createdAt: '2026-11-02T00:00:00.000Z' }),
        lead('older', 'New', [], { createdAt: '2026-10-02T00:00:00.000Z' }),
      ],
      { now }
    );
    assert.deepEqual(ids(rows), ['older', 'newer']);
  });
});

describe('daysSinceLocalDay', () => {
  test('counts calendar days, not 24-hour periods', () => {
    assert.equal(daysSinceLocalDay(localIso(2026, 11, 16, 1), now), 0);
    assert.equal(daysSinceLocalDay(localIso(2026, 11, 15, 23), now), 1);
    assert.equal(daysSinceLocalDay(localIso(2026, 10, 17), now), 30);
  });

  test('never goes negative for a contact dated in the future', () => {
    assert.equal(daysSinceLocalDay(localIso(2026, 11, 18), now), 0);
  });
});
