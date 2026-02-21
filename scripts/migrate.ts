import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigrations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔄 Connecting to database...');
    
    // Run migrations in order
    const migrations = [
      '001_initial_schema.sql',
      '002_offense_tracking.sql'
    ];

    for (const migrationFile of migrations) {
      const migrationPath = join(__dirname, '../src/core/database/schema', migrationFile);
      const migrationSQL = readFileSync(migrationPath, 'utf-8');

      console.log(`📝 Running migration: ${migrationFile}`);
      
      // Execute the migration
      await pool.query(migrationSQL);
      
      console.log(`✅ ${migrationFile} completed successfully!`);
    }
    
    console.log('\n📊 All migrations completed!');
    console.log('Database tables:');
    console.log('  - users');
    console.log('  - violations');
    console.log('  - giveaways');
    console.log('  - giveaway_entries');
    console.log('  - chat_activity');
    console.log('  - chat_rain_winners');
    console.log('  - config');
    console.log('  - moderation_logs');
    console.log('  - message_content');
    console.log('  - notification_queue');
    console.log('  - schema_migrations');
    console.log('  - offense_records');
    console.log('  - offense_entries');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
