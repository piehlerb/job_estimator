-- Migration: refresh the actual_install_schedule column comment
-- The actuals schedule now carries optional per-laborer hour overrides, and its
-- day count is independent of the planned installDays. The column is already
-- JSONB, so no structural change is needed — this only updates documentation.

COMMENT ON COLUMN jobs.actual_install_schedule IS
  'Actual per-day schedule, independent of planned install days. Array of {day, hours, laborerIds[], laborerHours?: [{laborerId, hours}]}. laborerHours entries override the day''s hours for that laborer.';
