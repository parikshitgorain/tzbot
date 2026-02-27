/**
 * Rollback: Remove unique constraint from giveaway_winners table
 */

-- Remove index
DROP INDEX IF EXISTS idx_giveaway_winners_status;

-- Remove unique constraint
ALTER TABLE giveaway_winners 
DROP CONSTRAINT IF EXISTS giveaway_winners_giveaway_user_unique;

-- Remove migration record
DELETE FROM schema_migrations WHERE version = 8;
