/**
 * @file reroll-winner-selection.property.test.ts
 * @description Property-based tests for RerollHandler eligibility filtering
 * Feature: giveaway-winner-confirmation
 * Property 13: Reroll Winner Selection
 * @module tests/property
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { createPool, closePool } from '@/core/database/pool.js';
import { runMigrations } from '@/core/database/migrator.js';
import { WinnerStateRepository } from '@/core/database/repositories/WinnerStateRepository.js';
import { GiveawayRepository } from '@/core/database/repositories/GiveawayRepository.js';
import { RerollHandler } from '@/giveaway/reroll-handler.js';
import { WinnerStatus, GiveawayStatus } from '@/types/models.js';

// Skip tests if database is not available
const skipDatabaseTests = 
  process.env.SKIP_DB_TESTS === 'true' || 
  process.env.CI === 'true' ||
  (process.env.NODE_ENV === 'test' && process.env.DATABASE_URL?.includes('localhost'));

describe.skipIf(skipDatabaseTests)('RerollHandler - Reroll Winner Selection Property Tests', () => {
  let pool: Pool;
  let winnerRepo: WinnerStateRepository;
  let giveawayRepo: GiveawayRepository;
  let rerollHandler: RerollHandler;

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

    winnerRepo = new WinnerStateRepository(pool);
    giveawayRepo = new GiveawayRepository(pool);
    rerollHandler = new RerollHandler(giveawayRepo, winnerRepo);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await pool.query('DELETE FROM giveaway_winners');
    await pool.query('DELETE FROM giveaways');
  });

  /**
   * Property 13: Reroll Winner Selection
   * **Validates: Requirements 4.3, 4.7, 5.4, 7.6**
   * 
   * For any rerolled winner, a new winner should be selected from the pool of 
   * eligible participants (excluding all users with any winner state for that giveaway).
   */
  describe('Property 13: Reroll Winner Selection', () => {
    it('should exclude all users with PENDING status from reroll selection', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate array of user IDs (participants)
          fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 3, maxLength: 20 }),
          // Generate number of pending winners (at least 1, less than total participants)
          fc.integer({ min: 1, max: 5 }),
          async (userIdNumbers, pendingCount) => {
            // Ensure we have enough participants
            fc.pre(userIdNumbers.length > pendingCount);
            
            // Create unique user IDs
            const uniqueUserIds = [...new Set(userIdNumbers.map(n => `user-${n}`))];
            fc.pre(uniqueUserIds.length > pendingCount);

            const giveawayId = randomUUID();

            // Create giveaway
            await giveawayRepo.save({
              id: giveawayId,
              title: 'Test Giveaway',
              description: 'Test',
              channelId: 'channel-1',
              messageId: 'message-1',
              requiredRoles: [],
              winnerCount: pendingCount,
              entries: [],
              status: GiveawayStatus.ACTIVE,
              endsAt: new Date(Date.now() + 3600000),
              createdAt: new Date(),
            });

            // Add entries
            for (const userId of uniqueUserIds) {
              await giveawayRepo.addEntry(giveawayId, userId);
            }

            // Select some users as PENDING winners
            const pendingWinners = uniqueUserIds.slice(0, pendingCount);
            for (const userId of pendingWinners) {
              await winnerRepo.createWinner({
                giveawayId,
                userId,
                status: WinnerStatus.PENDING,
                selectedAt: new Date(),
                timerStartTime: new Date(),
                timerActive: true,
              });
            }

            // Get eligible participants
            const eligible = await rerollHandler.getEligibleParticipants(giveawayId);

            // Verify no PENDING winners are in eligible list
            for (const pendingWinner of pendingWinners) {
              expect(eligible).not.toContain(pendingWinner);
            }

            // Verify all non-winners are eligible
            const nonWinners = uniqueUserIds.slice(pendingCount);
            for (const nonWinner of nonWinners) {
              expect(eligible).toContain(nonWinner);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should exclude all users with CONFIRMED status from reroll selection', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 3, maxLength: 20 }),
          fc.integer({ min: 1, max: 5 }),
          async (userIdNumbers, confirmedCount) => {
            fc.pre(userIdNumbers.length > confirmedCount);
            
            const uniqueUserIds = [...new Set(userIdNumbers.map(n => `user-${n}`))];
            fc.pre(uniqueUserIds.length > confirmedCount);

            const giveawayId = randomUUID();

            await giveawayRepo.save({
              id: giveawayId,
              title: 'Test Giveaway',
              description: 'Test',
              channelId: 'channel-1',
              messageId: 'message-1',
              requiredRoles: [],
              winnerCount: confirmedCount,
              entries: [],
              status: GiveawayStatus.ACTIVE,
              endsAt: new Date(Date.now() + 3600000),
              createdAt: new Date(),
            });

            for (const userId of uniqueUserIds) {
              await giveawayRepo.addEntry(giveawayId, userId);
            }

            // Select some users as CONFIRMED winners
            const confirmedWinners = uniqueUserIds.slice(0, confirmedCount);
            for (const userId of confirmedWinners) {
              await winnerRepo.createWinner({
                giveawayId,
                userId,
                status: WinnerStatus.PENDING,
                selectedAt: new Date(),
                timerStartTime: new Date(),
                timerActive: true,
              });
              
              // Transition to CONFIRMED
              await winnerRepo.updateStatus(giveawayId, userId, WinnerStatus.CONFIRMED);
            }

            // Get eligible participants
            const eligible = await rerollHandler.getEligibleParticipants(giveawayId);

            // Verify no CONFIRMED winners are in eligible list
            for (const confirmedWinner of confirmedWinners) {
              expect(eligible).not.toContain(confirmedWinner);
            }

            // Verify all non-winners are eligible
            const nonWinners = uniqueUserIds.slice(confirmedCount);
            for (const nonWinner of nonWinners) {
              expect(eligible).toContain(nonWinner);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should exclude all users with REROLLED status from reroll selection', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 3, maxLength: 20 }),
          fc.integer({ min: 1, max: 5 }),
          async (userIdNumbers, rerolledCount) => {
            fc.pre(userIdNumbers.length > rerolledCount);
            
            const uniqueUserIds = [...new Set(userIdNumbers.map(n => `user-${n}`))];
            fc.pre(uniqueUserIds.length > rerolledCount);

            const giveawayId = randomUUID();

            await giveawayRepo.save({
              id: giveawayId,
              title: 'Test Giveaway',
              description: 'Test',
              channelId: 'channel-1',
              messageId: 'message-1',
              requiredRoles: [],
              winnerCount: rerolledCount,
              entries: [],
              status: GiveawayStatus.ACTIVE,
              endsAt: new Date(Date.now() + 3600000),
              createdAt: new Date(),
            });

            for (const userId of uniqueUserIds) {
              await giveawayRepo.addEntry(giveawayId, userId);
            }

            // Select some users as REROLLED winners
            const rerolledWinners = uniqueUserIds.slice(0, rerolledCount);
            for (const userId of rerolledWinners) {
              await winnerRepo.createWinner({
                giveawayId,
                userId,
                status: WinnerStatus.PENDING,
                selectedAt: new Date(),
                timerStartTime: new Date(),
                timerActive: true,
              });
              
              // Transition to REROLLED
              await winnerRepo.updateStatus(giveawayId, userId, WinnerStatus.REROLLED);
            }

            // Get eligible participants
            const eligible = await rerollHandler.getEligibleParticipants(giveawayId);

            // Verify no REROLLED winners are in eligible list
            for (const rerolledWinner of rerolledWinners) {
              expect(eligible).not.toContain(rerolledWinner);
            }

            // Verify all non-winners are eligible
            const nonWinners = uniqueUserIds.slice(rerolledCount);
            for (const nonWinner of nonWinners) {
              expect(eligible).toContain(nonWinner);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should exclude all users with ANY winner state (mixed statuses)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 10, maxLength: 30 }),
          fc.integer({ min: 1, max: 3 }), // pending count
          fc.integer({ min: 1, max: 3 }), // confirmed count
          fc.integer({ min: 1, max: 3 }), // rerolled count
          async (userIdNumbers, pendingCount, confirmedCount, rerolledCount) => {
            const totalWinners = pendingCount + confirmedCount + rerolledCount;
            fc.pre(userIdNumbers.length > totalWinners);
            
            const uniqueUserIds = [...new Set(userIdNumbers.map(n => `user-${n}`))];
            fc.pre(uniqueUserIds.length > totalWinners);

            const giveawayId = randomUUID();

            await giveawayRepo.save({
              id: giveawayId,
              title: 'Test Giveaway',
              description: 'Test',
              channelId: 'channel-1',
              messageId: 'message-1',
              requiredRoles: [],
              winnerCount: totalWinners,
              entries: [],
              status: GiveawayStatus.ACTIVE,
              endsAt: new Date(Date.now() + 3600000),
              createdAt: new Date(),
            });

            for (const userId of uniqueUserIds) {
              await giveawayRepo.addEntry(giveawayId, userId);
            }

            let offset = 0;
            const allWinners: string[] = [];

            // Create PENDING winners
            const pendingWinners = uniqueUserIds.slice(offset, offset + pendingCount);
            offset += pendingCount;
            for (const userId of pendingWinners) {
              await winnerRepo.createWinner({
                giveawayId,
                userId,
                status: WinnerStatus.PENDING,
                selectedAt: new Date(),
                timerStartTime: new Date(),
                timerActive: true,
              });
              allWinners.push(userId);
            }

            // Create CONFIRMED winners
            const confirmedWinners = uniqueUserIds.slice(offset, offset + confirmedCount);
            offset += confirmedCount;
            for (const userId of confirmedWinners) {
              await winnerRepo.createWinner({
                giveawayId,
                userId,
                status: WinnerStatus.PENDING,
                selectedAt: new Date(),
                timerStartTime: new Date(),
                timerActive: true,
              });
              await winnerRepo.updateStatus(giveawayId, userId, WinnerStatus.CONFIRMED);
              allWinners.push(userId);
            }

            // Create REROLLED winners
            const rerolledWinners = uniqueUserIds.slice(offset, offset + rerolledCount);
            offset += rerolledCount;
            for (const userId of rerolledWinners) {
              await winnerRepo.createWinner({
                giveawayId,
                userId,
                status: WinnerStatus.PENDING,
                selectedAt: new Date(),
                timerStartTime: new Date(),
                timerActive: true,
              });
              await winnerRepo.updateStatus(giveawayId, userId, WinnerStatus.REROLLED);
              allWinners.push(userId);
            }

            // Get eligible participants
            const eligible = await rerollHandler.getEligibleParticipants(giveawayId);

            // Verify NO winners (regardless of status) are in eligible list
            for (const winner of allWinners) {
              expect(eligible).not.toContain(winner);
            }

            // Verify all non-winners are eligible
            const nonWinners = uniqueUserIds.slice(offset);
            expect(eligible.length).toBe(nonWinners.length);
            for (const nonWinner of nonWinners) {
              expect(eligible).toContain(nonWinner);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return new winner from eligible pool when rerolling', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 5, maxLength: 20 }),
          fc.integer({ min: 1, max: 3 }),
          async (userIdNumbers, existingWinnerCount) => {
            fc.pre(userIdNumbers.length > existingWinnerCount);
            
            const uniqueUserIds = [...new Set(userIdNumbers.map(n => `user-${n}`))];
            fc.pre(uniqueUserIds.length > existingWinnerCount);

            const giveawayId = randomUUID();

            await giveawayRepo.save({
              id: giveawayId,
              title: 'Test Giveaway',
              description: 'Test',
              channelId: 'channel-1',
              messageId: 'message-1',
              requiredRoles: [],
              winnerCount: existingWinnerCount + 1,
              entries: [],
              status: GiveawayStatus.ACTIVE,
              endsAt: new Date(Date.now() + 3600000),
              createdAt: new Date(),
            });

            for (const userId of uniqueUserIds) {
              await giveawayRepo.addEntry(giveawayId, userId);
            }

            // Create some existing winners with various statuses
            const existingWinners = uniqueUserIds.slice(0, existingWinnerCount);
            for (let i = 0; i < existingWinners.length; i++) {
              const userId = existingWinners[i];
              await winnerRepo.createWinner({
                giveawayId,
                userId,
                status: WinnerStatus.PENDING,
                selectedAt: new Date(),
                timerStartTime: new Date(),
                timerActive: true,
              });
              
              // Randomly assign final status
              if (i % 3 === 0) {
                await winnerRepo.updateStatus(giveawayId, userId, WinnerStatus.CONFIRMED);
              } else if (i % 3 === 1) {
                await winnerRepo.updateStatus(giveawayId, userId, WinnerStatus.REROLLED);
              }
              // else leave as PENDING
            }

            // Perform reroll
            const newWinner = await rerollHandler.rerollWinner(giveawayId);

            // Verify new winner is selected
            expect(newWinner).not.toBeNull();
            
            // Verify new winner is NOT one of the existing winners
            expect(existingWinners).not.toContain(newWinner);
            
            // Verify new winner is from the eligible pool
            const eligiblePool = uniqueUserIds.slice(existingWinnerCount);
            expect(eligiblePool).toContain(newWinner);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null when all participants have winner states', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 2, maxLength: 10 }),
          async (userIdNumbers) => {
            const uniqueUserIds = [...new Set(userIdNumbers.map(n => `user-${n}`))];
            fc.pre(uniqueUserIds.length >= 2);

            const giveawayId = randomUUID();

            await giveawayRepo.save({
              id: giveawayId,
              title: 'Test Giveaway',
              description: 'Test',
              channelId: 'channel-1',
              messageId: 'message-1',
              requiredRoles: [],
              winnerCount: uniqueUserIds.length,
              entries: [],
              status: GiveawayStatus.ACTIVE,
              endsAt: new Date(Date.now() + 3600000),
              createdAt: new Date(),
            });

            for (const userId of uniqueUserIds) {
              await giveawayRepo.addEntry(giveawayId, userId);
            }

            // Make ALL participants winners with various statuses
            for (let i = 0; i < uniqueUserIds.length; i++) {
              const userId = uniqueUserIds[i];
              await winnerRepo.createWinner({
                giveawayId,
                userId,
                status: WinnerStatus.PENDING,
                selectedAt: new Date(),
                timerStartTime: new Date(),
                timerActive: true,
              });
              
              // Assign various final statuses
              if (i % 3 === 0) {
                await winnerRepo.updateStatus(giveawayId, userId, WinnerStatus.CONFIRMED);
              } else if (i % 3 === 1) {
                await winnerRepo.updateStatus(giveawayId, userId, WinnerStatus.REROLLED);
              }
              // else leave as PENDING
            }

            // Attempt reroll - should return null
            const newWinner = await rerollHandler.rerollWinner(giveawayId);

            expect(newWinner).toBeNull();

            // Verify eligible participants is empty
            const eligible = await rerollHandler.getEligibleParticipants(giveawayId);
            expect(eligible).toEqual([]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should consistently exclude winners across multiple reroll attempts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 10, maxLength: 30 }),
          fc.integer({ min: 2, max: 5 }),
          async (userIdNumbers, rerollCount) => {
            const uniqueUserIds = [...new Set(userIdNumbers.map(n => `user-${n}`))];
            fc.pre(uniqueUserIds.length > rerollCount * 2);

            const giveawayId = randomUUID();

            await giveawayRepo.save({
              id: giveawayId,
              title: 'Test Giveaway',
              description: 'Test',
              channelId: 'channel-1',
              messageId: 'message-1',
              requiredRoles: [],
              winnerCount: rerollCount,
              entries: [],
              status: GiveawayStatus.ACTIVE,
              endsAt: new Date(Date.now() + 3600000),
              createdAt: new Date(),
            });

            for (const userId of uniqueUserIds) {
              await giveawayRepo.addEntry(giveawayId, userId);
            }

            const allSelectedWinners: string[] = [];

            // Perform multiple rerolls
            for (let i = 0; i < rerollCount; i++) {
              const newWinner = await rerollHandler.rerollWinner(giveawayId);
              
              expect(newWinner).not.toBeNull();
              
              // Verify new winner hasn't been selected before
              expect(allSelectedWinners).not.toContain(newWinner);
              
              allSelectedWinners.push(newWinner!);
              
              // Add winner to database with PENDING status
              await winnerRepo.createWinner({
                giveawayId,
                userId: newWinner!,
                status: WinnerStatus.PENDING,
                selectedAt: new Date(),
                timerStartTime: new Date(),
                timerActive: true,
              });
            }

            // Verify all selected winners are unique
            const uniqueWinners = new Set(allSelectedWinners);
            expect(uniqueWinners.size).toBe(rerollCount);

            // Verify eligible pool shrinks correctly
            const finalEligible = await rerollHandler.getEligibleParticipants(giveawayId);
            expect(finalEligible.length).toBe(uniqueUserIds.length - rerollCount);
            
            // Verify no selected winners are in final eligible pool
            for (const winner of allSelectedWinners) {
              expect(finalEligible).not.toContain(winner);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
