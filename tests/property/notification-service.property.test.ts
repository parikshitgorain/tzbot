/**
 * @file notification-service.property.test.ts
 * @description Property-based tests for NotificationService (NotificationManager)
 * @module tests/property
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { NotificationManager } from '@/managers/notification.manager.js';
import { PunishmentCalculator, PunishmentType } from '@/moderation/punishment-calculator.js';
import type { Punishment } from '@/moderation/punishment-calculator.js';
import type { IDiscordClient } from '@/core/discord/client.js';

// Mock Discord client
function createMockDiscordClient(): IDiscordClient {
  return {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendDirectMessage: vi.fn().mockResolvedValue(undefined),
    getClient: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
    login: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
  } as unknown as IDiscordClient;
}

describe('NotificationService - Property-Based Tests', () => {
  let mockClient: IDiscordClient;
  let notificationManager: NotificationManager;
  let calculator: PunishmentCalculator;

  beforeEach(() => {
    mockClient = createMockDiscordClient();
    calculator = new PunishmentCalculator();
    
    notificationManager = new NotificationManager(mockClient, {
      primaryChannelId: 'primary-channel-id',
      fallbackChannelId: 'fallback-channel-id',
      modLogChannelId: 'mod-log-channel-id',
    });
  });

  /**
   * Property 6: Triple Notification Delivery
   * **Validates: Requirements 3.1-3.4**
   * 
   * Every punishment must attempt to send all three notifications (DM, ephemeral, mod-log),
   * and failures must be logged without blocking punishment application
   */
  describe('Property 6: Triple notification always attempted', () => {
    it('should attempt all three notifications for any punishment', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 30 }), // userId
          fc.string({ minLength: 10, maxLength: 30 }), // channelId
          fc.integer({ min: 1, max: 10 }), // offenseCount
          fc.string({ minLength: 10, maxLength: 100 }), // reason
          async (userId, channelId, offenseCount, reason) => {
            // Calculate punishment
            const punishment = calculator.calculatePunishment(offenseCount, 0);

            // Send notification
            const result = await notificationManager.sendPunishmentNotification(
              userId,
              channelId,
              punishment,
              reason,
              offenseCount
            );

            // All three notification attempts must be recorded
            expect(typeof result.dmSent).toBe('boolean');
            expect(typeof result.ephemeralSent).toBe('boolean');
            expect(typeof result.modLogSent).toBe('boolean');

            // Failures array must exist
            expect(Array.isArray(result.failures)).toBe(true);

            // Verify all three notification methods were called
            expect(mockClient.sendDirectMessage).toHaveBeenCalled();
            expect(mockClient.sendMessage).toHaveBeenCalled();

            // Reset mocks for next iteration
            vi.clearAllMocks();
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should record failures when notifications fail', async () => {
      // Mock failures
      const failingClient = createMockDiscordClient();
      (failingClient.sendDirectMessage as any).mockRejectedValue(new Error('DM failed'));
      (failingClient.sendMessage as any).mockRejectedValue(new Error('Message failed'));

      const failingManager = new NotificationManager(failingClient, {
        primaryChannelId: 'primary-channel-id',
        modLogChannelId: 'mod-log-channel-id',
      });

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 30 }),
          fc.string({ minLength: 10, maxLength: 30 }),
          fc.integer({ min: 1, max: 10 }),
          fc.string({ minLength: 10, maxLength: 100 }),
          async (userId, channelId, offenseCount, reason) => {
            const punishment = calculator.calculatePunishment(offenseCount, 0);

            const result = await failingManager.sendPunishmentNotification(
              userId,
              channelId,
              punishment,
              reason,
              offenseCount
            );

            // When notifications fail, failures should be logged
            if (!result.dmSent || !result.ephemeralSent || !result.modLogSent) {
              expect(result.failures.length).toBeGreaterThan(0);
            }

            // Reset mocks
            vi.clearAllMocks();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should not throw errors even when all notifications fail', async () => {
      const failingClient = createMockDiscordClient();
      (failingClient.sendDirectMessage as any).mockRejectedValue(new Error('DM failed'));
      (failingClient.sendMessage as any).mockRejectedValue(new Error('Message failed'));

      const failingManager = new NotificationManager(failingClient, {
        primaryChannelId: 'primary-channel-id',
        modLogChannelId: 'mod-log-channel-id',
      });

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 30 }),
          fc.string({ minLength: 10, maxLength: 30 }),
          fc.integer({ min: 1, max: 10 }),
          fc.string({ minLength: 10, maxLength: 100 }),
          async (userId, channelId, offenseCount, reason) => {
            const punishment = calculator.calculatePunishment(offenseCount, 0);

            // Should not throw
            await expect(
              failingManager.sendPunishmentNotification(
                userId,
                channelId,
                punishment,
                reason,
                offenseCount
              )
            ).resolves.toBeDefined();

            vi.clearAllMocks();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Additional property: Notification content includes required fields
   */
  describe('Property: Notification content completeness', () => {
    it('should include all required fields in notifications', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 30 }),
          fc.string({ minLength: 10, maxLength: 30 }),
          fc.integer({ min: 1, max: 10 }),
          fc.string({ minLength: 10, maxLength: 100 }),
          async (userId, channelId, offenseCount, reason) => {
            const punishment = calculator.calculatePunishment(offenseCount, 0);

            await notificationManager.sendPunishmentNotification(
              userId,
              channelId,
              punishment,
              reason,
              offenseCount
            );

            // Verify DM was called with embed containing required fields
            const dmCall = (mockClient.sendDirectMessage as any).mock.calls[0];
            expect(dmCall).toBeDefined();
            expect(dmCall[0]).toBe(userId);
            expect(dmCall[1]).toHaveProperty('embeds');
            expect(dmCall[1].embeds).toHaveLength(1);

            const dmEmbed = dmCall[1].embeds[0];
            expect(dmEmbed.data.title).toBeDefined();
            expect(dmEmbed.data.description).toBeDefined();
            expect(dmEmbed.data.fields).toBeDefined();
            expect(dmEmbed.data.timestamp).toBeDefined();

            // Verify channel message was called
            const channelCall = (mockClient.sendMessage as any).mock.calls[0];
            expect(channelCall).toBeDefined();
            expect(channelCall[0]).toBe(channelId);

            vi.clearAllMocks();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Additional property: Different punishment types are handled correctly
   */
  describe('Property: Punishment type handling', () => {
    it('should handle all punishment types correctly', async () => {
      const testCases = [
        { offenseCount: 1, previousTimeout: 0, expectedType: PunishmentType.WARNING },
        { offenseCount: 2, previousTimeout: 0, expectedType: PunishmentType.WARNING },
        { offenseCount: 3, previousTimeout: 0, expectedType: PunishmentType.TIMEOUT },
        { offenseCount: 8, previousTimeout: 16, expectedType: PunishmentType.PERMANENT_BAN }, // 16 * 2 = 32h >= 24h
      ];

      for (const testCase of testCases) {
        const punishment = calculator.calculatePunishment(testCase.offenseCount, testCase.previousTimeout);
        expect(punishment.type).toBe(testCase.expectedType);

        const result = await notificationManager.sendPunishmentNotification(
          'test-user',
          'test-channel',
          punishment,
          'test reason',
          testCase.offenseCount
        );

        // Verify notification was attempted
        expect(typeof result.dmSent).toBe('boolean');
        expect(typeof result.ephemeralSent).toBe('boolean');
        expect(typeof result.modLogSent).toBe('boolean');

        vi.clearAllMocks();
      }
    });
  });

  /**
   * Additional property: Notification result structure is consistent
   */
  describe('Property: Result structure consistency', () => {
    it('should always return consistent NotificationResult structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 30 }),
          fc.string({ minLength: 10, maxLength: 30 }),
          fc.integer({ min: 1, max: 10 }),
          fc.string({ minLength: 10, maxLength: 100 }),
          async (userId, channelId, offenseCount, reason) => {
            const punishment = calculator.calculatePunishment(offenseCount, 0);

            const result = await notificationManager.sendPunishmentNotification(
              userId,
              channelId,
              punishment,
              reason,
              offenseCount
            );

            // Verify result structure
            expect(result).toHaveProperty('dmSent');
            expect(result).toHaveProperty('ephemeralSent');
            expect(result).toHaveProperty('modLogSent');
            expect(result).toHaveProperty('failures');

            // Verify types
            expect(typeof result.dmSent).toBe('boolean');
            expect(typeof result.ephemeralSent).toBe('boolean');
            expect(typeof result.modLogSent).toBe('boolean');
            expect(Array.isArray(result.failures)).toBe(true);

            // Verify failures are strings
            result.failures.forEach(failure => {
              expect(typeof failure).toBe('string');
            });

            vi.clearAllMocks();
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Additional property: Mod-log channel optional handling
   */
  describe('Property: Mod-log channel optional', () => {
    it('should handle missing mod-log channel gracefully', async () => {
      const managerNoModLog = new NotificationManager(mockClient, {
        primaryChannelId: 'primary-channel-id',
        // No modLogChannelId
      });

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 30 }),
          fc.string({ minLength: 10, maxLength: 30 }),
          fc.integer({ min: 1, max: 10 }),
          fc.string({ minLength: 10, maxLength: 100 }),
          async (userId, channelId, offenseCount, reason) => {
            const punishment = calculator.calculatePunishment(offenseCount, 0);

            const result = await managerNoModLog.sendPunishmentNotification(
              userId,
              channelId,
              punishment,
              reason,
              offenseCount
            );

            // Should not throw
            expect(result).toBeDefined();

            // Mod-log should not be sent
            expect(result.modLogSent).toBe(false);

            // Should have a failure message about missing mod-log
            expect(result.failures.some(f => f.includes('Mod-log'))).toBe(true);

            vi.clearAllMocks();
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
