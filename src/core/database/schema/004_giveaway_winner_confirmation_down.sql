-- Migration Rollback: 004_giveaway_winner_confirmation
-- Description: Remove giveaway winner confirmation and config tables

-- Drop indexes
DROP INDEX IF EXISTS idx_giveaway_winners_user;
DROP INDEX IF EXISTS idx_giveaway_winners_pending;
DROP INDEX IF EXISTS idx_giveaway_winners_status;

-- Drop tables
DROP TABLE IF EXISTS giveaway_config;
DROP TABLE IF EXISTS giveaway_winners;

-- Remove migration record
DELETE FROM schema_migrations WHERE version = 4;
