/**
 * @file offense-manager.property.test.ts
 * @description Property-based tests for OffenseManager
 * @module tests/property
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { Pool } from 'pg';
import { createPool, closePool } from '@/core/database/pool.js';
import { runMigrations } from '@/core/database/migrator.js';
import { OffenseManager } from '@/moderation/offense-manager.js';
import { OffenseRepository } from '@/core/database/repositories/OffenseRepository.js';
import { PunishmentCalculator, PunishmentType } from '@/moderation/punishment-calculator.js';
import type { NotificationService, NotificationResult } from '@/moderation/offense-manager.js';
import type { Punishment } from '@/moderation/punishment-calculator.js';

// Mock notification service
class MockNotificationService implements NotificationService {
  async sendPunishmentNotification(
    userId: string,
    channelId: string,
    punishment: Punishment,
    reason: string,
    offenseCount: number
  ): Promise<NotificationResult> {
    return {
      dmSent: true,
      ephemeralSent: true,
      modLogSent: true,
      failures: [],
    };
  }
}

describe('OffenseManager - Property-Based Tests', () => {
  let pool: Pool;
  let offenseRepo: OffenseRepository;
  let calculator: PunishmentCalculator;
  let notificationService: MockNotificationService;
  let offenseManager: OffenseManager;

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
    calculator = new PunishmentCalculator();
    notificationService = new MockNotificationService();
    offenseManager = new OffenseManager(pool, offenseRepo, calculator, notificationService);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await pool.query('DELETE FROM offense_entries WHERE user_id LIKE $1', ['test_%']);
    await pool.query('DELETE FROM offense_records WHERE user_id LIKE $1', ['test_%']);
  });

  /**
   * Property 3: 30-Day Reset Correctness
   * **Validates: Requirements 2.1-2.3**
   * 
   * If 30 or more days have passed since the last offense, the next offense must be treated as the first offense
   */
  describe('Property 3: 30-day reset clears offense history', () => {
    it('should reset offense count after 30 days', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }), // initial offense count
          fc.integer({ min: 30, max: 365 }), // days since last offense
          async (initialOffenses, daysSinceLastOffense) => {
            const userId = `test_user_${Date.now()}_${Math.random()}`;
            const channelId = 'test_channel';
            const moderatorId = 'test_moderator';

            // Create initial offense record with old timestamp
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - daysSinceLastOffense);

            // Manually insert old offense record
            await pool.query(
              `INSERT INTO offense_records (user_id, total_offenses, last_offense_timestamp, current_timeout_duration, is_banned)
               VALUES ($1, $2, $3, $4, $5)`,
              [userId, initialOffenses, oldDate, 0, false]
            );

            // Process new offense - should trigger reset
            const punishment = await offenseManager.processOffense(
              userId,
              'test reason',
              moderatorId,
              channelId
            );

            // After reset, this should be treated as first offense
            expect(punishment.type).toBe(PunishmentType.WARNING);
            expect(punishment.duration).toBeUndefined();

            // Verify offense count is 1
            const record = await offenseRepo.getOffenseRecord(userId);
            expect(record).not.toBeNull();
            expect(record!.total_offenses).toBe(1);
            expect(record!.current_timeout_duration).toBe(0);
            expect(record!.is_banned).toBe(false);

            // Clean up
            await pool.query('DELETE FROM offense_records WHERE user_id = $1', [userId]);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should NOT reset offense count before 30 days', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // initial offense count
          fc.integer({ min: 0, max: 29 }), // days since last offense (< 30)
          async (initialOffenses, daysSinceLastOffense) => {
            const userId = `test_user_${Date.now()}_${Math.random()}`;
            const channelId = 'test_channel';
            const moderatorId = 'test_moderator';

            // Create initial offense record with recent timestamp
            const recentDate = new Date();
            recentDate.setDate(recentDate.getDate() - daysSinceLastOffense);

            await pool.query(
              `INSERT INTO offense_records (user_id, total_offenses, last_offense_timestamp, current_timeout_duration, is_banned)
               VALUES ($1, $2, $3, $4, $5)`,
              [userId, initialOffenses, recentDate, 0, false]
            );

            // Process new offense - should NOT trigger reset
            await offenseManager.processOffense(
              userId,
              'test reason',
              moderatorId,
              channelId
            );

            // Verify offense count incremented (not reset)
            const record = await offenseRepo.getOffenseRecord(userId);
            expect(record).not.toBeNull();
            expect(record!.total_offenses).toBe(initialOffenses + 1);

            // Clean up
            await pool.query('DELETE FROM offense_records WHERE user_id = $1', [userId]);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 10: Clear Last Offense Recalculation
   * **Validates: Requirements 7.1-7.2**
   * 
   * When the last offense is cleared, the user's punishment status must be recalculated
   */
  describe('Property 10: Clearing last offense recalculates status', () => {
    it('should decrement offense count and recalculate timeout', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 7 }), // offense count (at least 2 so we can clear one)
          async (offenseCount) => {
            const userId = `test_user_${Date.now()}_${Math.random()}`;
            const channelId = 'test_channel';
            const moderatorId = 'test_moderator';

            // Create offenses
            for (let i = 0; i < offenseCount; i++) {
              await offenseManager.processOffense(
                userId,
                `test reason ${i}`,
                moderatorId,
                channelId
              );
            }

            // Get record before clearing
            const recordBefore = await offenseRepo.getOffenseRecord(userId);
            expect(recordBefore).not.toBeNull();
            expect(recordBefore!.total_offenses).toBe(offenseCount);

            // Clear last offense
            await offenseManager.clearLastOffense(userId);

            // Get record after clearing
            const recordAfter = await offenseRepo.getOffenseRecord(userId);
            expect(recordAfter).not.toBeNull();
            expect(recordAfter!.total_offenses).toBe(offenseCount - 1);

            // Verify timeout duration was recalculated
            const expectedPunishment = calculator.calculatePunishment(offenseCount - 1, 0);
            expect(recordAfter!.current_timeout_duration).toBe(expectedPunishment.duration || 0);

            // Clean up
            await pool.query('DELETE FROM offense_records WHERE user_id = $1', [userId]);
          }
        ),
        { numRuns: 15 }
      );
    });

    it('should handle clearing offense from warning-only state', async () => {
      const userId = `test_user_${Date.now()}_${Math.random()}`;
      const channelId = 'test_channel';
      const moderatorId = 'test_moderator';

      // Create 2 offenses (both warnings)
      await offenseManager.processOffense(userId, 'reason 1', moderatorId, channelId);
      await offenseManager.processOffense(userId, 'reason 2', moderatorId, channelId);

      const recordBefore = await offenseRepo.getOffenseRecord(userId);
      expect(recordBefore!.total_offenses).toBe(2);
      expect(recordBefore!.current_timeout_duration).toBe(0);

      // Clear last offense
      await offenseManager.clearLastOffense(userId);

      const recordAfter = await offenseRepo.getOffenseRecord(userId);
      expect(recordAfter!.total_offenses).toBe(1);
      expect(recordAfter!.current_timeout_duration).toBe(0); // Still warning

      // Clean up
      await pool.query('DELETE FROM offense_records WHERE user_id = $1', [userId]);
    });
  });

  /**
   * Property 9: Offense History Immutability
   * **Validates: Requirements 4.5**
   * 
   * Once an offense is recorded, it cannot be modified (only removed via clearLastOffense or reset)
   */
  describe('Property 9: Offense history entries are immutable', () => {
    it('should preserve offense entry data after retrieval', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 100 }), // reason
          async (reason) => {
            const userId = `test_user_${Date.now()}_${Math.random()}`;
            const channelId = 'test_channel';
            const moderatorId = 'test_moderator';

            // Create offense
            await offenseManager.processOffense(userId, reason, moderatorId, channelId);

            // Get record
            const record1 = await offenseRepo.getOffenseRecord(userId);
            expect(record1).not.toBeNull();
            expect(record1!.warning_history.length).toBe(1);

            const originalEntry = record1!.warning_history[0];
            const originalReason = originalEntry.reason;
            const originalTimestamp = originalEntry.timestamp;
            const originalPunishment = originalEntry.punishment_applied;

            // Retrieve again
            const record2 = await offenseRepo.getOffenseRecord(userId);
            expect(record2).not.toBeNull();
            expect(record2!.warning_history.length).toBe(1);

            const retrievedEntry = record2!.warning_history[0];

            // Verify data is identical
            expect(retrievedEntry.reason).toBe(originalReason);
            expect(retrievedEntry.timestamp.getTime()).toBe(originalTimestamp.getTime());
            expect(retrievedEntry.punishment_applied).toBe(originalPunishment);
            expect(retrievedEntry.moderator_id).toBe(moderatorId);

            // Clean up
            await pool.query('DELETE FROM offense_records WHERE user_id = $1', [userId]);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should maintain offense history order', async () => {
      const userId = `test_user_${Date.now()}_${Math.random()}`;
      const channelId = 'test_channel';
      const moderatorId = 'test_moderator';

      const reasons = ['first', 'second', 'third'];

      // Create multiple offenses
      for (const reason of reasons) {
        await offenseManager.processOffense(userId, reason, moderatorId, channelId);
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Get record
      const record = await offenseRepo.getOffenseRecord(userId);
      expect(record).not.toBeNull();
      expect(record!.warning_history.length).toBe(3);

      // Verify order (should be chronological)
      for (let i = 0; i < reasons.length; i++) {
        expect(record!.warning_history[i].reason).toBe(reasons[i]);
      }

      // Verify timestamps are in order
      for (let i = 1; i < record!.warning_history.length; i++) {
        expect(record!.warning_history[i].timestamp.getTime())
          .toBeGreaterThanOrEqual(record!.warning_history[i - 1].timestamp.getTime());
      }

      // Clean up
      await pool.query('DELETE FROM offense_records WHERE user_id = $1', [userId]);
    });
  });

  /**
   * Additional property: Reset clears all data
   */
  describe('Property: Reset all offenses clears all data', () => {
    it('should completely remove offense record and entries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }), // number of offenses
          async (offenseCount) => {
            const userId = `test_user_${Date.now()}_${Math.random()}`;
            const channelId = 'test_channel';
            const moderatorId = 'test_moderator';

            // Create offenses
            for (let i = 0; i < offenseCount; i++) {
              await offenseManager.processOffense(
                userId,
                `reason ${i}`,
                moderatorId,
                channelId
              );
            }

            // Verify offenses exist
            const recordBefore = await offenseRepo.getOffenseRecord(userId);
            expect(recordBefore).not.toBeNull();
            expect(recordBefore!.total_offenses).toBe(offenseCount);

            // Reset all offenses
            await offenseManager.resetAllOffenses(userId);

            // Verify record is gone
            const recordAfter = await offenseRepo.getOffenseRecord(userId);
            expect(recordAfter).toBeNull();

            // Clean up (should be no-op)
            await pool.query('DELETE FROM offense_records WHERE user_id = $1', [userId]);
          }
        ),
        { numRuns: 15 }
      );
    });
  });
});
