import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AdSpend, Lead, LeadAppointment } from '../types/index.js';
import { UNATTRIBUTED_SOURCE, costPer, costsBySource, leadSourceOf, leadTerritory, summarizeLeads } from './leadReporting.js';

const lead = (id: string, overrides: Partial<Lead> = {}): Lead => ({ id, stage: 'New', firstSeenAt: '2026-09-01', createdAt: '2026-09-01', updatedAt: '2026-09-01', ...overrides });
const appointment = (id: string, leadId: string, overrides: Partial<LeadAppointment> = {}): LeadAppointment => ({ id, leadId, status: 'booked', createdAt: '2026-09-01', updatedAt: '2026-09-01', ...overrides });

test('territory follows the explicit business rule, even without an address', () => {
  assert.equal(leadTerritory(lead('a')), 'In territory');
  assert.equal(leadTerritory(lead('b', { dispositionReason: 'Out of Territory' })), 'Out of territory');
  assert.equal(leadTerritory(lead('c', { stage: 'Lost', dispositionReason: 'Price/Budget' })), 'In territory');
});

test('counts unique booked leads, retains closed bookings, and excludes deleted records', () => {
  const result = summarizeLeads([
    lead('a'), lead('b', { stage: 'Lost', dispositionReason: 'Out of Territory' }),
    lead('c', { stage: 'Won' }), lead('d', { deleted: true }), lead('e'),
  ], [appointment('1', 'a'), appointment('2', 'a'), appointment('3', 'b', { status: 'canceled' }), appointment('4', 'e', { deleted: true })]);
  assert.equal(result.leads, 4);
  assert.equal(result.booked, 3);
  assert.equal(result.bookedInTerritory, 2);
  assert.equal(result.open, 1);
  assert.equal(result.won, 1);
  assert.deepEqual(result.territory, { 'In territory': 3, 'Out of territory': 1 });
  assert.deepEqual(result.stages, { New: 2, Lost: 1, Won: 1 });
  assert.deepEqual(result.dispositions, { 'No disposition': 3, 'Out of Territory': 1 });
});

test('costs distinguish missing spend, zero spend, and zero denominators', () => {
  assert.equal(costPer(300, 3), 100);
  assert.equal(costPer(null, 3), null);
  assert.equal(costPer(0, 3), 0);
  assert.equal(costPer(300, 0), null);
  assert.equal(costPer(0, 0), null);
});

const spend = (month: string, amount: number, source?: string, overrides: Partial<AdSpend> = {}): AdSpend => ({ id: `${month}-${source}`, month, amount, source, createdAt: '2026-09-01', updatedAt: '2026-09-01', ...overrides });

test('costs by source count only that source\'s leads in months it has spend', () => {
  const leads = [
    lead('a', { source: 'EZMedia', firstSeenAt: '2026-08-10T12:00:00' }),
    lead('b', { source: 'EZMedia ', firstSeenAt: '2026-08-20T12:00:00', stage: 'Quoted' }),
    lead('c', { source: 'EZMedia', firstSeenAt: '2026-09-05T12:00:00' }), // no EZMedia spend in September
    lead('d', { source: 'Facebook', firstSeenAt: '2026-08-11T12:00:00', dispositionReason: 'Out of Territory' }),
    lead('e', { source: 'EZMedia', firstSeenAt: '2026-08-12T12:00:00', deleted: true }),
  ];
  const result = costsBySource(leads, [], [
    spend('2026-08', 1000, 'EZMedia'),
    spend('2026-08', 50, 'Facebook'),
    spend('2026-09', 200, 'Google'),
    spend('2026-07', 999, 'EZMedia'), // outside the months asked for
    spend('2026-08', 70, 'Facebook', { id: 'gone', deleted: true }),
    spend('2026-08', 30),
  ], new Set(['2026-08', '2026-09']));
  assert.deepEqual(result.get('EZMedia'), { spend: 1000, leads: 2, inTerritory: 2, booked: 1 });
  assert.deepEqual(result.get('Facebook'), { spend: 50, leads: 1, inTerritory: 0, booked: 0 });
  assert.deepEqual(result.get('Google'), { spend: 200, leads: 0, inTerritory: 0, booked: 0 });
  assert.equal(result.get(UNATTRIBUTED_SOURCE)?.spend, 30);
  assert.equal(result.has('(No Source)'), false);
});

test('lead sources are trimmed and blank sources grouped', () => {
  assert.equal(leadSourceOf({ source: '  Web ' }), 'Web');
  assert.equal(leadSourceOf({ source: '' }), '(No Source)');
});
