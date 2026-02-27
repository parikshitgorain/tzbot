/**
 * Migration: Add unique constraint to giveaway_winners table
 * Prevents duplicate winner records for the same giveaway and user
 */

-- Add unique constraint on (giveaway_id, user_id)
ALTER TABLE giveaway_winners 
ADD CONSTRAINT giveaway_winners_giveaway_user_unique 
UNIQUE (giveaway_id, user_id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_giveaway_winners_status 
ON giveaway_winners(status) 
WHERE status = 'pending';

-- Record migration
INSERT INTO schema_migrations (version, name, applied_at)
VALUES (8, '008_add_unique_constraint_giveaway_winners', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;
