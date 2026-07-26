-- Add missing idle and awake columns to monsters table
ALTER TABLE monsters ADD COLUMN IF NOT EXISTS idle_until timestamp with time zone;
ALTER TABLE monsters ADD COLUMN IF NOT EXISTS idle_hours double precision;
ALTER TABLE monsters ADD COLUMN IF NOT EXISTS awake_until timestamp with time zone;
