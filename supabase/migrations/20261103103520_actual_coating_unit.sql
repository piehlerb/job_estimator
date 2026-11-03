-- Let an org enter actual base/top coat, Cyclo1 and MVB in ounces instead of gallons.
-- Jobs keep storing actual coating in gallons; this only sets the entry unit.
ALTER TABLE pricing
ADD COLUMN IF NOT EXISTS actual_coating_unit TEXT
  CONSTRAINT pricing_actual_coating_unit_check
  CHECK (actual_coating_unit IS NULL OR actual_coating_unit IN ('gallons', 'ounces'));

COMMENT ON COLUMN pricing.actual_coating_unit IS 'Unit for entering actual base/top coat, Cyclo1 and MVB on jobs: gallons (default) or ounces. Job actuals are always stored in gallons.';
