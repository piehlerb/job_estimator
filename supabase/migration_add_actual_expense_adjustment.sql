-- Migration: Add actual expense adjustment fields to jobs table
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS actual_expense_adjustment NUMERIC;

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS actual_expense_adjustment_notes TEXT;

COMMENT ON COLUMN public.jobs.actual_expense_adjustment IS 'Ad-hoc expense adjustment added to actual costs (positive = additional cost, negative = credit)';
COMMENT ON COLUMN public.jobs.actual_expense_adjustment_notes IS 'Justification/notes for the expense adjustment';
