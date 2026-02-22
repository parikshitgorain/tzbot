-- Migration: 003_giveaway_enhancements
-- Description: Add condition and winners fields to giveaways table
-- Created: 2026-02-21

-- Add condition column for winner requirements/instructions
ALTER TABLE giveaways 
ADD COLUMN IF NOT EXISTS condition TEXT;

-- Add winners column to store winner IDs for reroll functionality
ALTER TABLE giveaways 
ADD COLUMN IF NOT EXISTS winners JSONB DEFAULT '[]'::jsonb;

-- Create index for faster winner lookups
CREATE INDEX IF NOT EXISTS idx_giveaways_winners ON giveaways USING GIN (winners);

-- Insert migration record
INSERT INTO schema_migrations (version, name) VALUES (3, '003_giveaway_enhancements')
ON CONFLICT (version) DO NOTHING;
