-- Migration: 007_change_giveaway_id_to_varchar
-- Description: Change giveaway ID from UUID to VARCHAR to support new format (GW-MM-XXXXX)
-- Created: 2026-02-27

-- Step 1: Drop all foreign key constraints
ALTER TABLE giveaway_entries DROP CONSTRAINT IF EXISTS giveaway_entries_giveaway_id_fkey;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'giveaway_winners') THEN
    ALTER TABLE giveaway_winners DROP CONSTRAINT IF EXISTS giveaway_winners_giveaway_id_fkey;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'winner_state') THEN
    ALTER TABLE winner_state DROP CONSTRAINT IF EXISTS winner_state_giveaway_id_fkey;
  END IF;
END $$;

-- Step 2: Change giveaway_id type in all related tables (VARCHAR(50) to accommodate existing UUIDs)
ALTER TABLE giveaway_entries ALTER COLUMN giveaway_id TYPE VARCHAR(50);

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'giveaway_winners') THEN
    ALTER TABLE giveaway_winners ALTER COLUMN giveaway_id TYPE VARCHAR(50);
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'winner_state') THEN
    ALTER TABLE winner_state ALTER COLUMN giveaway_id TYPE VARCHAR(50);
  END IF;
END $$;

-- Step 3: Change id type in giveaways table (VARCHAR(50) to accommodate existing UUIDs)
ALTER TABLE giveaways ALTER COLUMN id TYPE VARCHAR(50);

-- Step 4: Remove default UUID generation
ALTER TABLE giveaways ALTER COLUMN id DROP DEFAULT;

-- Step 5: Re-add all foreign key constraints
ALTER TABLE giveaway_entries 
  ADD CONSTRAINT giveaway_entries_giveaway_id_fkey 
  FOREIGN KEY (giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'giveaway_winners') THEN
    ALTER TABLE giveaway_winners 
      ADD CONSTRAINT giveaway_winners_giveaway_id_fkey 
      FOREIGN KEY (giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'winner_state') THEN
    ALTER TABLE winner_state 
      ADD CONSTRAINT winner_state_giveaway_id_fkey 
      FOREIGN KEY (giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 6: Insert migration record
INSERT INTO schema_migrations (version, name) VALUES (7, '007_change_giveaway_id_to_varchar')
ON CONFLICT (version) DO NOTHING;
