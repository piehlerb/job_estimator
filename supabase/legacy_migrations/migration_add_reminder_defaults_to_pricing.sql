-- Migration: Add default reminder settings to pricing table
ALTER TABLE public.pricing
ADD COLUMN IF NOT EXISTS default_reminder_days INTEGER;

ALTER TABLE public.pricing
ADD COLUMN IF NOT EXISTS default_reminder_time TEXT;

COMMENT ON COLUMN public.pricing.default_reminder_days IS 'Days from today for default reminder due date (default 7)';
COMMENT ON COLUMN public.pricing.default_reminder_time IS 'Default reminder time in HH:mm format (default 05:00)';
