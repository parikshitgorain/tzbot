/**
 * @file timer-restoration.property.test.ts
 * @description Property-based tests for TimerManager restoration on system restart
 * Feature: giveaway-winner-confirmation
 * @module tests/property
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { TimerManager, TimerCallbacks } from '../../src/giveaway/timer-manager.js';

describe('TimerManager - Timer Restoration Property Tests', () => {
  let timerManager: TimerManager;
  let mockCallbacks: TimerCallbacks;
  let reminderCalls: Array<{ giveawayId: string; userId: string }>;
  let expiryCalls: Array<{ giveawayId: string; userId: string }>;

  beforeEach(() => {
    // Use fake timers for deterministic testing
    vi.useFakeTimers();

    // Track callback invocations
    reminderCalls = [];
    expiryCalls = [];

    mockCallbacks = {
      onReminder: vi.fn(async (giveawayId: string, userId: string) => {
        reminderCalls.push({ giveawayId, userId });
      }),
      onExpiry: vi.fn(async (giveawayId: string, userId: string) => {
        expiryCalls.push({ giveawayId, userId });
      }),
    };

    timerManager = new TimerManager(mockCallbacks);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /**
   * Property 22: Timer Restoration on Restart
   * **Validates: Requirements 9.4, 10.4, 10.5**
   * 
   * For any pending winner with an active timer at system shutdown, 
   * restarting the system should restore the timer with correctly 
   * calculated remaining time.
   */
  describe('Property 22: Timer Restoration on Restart', () => {
    it('should restore timers with correct remaining time for any elapsed duration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 0, max: 4 * 60 * 1000 }), // 0-4 minutes elapsed (before expiry)
          async (giveawayId, userId, elapsedMs) => {
            // Create start time in the past
            const timerStartTime = new Date(Date.now() - elapsedMs);
            
            // Simulate system restart: restore timer
            timerManager.restoreTimers([{ giveawayId, userId, timerStartTime }]);

            // Timer should be tracked after restoration
            expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(true);

            // Calculate remaining time until reminder (2 minutes)
            const reminderRemainingMs = Math.max(0, 2 * 60 * 1000 - elapsedMs);
            
            // Calculate remaining time until expiry (5 minutes)
            const expiryRemainingMs = Math.max(0, 5 * 60 * 1000 - elapsedMs);

            // If reminder hasn't occurred yet, advance to reminder time
            if (reminderRemainingMs > 0) {
              await vi.advanceTimersByTimeAsync(reminderRemainingMs);
              
              // Reminder should have been called
              expect(reminderCalls.some(call => 
                call.giveawayId === giveawayId && call.userId === userId
              )).toBe(true);
            }

            // Advance to expiry time (from current position)
            const additionalTimeToExpiry = expiryRemainingMs - (reminderRemainingMs > 0 ? reminderRemainingMs : 0);
            if (additionalTimeToExpiry > 0) {
              await vi.advanceTimersByTimeAsync(additionalTimeToExpiry);
            }

            // Expiry should have been called
            expect(expiryCalls.some(call => 
              call.giveawayId === giveawayId && call.userId === userId
            )).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should skip reminder when elapsed time >= 2 minutes on restoration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 2 * 60 * 1000, max: 4 * 60 * 1000 }), // 2-4 minutes elapsed
          async (giveawayId, userId, elapsedMs) => {
            const timerStartTime = new Date(Date.now() - elapsedMs);
            
            // Restore timer
            timerManager.restoreTimers([{ giveawayId, userId, timerStartTime }]);

            // Calculate remaining time until expiry
            const expiryRemainingMs = 5 * 60 * 1000 - elapsedMs;

            // Advance to expiry
            await vi.advanceTimersByTimeAsync(expiryRemainingMs);

            // Reminder should NOT have been called (already past 2 minutes)
            expect(reminderCalls.some(call => 
              call.giveawayId === giveawayId && call.userId === userId
            )).toBe(false);

            // Expiry should have been called
            expect(expiryCalls.some(call => 
              call.giveawayId === giveawayId && call.userId === userId
            )).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should trigger expiry immediately when elapsed time >= 5 minutes on restoration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 5 * 60 * 1000, max: 10 * 60 * 1000 }), // 5-10 minutes elapsed
          async (giveawayId, userId, elapsedMs) => {
            const timerStartTime = new Date(Date.now() - elapsedMs);
            
            // Restore timer
            timerManager.restoreTimers([{ giveawayId, userId, timerStartTime }]);

            // Run all immediate callbacks
            await vi.runAllTimersAsync();

            // Expiry should have been triggered immediately
            expect(expiryCalls.some(call => 
              call.giveawayId === giveawayId && call.userId === userId
            )).toBe(true);

            // Reminder should NOT have been called
            expect(reminderCalls.some(call => 
              call.giveawayId === giveawayId && call.userId === userId
            )).toBe(false);

            // Timer should no longer be tracked after immediate expiry
            expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should restore multiple timers independently with different elapsed times', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.array(
            fc.record({
              userId: fc.string({ minLength: 1, maxLength: 20 }),
              elapsedMs: fc.integer({ min: 0, max: 4 * 60 * 1000 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (giveawayId, winners) => {
            // Remove duplicate userIds
            const uniqueWinners = winners.filter((winner, index, self) =>
              index === self.findIndex(w => w.userId === winner.userId)
            );

            if (uniqueWinners.length < 2) {
              // Skip if we don't have at least 2 unique winners
              return;
            }

            // Create winner records with different elapsed times
            const activeWinners = uniqueWinners.map(winner => ({
              giveawayId,
              userId: winner.userId,
              timerStartTime: new Date(Date.now() - winner.elapsedMs),
            }));

            // Restore all timers
            timerManager.restoreTimers(activeWinners);

            // All timers should be tracked
            for (const winner of activeWinners) {
              expect(timerManager.hasActiveTimers(giveawayId, winner.userId)).toBe(true);
            }

            // Advance to maximum expiry time
            await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

            // All winners should have expired
            for (const winner of uniqueWinners) {
              expect(expiryCalls.some(call => 
                call.giveawayId === giveawayId && call.userId === winner.userId
              )).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should restore timers across multiple giveaways independently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              giveawayId: fc.uuid(),
              userId: fc.string({ minLength: 1, maxLength: 20 }),
              elapsedMs: fc.integer({ min: 0, max: 4 * 60 * 1000 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (winners) => {
            // Remove duplicates based on giveawayId:userId combination
            const uniqueWinners = winners.filter((winner, index, self) =>
              index === self.findIndex(w => 
                w.giveawayId === winner.giveawayId && w.userId === winner.userId
              )
            );

            if (uniqueWinners.length < 2) {
              // Skip if we don't have at least 2 unique winners
              return;
            }

            // Create winner records
            const activeWinners = uniqueWinners.map(winner => ({
              giveawayId: winner.giveawayId,
              userId: winner.userId,
              timerStartTime: new Date(Date.now() - winner.elapsedMs),
            }));

            // Restore all timers
            timerManager.restoreTimers(activeWinners);

            // All timers should be tracked
            for (const winner of activeWinners) {
              expect(timerManager.hasActiveTimers(winner.giveawayId, winner.userId)).toBe(true);
            }

            // Advance to maximum expiry time
            await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

            // All winners should have expired
            for (const winner of uniqueWinners) {
              expect(expiryCalls.some(call => 
                call.giveawayId === winner.giveawayId && call.userId === winner.userId
              )).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle restoration with empty array gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant([]),
          async (activeWinners) => {
            // Should not throw
            expect(() => {
              timerManager.restoreTimers(activeWinners);
            }).not.toThrow();

            // No callbacks should be triggered
            await vi.runAllTimersAsync();
            expect(reminderCalls).toHaveLength(0);
            expect(expiryCalls).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain timer accuracy across restoration for any start time', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 0, max: 1 * 60 * 1000 }), // 0-1 minute elapsed
          async (giveawayId, userId, elapsedMs) => {
            const timerStartTime = new Date(Date.now() - elapsedMs);
            
            // Restore timer
            timerManager.restoreTimers([{ giveawayId, userId, timerStartTime }]);

            // Calculate exact remaining time to reminder
            const reminderRemainingMs = 2 * 60 * 1000 - elapsedMs;

            // Advance to just before reminder (1ms before)
            await vi.advanceTimersByTimeAsync(reminderRemainingMs - 1);

            // Reminder should NOT have been called yet
            expect(reminderCalls.some(call => 
              call.giveawayId === giveawayId && call.userId === userId
            )).toBe(false);

            // Advance 1ms more to trigger reminder
            await vi.advanceTimersByTimeAsync(1);

            // Reminder should now have been called
            expect(reminderCalls.some(call => 
              call.giveawayId === giveawayId && call.userId === userId
            )).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve timer independence after restoration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 0, max: 2 * 60 * 1000 }),
          async (giveawayId, userId1, userId2, elapsedMs) => {
            // Ensure different user IDs
            if (userId1 === userId2) {
              return;
            }

            const timerStartTime = new Date(Date.now() - elapsedMs);
            
            // Restore timers for both users
            timerManager.restoreTimers([
              { giveawayId, userId: userId1, timerStartTime },
              { giveawayId, userId: userId2, timerStartTime },
            ]);

            // Both should be tracked
            expect(timerManager.hasActiveTimers(giveawayId, userId1)).toBe(true);
            expect(timerManager.hasActiveTimers(giveawayId, userId2)).toBe(true);

            // Stop one timer
            timerManager.stopTimers(giveawayId, userId1);

            // Only userId1 should be stopped
            expect(timerManager.hasActiveTimers(giveawayId, userId1)).toBe(false);
            expect(timerManager.hasActiveTimers(giveawayId, userId2)).toBe(true);

            // Advance to expiry
            await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

            // Only userId2 should have expired
            expect(expiryCalls.some(call => 
              call.giveawayId === giveawayId && call.userId === userId1
            )).toBe(false);
            expect(expiryCalls.some(call => 
              call.giveawayId === giveawayId && call.userId === userId2
            )).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle restoration at exact boundary times correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.constantFrom(
            0,                    // Just started
            2 * 60 * 1000,       // Exactly at reminder time
            5 * 60 * 1000        // Exactly at expiry time
          ),
          async (giveawayId, userId, elapsedMs) => {
            const timerStartTime = new Date(Date.now() - elapsedMs);
            
            // Restore timer
            timerManager.restoreTimers([{ giveawayId, userId, timerStartTime }]);

            // Run all timers
            await vi.runAllTimersAsync();

            if (elapsedMs === 0) {
              // Just started: both reminder and expiry should trigger
              expect(reminderCalls.some(call => 
                call.giveawayId === giveawayId && call.userId === userId
              )).toBe(true);
              expect(expiryCalls.some(call => 
                call.giveawayId === giveawayId && call.userId === userId
              )).toBe(true);
            } else if (elapsedMs === 2 * 60 * 1000) {
              // At reminder time: reminder should not trigger, expiry should
              expect(reminderCalls.some(call => 
                call.giveawayId === giveawayId && call.userId === userId
              )).toBe(false);
              expect(expiryCalls.some(call => 
                call.giveawayId === giveawayId && call.userId === userId
              )).toBe(true);
            } else if (elapsedMs === 5 * 60 * 1000) {
              // At expiry time: expiry should trigger immediately
              expect(expiryCalls.some(call => 
                call.giveawayId === giveawayId && call.userId === userId
              )).toBe(true);
              expect(reminderCalls.some(call => 
                call.giveawayId === giveawayId && call.userId === userId
              )).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
