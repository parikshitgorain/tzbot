-- Migration: 006_add_hosted_by_to_giveaways
-- Description: Add hosted_by field to track who is hosting the giveaway
-- Created: 2026-02-23

-- Add hosted_by column to store the Discord user ID of the host
ALTER TABLE giveaways 
ADD COLUMN IF NOT EXISTS hosted_by TEXT;

-- Create index for faster host lookups
CREATE INDEX IF NOT EXISTS idx_giveaways_hosted_by ON giveaways (hosted_by);

-- Insert migration record
INSERT INTO schema_migrations (version, name) VALUES (6, '006_add_hosted_by_to_giveaways')
ON CONFLICT (version) DO NOTHING;
