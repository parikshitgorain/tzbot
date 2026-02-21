-- Migration Rollback: 001_initial_schema
-- Description: Rollback initial database schema

-- Drop tables in reverse order (respecting foreign key constraints)
DROP TABLE IF EXISTS notification_queue CASCADE;
DROP TABLE IF EXISTS message_content CASCADE;
DROP TABLE IF EXISTS moderation_logs CASCADE;
DROP TABLE IF EXISTS config CASCADE;
DROP TABLE IF EXISTS chat_rain_winners CASCADE;
DROP TABLE IF EXISTS chat_activity CASCADE;
DROP TABLE IF EXISTS giveaway_entries CASCADE;
DROP TABLE IF EXISTS giveaways CASCADE;
DROP TABLE IF EXISTS violations CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Remove migration record
DELETE FROM schema_migrations WHERE version = 1;
