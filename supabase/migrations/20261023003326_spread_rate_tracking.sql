-- Spread rate tracking: where actual coating went (floor vs vertical), per-job
-- spread rate assumptions, and a flag to leave a job out of the spread report.
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS actual_base_coat_floor_gallons NUMERIC,
ADD COLUMN IF NOT EXISTS actual_base_coat_vertical_gallons NUMERIC,
ADD COLUMN IF NOT EXISTS actual_top_coat_floor_gallons NUMERIC,
ADD COLUMN IF NOT EXISTS actual_top_coat_vertical_gallons NUMERIC,
ADD COLUMN IF NOT EXISTS spread_rate_overrides JSONB,
ADD COLUMN IF NOT EXISTS exclude_from_spread_report BOOLEAN;

COMMENT ON COLUMN jobs.actual_base_coat_floor_gallons IS 'Actual base coat gallons used on the floor';
COMMENT ON COLUMN jobs.actual_base_coat_vertical_gallons IS 'Actual base coat gallons used on verticals';
COMMENT ON COLUMN jobs.actual_top_coat_floor_gallons IS 'Actual top coat gallons used on the floor';
COMMENT ON COLUMN jobs.actual_top_coat_vertical_gallons IS 'Actual top coat gallons used on verticals';
COMMENT ON COLUMN jobs.spread_rate_overrides IS 'Job-level spread rates in sqft/gal per coat: {base_floor, base_vertical, top_floor, top_vertical}; absent keys use the system default';
COMMENT ON COLUMN jobs.exclude_from_spread_report IS 'True to leave this job out of the spread rate report';
