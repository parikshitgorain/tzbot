-- Migration: 002_offense_tracking
-- Description: Add offense tracking tables for progressive spam punishment system
-- Created: 2025-01-01

-- Offense records table
CREATE TABLE IF NOT EXISTS offense_records (
  user_id TEXT PRIMARY KEY,
  total_offenses INTEGER NOT NULL DEFAULT 0,
  last_offense_timestamp TIMESTAMP,
  current_timeout_duration INTEGER NOT NULL DEFAULT 0,
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_offense_records_last_offense ON offense_records(last_offense_timestamp);

-- Offense entries table (individual offense records)
CREATE TABLE IF NOT EXISTS offense_entries (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason TEXT NOT NULL,
  punishment_applied TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  timeout_duration INTEGER,
  FOREIGN KEY (user_id) REFERENCES offense_records(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_offense_entries_user_id ON offense_entries(user_id);

-- Insert migration record
INSERT INTO schema_migrations (version, name) VALUES (2, '002_offense_tracking')
ON CONFLICT (version) DO NOTHING;
