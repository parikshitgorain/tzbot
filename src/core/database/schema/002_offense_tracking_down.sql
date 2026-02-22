-- Migration: 002_offense_tracking_down
-- Description: Rollback offense tracking tables for progressive spam punishment system
-- Created: 2025-01-01

-- Drop indexes first
DROP INDEX IF EXISTS idx_offense_entries_user_id;
DROP INDEX IF EXISTS idx_offense_records_last_offense;

-- Drop tables (offense_entries first due to foreign key constraint)
DROP TABLE IF EXISTS offense_entries;
DROP TABLE IF EXISTS offense_records;

-- Remove migration record
DELETE FROM schema_migrations WHERE version = 2 AND name = '002_offense_tracking';
