-- Migration Rollback: 007_change_giveaway_id_to_varchar
-- Description: Rollback giveaway ID from VARCHAR back to UUID
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

-- Step 2: Change back to UUID type
ALTER TABLE giveaway_entries ALTER COLUMN giveaway_id TYPE UUID USING giveaway_id::uuid;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'giveaway_winners') THEN
    ALTER TABLE giveaway_winners ALTER COLUMN giveaway_id TYPE UUID USING giveaway_id::uuid;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'winner_state') THEN
    ALTER TABLE winner_state ALTER COLUMN giveaway_id TYPE UUID USING giveaway_id::uuid;
  END IF;
END $$;

ALTER TABLE giveaways ALTER COLUMN id TYPE UUID USING id::uuid;

-- Step 3: Re-add default UUID generation
ALTER TABLE giveaways ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Step 4: Re-add all foreign key constraints
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

-- Step 5: Remove migration record
DELETE FROM schema_migrations WHERE version = 7;
