-- Track advertising spend per lead source, not just per month.
--
-- ad_spend held one total per month, so cost per lead could only be blended
-- across every source. Each row now names the lead source the money was spent
-- on (matching leads.source), so the Lead Tracking report can show spend, cost
-- per lead, per in-territory lead and per booking for each source.
--
-- * ad_spend.source  lead source; NULL = entered before per-source tracking
--
-- Backfill: the monthly totals entered so far (July-October 2026) were all
-- EZMedia spend, per the business owner, so rows without a source become
-- EZMedia. updated_at is bumped so clients pull the change on their next sync.
-- Only rows still missing a source are touched, so it is safe to re-run.

ALTER TABLE public.ad_spend ADD COLUMN IF NOT EXISTS source text;
COMMENT ON COLUMN public.ad_spend.source IS 'Lead source the spend was for (matches leads.source); NULL = entered before per-source tracking';
COMMENT ON TABLE public.ad_spend IS 'Manually-entered advertising spend per lead source per calendar month (lead tracking report)';

UPDATE public.ad_spend
SET source = 'EZMedia',
    updated_at = NOW()
WHERE source IS NULL;

CREATE INDEX IF NOT EXISTS idx_ad_spend_month_source ON public.ad_spend (month, source);
