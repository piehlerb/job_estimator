/**
 * Auto-add reminders.
 *
 * Settings hold a list of AutoReminderRule entries (Pricing.autoReminderRules).
 * When a job is created, each enabled rule adds one reminder to it, timed a
 * fixed number of days from the job's estimate date. Reminders created this way
 * carry the rule id in `autoRuleId` so a rule is never applied twice to the
 * same job.
 */
import { addDaysToLocalDate } from './dateUtils.js';
import type { AutoReminderRule, CommunicationTemplate, JobReminder } from '../types/index.js';

export const DEFAULT_REMINDER_TIME = '05:00';

export interface BuildAutoRemindersOptions {
  rules?: AutoReminderRule[];
  templates?: Pick<CommunicationTemplate, 'id' | 'name' | 'body'>[];
  /** Job estimate date (YYYY-MM-DD). No reminders are built without one. */
  estimateDate?: string;
  /** Used to resolve the [Name] placeholder in template bodies. */
  customerName?: string;
  /** Fallback time for rules with no time of their own. */
  defaultTime?: string;
  /** Reminders already on the job — rules represented here are skipped. */
  existingReminders?: JobReminder[];
  generateId: () => string;
  now?: Date;
}

/** Replace the [Name] placeholder with the customer's first name. */
export function resolveTemplateBody(body: string, customerName?: string): string {
  const firstName = (customerName || '').trim().split(' ')[0] || '[Name]';
  return body.replace(/\[Name\]/gi, firstName);
}

export function buildAutoReminders(options: BuildAutoRemindersOptions): JobReminder[] {
  const {
    rules = [],
    templates = [],
    estimateDate,
    customerName,
    defaultTime,
    existingReminders = [],
    generateId,
    now = new Date(),
  } = options;

  if (!estimateDate) return [];

  const alreadyApplied = new Set(
    existingReminders.map((reminder) => reminder.autoRuleId).filter(Boolean) as string[]
  );
  const nowIso = now.toISOString();

  return rules
    .filter((rule) => rule.enabled && !alreadyApplied.has(rule.id))
    .flatMap<JobReminder>((rule) => {
      const dueDate = addDaysToLocalDate(estimateDate, rule.daysAfterEstimate || 0);
      if (!dueDate) return [];

      const template = templates.find((t) => t.id === rule.templateId);
      const dueTime = rule.time || defaultTime || DEFAULT_REMINDER_TIME;
      const details = template ? resolveTemplateBody(template.body, customerName) : '';

      const reminder: JobReminder = {
        id: generateId(),
        subject: rule.subject.trim() || template?.name || 'Follow up',
        details: details || undefined,
        dueDate,
        dueTime,
        dueAt: new Date(`${dueDate}T${dueTime}`).toISOString(),
        completed: false,
        autoRuleId: rule.id,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      return [reminder];
    })
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}
