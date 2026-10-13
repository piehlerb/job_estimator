import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Lead } from '../types/index.js';
import { applyLeadEdit } from './leadMutations.js';
import {
  fromDateTimeLocalValue,
  logLeadContact,
  matchesLastContactedFilter,
  sortedContactLog,
  summarizeLeadContacts,
  toDateTimeLocalValue,
} from './leadContacts.js';

const baseLead: Lead = {
  id: 'lead-1',
  name: 'Jane',
  firstSeenAt: '2026-06-01T00:00:00.000Z',
  stage: 'New',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

// Built from local components so calendar-day assertions hold in any timezone
function localIso(y: number, m: number, d: number, h = 12): string {
  return new Date(y, m - 1, d, h).toISOString();
}

const now = new Date(2026, 9, 13, 15); // Oct 13 2026, 3 PM local

function contactedOn(...dates: [number, number, number][]): Lead {
  return {
    ...baseLead,
    contactLog: dates.map(([y, m, d], index) => ({
      id: `c${index}`,
      channel: index % 2 === 0 ? 'call' : 'text',
      at: localIso(y, m, d),
    })),
  };
}

describe('summarizeLeadContacts', () => {
  test('counts calls and texts and finds the latest attempt in any order', () => {
    const lead: Lead = {
      ...baseLead,
      contactLog: [
        { id: 'a', channel: 'call', at: '2026-10-10T14:00:00.000Z' },
        { id: 'b', channel: 'text', at: '2026-10-12T14:00:00.000Z' },
        { id: 'c', channel: 'call', at: '2026-10-11T14:00:00.000Z' },
      ],
    };
    assert.deepEqual(summarizeLeadContacts(lead), {
      calls: 2,
      texts: 1,
      lastContactedAt: '2026-10-12T14:00:00.000Z',
    });
  });

  test('handles leads with no log, including null from the database', () => {
    assert.deepEqual(summarizeLeadContacts(baseLead), { calls: 0, texts: 0, lastContactedAt: undefined });
    assert.deepEqual(summarizeLeadContacts({ ...baseLead, contactLog: null }), {
      calls: 0,
      texts: 0,
      lastContactedAt: undefined,
    });
  });

  test('ignores entries with an unreadable date', () => {
    const lead: Lead = { ...baseLead, contactLog: [{ id: 'a', channel: 'call', at: 'garbage' }] };
    assert.deepEqual(summarizeLeadContacts(lead), { calls: 0, texts: 0, lastContactedAt: undefined });
  });
});

describe('logLeadContact', () => {
  test('appends the attempt, bumps updatedAt and moves a New lead to Contact Attempted', () => {
    const next = logLeadContact(baseLead, 'call', '2026-10-13T15:00:00.000Z', 'id-1');
    assert.deepEqual(next.contactLog, [{ id: 'id-1', channel: 'call', at: '2026-10-13T15:00:00.000Z' }]);
    assert.equal(next.stage, 'Contact Attempted');
    assert.equal(next.updatedAt, '2026-10-13T15:00:00.000Z');
  });

  test('leaves later stages alone and keeps earlier attempts', () => {
    const lead: Lead = {
      ...baseLead,
      stage: 'Call Booked',
      contactLog: [{ id: 'old', channel: 'text', at: '2026-10-01T15:00:00.000Z' }],
    };
    const next = logLeadContact(lead, 'text', '2026-10-13T15:00:00.000Z', 'new');
    assert.equal(next.stage, 'Call Booked');
    assert.deepEqual(next.contactLog?.map((attempt) => attempt.id), ['old', 'new']);
  });
});

describe('matchesLastContactedFilter', () => {
  const today = contactedOn([2026, 10, 13]);
  const sixDaysAgo = contactedOn([2026, 10, 7]);
  const sevenDaysAgo = contactedOn([2026, 10, 6]);

  test('any matches everything, never matches only uncontacted leads', () => {
    assert.ok(matchesLastContactedFilter(baseLead, { kind: 'any' }, now));
    assert.ok(matchesLastContactedFilter(today, { kind: 'any' }, now));
    assert.ok(matchesLastContactedFilter(baseLead, { kind: 'never' }, now));
    assert.ok(!matchesLastContactedFilter(today, { kind: 'never' }, now));
  });

  test('within N days counts today as the first day', () => {
    assert.ok(matchesLastContactedFilter(today, { kind: 'within', days: 1 }, now));
    assert.ok(!matchesLastContactedFilter(sixDaysAgo, { kind: 'within', days: 1 }, now));
    assert.ok(matchesLastContactedFilter(sixDaysAgo, { kind: 'within', days: 7 }, now));
    assert.ok(!matchesLastContactedFilter(sevenDaysAgo, { kind: 'within', days: 7 }, now));
    assert.ok(!matchesLastContactedFilter(baseLead, { kind: 'within', days: 7 }, now));
  });

  test('olderThan is the complement of within for contacted leads, and excludes never-contacted', () => {
    assert.ok(!matchesLastContactedFilter(sixDaysAgo, { kind: 'olderThan', days: 7 }, now));
    assert.ok(matchesLastContactedFilter(sevenDaysAgo, { kind: 'olderThan', days: 7 }, now));
    assert.ok(!matchesLastContactedFilter(baseLead, { kind: 'olderThan', days: 7 }, now));
  });

  test('uses the most recent attempt, not the first', () => {
    const lead = contactedOn([2026, 9, 1], [2026, 10, 12]);
    assert.ok(matchesLastContactedFilter(lead, { kind: 'within', days: 7 }, now));
    assert.ok(!matchesLastContactedFilter(lead, { kind: 'olderThan', days: 7 }, now));
  });

  test('range is inclusive on both ends and either end may be open', () => {
    assert.ok(matchesLastContactedFilter(sevenDaysAgo, { kind: 'range', from: '2026-10-06', to: '2026-10-06' }, now));
    assert.ok(!matchesLastContactedFilter(sevenDaysAgo, { kind: 'range', from: '2026-10-07' }, now));
    assert.ok(matchesLastContactedFilter(sevenDaysAgo, { kind: 'range', to: '2026-10-06' }, now));
    assert.ok(matchesLastContactedFilter(sevenDaysAgo, { kind: 'range' }, now));
    assert.ok(!matchesLastContactedFilter(baseLead, { kind: 'range' }, now));
  });
});

describe('contact log editing', () => {
  test('sortedContactLog lists newest first without mutating the lead', () => {
    const lead = contactedOn([2026, 10, 1], [2026, 10, 12], [2026, 10, 5]);
    assert.deepEqual(sortedContactLog(lead).map((attempt) => attempt.id), ['c1', 'c2', 'c0']);
    assert.deepEqual(lead.contactLog?.map((attempt) => attempt.id), ['c0', 'c1', 'c2']);
  });

  test('datetime-local values round-trip through local time', () => {
    const iso = localIso(2026, 10, 13, 9);
    assert.equal(toDateTimeLocalValue(iso), '2026-10-13T09:00');
    assert.equal(fromDateTimeLocalValue('2026-10-13T09:00'), iso);
    assert.equal(fromDateTimeLocalValue(''), undefined);
    assert.equal(toDateTimeLocalValue('garbage'), '');
  });

  test('applyLeadEdit writes the edited log, and an emptied log as null', () => {
    const lead = contactedOn([2026, 10, 1]);
    const edited = applyLeadEdit(lead, { stage: lead.stage, contactLog: [] }, '2026-10-13T00:00:00.000Z');
    assert.equal(edited.contactLog, null);

    const untouched = applyLeadEdit(lead, { stage: lead.stage }, '2026-10-13T00:00:00.000Z');
    assert.deepEqual(untouched.contactLog, lead.contactLog);
  });
});
