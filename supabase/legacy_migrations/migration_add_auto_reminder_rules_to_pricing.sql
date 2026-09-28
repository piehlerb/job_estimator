-- Migration: Add auto_reminder_rules JSONB column to pricing table
-- Reminders configured here are added automatically to every new job,
-- scheduled a set number of days from the job's estimate date.

ALTER TABLE public.pricing
ADD COLUMN IF NOT EXISTS auto_reminder_rules JSONB;

COMMENT ON COLUMN public.pricing.auto_reminder_rules IS
  'Auto-add reminder rules applied to new jobs. '
  'Array of {id, subject, template_id, days_after_estimate, time, enabled}. '
  'template_id references comm_templates; time (HH:mm) falls back to default_reminder_time.';
