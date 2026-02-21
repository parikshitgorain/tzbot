-- Migration: 005_add_guild_id_to_giveaways
-- Description: Add guild_id column to giveaways table for multi-guild support
-- Created: 2026-02-21

-- Add guild_id column to giveaways table
ALTER TABLE giveaways ADD COLUMN IF NOT EXISTS guild_id VARCHAR(20);

-- Create index for guild_id lookups
CREATE INDEX IF NOT EXISTS idx_giveaways_guild ON giveaways(guild_id);

-- Insert migration record
INSERT INTO schema_migrations (version, name) VALUES (5, '005_add_guild_id_to_giveaways')
ON CONFLICT (version) DO NOTHING;
