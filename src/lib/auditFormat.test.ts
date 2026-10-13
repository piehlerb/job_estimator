import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { actionVerb, actorName, changedFields, fieldLabel, formatValue, tableLabel } from './auditFormat.js';

describe('audit log formatting', () => {
  test('labels tables and fields for people', () => {
    assert.equal(tableLabel('lead_appointments'), 'Lead appointment');
    assert.equal(tableLabel('some_new_table'), 'Some new table');
    assert.equal(fieldLabel('customer_name'), 'Customer name');
    assert.equal(actionVerb('delete'), 'deleted');
  });

  test('changed fields skip ids and come back sorted', () => {
    const fields = changedFields({
      changes: { stage: { old: 'New', new: 'Quoted' }, id: { new: 'L1' }, org_id: { new: 'x' }, name: { new: 'Jane' } },
    });
    assert.deepEqual(fields.map((f) => f.field), ['name', 'stage']);
    assert.equal(fields[1].old, 'New');
    assert.equal(fields[1].new, 'Quoted');
    assert.deepEqual(changedFields({ changes: null }), []);
  });

  test('formats values compactly', () => {
    assert.equal(formatValue(null), '—');
    assert.equal(formatValue(''), '—');
    assert.equal(formatValue(true), 'Yes');
    assert.equal(formatValue(12.5), '12.5');
    assert.equal(formatValue({ a: 1 }), '{"a":1}');
    assert.equal(formatValue('x'.repeat(10), 5), 'xxxx…');
  });

  test('names the actor, with the webhook as system', () => {
    assert.equal(actorName({ userId: undefined, actorEmail: undefined }), 'System');
    assert.equal(actorName({ userId: 'u', actorEmail: 'muse@example.com' }), 'muse@example.com');
  });
});
