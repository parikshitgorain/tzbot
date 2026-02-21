/**
 * @file offense-system.integration.test.ts
 * @description Integration tests for the progressive spam punishment system
 * Tests the full offense flow from detection to punishment application
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeDatabase,
  getPool,
  closePool,
  type DatabaseConfig,
} from '../../src/core/database/index.js';
import { OffenseRepository } from '../../src/core/database/repositories/OffenseRepository.js';
import { PunishmentCalculator, PunishmentType } from '../../src/moderation/punishment-calculator.js';
import { OffenseManager, type NotificationService, type NotificationResult } from '../../src/moderation/offense-manager.js';

describe('Offense System Integration', () => {
  const testConfig: DatabaseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'tzbot_test',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'test',
  };

  // Skip tests if database is not available
  const skipIfNoDb = process.env.CI === 'true' || !process.env.DB_HOST;

  let offenseRepository: OffenseRepository;
  let punishmentCalculator: PunishmentCalculator;
  let offenseManager: OffenseManager;
  let mockNotificationService: NotificationService;

  beforeAll(async () => {
    if (skipIfNoDb) return;
    
    await initializeDatabase(testConfig);
    const pool = getPool();
    
    offenseRepository = new OffenseRepository(pool);
    punishmentCalculator = new PunishmentCalculator();
    
    // Mock notification service that tracks calls
    mockNotificationService = {
      sendPunishmentNotification: async () => ({
        dmSent: true,
        ephemeralSent: true,
        modLogSent: true,
        failures: [],
      }),
    };
    
    offenseManager = new OffenseManager(
      pool,
      offenseRepository,
      punishmentCalculator,
      mockNotificationService
    );
  });

  afterAll(async () => {
    if (skipIfNoDb) return;
    await closePool();
  });

  beforeEach(async () => {
    if (skipIfNoDb) return;
    
    // Clean up test data before each test
    const pool = getPool();
    await pool.query('DELETE FROM offense_entries');
    await pool.query('DELETE FROM offense_records');
  });

  describe('Full Offense Flow', () => {
    it.skipIf(skipIfNoDb)('should process complete offense ladder from warning to ban', async () => {
      const userId = 'test_user_ladder_' + Date.now();
      const moderatorId = 'mod_123';
      const channelId = 'channel_456';

      // Offense 1: Warning
      let punishment = await offenseManager.processOffense(
        userId,
        'Spam message 1',
        moderatorId,
        channelId
      );
      expect(punishment.type).toBe(PunishmentType.WARNING);
      expect(punishment.duration).toBeUndefined();

      // Offense 2: Warning
      punishment = await offenseManager.processOffense(
        userId,
        'Spam message 2',
        moderatorId,
        channelId
      );
      expect(punishment.type).toBe(PunishmentType.WARNING);
      expect(punishment.duration).toBeUndefined();

      // Offense 3: 1 hour timeout
      punishment = await offenseManager.processOffense(
        userId,
        'Spam message 3',
        moderatorId,
        channelId
      );
      expect(punishment.type).toBe(PunishmentType.TIMEOUT);
      expect(punishment.duration).toBe(1);

      // Offense 4: 2 hour timeout
      punishment = await offenseManager.processOffense(
        userId,
        'Spam message 4',
        moderatorId,
        channelId
      );
      expect(punishment.type).toBe(PunishmentType.TIMEOUT);
      expect(punishment.duration).toBe(2);

      // Offense 5: 4 hour timeout
      punishment = await offenseManager.processOffense(
        userId,
        'Spam message 5',
        moderatorId,
        channelId
      );
      expect(punishment.type).toBe(PunishmentType.TIMEOUT);
      expect(punishment.duration).toBe(4);

      // Offense 6: 8 hour timeout
      punishment = await offenseManager.processOffense(
        userId,
        'Spam message 6',
        moderatorId,
        channelId
      );
      expect(punishment.type).toBe(PunishmentType.TIMEOUT);
      expect(punishment.duration).toBe(8);

      // Offense 7: 16 hour timeout
      punishment = await offenseManager.processOffense(
        userId,
        'Spam message 7',
        moderatorId,
        channelId
      );
      expect(punishment.type).toBe(PunishmentType.TIMEOUT);
      expect(punishment.duration).toBe(16);

      // Offense 8: Permanent ban (would be 32 hours)
      punishment = await offenseManager.processOffense(
        userId,
        'Spam message 8',
        moderatorId,
        channelId
      );
      expect(punishment.type).toBe(PunishmentType.PERMANENT_BAN);
      expect(punishment.duration).toBeUndefined();

      // Verify final state
      const record = await offenseManager.getOffenseHistory(userId);
      expect(record).not.toBeNull();
      expect(record!.total_offenses).toBe(8);
      expect(record!.is_banned).toBe(true);
      expect(record!.warning_history.length).toBe(8);
    });

    it.skipIf(skipIfNoDb)('should persist offense data across repository instances', async () => {
      const userId = 'test_user_persist_' + Date.now();
      const moderatorId = 'mod_123';
      const channelId = 'channel_456';

      // Process 3 offenses
      await offenseManager.processOffense(userId, 'Offense 1', moderatorId, channelId);
      await offenseManager.processOffense(userId, 'Offense 2', moderatorId, channelId);
      await offenseManager.processOffense(userId, 'Offense 3', moderatorId, channelId);

      // Create new repository instance (simulating restart)
      const pool = getPool();
      const newRepository = new OffenseRepository(pool);
      const record = await newRepository.getOffenseRecord(userId);

      expect(record).not.toBeNull();
      expect(record!.total_offenses).toBe(3);
      expect(record!.current_timeout_duration).toBe(1);
      expect(record!.warning_history.length).toBe(3);
      expect(record!.warning_history[0].reason).toBe('Offense 1');
      expect(record!.warning_history[1].reason).toBe('Offense 2');
      expect(record!.warning_history[2].reason).toBe('Offense 3');
    });
  });

  describe('30-Day Reset Integration', () => {
    it.skipIf(skipIfNoDb)('should automatically reset offenses after 30 days', async () => {
      const userId = 'test_user_reset_' + Date.now();
      const moderatorId = 'mod_123';
      const channelId = 'channel_456';

      // Process 3 offenses
      await offenseManager.processOffense(userId, 'Offense 1', moderatorId, channelId);
      await offenseManager.processOffense(userId, 'Offense 2', moderatorId, channelId);
      await offenseManager.processOffense(userId, 'Offense 3', moderatorId, channelId);

      // Verify user has 3 offenses
      let record = await offenseManager.getOffenseHistory(userId);
      expect(record!.total_offenses).toBe(3);

      // Manually set last_offense_timestamp to 31 days ago
      const pool = getPool();
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
      
      await pool.query(
        'UPDATE offense_records SET last_offense_timestamp = $1 WHERE user_id = $2',
        [thirtyOneDaysAgo, userId]
      );

      // Process new offense - should trigger reset
      const punishment = await offenseManager.processOffense(
        userId,
        'New offense after 30 days',
        moderatorId,
        channelId
      );

      // Should be treated as first offense (warning)
      expect(punishment.type).toBe(PunishmentType.WARNING);
      expect(punishment.duration).toBeUndefined();

      // Verify offense count was reset
      record = await offenseManager.getOffenseHistory(userId);
      expect(record!.total_offenses).toBe(1);
      expect(record!.current_timeout_duration).toBe(0);
      expect(record!.warning_history.length).toBe(1);
    });

    it.skipIf(skipIfNoDb)('should not reset offenses before 30 days', async () => {
      const userId = 'test_user_no_reset_' + Date.now();
      const moderatorId = 'mod_123';
      const channelId = 'channel_456';

      // Process 3 offenses
      await offenseManager.processOffense(userId, 'Offense 1', moderatorId, channelId);
      await offenseManager.processOffense(userId, 'Offense 2', moderatorId, channelId);
      await offenseManager.processOffense(userId, 'Offense 3', moderatorId, channelId);

      // Manually set last_offense_timestamp to 29 days ago
      const pool = getPool();
      const twentyNineDaysAgo = new Date();
      twentyNineDaysAgo.setDate(twentyNineDaysAgo.getDate() - 29);
      
      await pool.query(
        'UPDATE offense_records SET last_offense_timestamp = $1 WHERE user_id = $2',
        [twentyNineDaysAgo, userId]
      );

      // Process new offense - should NOT trigger reset
      const punishment = await offenseManager.processOffense(
        userId,
        'Offense 4',
        moderatorId,
        channelId
      );

      // Should be 4th offense (2 hour timeout)
      expect(punishment.type).toBe(PunishmentType.TIMEOUT);
      expect(punishment.duration).toBe(2);

      // Verify offense count was not reset
      const record = await offenseManager.getOffenseHistory(userId);
      expect(record!.total_offenses).toBe(4);
    });
  });

  describe('Moderator Commands End-to-End', () => {
    it.skipIf(skipIfNoDb)('should clear last offense and recalculate punishment', async () => {
      const userId = 'test_user_clear_' + Date.now();
      const moderatorId = 'mod_123';
      const channelId = 'channel_456';

      // Process 4 offenses (should be at 2h timeout)
      await offenseManager.processOffense(userId, 'Offense 1', moderatorId, channelId);
      await offenseManager.processOffense(userId, 'Offense 2', moderatorId, channelId);
      await offenseManager.processOffense(userId, 'Offense 3', moderatorId, channelId);
      await offenseManager.processOffense(userId, 'Offense 4', moderatorId, channelId);

      let record = await offenseManager.getOffenseHistory(userId);
      expect(record!.total_offenses).toBe(4);
      expect(record!.current_timeout_duration).toBe(2);

      // Clear last offense
      await offenseManager.clearLastOffense(userId);

      // Verify offense count decreased
      record = await offenseManager.getOffenseHistory(userId);
      expect(record!.total_offenses).toBe(3);
      expect(record!.current_timeout_duration).toBe(1); // Recalculated to 3rd offense level
      expect(record!.warning_history.length).toBe(3);
    });

    it.skipIf(skipIfNoDb)('should reset all offenses completely', async () => {
      const userId = 'test_user_reset_all_' + Date.now();
      const moderatorId = 'mod_123';
      const channelId = 'channel_456';

      // Process 5 offenses
      await offenseManager.processOffense(userId, 'Offense 1', moderatorId, channelId);
      await offenseManager.processOffense(userId, 'Offense 2', moderatorId, channelId);
      await offenseManager.processOffense(userId, 'Offense 3', moderatorId, channelId);
      await offenseManager.processOffense(userId, 'Offense 4', moderatorId, channelId);
      await offenseManager.processOffense(userId, 'Offense 5', moderatorId, channelId);

      let record = await offenseManager.getOffenseHistory(userId);
      expect(record!.total_offenses).toBe(5);

      // Reset all offenses
      await offenseManager.resetAllOffenses(userId);

      // Verify all data cleared
      record = await offenseManager.getOffenseHistory(userId);
      expect(record).toBeNull();
    });

    it.skipIf(skipIfNoDb)('should retrieve offense history with all entries', async () => {
      const userId = 'test_user_history_' + Date.now();
      const moderatorId = 'mod_123';
      const channelId = 'channel_456';

      // Process 3 offenses with different reasons
      await offenseManager.processOffense(userId, 'Spam links', moderatorId, channelId);
      await offenseManager.processOffense(userId, 'Excessive caps', moderatorId, channelId);
      await offenseManager.processOffense(userId, 'Repeated messages', moderatorId, channelId);

      const record = await offenseManager.getOffenseHistory(userId);
      
      expect(record).not.toBeNull();
      expect(record!.total_offenses).toBe(3);
      expect(record!.warning_history.length).toBe(3);
      expect(record!.warning_history[0].reason).toBe('Spam links');
      expect(record!.warning_history[1].reason).toBe('Excessive caps');
      expect(record!.warning_history[2].reason).toBe('Repeated messages');
      expect(record!.warning_history[0].moderator_id).toBe(moderatorId);
    });

    it.skipIf(skipIfNoDb)('should retrieve all active offenses', async () => {
      const user1 = 'test_user_all_1_' + Date.now();
      const user2 = 'test_user_all_2_' + Date.now();
      const user3 = 'test_user_all_3_' + Date.now();
      const moderatorId = 'mod_123';
      const channelId = 'channel_456';

      // Create offenses for multiple users
      await offenseManager.processOffense(user1, 'User 1 offense', moderatorId, channelId);
      await offenseManager.processOffense(user2, 'User 2 offense', moderatorId, channelId);
      await offenseManager.processOffense(user2, 'User 2 offense 2', moderatorId, channelId);
      await offenseManager.processOffense(user3, 'User 3 offense', moderatorId, channelId);

      const allOffenses = await offenseRepository.getAllActiveOffenses();
      
      expect(allOffenses.length).toBe(3);
      
      const user1Record = allOffenses.find(r => r.user_id === user1);
      const user2Record = allOffenses.find(r => r.user_id === user2);
      const user3Record = allOffenses.find(r => r.user_id === user3);
      
      expect(user1Record!.total_offenses).toBe(1);
      expect(user2Record!.total_offenses).toBe(2);
      expect(user3Record!.total_offenses).toBe(1);
    });
  });

  describe('Notification Delivery Integration', () => {
    it.skipIf(skipIfNoDb)('should attempt all three notifications', async () => {
      const userId = 'test_user_notif_' + Date.now();
      const moderatorId = 'mod_123';
      const channelId = 'channel_456';

      let notificationCalls = 0;
      let lastNotificationParams: any = null;

      // Mock notification service that tracks calls
      const trackingNotificationService: NotificationService = {
        sendPunishmentNotification: async (userId, channelId, punishment, reason, offenseCount) => {
          notificationCalls++;
          lastNotificationParams = { userId, channelId, punishment, reason, offenseCount };
          return {
            dmSent: true,
            ephemeralSent: true,
            modLogSent: true,
            failures: [],
          };
        },
      };

      const pool = getPool();
      const trackedOffenseManager = new OffenseManager(
        pool,
        offenseRepository,
        punishmentCalculator,
        trackingNotificationService
      );

      // Process offense
      await trackedOffenseManager.processOffense(userId, 'Test spam', moderatorId, channelId);

      // Verify notification was called
      expect(notificationCalls).toBe(1);
      expect(lastNotificationParams.userId).toBe(userId);
      expect(lastNotificationParams.channelId).toBe(channelId);
      expect(lastNotificationParams.reason).toBe('Test spam');
      expect(lastNotificationParams.offenseCount).toBe(1);
    });

    it.skipIf(skipIfNoDb)('should continue processing even if notifications fail', async () => {
      const userId = 'test_user_notif_fail_' + Date.now();
      const moderatorId = 'mod_123';
      const channelId = 'channel_456';

      // Mock notification service that always fails
      const failingNotificationService: NotificationService = {
        sendPunishmentNotification: async () => {
          throw new Error('Notification service unavailable');
        },
      };

      const pool = getPool();
      const failingOffenseManager = new OffenseManager(
        pool,
        offenseRepository,
        punishmentCalculator,
        failingNotificationService
      );

      // Process offense - should not throw despite notification failure
      const punishment = await failingOffenseManager.processOffense(
        userId,
        'Test spam',
        moderatorId,
        channelId
      );

      // Verify offense was still processed
      expect(punishment.type).toBe(PunishmentType.WARNING);
      
      const record = await offenseManager.getOffenseHistory(userId);
      expect(record).not.toBeNull();
      expect(record!.total_offenses).toBe(1);
    });

    it.skipIf(skipIfNoDb)('should track partial notification failures', async () => {
      const userId = 'test_user_partial_fail_' + Date.now();
      const moderatorId = 'mod_123';
      const channelId = 'channel_456';

      // Mock notification service with partial failures
      const partialFailNotificationService: NotificationService = {
        sendPunishmentNotification: async () => ({
          dmSent: false, // DM failed
          ephemeralSent: true,
          modLogSent: true,
          failures: ['Failed to send DM: User has DMs disabled'],
        }),
      };

      const pool = getPool();
      const partialFailOffenseManager = new OffenseManager(
        pool,
        offenseRepository,
        punishmentCalculator,
        partialFailNotificationService
      );

      // Process offense - should succeed despite partial notification failure
      const punishment = await partialFailOffenseManager.processOffense(
        userId,
        'Test spam',
        moderatorId,
        channelId
      );

      expect(punishment.type).toBe(PunishmentType.WARNING);
      
      const record = await offenseManager.getOffenseHistory(userId);
      expect(record!.total_offenses).toBe(1);
    });
  });

  describe('Transaction Integrity', () => {
    it.skipIf(skipIfNoDb)('should rollback offense on database error', async () => {
      const userId = 'test_user_rollback_' + Date.now();
      const moderatorId = 'mod_123';
      const channelId = 'channel_456';

      // Create a repository that will fail on addOffenseEntry
      const pool = getPool();
      const failingRepository = new OffenseRepository(pool);
      
      // Override addOffenseEntry to throw error
      const originalAddOffenseEntry = failingRepository.addOffenseEntry.bind(failingRepository);
      failingRepository.addOffenseEntry = async () => {
        throw new Error('Simulated database error');
      };

      const failingOffenseManager = new OffenseManager(
        pool,
        failingRepository,
        punishmentCalculator,
        mockNotificationService
      );

      // Attempt to process offense - should fail
      await expect(
        failingOffenseManager.processOffense(userId, 'Test spam', moderatorId, channelId)
      ).rejects.toThrow();

      // Verify no offense record was created (transaction rolled back)
      const record = await offenseRepository.getOffenseRecord(userId);
      expect(record).toBeNull();
    });

    it.skipIf(skipIfNoDb)('should handle concurrent offense processing', async () => {
      const userId = 'test_user_concurrent_' + Date.now();
      const moderatorId = 'mod_123';
      const channelId = 'channel_456';

      // Process 3 offenses concurrently
      const promises = [
        offenseManager.processOffense(userId, 'Concurrent offense 1', moderatorId, channelId),
        offenseManager.processOffense(userId, 'Concurrent offense 2', moderatorId, channelId),
        offenseManager.processOffense(userId, 'Concurrent offense 3', moderatorId, channelId),
      ];

      await Promise.all(promises);

      // Verify all 3 offenses were recorded
      const record = await offenseManager.getOffenseHistory(userId);
      expect(record!.total_offenses).toBe(3);
      expect(record!.warning_history.length).toBe(3);
    });
  });
});
