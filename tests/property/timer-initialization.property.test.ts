/**
 * @file timer-initialization.property.test.ts
 * @description Property-based tests for TimerManager initialization
 * Feature: giveaway-winner-confirmation
 * @module tests/property
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { TimerManager, TimerCallbacks } from '@/giveaway/timer-manager.js';

describe('TimerManager - Timer Initialization Property Tests', () => {
  let timerManager: TimerManager;
  let mockCallbacks: TimerCallbacks;

  beforeEach(() => {
    // Use fake timers for deterministic testing
    vi.useFakeTimers();

    mockCallbacks = {
      onReminder: vi.fn(async () => {}),
      onExpiry: vi.fn(async () => {}),
    };

    timerManager = new TimerManager(mockCallbacks);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /**
   * Property 3: Timer Initialization
   * **Validates: Requirements 1.3, 4.5**
   * 
   * For any winner with PENDING status, a Confirmation_Timer should be 
   * active and tracked by the Timer Manager.
   */
  describe('Property 3: Timer Initialization', () => {
    it('should initialize and track timers for any pending winner', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.date({ min: new Date('2024-01-01'), max: new Date() }),
          async (giveawayId, userId, startTime) => {
            // Start timers for a pending winner
            timerManager.startTimers(giveawayId, userId, startTime);

            // Verify timer is active and tracked
            expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should track timers independently for different winners', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 10 }),
          fc.date({ min: new Date('2024-01-01'), max: new Date() }),
          async (giveawayId, userIds, startTime) => {
            // Remove duplicates
            const uniqueUserIds = [...new Set(userIds)];
            
            // Start timers for multiple winners
            for (const userId of uniqueUserIds) {
              timerManager.startTimers(giveawayId, userId, startTime);
            }

            // Verify all timers are tracked independently
            for (const userId of uniqueUserIds) {
              expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should track timers independently across different giveaways', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.date({ min: new Date('2024-01-01'), max: new Date() }),
          async (giveawayIds, userId, startTime) => {
            // Remove duplicates
            const uniqueGiveawayIds = [...new Set(giveawayIds)];
            
            // Start timers for same user across multiple giveaways
            for (const giveawayId of uniqueGiveawayIds) {
              timerManager.startTimers(giveawayId, userId, startTime);
            }

            // Verify all timers are tracked independently
            for (const giveawayId of uniqueGiveawayIds) {
              expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain timer tracking after reminder callback', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          async (giveawayId, userId) => {
            const startTime = new Date();
            
            // Start timers
            timerManager.startTimers(giveawayId, userId, startTime);

            // Verify timer is tracked
            expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(true);

            // Fast-forward to reminder time (2 minutes)
            await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

            // Timer should still be tracked after reminder
            expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should stop tracking timers after expiry callback', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          async (giveawayId, userId) => {
            const startTime = new Date();
            
            // Start timers
            timerManager.startTimers(giveawayId, userId, startTime);

            // Verify timer is tracked
            expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(true);

            // Fast-forward to expiry time (5 minutes)
            await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

            // Timer should no longer be tracked after expiry
            expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should stop tracking timers when explicitly stopped', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.date({ min: new Date('2024-01-01'), max: new Date() }),
          async (giveawayId, userId, startTime) => {
            // Start timers
            timerManager.startTimers(giveawayId, userId, startTime);

            // Verify timer is tracked
            expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(true);

            // Stop timers
            timerManager.stopTimers(giveawayId, userId);

            // Timer should no longer be tracked
            expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should restore and track timers for pending winners on restart', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              giveawayId: fc.uuid(),
              userId: fc.string({ minLength: 1, maxLength: 20 }),
              timerStartTime: fc.date({ min: new Date('2024-01-01'), max: new Date() }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (activeWinners) => {
            // Remove duplicates based on giveawayId:userId combination
            const uniqueWinners = activeWinners.filter((winner, index, self) =>
              index === self.findIndex(w => 
                w.giveawayId === winner.giveawayId && w.userId === winner.userId
              )
            );

            // Restore timers (simulating system restart)
            timerManager.restoreTimers(uniqueWinners);

            // Verify all timers are tracked after restoration
            for (const winner of uniqueWinners) {
              // Only check if timer hasn't expired (< 5 minutes elapsed)
              const elapsed = Date.now() - winner.timerStartTime.getTime();
              if (elapsed < 5 * 60 * 1000) {
                expect(timerManager.hasActiveTimers(winner.giveawayId, winner.userId)).toBe(true);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle timer initialization with various elapsed times', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 0, max: 10 * 60 * 1000 }), // 0-10 minutes elapsed
          async (giveawayId, userId, elapsedMs) => {
            // Create start time in the past
            const startTime = new Date(Date.now() - elapsedMs);
            
            // Start timers
            timerManager.startTimers(giveawayId, userId, startTime);

            // If elapsed < 5 minutes, timer should be tracked
            if (elapsedMs < 5 * 60 * 1000) {
              expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(true);
            } else {
              // If elapsed >= 5 minutes, expiry should trigger immediately
              // Run immediate callbacks
              await vi.runAllTimersAsync();
              
              // Timer should no longer be tracked after immediate expiry
              expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should replace existing timers when reinitialized for same winner', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.date({ min: new Date('2024-01-01'), max: new Date() }),
          fc.date({ min: new Date('2024-01-01'), max: new Date() }),
          async (giveawayId, userId, startTime1, startTime2) => {
            // Start timers first time
            timerManager.startTimers(giveawayId, userId, startTime1);
            expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(true);

            // Start timers again (should replace)
            timerManager.startTimers(giveawayId, userId, startTime2);
            
            // Timer should still be tracked
            expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not track timers for winners that were never initialized', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          async (giveawayId, userId) => {
            // Check timer status without initializing
            expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
