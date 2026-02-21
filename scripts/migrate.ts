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
    
    // Read the migration file
    const migrationPath = join(__dirname, '../src/core/database/schema/001_initial_schema.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📝 Running migration: 001_initial_schema');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('\n📊 Database tables created:');
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
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
