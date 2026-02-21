/**
 * @file offense-repository.property.test.ts
 * @description Property-based tests for OffenseRepository
 * @module tests/property
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { Pool } from 'pg';
import { createPool, closePool } from '@/core/database/pool.js';
import { runMigrations } from '@/core/database/migrator.js';
import { OffenseRepository } from '@/core/database/repositories/OffenseRepository.js';
import type { OffenseRecord, OffenseEntry } from '@/core/database/repositories/OffenseRepository.js';

describe('OffenseRepository - Property-Based Tests', () => {
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
    // Clean up ALL test data before each test to avoid collisions
    await pool.query('DELETE FROM offense_entries');
    await pool.query('DELETE FROM offense_records');
  });

  /**
   * Property 5: Offense Data Persistence
   * **Validates: Requirements 4.1-4.6**
   * 
   * All offense data must persist across system restarts and be retrievable
   */
  describe('Property 5: Offense data persists correctly', () => {
    it('should persist and retrieve offense record with all fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            user_id: fc.string({ minLength: 5, maxLength: 20 }).map(s => `test_${s}`),
            total_offenses: fc.integer({ min: 0, max: 20 }),
            current_timeout_duration: fc.integer({ min: 0, max: 24 }),
            is_banned: fc.boolean(),
          }),
          async (recordData) => {
            const record: OffenseRecord = {
              ...recordData,
              last_offense_timestamp: new Date(),
              warning_history: [],
            };

            // Save offense record
            await offenseRepo.saveOffenseRecord(record);

            // Retrieve offense record
            const retrieved = await offenseRepo.getOffenseRecord(record.user_id);

            // Verify all fields persist correctly
            expect(retrieved).not.toBeNull();
            expect(retrieved!.user_id).toBe(record.user_id);
            expect(retrieved!.total_offenses).toBe(record.total_offenses);
            expect(retrieved!.current_timeout_duration).toBe(record.current_timeout_duration);
            expect(retrieved!.is_banned).toBe(record.is_banned);
            expect(retrieved!.last_offense_timestamp).toBeDefined();

            // Clean up
            await pool.query('DELETE FROM offense_records WHERE user_id = $1', [record.user_id]);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should persist offense entries with all fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid().map(id => `test_${id}`), // Use UUID to ensure uniqueness
          fc.string({ minLength: 10, maxLength: 100 }),
          fc.constantFrom('WARNING', 'TIMEOUT', 'PERMANENT_BAN'),
          fc.string({ minLength: 5, maxLength: 20 }),
          fc.option(fc.integer({ min: 1, max: 24 }), { nil: undefined }),
          async (userId, reason, punishmentType, moderatorId, timeoutDuration) => {
            try {
              // Create offense record first
              const record: OffenseRecord = {
                user_id: userId,
                total_offenses: 1,
                last_offense_timestamp: new Date(),
                current_timeout_duration: 0,
                is_banned: false,
                warning_history: [],
              };

              await offenseRepo.saveOffenseRecord(record);

              // Add offense entry
              const entry: OffenseEntry = {
                timestamp: new Date(),
                reason,
                punishment_applied: punishmentType,
                moderator_id: moderatorId,
                timeout_duration: timeoutDuration,
              };

              await offenseRepo.addOffenseEntry(userId, entry);

              // Retrieve and verify
              const retrieved = await offenseRepo.getOffenseRecord(userId);
              expect(retrieved).not.toBeNull();
              expect(retrieved!.warning_history).toHaveLength(1);

              const retrievedEntry = retrieved!.warning_history[0];
              expect(retrievedEntry.reason).toBe(reason);
              expect(retrievedEntry.punishment_applied).toBe(punishmentType);
              expect(retrievedEntry.moderator_id).toBe(moderatorId);
              // Handle null/undefined equivalence for optional fields
              if (timeoutDuration === undefined) {
                expect(retrievedEntry.timeout_duration).toBeNull();
              } else {
                expect(retrievedEntry.timeout_duration).toBe(timeoutDuration);
              }
            } finally {
              // Clean up immediately after each property test run
              await pool.query('DELETE FROM offense_records WHERE user_id = $1', [userId]);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should handle upsert correctly - update existing records', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 20 }).map(s => `test_${s}`),
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 10 }),
          async (userId, initialOffenses, additionalOffenses) => {
            // Create initial record
            const record1: OffenseRecord = {
              user_id: userId,
              total_offenses: initialOffenses,
              last_offense_timestamp: new Date(),
              current_timeout_duration: 0,
              is_banned: false,
              warning_history: [],
            };

            await offenseRepo.saveOffenseRecord(record1);

            // Update record (upsert)
            const record2: OffenseRecord = {
              user_id: userId,
              total_offenses: initialOffenses + additionalOffenses,
              last_offense_timestamp: new Date(),
              current_timeout_duration: 2,
              is_banned: false,
              warning_history: [],
            };

            await offenseRepo.saveOffenseRecord(record2);

            // Verify only one record exists with updated values
            const retrieved = await offenseRepo.getOffenseRecord(userId);
            expect(retrieved).not.toBeNull();
            expect(retrieved!.total_offenses).toBe(initialOffenses + additionalOffenses);
            expect(retrieved!.current_timeout_duration).toBe(2);

            // Verify no duplicate records
            const allRecords = await pool.query(
              'SELECT * FROM offense_records WHERE user_id = $1',
              [userId]
            );
            expect(allRecords.rows).toHaveLength(1);

            // Clean up
            await pool.query('DELETE FROM offense_records WHERE user_id = $1', [userId]);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should maintain data integrity across multiple operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 20 }).map(s => `test_${s}`),
          fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
          async (userId, reasons) => {
            // Create offense record
            const record: OffenseRecord = {
              user_id: userId,
              total_offenses: reasons.length,
              last_offense_timestamp: new Date(),
              current_timeout_duration: 0,
              is_banned: false,
              warning_history: [],
            };

            await offenseRepo.saveOffenseRecord(record);

            // Add multiple entries
            for (const reason of reasons) {
              const entry: OffenseEntry = {
                timestamp: new Date(),
                reason,
                punishment_applied: 'WARNING',
                moderator_id: 'test_mod',
              };
              await offenseRepo.addOffenseEntry(userId, entry);
              // Small delay to ensure different timestamps
              await new Promise(resolve => setTimeout(resolve, 5));
            }

            // Retrieve and verify
            const retrieved = await offenseRepo.getOffenseRecord(userId);
            expect(retrieved).not.toBeNull();
            expect(retrieved!.warning_history).toHaveLength(reasons.length);
            expect(retrieved!.total_offenses).toBe(reasons.length);

            // Verify all reasons are present
            const retrievedReasons = retrieved!.warning_history.map(e => e.reason);
            for (const reason of reasons) {
              expect(retrievedReasons).toContain(reason);
            }

            // Clean up
            await pool.query('DELETE FROM offense_records WHERE user_id = $1', [userId]);
          }
        ),
        { numRuns: 15 }
      );
    });

    it('should handle concurrent saves correctly', async () => {
      const userId = `test_concurrent_${Date.now()}`;

      // Create initial record
      const record: OffenseRecord = {
        user_id: userId,
        total_offenses: 0,
        last_offense_timestamp: new Date(),
        current_timeout_duration: 0,
        is_banned: false,
        warning_history: [],
      };

      await offenseRepo.saveOffenseRecord(record);

      // Perform multiple concurrent updates
      const updates = Array.from({ length: 5 }, (_, i) => ({
        user_id: userId,
        total_offenses: i + 1,
        last_offense_timestamp: new Date(),
        current_timeout_duration: i,
        is_banned: false,
        warning_history: [],
      }));

      await Promise.all(updates.map(u => offenseRepo.saveOffenseRecord(u)));

      // Verify only one record exists
      const allRecords = await pool.query(
        'SELECT * FROM offense_records WHERE user_id = $1',
        [userId]
      );
      expect(allRecords.rows).toHaveLength(1);

      // Clean up
      await pool.query('DELETE FROM offense_records WHERE user_id = $1', [userId]);
    });
  });

  /**
   * Additional property: Cascade delete works correctly
   */
  describe('Property: Cascade delete removes all related data', () => {
    it('should delete all offense entries when record is deleted', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 20 }).map(s => `test_${s}`),
          fc.integer({ min: 1, max: 10 }),
          async (userId, entryCount) => {
            // Create offense record
            const record: OffenseRecord = {
              user_id: userId,
              total_offenses: entryCount,
              last_offense_timestamp: new Date(),
              current_timeout_duration: 0,
              is_banned: false,
              warning_history: [],
            };

            await offenseRepo.saveOffenseRecord(record);

            // Add entries
            for (let i = 0; i < entryCount; i++) {
              const entry: OffenseEntry = {
                timestamp: new Date(),
                reason: `reason ${i}`,
                punishment_applied: 'WARNING',
                moderator_id: 'test_mod',
              };
              await offenseRepo.addOffenseEntry(userId, entry);
            }

            // Verify entries exist
            const beforeDelete = await pool.query(
              'SELECT * FROM offense_entries WHERE user_id = $1',
              [userId]
            );
            expect(beforeDelete.rows).toHaveLength(entryCount);

            // Delete record (should cascade)
            await offenseRepo.resetOffenses(userId);

            // Verify entries are also deleted
            const afterDelete = await pool.query(
              'SELECT * FROM offense_entries WHERE user_id = $1',
              [userId]
            );
            expect(afterDelete.rows).toHaveLength(0);

            // Clean up (should be no-op)
            await pool.query('DELETE FROM offense_records WHERE user_id = $1', [userId]);
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  /**
   * Additional property: Timestamp precision
   */
  describe('Property: Timestamps maintain precision', () => {
    it('should preserve timestamp precision for offense records', async () => {
      const userId = `test_timestamp_${Date.now()}`;
      const now = new Date();

      const record: OffenseRecord = {
        user_id: userId,
        total_offenses: 1,
        last_offense_timestamp: now,
        current_timeout_duration: 0,
        is_banned: false,
        warning_history: [],
      };

      await offenseRepo.saveOffenseRecord(record);

      const retrieved = await offenseRepo.getOffenseRecord(userId);
      expect(retrieved).not.toBeNull();

      // Timestamps should be within 1 second (accounting for DB precision)
      const timeDiff = Math.abs(
        retrieved!.last_offense_timestamp!.getTime() - now.getTime()
      );
      expect(timeDiff).toBeLessThan(1000);

      // Clean up
      await pool.query('DELETE FROM offense_records WHERE user_id = $1', [userId]);
    });

    it('should preserve timestamp precision for offense entries', async () => {
      const userId = `test_timestamp_entry_${Date.now()}`;
      const now = new Date();

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
        timestamp: now,
        reason: 'test',
        punishment_applied: 'WARNING',
        moderator_id: 'test_mod',
      };

      await offenseRepo.addOffenseEntry(userId, entry);

      const retrieved = await offenseRepo.getOffenseRecord(userId);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.warning_history).toHaveLength(1);

      // Timestamps should be within 1 second
      const timeDiff = Math.abs(
        retrieved!.warning_history[0].timestamp.getTime() - now.getTime()
      );
      expect(timeDiff).toBeLessThan(1000);

      // Clean up
      await pool.query('DELETE FROM offense_records WHERE user_id = $1', [userId]);
    });
  });
});
