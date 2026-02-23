-- Rollback Migration: 006_add_hosted_by_to_giveaways
-- Description: Remove hosted_by field from giveaways table

-- Drop index
DROP INDEX IF EXISTS idx_giveaways_hosted_by;

-- Remove hosted_by column
ALTER TABLE giveaways 
DROP COLUMN IF EXISTS hosted_by;

-- Remove migration record
DELETE FROM schema_migrations WHERE version = 6;
