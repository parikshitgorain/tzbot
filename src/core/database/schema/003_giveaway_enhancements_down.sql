-- Migration Rollback: 003_giveaway_enhancements
-- Description: Remove condition and winners fields from giveaways table

-- Drop index
DROP INDEX IF EXISTS idx_giveaways_winners;

-- Remove winners column
ALTER TABLE giveaways 
DROP COLUMN IF EXISTS winners;

-- Remove condition column
ALTER TABLE giveaways 
DROP COLUMN IF EXISTS condition;

-- Remove migration record
DELETE FROM schema_migrations WHERE version = 3;
