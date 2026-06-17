ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS inventory_actuals_applied JSONB;

COMMENT ON COLUMN public.jobs.inventory_actuals_applied IS
'Actual material quantities and identities already applied to inventory for delta-based inventory updates.';
