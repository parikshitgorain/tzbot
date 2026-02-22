-- Migration: 005_add_guild_id_to_giveaways (DOWN)
-- Description: Rollback guild_id column addition
-- Created: 2026-02-21

-- Drop index
DROP INDEX IF EXISTS idx_giveaways_guild;

-- Remove guild_id column
ALTER TABLE giveaways DROP COLUMN IF EXISTS guild_id;

-- Remove migration record
DELETE FROM schema_migrations WHERE version = 5;
