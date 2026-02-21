import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  initializeDatabase,
  getPool,
  closePool,
  getMigrationStatus,
  type DatabaseConfig,
} from '../../src/core/database/index.js';

describe('Database Integration', () => {
  const testConfig: DatabaseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'tzbot_test',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'test',
  };

  // Skip tests if database is not available
  const skipIfNoDb = process.env.CI === 'true' || !process.env.DB_HOST;

  afterAll(async () => {
    if (skipIfNoDb) return;
    await closePool();
  });

  describe('initializeDatabase', () => {
    it.skipIf(skipIfNoDb)('should initialize database with pool and migrations', async () => {
      await expect(initializeDatabase(testConfig)).resolves.not.toThrow();
      
      // Verify pool is created
      const pool = getPool();
      expect(pool).toBeDefined();
      
      // Verify migrations ran
      const status = await getMigrationStatus();
      expect(status.currentVersion).toBeGreaterThanOrEqual(1);
      expect(status.pendingMigrations).toBe(0);
    });

    it.skipIf(skipIfNoDb)('should create all required tables', async () => {
      await initializeDatabase(testConfig);
      const pool = getPool();
      
      // Check that key tables exist
      const tables = [
        'users',
        'violations',
        'giveaways',
        'giveaway_entries',
        'chat_activity',
        'chat_rain_winners',
        'config',
        'moderation_logs',
        'message_content',
        'notification_queue',
        'schema_migrations',
      ];
      
      for (const table of tables) {
        const result = await pool.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = $1
          )`,
          [table]
        );
        
        expect(result.rows[0].exists).toBe(true);
      }
    });

    it.skipIf(skipIfNoDb)('should create proper indexes', async () => {
      await initializeDatabase(testConfig);
      const pool = getPool();
      
      // Check for some key indexes
      const result = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename IN ('users', 'violations', 'giveaways')
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it.skipIf(skipIfNoDb)('should enforce foreign key constraints', async () => {
      await initializeDatabase(testConfig);
      const pool = getPool();
      
      // Try to insert violation for non-existent user
      await expect(
        pool.query(
          `INSERT INTO violations (user_id, type, severity, timestamp) 
           VALUES ($1, $2, $3, NOW())`,
          ['nonexistent_user', 'spam', 1]
        )
      ).rejects.toThrow();
    });

    it.skipIf(skipIfNoDb)('should enforce check constraints', async () => {
      await initializeDatabase(testConfig);
      const pool = getPool();
      
      // First create a user
      await pool.query(
        'INSERT INTO users (discord_id) VALUES ($1) ON CONFLICT DO NOTHING',
        ['test_user_123']
      );
      
      // Try to insert violation with invalid type
      await expect(
        pool.query(
          `INSERT INTO violations (user_id, type, severity, timestamp) 
           VALUES ($1, $2, $3, NOW())`,
          ['test_user_123', 'invalid_type', 1]
        )
      ).rejects.toThrow();
    });

    it.skipIf(skipIfNoDb)('should support JSONB columns', async () => {
      await initializeDatabase(testConfig);
      const pool = getPool();
      
      // Insert giveaway with JSONB required_roles
      const result = await pool.query(
        `INSERT INTO giveaways (title, channel_id, message_id, required_roles, winner_count, ends_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '1 day')
         RETURNING id, required_roles`,
        ['Test Giveaway', '123', '456', JSON.stringify(['role1', 'role2']), 1]
      );
      
      expect(result.rows[0].required_roles).toEqual(['role1', 'role2']);
      
      // Cleanup
      await pool.query('DELETE FROM giveaways WHERE id = $1', [result.rows[0].id]);
    });

    it.skipIf(skipIfNoDb)('should support UUID generation', async () => {
      await initializeDatabase(testConfig);
      const pool = getPool();
      
      // Create a user first
      await pool.query(
        'INSERT INTO users (discord_id) VALUES ($1) ON CONFLICT DO NOTHING',
        ['test_user_uuid']
      );
      
      // Insert violation without specifying ID
      const result = await pool.query(
        `INSERT INTO violations (user_id, type, severity, timestamp)
         VALUES ($1, $2, $3, NOW())
         RETURNING id`,
        ['test_user_uuid', 'spam', 1]
      );
      
      expect(result.rows[0].id).toBeDefined();
      expect(typeof result.rows[0].id).toBe('string');
      expect(result.rows[0].id.length).toBe(36); // UUID format
      
      // Cleanup
      await pool.query('DELETE FROM violations WHERE id = $1', [result.rows[0].id]);
    });
  });

  describe('Database Operations', () => {
    beforeAll(async () => {
      if (skipIfNoDb) return;
      await initializeDatabase(testConfig);
    });

    it.skipIf(skipIfNoDb)('should insert and retrieve user', async () => {
      const pool = getPool();
      const discordId = 'test_user_' + Date.now();
      
      // Insert user
      await pool.query(
        'INSERT INTO users (discord_id, kick_username) VALUES ($1, $2)',
        [discordId, 'test_kick_user']
      );
      
      // Retrieve user
      const result = await pool.query(
        'SELECT * FROM users WHERE discord_id = $1',
        [discordId]
      );
      
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].discord_id).toBe(discordId);
      expect(result.rows[0].kick_username).toBe('test_kick_user');
      
      // Cleanup
      await pool.query('DELETE FROM users WHERE discord_id = $1', [discordId]);
    });

    it.skipIf(skipIfNoDb)('should handle transactions correctly', async () => {
      const pool = getPool();
      const client = await pool.connect();
      const discordId = 'test_transaction_' + Date.now();
      
      try {
        await client.query('BEGIN');
        
        // Insert user
        await client.query(
          'INSERT INTO users (discord_id) VALUES ($1)',
          [discordId]
        );
        
        // Insert violation
        await client.query(
          'INSERT INTO violations (user_id, type, severity, timestamp) VALUES ($1, $2, $3, NOW())',
          [discordId, 'spam', 1]
        );
        
        await client.query('COMMIT');
        
        // Verify both records exist
        const userResult = await pool.query(
          'SELECT * FROM users WHERE discord_id = $1',
          [discordId]
        );
        const violationResult = await pool.query(
          'SELECT * FROM violations WHERE user_id = $1',
          [discordId]
        );
        
        expect(userResult.rows.length).toBe(1);
        expect(violationResult.rows.length).toBe(1);
        
        // Cleanup
        await pool.query('DELETE FROM violations WHERE user_id = $1', [discordId]);
        await pool.query('DELETE FROM users WHERE discord_id = $1', [discordId]);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    });

    it.skipIf(skipIfNoDb)('should rollback transaction on error', async () => {
      const pool = getPool();
      const client = await pool.connect();
      const discordId = 'test_rollback_' + Date.now();
      
      try {
        await client.query('BEGIN');
        
        // Insert user
        await client.query(
          'INSERT INTO users (discord_id) VALUES ($1)',
          [discordId]
        );
        
        // Try to insert invalid violation (should fail)
        await client.query(
          'INSERT INTO violations (user_id, type, severity, timestamp) VALUES ($1, $2, $3, NOW())',
          [discordId, 'invalid_type', 1]
        );
        
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        
        // Verify user was not inserted (transaction rolled back)
        const result = await pool.query(
          'SELECT * FROM users WHERE discord_id = $1',
          [discordId]
        );
        
        expect(result.rows.length).toBe(0);
      } finally {
        client.release();
      }
    });
  });
});
