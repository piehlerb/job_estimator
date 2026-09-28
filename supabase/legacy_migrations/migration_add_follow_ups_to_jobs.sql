-- Migration: Add follow_ups column to jobs table
-- Follow-ups are logged reactive contacts (calls received, conversations, etc.)
-- alongside proactive reminders, both count toward "last contact" for Needs Contact logic.

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS follow_ups JSONB;

COMMENT ON COLUMN jobs.follow_ups IS 'Array of JobFollowUp objects logging customer contacts and interactions';
