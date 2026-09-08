import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Lead, LeadAppointment } from '../types/index.js';
import { costPer, leadTerritory, summarizeLeads } from './leadReporting.js';

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
