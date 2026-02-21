import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createPool, closePool } from '../../../../../src/core/database/pool.js';
import { runMigrations } from '../../../../../src/core/database/migrator.js';
import { OffenseRepository } from '../../../../../src/core/database/repositories/OffenseRepository.js';
import type { Pool } from 'pg';
import type { OffenseRecord, OffenseEntry } from '../../../../../src/core/database/repositories/OffenseRepository.js';

describe('OffenseRepository', () => {
  let pool: Pool;
  let offenseRepo: OffenseRepository;

  beforeAll(async () => {
    // Create test database connection
    pool = createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'tzbot_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    // Run migrations
    await runMigrations();

    offenseRepo = new OffenseRepository(pool);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    // Clean up offense tables before each test
    await pool.query('DELETE FROM offense_entries');
    await pool.query('DELETE FROM offense_records');
  });

  describe('getOffenseRecord', () => {
    it('should return null for non-existent user', async () => {
      const result = await offenseRepo.getOffenseRecord('nonexistent-user');
      expect(result).toBeNull();
    });

    it('should return offense record with warning history', async () => {
      const userId = 'user123';
      const record: OffenseRecord = {
        user_id: userId,
        total_offenses: 2,
        last_offense_timestamp: new Date(),
        current_timeout_duration: 0,
        is_banned: false,
        warning_history: [],
      };

      await offenseRepo.saveOffenseRecord(record);

      const entry: OffenseEntry = {
        timestamp: new Date(),
        reason: 'Spam detected',
        punishment_applied: 'WARNING',
        moderator_id: 'mod123',
      };

      await offenseRepo.addOffenseEntry(userId, entry);

      const retrieved = await offenseRepo.getOffenseRecord(userId);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.user_id).toBe(userId);
      expect(retrieved?.total_offenses).toBe(2);
      expect(retrieved?.warning_history).toHaveLength(1);
      expect(retrieved?.warning_history[0].reason).toBe('Spam detected');
    });
  });

  describe('saveOffenseRecord', () => {
    it('should create new record', async () => {
      const userId = 'user123';
      const record: OffenseRecord = {
        user_id: userId,
        total_offenses: 1,
        last_offense_timestamp: new Date(),
        current_timeout_duration: 0,
        is_banned: false,
        warning_history: [],
      };

      await offenseRepo.saveOffenseRecord(record);

      const result = await pool.query('SELECT * FROM offense_records WHERE user_id = $1', [userId]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].user_id).toBe(userId);
      expect(result.rows[0].total_offenses).toBe(1);
      expect(result.rows[0].is_banned).toBe(false);
    });

    it('should update existing record (upsert)', async () => {
      const userId = 'user123';
      const record1: OffenseRecord = {
        user_id: userId,
        total_offenses: 1,
        last_offense_timestamp: new Date(),
        current_timeout_duration: 0,
        is_banned: false,
        warning_history: [],
      };

      await offenseRepo.saveOffenseRecord(record1);

      const record2: OffenseRecord = {
        user_id: userId,
        total_offenses: 2,
        last_offense_timestamp: new Date(),
        current_timeout_duration: 1,
        is_banned: false,
        warning_history: [],
      };

      await offenseRepo.saveOffenseRecord(record2);

      const result = await pool.query('SELECT * FROM offense_records WHERE user_id = $1', [userId]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].total_offenses).toBe(2);
      expect(result.rows[0].current_timeout_duration).toBe(1);
    });
  });

  describe('addOffenseEntry', () => {
    it('should add offense entry to warning_history', async () => {
      const userId = 'user123';
      const record: OffenseRecord = {
        user_id: userId,
        total_offenses: 1,
        last_offense_timestamp: new Date(),
        current_timeout_duration: 0,
        is_banned: false,
        warning_history: [],
      };

      await offenseRepo.saveOffenseRecord(record);

      const entry: OffenseEntry = {
        timestamp: new Date(),
        reason: 'Spam detected',
        punishment_applied: 'WARNING',
        moderator_id: 'mod123',
      };

      await offenseRepo.addOffenseEntry(userId, entry);

      const retrieved = await offenseRepo.getOffenseRecord(userId);
      expect(retrieved?.warning_history).toHaveLength(1);
      expect(retrieved?.warning_history[0].reason).toBe('Spam detected');
      expect(retrieved?.warning_history[0].punishment_applied).toBe('WARNING');
      expect(retrieved?.warning_history[0].moderator_id).toBe('mod123');
    });

    it('should add multiple offense entries', async () => {
      const userId = 'user123';
      const record: OffenseRecord = {
        user_id: userId,
        total_offenses: 2,
        last_offense_timestamp: new Date(),
        current_timeout_duration: 0,
        is_banned: false,
        warning_history: [],
      };

      await offenseRepo.saveOffenseRecord(record);

      const entry1: OffenseEntry = {
        timestamp: new Date(),
        reason: 'First spam',
        punishment_applied: 'WARNING',
        moderator_id: 'mod123',
      };

      const entry2: OffenseEntry = {
        timestamp: new Date(),
        reason: 'Second spam',
        punishment_applied: 'WARNING',
        moderator_id: 'mod456',
      };

      await offenseRepo.addOffenseEntry(userId, entry1);
      await offenseRepo.addOffenseEntry(userId, entry2);

      const retrieved = await offenseRepo.getOffenseRecord(userId);
      expect(retrieved?.warning_history).toHaveLength(2);
    });
  });

  describe('removeLastOffense', () => {
    it('should delete most recent entry', async () => {
      const userId = 'user123';
      const record: OffenseRecord = {
        user_id: userId,
        total_offenses: 3,
        last_offense_timestamp: new Date(),
        current_timeout_duration: 1,
        is_banned: false,
        warning_history: [],
      };

      await offenseRepo.saveOffenseRecord(record);

      // Add three entries with different timestamps
      const entry1: OffenseEntry = {
        timestamp: new Date(Date.now() - 3000),
        reason: 'First offense',
        punishment_applied: 'WARNING',
        moderator_id: 'mod123',
      };

      const entry2: OffenseEntry = {
        timestamp: new Date(Date.now() - 2000),
        reason: 'Second offense',
        punishment_applied: 'WARNING',
        moderator_id: 'mod123',
      };

      const entry3: OffenseEntry = {
        timestamp: new Date(Date.now() - 1000),
        reason: 'Third offense',
        punishment_applied: 'TIMEOUT',
        moderator_id: 'mod123',
        timeout_duration: 1,
      };

      await offenseRepo.addOffenseEntry(userId, entry1);
      await offenseRepo.addOffenseEntry(userId, entry2);
      await offenseRepo.addOffenseEntry(userId, entry3);

      await offenseRepo.removeLastOffense(userId);

      const retrieved = await offenseRepo.getOffenseRecord(userId);
      expect(retrieved?.warning_history).toHaveLength(2);
      expect(retrieved?.total_offenses).toBe(2);
      expect(retrieved?.warning_history[0].reason).toBe('First offense');
      expect(retrieved?.warning_history[1].reason).toBe('Second offense');
    });

    it('should decrement total_offenses', async () => {
      const userId = 'user123';
      const record: OffenseRecord = {
        user_id: userId,
        total_offenses: 2,
        last_offense_timestamp: new Date(),
        current_timeout_duration: 0,
        is_banned: false,
        warning_history: [],
      };

      await offenseRepo.saveOffenseRecord(record);

      const entry: OffenseEntry = {
        timestamp: new Date(),
        reason: 'Spam',
        punishment_applied: 'WARNING',
        moderator_id: 'mod123',
      };

      await offenseRepo.addOffenseEntry(userId, entry);
      await offenseRepo.removeLastOffense(userId);

      const retrieved = await offenseRepo.getOffenseRecord(userId);
      expect(retrieved?.total_offenses).toBe(1);
    });
  });

  describe('resetOffenses', () => {
    it('should cascade delete all entries', async () => {
      const userId = 'user123';
      const record: OffenseRecord = {
        user_id: userId,
        total_offenses: 3,
        last_offense_timestamp: new Date(),
        current_timeout_duration: 1,
        is_banned: false,
        warning_history: [],
      };

      await offenseRepo.saveOffenseRecord(record);

      const entry1: OffenseEntry = {
        timestamp: new Date(),
        reason: 'First offense',
        punishment_applied: 'WARNING',
        moderator_id: 'mod123',
      };

      const entry2: OffenseEntry = {
        timestamp: new Date(),
        reason: 'Second offense',
        punishment_applied: 'WARNING',
        moderator_id: 'mod123',
      };

      await offenseRepo.addOffenseEntry(userId, entry1);
      await offenseRepo.addOffenseEntry(userId, entry2);

      await offenseRepo.resetOffenses(userId);

      const retrieved = await offenseRepo.getOffenseRecord(userId);
      expect(retrieved).toBeNull();

      // Verify entries are also deleted
      const entriesResult = await pool.query('SELECT * FROM offense_entries WHERE user_id = $1', [userId]);
      expect(entriesResult.rows).toHaveLength(0);
    });

    it('should handle resetting non-existent user', async () => {
      // Should not throw error
      await expect(offenseRepo.resetOffenses('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('withTransaction', () => {
    it('should rollback on error', async () => {
      const userId = 'user123';

      try {
        await offenseRepo.withTransaction(async (client) => {
          // Insert a record
          await client.query(
            'INSERT INTO offense_records (user_id, total_offenses, current_timeout_duration, is_banned) VALUES ($1, $2, $3, $4)',
            [userId, 1, 0, false]
          );

          // Throw an error to trigger rollback
          throw new Error('Test error');
        });
      } catch (error) {
        // Expected error
      }

      // Verify record was not saved
      const result = await pool.query('SELECT * FROM offense_records WHERE user_id = $1', [userId]);
      expect(result.rows).toHaveLength(0);
    });

    it('should commit on success', async () => {
      const userId = 'user123';

      await offenseRepo.withTransaction(async (client) => {
        await client.query(
          'INSERT INTO offense_records (user_id, total_offenses, current_timeout_duration, is_banned) VALUES ($1, $2, $3, $4)',
          [userId, 1, 0, false]
        );
      });

      // Verify record was saved
      const result = await pool.query('SELECT * FROM offense_records WHERE user_id = $1', [userId]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].user_id).toBe(userId);
    });
  });

  describe('getAllActiveOffenses', () => {
    it('should return all users with offenses', async () => {
      const user1: OffenseRecord = {
        user_id: 'user1',
        total_offenses: 2,
        last_offense_timestamp: new Date(),
        current_timeout_duration: 0,
        is_banned: false,
        warning_history: [],
      };

      const user2: OffenseRecord = {
        user_id: 'user2',
        total_offenses: 3,
        last_offense_timestamp: new Date(),
        current_timeout_duration: 1,
        is_banned: false,
        warning_history: [],
      };

      await offenseRepo.saveOffenseRecord(user1);
      await offenseRepo.saveOffenseRecord(user2);

      const entry1: OffenseEntry = {
        timestamp: new Date(),
        reason: 'Spam',
        punishment_applied: 'WARNING',
        moderator_id: 'mod123',
      };

      await offenseRepo.addOffenseEntry('user1', entry1);
      await offenseRepo.addOffenseEntry('user2', entry1);

      const allOffenses = await offenseRepo.getAllActiveOffenses();
      
      expect(allOffenses).toHaveLength(2);
      expect(allOffenses.some(o => o.user_id === 'user1')).toBe(true);
      expect(allOffenses.some(o => o.user_id === 'user2')).toBe(true);
    });

    it('should return empty array when no offenses exist', async () => {
      const allOffenses = await offenseRepo.getAllActiveOffenses();
      expect(allOffenses).toHaveLength(0);
    });
  });
});
