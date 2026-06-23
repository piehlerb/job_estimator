import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Lead } from '../types/index.js';
import { applyLeadEdit, softDeleteLead } from './leadMutations.js';

const baseLead: Lead = {
  id: 'lead-1',
  name: 'Original',
  phone: '5551112222',
  email: 'old@example.com',
  address: '1 Main St',
  source: 'Facebook',
  campaign: 'Spring',
  firstSeenAt: '2026-06-01T00:00:00.000Z',
  lastEventAt: '2026-06-02T00:00:00.000Z',
  stage: 'New',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-02T00:00:00.000Z',
};

describe('lead mutation helpers', () => {
  test('applies trimmed editable fields and updates timestamp', () => {
    const next = applyLeadEdit(baseLead, {
      name: '  Jane Lead  ',
      phone: ' 5553334444 ',
      email: ' jane@example.com ',
      address: ' 44 Oak Rd ',
      source: ' Google Ads ',
      campaign: ' Summer ',
      stage: 'Engaged',
    }, '2026-06-23T12:00:00.000Z');

    assert.equal(next.name, 'Jane Lead');
    assert.equal(next.phone, '5553334444');
    assert.equal(next.email, 'jane@example.com');
    assert.equal(next.address, '44 Oak Rd');
    assert.equal(next.source, 'Google Ads');
    assert.equal(next.campaign, 'Summer');
    assert.equal(next.stage, 'Engaged');
    assert.equal(next.updatedAt, '2026-06-23T12:00:00.000Z');
  });

  test('clears empty optional fields and non-applicable disposition fields', () => {
    const lostLead: Lead = {
      ...baseLead,
      stage: 'Lost',
      dispositionReason: 'Not Interested',
      dispositionNotes: 'No budget',
      closedAt: '2026-06-10T00:00:00.000Z',
    };

    const next = applyLeadEdit(lostLead, {
      name: '',
      phone: '',
      email: '',
      address: '',
      source: '',
      campaign: '',
      stage: 'Engaged',
      dispositionReason: 'Not Interested',
      dispositionNotes: 'Keep me',
    }, '2026-06-23T12:30:00.000Z');

    assert.equal(next.name, undefined);
    assert.equal(next.phone, undefined);
    assert.equal(next.email, undefined);
    assert.equal(next.address, undefined);
    assert.equal(next.source, undefined);
    assert.equal(next.campaign, undefined);
    assert.equal(next.stage, 'Engaged');
    assert.equal(next.dispositionReason, undefined);
    assert.equal(next.dispositionNotes, undefined);
    assert.equal(next.closedAt, undefined);
  });

  test('sets closed timestamp when moving to terminal stage', () => {
    const next = applyLeadEdit(baseLead, {
      stage: 'Disqualified',
      dispositionReason: 'Out of Territory',
      dispositionNotes: 'Outside service area',
    }, '2026-06-23T13:00:00.000Z');

    assert.equal(next.stage, 'Disqualified');
    assert.equal(next.dispositionReason, 'Out of Territory');
    assert.equal(next.dispositionNotes, 'Outside service area');
    assert.equal(next.closedAt, '2026-06-23T13:00:00.000Z');
  });

  test('soft deletes a lead and updates timestamp', () => {
    const next = softDeleteLead(baseLead, '2026-06-23T14:00:00.000Z');

    assert.equal(next.deleted, true);
    assert.equal(next.updatedAt, '2026-06-23T14:00:00.000Z');
    assert.equal(next.id, baseLead.id);
  });
});
