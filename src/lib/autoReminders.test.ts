import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildAutoReminders, resolveTemplateBody } from './autoReminders.js';
import { addDaysToLocalDate } from './dateUtils.js';
import type { AutoReminderRule, CommunicationTemplate, JobReminder } from '../types/index.js';

function makeRule(overrides: Partial<AutoReminderRule> = {}): AutoReminderRule {
  return {
    id: 'rule-1',
    subject: 'Follow up call',
    daysAfterEstimate: 2,
    enabled: true,
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<CommunicationTemplate> = {}): CommunicationTemplate {
  return {
    id: 'tpl-1',
    name: 'Initial Follow-up',
    body: 'Hi [Name], just checking in on your quote.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

let idCounter = 0;
const generateId = () => `generated-${++idCounter}`;

describe('addDaysToLocalDate', () => {
  test('adds days on the local calendar and crosses month boundaries', () => {
    assert.equal(addDaysToLocalDate('2026-06-20', 2), '2026-06-22');
    assert.equal(addDaysToLocalDate('2026-06-29', 7), '2026-07-06');
    assert.equal(addDaysToLocalDate('2026-03-01', -1), '2026-02-28');
    assert.equal(addDaysToLocalDate('2026-06-20', 0), '2026-06-20');
  });

  test('returns empty string for unusable input', () => {
    assert.equal(addDaysToLocalDate('', 3), '');
    assert.equal(addDaysToLocalDate('not-a-date', 3), '');
  });
});

describe('resolveTemplateBody', () => {
  test('substitutes the customer first name, keeping the placeholder when unknown', () => {
    assert.equal(resolveTemplateBody('Hi [Name]!', 'Dana Smith'), 'Hi Dana!');
    assert.equal(resolveTemplateBody('Hi [Name]!', '  '), 'Hi [Name]!');
  });
});

describe('buildAutoReminders', () => {
  test('builds one reminder per enabled rule, timed from the estimate date', () => {
    const reminders = buildAutoReminders({
      rules: [
        makeRule({ id: 'a', subject: 'Day 7 check-in', daysAfterEstimate: 7, time: '08:30' }),
        makeRule({ id: 'b', subject: 'Day 2 call', daysAfterEstimate: 2 }),
      ],
      estimateDate: '2026-06-20',
      defaultTime: '06:00',
      generateId,
      now: new Date('2026-06-20T14:00:00.000Z'),
    });

    assert.deepEqual(
      reminders.map((r) => [r.subject, r.dueDate, r.dueTime, r.autoRuleId]),
      [
        ['Day 2 call', '2026-06-22', '06:00', 'b'],
        ['Day 7 check-in', '2026-06-27', '08:30', 'a'],
      ]
    );
    assert.equal(reminders[0].completed, false);
    assert.equal(reminders[0].createdAt, '2026-06-20T14:00:00.000Z');
  });

  test('skips disabled rules and rules already applied to the job', () => {
    const existing: JobReminder[] = [
      {
        id: 'existing',
        subject: 'Day 2 call',
        dueDate: '2026-06-22',
        dueTime: '06:00',
        dueAt: '2026-06-22T10:00:00.000Z',
        autoRuleId: 'applied',
        createdAt: '2026-06-20T10:00:00.000Z',
        updatedAt: '2026-06-20T10:00:00.000Z',
      },
    ];

    const reminders = buildAutoReminders({
      rules: [
        makeRule({ id: 'applied' }),
        makeRule({ id: 'off', enabled: false }),
        makeRule({ id: 'fresh', subject: 'New one' }),
      ],
      estimateDate: '2026-06-20',
      existingReminders: existing,
      generateId,
    });

    assert.deepEqual(reminders.map((r) => r.autoRuleId), ['fresh']);
  });

  test('fills details from the linked template and falls back to its name for the subject', () => {
    const [reminder] = buildAutoReminders({
      rules: [makeRule({ subject: '  ', templateId: 'tpl-1' })],
      templates: [makeTemplate()],
      estimateDate: '2026-06-20',
      customerName: 'Dana Smith',
      generateId,
    });

    assert.equal(reminder.subject, 'Initial Follow-up');
    assert.equal(reminder.details, 'Hi Dana, just checking in on your quote.');
  });

  test('leaves details empty when the rule has no template', () => {
    const [reminder] = buildAutoReminders({
      rules: [makeRule()],
      estimateDate: '2026-06-20',
      generateId,
    });

    assert.equal(reminder.details, undefined);
  });

  test('builds nothing without an estimate date or rules', () => {
    assert.deepEqual(buildAutoReminders({ rules: [makeRule()], generateId }), []);
    assert.deepEqual(buildAutoReminders({ estimateDate: '2026-06-20', generateId }), []);
  });
});
