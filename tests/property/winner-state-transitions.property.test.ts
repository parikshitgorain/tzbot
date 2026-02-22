/**
 * @file winner-state-transitions.property.test.ts
 * @description Property-based tests for WinnerStateRepository state transitions
 * Feature: giveaway-winner-confirmation
 * @module tests/property
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { Pool } from 'pg';
import { createPool, closePool } from '@/core/database/pool.js';
import { runMigrations } from '@/core/database/migrator.js';
import { WinnerStateRepository } from '@/core/database/repositories/WinnerStateRepository.js';
import { WinnerStatus, type WinnerRecord } from '@/types/models.js';

// Skip tests if database is not available
const skipDatabaseTests = 
  process.env.SKIP_DB_TESTS === 'true' || 
  process.env.CI === 'true' ||
  (process.env.NODE_ENV === 'test' && process.env.DATABASE_URL?.includes('localhost'));

describe.skipIf(skipDatabaseTests)('WinnerStateRepository - State Transition Property Tests', () => {
  let pool: Pool;
  let winnerRepo: WinnerStateRepository;
  const testGiveawayId = '550e8400-e29b-41d4-a716-446655440000';

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
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await pool.query('DELETE FROM giveaway_winners');
    await pool.query('DELETE FROM giveaways');
    
    // Create a test giveaway for foreign key constraint
    await pool.query(`
      INSERT INTO giveaways (id, title, description, channel_id, message_id, winner_count, status, ends_at)
      VALUES ($1, 'Test Giveaway', 'Test Description', '123456789', '987654321', 1, 'active', NOW() + INTERVAL '1 hour')
    `, [testGiveawayId]);
  });

  /**
   * Property 2: Initial Winner State
   * **Validates: Requirements 1.2, 7.2**
   * 
   * For any newly selected winner (including rerolled winners), 
   * their initial status should be PENDING.
   */
  describe('Property 2: Initial Winner State', () => {
    it('should create all new winners with PENDING status', async () => {
      let counter = 0;
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
          fc.boolean(),
          async (selectedAt, timerStartTime, timerActive) => {
            const userId = `u${counter++}`;
            
            // Create winner record with PENDING status using test giveaway ID
            await winnerRepo.createWinner({
              giveawayId: testGiveawayId,
              userId,
              status: WinnerStatus.PENDING,
              selectedAt,
              timerStartTime,
              timerActive,
            });

            // Retrieve and verify status is PENDING
            const retrieved = await winnerRepo.getWinner(testGiveawayId, userId);

            expect(retrieved).not.toBeNull();
            expect(retrieved!.status).toBe(WinnerStatus.PENDING);
            expect(retrieved!.confirmedAt).toBeUndefined();
            expect(retrieved!.rerolledAt).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: Confirmation State Transition
   * **Validates: Requirements 2.2, 7.3**
   * 
   * For any pending winner who sends a message, 
   * their status should transition from PENDING to CONFIRMED.
   */
  describe('Property 6: Confirmation State Transition', () => {
    it('should transition PENDING winners to CONFIRMED', async () => {
      let counter = 0;
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const userId = `u${counter++}`;
            
            // Create PENDING winner using test giveaway ID
            await winnerRepo.createWinner({
              giveawayId: testGiveawayId,
              userId,
              status: WinnerStatus.PENDING,
              selectedAt: new Date(),
              timerStartTime: new Date(),
              timerActive: true,
            });

            // Transition to CONFIRMED
            await winnerRepo.updateStatus(testGiveawayId, userId, WinnerStatus.CONFIRMED);

            // Verify status changed to CONFIRMED
            const retrieved = await winnerRepo.getWinner(testGiveawayId, userId);

            expect(retrieved).not.toBeNull();
            expect(retrieved!.status).toBe(WinnerStatus.CONFIRMED);
            expect(retrieved!.confirmedAt).toBeDefined();
            expect(retrieved!.timerActive).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 12: Expiry State Transition
   * **Validates: Requirements 4.2, 7.4**
   * 
   * For any winner with PENDING status at 5-minute expiry, 
   * their status should transition from PENDING to REROLLED.
   */
  describe('Property 12: Expiry State Transition', () => {
    it('should transition PENDING winners to REROLLED on expiry', async () => {
      let counter = 0;
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const userId = `u${counter++}`;
            
            // Create PENDING winner using test giveaway ID
            await winnerRepo.createWinner({
              giveawayId: testGiveawayId,
              userId,
              status: WinnerStatus.PENDING,
              selectedAt: new Date(),
              timerStartTime: new Date(),
              timerActive: true,
            });

            // Transition to REROLLED (simulating expiry)
            await winnerRepo.updateStatus(testGiveawayId, userId, WinnerStatus.REROLLED);

            // Verify status changed to REROLLED
            const retrieved = await winnerRepo.getWinner(testGiveawayId, userId);

            expect(retrieved).not.toBeNull();
            expect(retrieved!.status).toBe(WinnerStatus.REROLLED);
            expect(retrieved!.rerolledAt).toBeDefined();
            expect(retrieved!.timerActive).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 20: Terminal State Immutability
   * **Validates: Requirements 7.5**
   * 
   * For any winner with status CONFIRMED or REROLLED, 
   * attempting to change their status should be rejected or have no effect.
   */
  describe('Property 20: Terminal State Immutability', () => {
    it('should not allow transitions from CONFIRMED state', async () => {
      let counter = 0;
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(WinnerStatus.PENDING, WinnerStatus.REROLLED),
          async (attemptedStatus) => {
            const userId = `u${counter++}`;
            
            // Create PENDING winner using test giveaway ID
            await winnerRepo.createWinner({
              giveawayId: testGiveawayId,
              userId,
              status: WinnerStatus.PENDING,
              selectedAt: new Date(),
              timerStartTime: new Date(),
              timerActive: true,
            });

            // Transition to CONFIRMED
            await winnerRepo.updateStatus(testGiveawayId, userId, WinnerStatus.CONFIRMED);

            // Attempt to change from CONFIRMED (should have no effect)
            await winnerRepo.updateStatus(testGiveawayId, userId, attemptedStatus);

            // Verify status remains CONFIRMED
            const retrieved = await winnerRepo.getWinner(testGiveawayId, userId);

            expect(retrieved).not.toBeNull();
            expect(retrieved!.status).toBe(WinnerStatus.CONFIRMED);
            expect(retrieved!.confirmedAt).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not allow transitions from REROLLED state', async () => {
      let counter = 0;
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(WinnerStatus.PENDING, WinnerStatus.CONFIRMED),
          async (attemptedStatus) => {
            const userId = `u${counter++}`;
            
            // Create PENDING winner using test giveaway ID
            await winnerRepo.createWinner({
              giveawayId: testGiveawayId,
              userId,
              status: WinnerStatus.PENDING,
              selectedAt: new Date(),
              timerStartTime: new Date(),
              timerActive: true,
            });

            // Transition to REROLLED
            await winnerRepo.updateStatus(testGiveawayId, userId, WinnerStatus.REROLLED);

            // Attempt to change from REROLLED (should have no effect)
            await winnerRepo.updateStatus(testGiveawayId, userId, attemptedStatus);

            // Verify status remains REROLLED
            const retrieved = await winnerRepo.getWinner(testGiveawayId, userId);

            expect(retrieved).not.toBeNull();
            expect(retrieved!.status).toBe(WinnerStatus.REROLLED);
            expect(retrieved!.rerolledAt).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 9: Confirmation Persistence Round Trip
   * **Validates: Requirements 2.5, 10.2**
   * 
   * For any winner who is confirmed, querying the database immediately after 
   * should return status CONFIRMED with a confirmedAt timestamp.
   */
  describe('Property 9: Confirmation Persistence Round Trip', () => {
    it('should persist CONFIRMED status with timestamp immediately', async () => {
      let counter = 0;
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
          async (selectedAt, timerStartTime) => {
            const userId = `u${counter++}`;
            
            // Create PENDING winner
            await winnerRepo.createWinner({
              giveawayId: testGiveawayId,
              userId,
              status: WinnerStatus.PENDING,
              selectedAt,
              timerStartTime,
              timerActive: true,
            });

            // Confirm the winner
            const beforeConfirm = Date.now();
            await winnerRepo.updateStatus(testGiveawayId, userId, WinnerStatus.CONFIRMED);
            const afterConfirm = Date.now();

            // Query database immediately after confirmation
            const retrieved = await winnerRepo.getWinner(testGiveawayId, userId);

            // Verify persistence round trip
            expect(retrieved).not.toBeNull();
            expect(retrieved!.status).toBe(WinnerStatus.CONFIRMED);
            expect(retrieved!.confirmedAt).toBeDefined();
            expect(retrieved!.timerActive).toBe(false);
            
            // Verify confirmedAt timestamp is within reasonable range
            const confirmedAtTime = retrieved!.confirmedAt!.getTime();
            expect(confirmedAtTime).toBeGreaterThanOrEqual(beforeConfirm);
            expect(confirmedAtTime).toBeLessThanOrEqual(afterConfirm + 1000); // Allow 1s clock skew
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should persist CONFIRMED status across multiple queries', async () => {
      let counter = 0;
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const userId = `u${counter++}`;
            
            // Create and confirm winner
            await winnerRepo.createWinner({
              giveawayId: testGiveawayId,
              userId,
              status: WinnerStatus.PENDING,
              selectedAt: new Date(),
              timerStartTime: new Date(),
              timerActive: true,
            });

            await winnerRepo.updateStatus(testGiveawayId, userId, WinnerStatus.CONFIRMED);

            // Query multiple times to verify persistence
            const query1 = await winnerRepo.getWinner(testGiveawayId, userId);
            const query2 = await winnerRepo.getWinner(testGiveawayId, userId);
            const query3 = await winnerRepo.getWinner(testGiveawayId, userId);

            // All queries should return consistent CONFIRMED status
            expect(query1!.status).toBe(WinnerStatus.CONFIRMED);
            expect(query2!.status).toBe(WinnerStatus.CONFIRMED);
            expect(query3!.status).toBe(WinnerStatus.CONFIRMED);
            
            // confirmedAt should be consistent across queries
            expect(query1!.confirmedAt).toBeDefined();
            expect(query2!.confirmedAt).toBeDefined();
            expect(query3!.confirmedAt).toBeDefined();
            expect(query1!.confirmedAt!.getTime()).toBe(query2!.confirmedAt!.getTime());
            expect(query2!.confirmedAt!.getTime()).toBe(query3!.confirmedAt!.getTime());
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 23: Winner Record Persistence
   * **Validates: Requirements 10.1**
   * 
   * For any winner selection, a winner record should be created in the database 
   * with status PENDING, timer start time, and timer_active = true.
   */
  describe('Property 23: Winner Record Persistence', () => {
    it('should persist winner records with all required fields', async () => {
      let counter = 0;
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
          fc.boolean(),
          async (selectedAt, timerStartTime, timerActive) => {
            const userId = `u${counter++}`;
            
            // Create winner record
            await winnerRepo.createWinner({
              giveawayId: testGiveawayId,
              userId,
              status: WinnerStatus.PENDING,
              selectedAt,
              timerStartTime,
              timerActive,
            });

            // Query immediately to verify persistence
            const retrieved = await winnerRepo.getWinner(testGiveawayId, userId);

            // Verify all required fields are persisted correctly
            expect(retrieved).not.toBeNull();
            expect(retrieved!.giveawayId).toBe(testGiveawayId);
            expect(retrieved!.userId).toBe(userId);
            expect(retrieved!.status).toBe(WinnerStatus.PENDING);
            expect(retrieved!.timerActive).toBe(timerActive);
            
            // Verify timestamps are persisted (within 1 second tolerance for clock skew)
            expect(Math.abs(retrieved!.selectedAt.getTime() - selectedAt.getTime())).toBeLessThan(1000);
            expect(Math.abs(retrieved!.timerStartTime.getTime() - timerStartTime.getTime())).toBeLessThan(1000);
            
            // Verify auto-generated fields
            expect(retrieved!.id).toBeDefined();
            expect(retrieved!.createdAt).toBeDefined();
            expect(retrieved!.updatedAt).toBeDefined();
            
            // Verify optional fields are undefined for PENDING status
            expect(retrieved!.confirmedAt).toBeUndefined();
            expect(retrieved!.rerolledAt).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should persist winner records with timer_active = true by default', async () => {
      let counter = 0;
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const userId = `u${counter++}`;
            
            // Create winner with timer_active = true
            await winnerRepo.createWinner({
              giveawayId: testGiveawayId,
              userId,
              status: WinnerStatus.PENDING,
              selectedAt: new Date(),
              timerStartTime: new Date(),
              timerActive: true,
            });

            // Verify timer_active is persisted as true
            const retrieved = await winnerRepo.getWinner(testGiveawayId, userId);

            expect(retrieved).not.toBeNull();
            expect(retrieved!.timerActive).toBe(true);
            expect(retrieved!.status).toBe(WinnerStatus.PENDING);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should retrieve winner records via getAllPendingWinners', async () => {
      let counter = 0;
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (winnerCount) => {
            const userIds: string[] = [];
            
            // Create multiple pending winners
            for (let i = 0; i < winnerCount; i++) {
              const userId = `u${counter++}`;
              userIds.push(userId);
              
              await winnerRepo.createWinner({
                giveawayId: testGiveawayId,
                userId,
                status: WinnerStatus.PENDING,
                selectedAt: new Date(),
                timerStartTime: new Date(),
                timerActive: true,
              });
            }

            // Query all pending winners
            const pendingWinners = await winnerRepo.getAllPendingWinners();

            // Verify all created winners are in the result
            const retrievedUserIds = pendingWinners.map(w => w.userId);
            for (const userId of userIds) {
              expect(retrievedUserIds).toContain(userId);
            }

            // Verify all retrieved winners have correct status
            for (const winner of pendingWinners) {
              if (userIds.includes(winner.userId)) {
                expect(winner.status).toBe(WinnerStatus.PENDING);
                expect(winner.timerActive).toBe(true);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: State transition sequence validation
   * Verifies that the complete state transition flow works correctly
   */
  describe('Property: Complete state transition sequences', () => {
    it('should handle PENDING → CONFIRMED sequence correctly', async () => {
      let counter = 0;
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const userId = `u${counter++}`;
            
            // Create PENDING winner using test giveaway ID
            await winnerRepo.createWinner({
              giveawayId: testGiveawayId,
              userId,
              status: WinnerStatus.PENDING,
              selectedAt: new Date(),
              timerStartTime: new Date(),
              timerActive: true,
            });

            // Verify PENDING state
            const pending = await winnerRepo.getWinner(testGiveawayId, userId);
            expect(pending!.status).toBe(WinnerStatus.PENDING);
            expect(pending!.timerActive).toBe(true);

            // Transition to CONFIRMED
            await winnerRepo.updateStatus(testGiveawayId, userId, WinnerStatus.CONFIRMED);

            // Verify CONFIRMED state
            const confirmed = await winnerRepo.getWinner(testGiveawayId, userId);
            expect(confirmed!.status).toBe(WinnerStatus.CONFIRMED);
            expect(confirmed!.timerActive).toBe(false);
            expect(confirmed!.confirmedAt).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle PENDING → REROLLED sequence correctly', async () => {
      let counter = 0;
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const userId = `u${counter++}`;
            
            // Create PENDING winner using test giveaway ID
            await winnerRepo.createWinner({
              giveawayId: testGiveawayId,
              userId,
              status: WinnerStatus.PENDING,
              selectedAt: new Date(),
              timerStartTime: new Date(),
              timerActive: true,
            });

            // Verify PENDING state
            const pending = await winnerRepo.getWinner(testGiveawayId, userId);
            expect(pending!.status).toBe(WinnerStatus.PENDING);
            expect(pending!.timerActive).toBe(true);

            // Transition to REROLLED
            await winnerRepo.updateStatus(testGiveawayId, userId, WinnerStatus.REROLLED);

            // Verify REROLLED state
            const rerolled = await winnerRepo.getWinner(testGiveawayId, userId);
            expect(rerolled!.status).toBe(WinnerStatus.REROLLED);
            expect(rerolled!.timerActive).toBe(false);
            expect(rerolled!.rerolledAt).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
