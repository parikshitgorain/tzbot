-- Migration: 004_giveaway_winner_confirmation
-- Description: Add giveaway winner confirmation and config tables
-- Created: 2026-02-21

-- Winner confirmation records table
CREATE TABLE IF NOT EXISTS giveaway_winners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  user_id VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'REROLLED')),
  selected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP,
  rerolled_at TIMESTAMP,
  timer_start_time TIMESTAMP NOT NULL,
  timer_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(giveaway_id, user_id)
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_giveaway_winners_status ON giveaway_winners(giveaway_id, status);
CREATE INDEX IF NOT EXISTS idx_giveaway_winners_pending ON giveaway_winners(status, timer_active) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_giveaway_winners_user ON giveaway_winners(user_id);

-- Giveaway configuration table for permission management
CREATE TABLE IF NOT EXISTS giveaway_config (
  guild_id VARCHAR(20) PRIMARY KEY,
  allowed_roles TEXT[] NOT NULL DEFAULT '{}',
  allowed_users TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert migration record
INSERT INTO schema_migrations (version, name) VALUES (4, '004_giveaway_winner_confirmation')
ON CONFLICT (version) DO NOTHING;
