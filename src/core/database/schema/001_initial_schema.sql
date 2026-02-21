-- Migration: 001_initial_schema
-- Description: Initial database schema for TZBOT
-- Created: 2025-01-01

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  discord_id VARCHAR(20) PRIMARY KEY,
  kick_username VARCHAR(100) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_kick_username ON users(kick_username);

-- Violations table
CREATE TABLE IF NOT EXISTS violations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(20) NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  severity INTEGER NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  details TEXT,
  punishment_applied VARCHAR(50),
  CONSTRAINT chk_violation_type CHECK (type IN ('spam', 'malicious_link', 'unauthorized_post', 'other')),
  CONSTRAINT chk_punishment CHECK (punishment_applied IN ('warning', 'timeout_1h', 'timeout_24h', 'ban', NULL))
);

CREATE INDEX IF NOT EXISTS idx_violations_user_timestamp ON violations(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_violations_timestamp ON violations(timestamp);

-- Giveaways table
CREATE TABLE IF NOT EXISTS giveaways (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  channel_id VARCHAR(20) NOT NULL,
  message_id VARCHAR(20) NOT NULL,
  required_roles JSONB DEFAULT '[]'::jsonb,
  winner_count INTEGER NOT NULL CHECK (winner_count > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  ends_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_giveaway_status CHECK (status IN ('active', 'ended', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_giveaways_status_ends ON giveaways(status, ends_at);
CREATE INDEX IF NOT EXISTS idx_giveaways_channel ON giveaways(channel_id);

-- Giveaway entries table
CREATE TABLE IF NOT EXISTS giveaway_entries (
  giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  user_id VARCHAR(20) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (giveaway_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_giveaway_entries_user ON giveaway_entries(user_id);

-- Chat activity table (for chat rain)
CREATE TABLE IF NOT EXISTS chat_activity (
  user_id VARCHAR(20) NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_chat_activity_timestamp ON chat_activity(timestamp DESC);

-- Chat rain winners table
CREATE TABLE IF NOT EXISTS chat_rain_winners (
  user_id VARCHAR(20) NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reward_type VARCHAR(50) NOT NULL,
  reward_value TEXT,
  PRIMARY KEY (user_id, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_chat_rain_winners_user_timestamp ON chat_rain_winners(user_id, timestamp DESC);

-- Configuration table
CREATE TABLE IF NOT EXISTS config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Moderation logs table
CREATE TABLE IF NOT EXISTS moderation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  moderator_id VARCHAR(20) NOT NULL,
  target_user_id VARCHAR(20) NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  reason TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_action_type CHECK (action_type IN ('ban', 'kick', 'timeout', 'warn', 'unban'))
);

CREATE INDEX IF NOT EXISTS idx_moderation_logs_target_timestamp ON moderation_logs(target_user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_moderator ON moderation_logs(moderator_id);

-- Message content table (7-day retention)
CREATE TABLE IF NOT EXISTS message_content (
  message_id VARCHAR(20) PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
  channel_id VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_message_content_timestamp ON message_content(timestamp);
CREATE INDEX IF NOT EXISTS idx_message_content_user ON message_content(user_id);

-- Notification queue table (for retry)
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL,
  channel_id VARCHAR(20) NOT NULL,
  attempts INTEGER DEFAULT 0,
  last_attempt TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_attempts ON notification_queue(attempts, created_at);

-- Migration tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial migration record
INSERT INTO schema_migrations (version, name) VALUES (1, '001_initial_schema')
ON CONFLICT (version) DO NOTHING;
