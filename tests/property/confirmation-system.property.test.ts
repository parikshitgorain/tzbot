/**
 * @file confirmation-system.property.test.ts
 * @description Property-based tests for ConfirmationSystem
 * Feature: giveaway-winner-confirmation
 * @module tests/property
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { ConfirmationSystem } from '../../src/giveaway/confirmation-system.js';
import { WinnerStateRepository } from '../../src/core/database/repositories/WinnerStateRepository.js';
import { GiveawayRepository } from '../../src/core/database/repositories/GiveawayRepository.js';
import { ConfigManager } from '../../src/giveaway/config-manager.js';
import { WinnerStatus, GiveawayStatus } from '../../src/types/models.js';
import { createPool, closePool } from '../../src/core/database/pool.js';
import { runMigrations } from '../../src/core/database/migrator.js';
import type { Pool } from 'pg';
import type { User } from 'discord.js';

// Mock Discord.js
vi.mock('discord.js', () => {
  class MockEmbedBuilder {
    data: any = {};
    
    setTitle(title: string) {
      this.data.title = title;
      return this;
    }
    
    setDescription(description: string) {
      this.data.description = description;
      return this;
    }
    
    setColor(color: number) {
      this.data.color = color;
      return this;
    }
    
    setTimestamp() {
      this.data.timestamp = new Date();
      return this;
    }
  }
  
  return {
    Client: vi.fn(),
    EmbedBuilder: MockEmbedBuilder,
  };
});

vi.mock('../../src/core/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Skip tests if database is not available
const skipDatabaseTests = 
  process.env.SKIP_DB_TESTS === 'true' || 
  process.env.CI === 'true' ||
  (process.env.NODE_ENV === 'test' && process.env.DATABASE_URL?.includes('localhost'));

describe.skipIf(skipDatabaseTests)('ConfirmationSystem - Property Tests', () => {
  let pool: Pool;
  let winnerStateRepo: WinnerStateRepository;
  let giveawayRepo: GiveawayRepository;
  let giveawayConfigRepo: any;
  let configManager: ConfigManager;
  let confirmationSystem: ConfirmationSystem;
  let mockClient: any;
  let mockChannel: any;
  let sentMessages: any[];
  let testCounter = 0;

  beforeAll(async () => {
    pool = createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'tzbot_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    await runMigrations();

    winnerStateRepo = new WinnerStateRepository(pool);
    giveawayRepo = new GiveawayRepository(pool);
    
    // Create GiveawayConfigRepository
    const { GiveawayConfigRepository } = await import('../../src/core/database/repositories/GiveawayConfigRepository.js');
    giveawayConfigRepo = new GiveawayConfigRepository(pool);
    configManager = new ConfigManager(giveawayConfigRepo);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    // Clean up test data in correct order (respecting foreign keys)
    await pool.query('DELETE FROM giveaway_winners');
    await pool.query('DELETE FROM giveaway_entries');
    await pool.query('DELETE FROM giveaway_config');
    await pool.query('DELETE FROM giveaways');

    // Reset sent messages
    sentMessages = [];

    // Mock Discord channel
    mockChannel = {
      send: vi.fn().mockImplementation((msg) => {
        sentMessages.push(msg);
        return Promise.resolve({});
      }),
      isTextBased: vi.fn().mockReturnValue(true),
    };

    // Mock Discord client with guild and member fetching
    const allowedUserIds = new Set<string>();
    
    mockClient = {
      channels: {
        fetch: vi.fn().mockResolvedValue(mockChannel),
      },
      guilds: {
        fetch: vi.fn().mockImplementation((guildId: string) => {
          return Promise.resolve({
            id: guildId,
            members: {
              fetch: vi.fn().mockImplementation((userId: string) => {
                return Promise.resolve({
                  id: userId,
                  permissions: {
                    has: vi.fn().mockReturnValue(false),
                  },
                  roles: {
                    cache: new Map(),
                  },
                });
              }),
            },
          });
        }),
      },
      on: vi.fn(),
    };

    confirmationSystem = new ConfirmationSystem(
      winnerStateRepo,
      giveawayRepo,
      configManager
    );

    confirmationSystem.initialize(mockClient);
  });

  /**
   * Property 1: Winner Selection Count
   * **Validates: Requirements 1.1**
   * 
   * For any giveaway with N specified winners and sufficient entries,
   * ending the giveaway should select exactly N winners.
   */
  describe('Property 1: Winner Selection Count', () => {
    it('should create exactly N winner records for N winners', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 10, maxLength: 20 }),
          fc.string({ minLength: 10, maxLength: 20 }),
          fc.integer({ min: 1, max: 5 }),
          async (giveawayId, channelId, guildId, winnerCount) => {
            // Create test giveaway
            await giveawayRepo.save({
              id: giveawayId,
              guildId,
              title: 'Test Giveaway',
              description: 'Test',
              channelId,
              messageId: '123',
              requiredRoles: [],
              winnerCount,
              status: GiveawayStatus.ACTIVE,
              endsAt: new Date(Date.now() + 3600000),
              createdAt: new Date(),
              entries: [],
            });

            // Create mock winners
            const winners: User[] = Array.from({ length: winnerCount }, (_, i) => ({
              id: `user-${i}`,
              username: `User${i}`,
            } as User));

            // Start confirmation
            await confirmationSystem.startConfirmation(giveawayId, winners);

            // Verify exactly N winner records created
            const winnerRecords = await winnerStateRepo.getWinners(giveawayId);
            expect(winnerRecords).toHaveLength(winnerCount);

            // Verify all have PENDING status
            for (const record of winnerRecords) {
              expect(record.status).toBe(WinnerStatus.PENDING);
              expect(record.timerActive).toBe(true);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 4: Winner Announcement Format
   * **Validates: Requirements 1.4, 1.5, 8.1, 8.5**
   * 
   * For any set of winners, the announcement message should contain
   * all winner mentions, confirmation instructions with 5-minute time limit,
   * and the moderator reroll command with correct giveaway ID format.
   */
  describe('Property 4: Winner Announcement Format', () => {
    it('should include all required elements in announcement', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 1, max: 3 }),
          async (giveawayId, winnerCount) => {
            const channelId = `channel-${testCounter++}`;
            const guildId = `guild-${testCounter++}`;
            
            // Create test giveaway
            await giveawayRepo.save({
              id: giveawayId,
              guildId,
              title: 'Test Giveaway',
              description: 'Test',
              channelId,
              messageId: '123',
              requiredRoles: [],
              winnerCount,
              status: GiveawayStatus.ACTIVE,
              endsAt: new Date(Date.now() + 3600000),
              createdAt: new Date(),
              entries: [],
            });

            const winners: User[] = Array.from({ length: winnerCount }, (_, i) => ({
              id: `user-${testCounter++}-${i}`,
              username: `User${i}`,
            } as User));

            sentMessages = [];
            await confirmationSystem.startConfirmation(giveawayId, winners);

            // Verify message was sent
            expect(sentMessages).toHaveLength(1);
            const message = sentMessages[0];

            // Verify winner mentions in content
            expect(message.content).toBeDefined();
            for (const winner of winners) {
              expect(message.content).toContain(`<@${winner.id}>`);
            }

            // Verify embed exists
            expect(message.embeds).toBeDefined();
            expect(message.embeds).toHaveLength(1);
            const embed = message.embeds[0];

            // Verify embed description contains required elements
            const description = embed.data?.description || '';
            expect(description).toContain('5 minutes');
            expect(description).toContain('confirm');
            expect(description).toContain('/giveaway reroll');
            expect(description).toContain(`giveaway_id:${giveawayId}`);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 8: Confirmation Message Sent
   * **Validates: Requirements 2.4, 8.2**
   * 
   * For any confirmed winner, a confirmation notification should be sent
   * mentioning the winner and including next steps.
   */
  describe('Property 8: Confirmation Message Sent', () => {
    it('should send confirmation message with winner mention', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (giveawayId) => {
            const channelId = `channel-${testCounter++}`;
            const guildId = `guild-${testCounter++}`;
            const userId = `user-${testCounter++}`;
            
            // Create test giveaway
            await giveawayRepo.save({
              id: giveawayId,
              guildId,
              title: 'Test Giveaway',
              description: 'Test',
              channelId,
              messageId: '123',
              requiredRoles: [],
              winnerCount: 1,
              status: GiveawayStatus.ACTIVE,
              endsAt: new Date(Date.now() + 3600000),
              createdAt: new Date(),
              entries: [],
            });

            // Create pending winner
            await winnerStateRepo.createWinner({
              giveawayId,
              userId,
              status: WinnerStatus.PENDING,
              selectedAt: new Date(),
              timerStartTime: new Date(),
              timerActive: true,
            });

            sentMessages = [];
            await confirmationSystem.confirmWinner(giveawayId, userId);

            // Verify confirmation message sent
            expect(sentMessages).toHaveLength(1);
            const message = sentMessages[0];

            // Verify embed contains winner mention
            expect(message.embeds).toBeDefined();
            expect(message.embeds).toHaveLength(1);
            const embed = message.embeds[0];
            const description = embed.data?.description || '';
            expect(description).toContain(`<@${userId}>`);
            expect(description).toContain('confirmed');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 15: Permission Validation for Reroll
   * **Validates: Requirements 5.1**
   * 
   * For any manual reroll command, the system should validate that
   * the moderator has permission to use giveaway commands before executing the reroll.
   */
  describe('Property 15: Permission Validation for Reroll', () => {
    it('should reject reroll from unauthorized moderators', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (giveawayId) => {
            const channelId = `channel-${testCounter++}`;
            const guildId = `guild-${testCounter++}`;
            const userId = `user-${testCounter++}`;
            const moderatorId = `mod-${testCounter++}`;
            
            // Create test giveaway
            await giveawayRepo.save({
              id: giveawayId,
              guildId,
              title: 'Test Giveaway',
              description: 'Test',
              channelId,
              messageId: '123',
              requiredRoles: [],
              winnerCount: 1,
              status: GiveawayStatus.ACTIVE,
              endsAt: new Date(Date.now() + 3600000),
              createdAt: new Date(),
              entries: [],
            });

            // Create pending winner
            await winnerStateRepo.createWinner({
              giveawayId,
              userId,
              status: WinnerStatus.PENDING,
              selectedAt: new Date(),
              timerStartTime: new Date(),
              timerActive: true,
            });

            // Set up config with no permissions for moderator
            await configManager.updateGiveawayPermissions(guildId, [], []);

            // Attempt manual reroll should fail
            await expect(
              confirmationSystem.manualReroll(giveawayId, userId, moderatorId)
            ).rejects.toThrow('Insufficient permissions');

            // Verify winner status unchanged
            const winner = await winnerStateRepo.getWinner(giveawayId, userId);
            expect(winner?.status).toBe(WinnerStatus.PENDING);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 16: Manual Reroll State Transition
   * **Validates: Requirements 5.2**
   * 
   * For any manual reroll request, the specified winner's status
   * should transition to REROLLED.
   */
  describe('Property 16: Manual Reroll State Transition', () => {
    it('should transition winner to REROLLED on manual reroll', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (giveawayId) => {
            const channelId = `channel-${testCounter++}`;
            const guildId = `guild-${testCounter++}`;
            const userId = `user-${testCounter++}`;
            const moderatorId = `mod-${testCounter++}`;
            
            // Create test giveaway
            await giveawayRepo.save({
              id: giveawayId,
              guildId,
              title: 'Test Giveaway',
              description: 'Test',
              channelId,
              messageId: '123',
              requiredRoles: [],
              winnerCount: 1,
              status: GiveawayStatus.ACTIVE,
              endsAt: new Date(Date.now() + 3600000),
              createdAt: new Date(),
              entries: [],
            });

            // Create pending winner
            await winnerStateRepo.createWinner({
              giveawayId,
              userId,
              status: WinnerStatus.PENDING,
              selectedAt: new Date(),
              timerStartTime: new Date(),
              timerActive: true,
            });

            // Grant permissions to moderator
            await configManager.updateGiveawayPermissions(guildId, [], [moderatorId]);

            // Execute manual reroll
            await confirmationSystem.manualReroll(giveawayId, userId, moderatorId);

            // Verify winner status changed to REROLLED
            const winner = await winnerStateRepo.getWinner(giveawayId, userId);
            expect(winner?.status).toBe(WinnerStatus.REROLLED);
            expect(winner?.timerActive).toBe(false);
            expect(winner?.rerolledAt).toBeDefined();
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
