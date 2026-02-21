import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TimerManager, TimerCallbacks } from '../../../src/giveaway/timer-manager.js';

describe('TimerManager', () => {
  let timerManager: TimerManager;
  let mockCallbacks: TimerCallbacks;
  let reminderCalls: Array<{ giveawayId: string; userId: string }>;
  let expiryCalls: Array<{ giveawayId: string; userId: string }>;

  beforeEach(() => {
    // Use fake timers
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

  describe('startTimers', () => {
    it('should schedule reminder and expiry timers for new winner', () => {
      const giveawayId = 'giveaway-1';
      const userId = 'user-1';
      const startTime = new Date();

      timerManager.startTimers(giveawayId, userId, startTime);

      expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(true);
    });

    it('should trigger reminder callback at 2 minutes', async () => {
      const giveawayId = 'giveaway-1';
      const userId = 'user-1';
      const startTime = new Date();

      timerManager.startTimers(giveawayId, userId, startTime);

      // Fast-forward to 2 minutes
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

      expect(mockCallbacks.onReminder).toHaveBeenCalledWith(giveawayId, userId);
      expect(reminderCalls).toHaveLength(1);
      expect(reminderCalls[0]).toEqual({ giveawayId, userId });
    });

    it('should trigger expiry callback at 5 minutes', async () => {
      const giveawayId = 'giveaway-1';
      const userId = 'user-1';
      const startTime = new Date();

      timerManager.startTimers(giveawayId, userId, startTime);

      // Fast-forward to 5 minutes
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      expect(mockCallbacks.onExpiry).toHaveBeenCalledWith(giveawayId, userId);
      expect(expiryCalls).toHaveLength(1);
      expect(expiryCalls[0]).toEqual({ giveawayId, userId });
    });

    it('should trigger both reminder and expiry in correct order', async () => {
      const giveawayId = 'giveaway-1';
      const userId = 'user-1';
      const startTime = new Date();

      timerManager.startTimers(giveawayId, userId, startTime);

      // Fast-forward to 2 minutes
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
      expect(reminderCalls).toHaveLength(1);
      expect(expiryCalls).toHaveLength(0);

      // Fast-forward to 5 minutes total
      await vi.advanceTimersByTimeAsync(3 * 60 * 1000);
      expect(reminderCalls).toHaveLength(1);
      expect(expiryCalls).toHaveLength(1);
    });

    it('should handle multiple winners with independent timers', async () => {
      const giveawayId = 'giveaway-1';
      const user1 = 'user-1';
      const user2 = 'user-2';
      const startTime = new Date();

      timerManager.startTimers(giveawayId, user1, startTime);
      timerManager.startTimers(giveawayId, user2, startTime);

      expect(timerManager.hasActiveTimers(giveawayId, user1)).toBe(true);
      expect(timerManager.hasActiveTimers(giveawayId, user2)).toBe(true);

      // Fast-forward to 5 minutes
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      expect(expiryCalls).toHaveLength(2);
      expect(expiryCalls).toContainEqual({ giveawayId, userId: user1 });
      expect(expiryCalls).toContainEqual({ giveawayId, userId: user2 });
    });

    it('should skip reminder if elapsed time >= 2 minutes', async () => {
      const giveawayId = 'giveaway-1';
      const userId = 'user-1';
      // Start time 2.5 minutes ago
      const startTime = new Date(Date.now() - 2.5 * 60 * 1000);

      timerManager.startTimers(giveawayId, userId, startTime);

      // Fast-forward to when expiry should trigger (2.5 minutes remaining)
      await vi.advanceTimersByTimeAsync(2.5 * 60 * 1000);

      // Reminder should not have been called
      expect(reminderCalls).toHaveLength(0);
      // Expiry should have been called
      expect(expiryCalls).toHaveLength(1);
    });

    it('should trigger expiry immediately if elapsed time >= 5 minutes', async () => {
      const giveawayId = 'giveaway-1';
      const userId = 'user-1';
      // Start time 6 minutes ago
      const startTime = new Date(Date.now() - 6 * 60 * 1000);

      timerManager.startTimers(giveawayId, userId, startTime);

      // Run all immediate callbacks
      await vi.runAllTimersAsync();

      // Expiry should have been triggered immediately
      expect(expiryCalls).toHaveLength(1);
      expect(reminderCalls).toHaveLength(0);
    });

    it('should replace existing timers when called again for same winner', async () => {
      const giveawayId = 'giveaway-1';
      const userId = 'user-1';
      const startTime = new Date();

      // Start timers
      timerManager.startTimers(giveawayId, userId, startTime);

      // Fast-forward 1 minute
      await vi.advanceTimersByTimeAsync(1 * 60 * 1000);

      // Start timers again (should reset)
      timerManager.startTimers(giveawayId, userId, new Date());

      // Fast-forward 2 minutes from second start
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

      // Should only have one reminder call (from second start)
      expect(reminderCalls).toHaveLength(1);
    });
  });

  describe('stopTimers', () => {
    it('should cancel pending timers', async () => {
      const giveawayId = 'giveaway-1';
      const userId = 'user-1';
      const startTime = new Date();

      timerManager.startTimers(giveawayId, userId, startTime);
      expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(true);

      // Stop timers before they trigger
      timerManager.stopTimers(giveawayId, userId);
      expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(false);

      // Fast-forward past expiry time
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      // Callbacks should not have been called
      expect(reminderCalls).toHaveLength(0);
      expect(expiryCalls).toHaveLength(0);
    });

    it('should handle stopping timers that do not exist', () => {
      const giveawayId = 'giveaway-1';
      const userId = 'user-1';

      // Should not throw
      expect(() => {
        timerManager.stopTimers(giveawayId, userId);
      }).not.toThrow();
    });

    it('should only stop timers for specific winner', async () => {
      const giveawayId = 'giveaway-1';
      const user1 = 'user-1';
      const user2 = 'user-2';
      const startTime = new Date();

      timerManager.startTimers(giveawayId, user1, startTime);
      timerManager.startTimers(giveawayId, user2, startTime);

      // Stop only user1's timers
      timerManager.stopTimers(giveawayId, user1);

      expect(timerManager.hasActiveTimers(giveawayId, user1)).toBe(false);
      expect(timerManager.hasActiveTimers(giveawayId, user2)).toBe(true);

      // Fast-forward to expiry
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      // Only user2's expiry should have been called
      expect(expiryCalls).toHaveLength(1);
      expect(expiryCalls[0]).toEqual({ giveawayId, userId: user2 });
    });
  });

  describe('hasActiveTimers', () => {
    it('should return false when no timers exist', () => {
      const giveawayId = 'giveaway-1';
      const userId = 'user-1';

      expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(false);
    });

    it('should return true when timers are active', () => {
      const giveawayId = 'giveaway-1';
      const userId = 'user-1';
      const startTime = new Date();

      timerManager.startTimers(giveawayId, userId, startTime);

      expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(true);
    });

    it('should return false after timers are stopped', () => {
      const giveawayId = 'giveaway-1';
      const userId = 'user-1';
      const startTime = new Date();

      timerManager.startTimers(giveawayId, userId, startTime);
      timerManager.stopTimers(giveawayId, userId);

      expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(false);
    });

    it('should return false after expiry callback completes', async () => {
      const giveawayId = 'giveaway-1';
      const userId = 'user-1';
      const startTime = new Date();

      timerManager.startTimers(giveawayId, userId, startTime);

      // Fast-forward to expiry
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      // Timers should be cleaned up after expiry
      expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(false);
    });
  });

  describe('restoreTimers', () => {
    it('should restore timers for pending winners', async () => {
      const activeWinners = [
        {
          giveawayId: 'giveaway-1',
          userId: 'user-1',
          timerStartTime: new Date(Date.now() - 1 * 60 * 1000), // 1 minute ago
        },
        {
          giveawayId: 'giveaway-1',
          userId: 'user-2',
          timerStartTime: new Date(Date.now() - 30 * 1000), // 30 seconds ago
        },
      ];

      timerManager.restoreTimers(activeWinners);

      // Both winners should have active timers
      expect(timerManager.hasActiveTimers('giveaway-1', 'user-1')).toBe(true);
      expect(timerManager.hasActiveTimers('giveaway-1', 'user-2')).toBe(true);
    });

    it('should restore timers with correct remaining time for early elapsed', async () => {
      const activeWinners = [
        {
          giveawayId: 'giveaway-1',
          userId: 'user-1',
          timerStartTime: new Date(Date.now() - 1 * 60 * 1000), // 1 minute ago
        },
      ];

      timerManager.restoreTimers(activeWinners);

      // Fast-forward 1 minute (total 2 minutes elapsed)
      await vi.advanceTimersByTimeAsync(1 * 60 * 1000);

      // Reminder should trigger
      expect(reminderCalls).toHaveLength(1);
      expect(expiryCalls).toHaveLength(0);

      // Fast-forward 3 more minutes (total 5 minutes elapsed)
      await vi.advanceTimersByTimeAsync(3 * 60 * 1000);

      // Expiry should trigger
      expect(expiryCalls).toHaveLength(1);
    });

    it('should skip reminder for partial elapsed timers', async () => {
      const activeWinners = [
        {
          giveawayId: 'giveaway-1',
          userId: 'user-1',
          timerStartTime: new Date(Date.now() - 3 * 60 * 1000), // 3 minutes ago
        },
      ];

      timerManager.restoreTimers(activeWinners);

      // Fast-forward 2 minutes (total 5 minutes elapsed)
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

      // Reminder should not trigger (already past 2 minutes)
      expect(reminderCalls).toHaveLength(0);
      // Expiry should trigger
      expect(expiryCalls).toHaveLength(1);
    });

    it('should trigger expiry immediately for expired timers', async () => {
      const activeWinners = [
        {
          giveawayId: 'giveaway-1',
          userId: 'user-1',
          timerStartTime: new Date(Date.now() - 6 * 60 * 1000), // 6 minutes ago
        },
      ];

      timerManager.restoreTimers(activeWinners);

      // Run all immediate callbacks
      await vi.runAllTimersAsync();

      // Expiry should trigger immediately
      expect(expiryCalls).toHaveLength(1);
      expect(reminderCalls).toHaveLength(0);
    });

    it('should restore multiple winners with different elapsed times', async () => {
      const activeWinners = [
        {
          giveawayId: 'giveaway-1',
          userId: 'user-1',
          timerStartTime: new Date(Date.now() - 30 * 1000), // 30 seconds ago
        },
        {
          giveawayId: 'giveaway-1',
          userId: 'user-2',
          timerStartTime: new Date(Date.now() - 3 * 60 * 1000), // 3 minutes ago
        },
        {
          giveawayId: 'giveaway-1',
          userId: 'user-3',
          timerStartTime: new Date(Date.now() - 6 * 60 * 1000), // 6 minutes ago (expired)
        },
      ];

      timerManager.restoreTimers(activeWinners);

      // Run only immediate callbacks (for expired timer)
      await vi.runOnlyPendingTimersAsync();

      // User 3 should have expired immediately
      expect(expiryCalls.length).toBeGreaterThanOrEqual(1);
      expect(expiryCalls.some(call => call.userId === 'user-3')).toBe(true);

      // Reset counters to track subsequent calls
      const initialExpiryCalls = expiryCalls.length;
      
      // Fast-forward 2 minutes (user-1 at 2.5min, user-2 at 5min)
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

      // User 1 should have reminder
      expect(reminderCalls.some(call => call.userId === 'user-1')).toBe(true);
      // User 2 should expire
      expect(expiryCalls.some(call => call.userId === 'user-2')).toBe(true);
    });

    it('should handle empty array of active winners', () => {
      const activeWinners: Array<{ giveawayId: string; userId: string; timerStartTime: Date }> = [];

      // Should not throw
      expect(() => {
        timerManager.restoreTimers(activeWinners);
      }).not.toThrow();
    });

    it('should restore timers across multiple giveaways', async () => {
      const activeWinners = [
        {
          giveawayId: 'giveaway-1',
          userId: 'user-1',
          timerStartTime: new Date(Date.now() - 1 * 60 * 1000),
        },
        {
          giveawayId: 'giveaway-2',
          userId: 'user-2',
          timerStartTime: new Date(Date.now() - 1 * 60 * 1000),
        },
      ];

      timerManager.restoreTimers(activeWinners);

      expect(timerManager.hasActiveTimers('giveaway-1', 'user-1')).toBe(true);
      expect(timerManager.hasActiveTimers('giveaway-2', 'user-2')).toBe(true);

      // Fast-forward to expiry
      await vi.advanceTimersByTimeAsync(4 * 60 * 1000);

      // Both should expire
      expect(expiryCalls).toHaveLength(2);
    });
  });

  describe('error handling', () => {
    it('should handle errors in reminder callback', async () => {
      const giveawayId = 'giveaway-1';
      const userId = 'user-1';
      const startTime = new Date();

      // Mock callback to throw error
      const errorCallbacks: TimerCallbacks = {
        onReminder: vi.fn(async () => {
          throw new Error('Reminder error');
        }),
        onExpiry: vi.fn(async () => {}),
      };

      const errorTimerManager = new TimerManager(errorCallbacks);
      errorTimerManager.startTimers(giveawayId, userId, startTime);

      // Spy on console.error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Fast-forward to reminder
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

      // Should have logged error
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('Error in reminder callback');

      consoleErrorSpy.mockRestore();
    });

    it('should handle errors in expiry callback and cleanup timers', async () => {
      const giveawayId = 'giveaway-1';
      const userId = 'user-1';
      const startTime = new Date();

      // Mock callback to throw error
      const errorCallbacks: TimerCallbacks = {
        onReminder: vi.fn(async () => {}),
        onExpiry: vi.fn(async () => {
          throw new Error('Expiry error');
        }),
      };

      const errorTimerManager = new TimerManager(errorCallbacks);
      errorTimerManager.startTimers(giveawayId, userId, startTime);

      // Spy on console.error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Fast-forward to expiry
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      // Should have logged error
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('Error in expiry callback');

      // Timers should still be cleaned up
      expect(errorTimerManager.hasActiveTimers(giveawayId, userId)).toBe(false);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    describe('timer cancellation on confirmation', () => {
      it('should cancel reminder timer when stopped before it fires', async () => {
        const giveawayId = 'giveaway-1';
        const userId = 'user-1';
        const startTime = new Date();

        timerManager.startTimers(giveawayId, userId, startTime);

        // Fast-forward 1 minute (before reminder at 2 minutes)
        await vi.advanceTimersByTimeAsync(1 * 60 * 1000);

        // Stop timers (simulating confirmation)
        timerManager.stopTimers(giveawayId, userId);

        // Fast-forward past reminder time
        await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

        // Reminder should not have fired
        expect(reminderCalls).toHaveLength(0);
        expect(expiryCalls).toHaveLength(0);
      });

      it('should cancel expiry timer when stopped after reminder but before expiry', async () => {
        const giveawayId = 'giveaway-1';
        const userId = 'user-1';
        const startTime = new Date();

        timerManager.startTimers(giveawayId, userId, startTime);

        // Fast-forward to after reminder (3 minutes)
        await vi.advanceTimersByTimeAsync(3 * 60 * 1000);

        // Reminder should have fired
        expect(reminderCalls).toHaveLength(1);

        // Stop timers (simulating confirmation)
        timerManager.stopTimers(giveawayId, userId);

        // Fast-forward past expiry time
        await vi.advanceTimersByTimeAsync(3 * 60 * 1000);

        // Expiry should not have fired
        expect(expiryCalls).toHaveLength(0);
      });

      it('should handle stopping timers immediately after starting', () => {
        const giveawayId = 'giveaway-1';
        const userId = 'user-1';
        const startTime = new Date();

        timerManager.startTimers(giveawayId, userId, startTime);
        expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(true);

        // Stop immediately
        timerManager.stopTimers(giveawayId, userId);
        expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(false);
      });
    });

    describe('expired timer on restart', () => {
      it('should handle timer that expired during downtime', async () => {
        const giveawayId = 'giveaway-1';
        const userId = 'user-1';
        // Timer started 10 minutes ago (well past expiry)
        const startTime = new Date(Date.now() - 10 * 60 * 1000);

        timerManager.startTimers(giveawayId, userId, startTime);

        // Run all immediate callbacks
        await vi.runAllTimersAsync();

        // Expiry should have been triggered immediately
        expect(expiryCalls).toHaveLength(1);
        expect(expiryCalls[0]).toEqual({ giveawayId, userId });
        expect(reminderCalls).toHaveLength(0);

        // Timers should be cleaned up
        expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(false);
      });

      it('should handle timer that expired exactly at 5 minutes', async () => {
        const giveawayId = 'giveaway-1';
        const userId = 'user-1';
        // Timer started exactly 5 minutes ago
        const startTime = new Date(Date.now() - 5 * 60 * 1000);

        timerManager.startTimers(giveawayId, userId, startTime);

        // Run all immediate callbacks
        await vi.runAllTimersAsync();

        // Expiry should have been triggered immediately
        expect(expiryCalls).toHaveLength(1);
        expect(reminderCalls).toHaveLength(0);
      });

      it('should restore multiple timers with some expired', async () => {
        const activeWinners = [
          {
            giveawayId: 'giveaway-1',
            userId: 'user-1',
            timerStartTime: new Date(Date.now() - 1 * 60 * 1000), // 1 min ago - active
          },
          {
            giveawayId: 'giveaway-1',
            userId: 'user-2',
            timerStartTime: new Date(Date.now() - 7 * 60 * 1000), // 7 min ago - expired
          },
          {
            giveawayId: 'giveaway-1',
            userId: 'user-3',
            timerStartTime: new Date(Date.now() - 3 * 60 * 1000), // 3 min ago - active
          },
        ];

        timerManager.restoreTimers(activeWinners);

        // Run all timers to process immediate callbacks
        await vi.runAllTimersAsync();

        // User 2 should have expired immediately
        expect(expiryCalls.some(call => call.userId === 'user-2')).toBe(true);
        // User 2 should not have active timers
        expect(timerManager.hasActiveTimers('giveaway-1', 'user-2')).toBe(false);
      });
    });

    describe('concurrent timer operations', () => {
      it('should handle rapid start/stop cycles', async () => {
        const giveawayId = 'giveaway-1';
        const userId = 'user-1';
        const startTime = new Date();

        // Start and stop multiple times rapidly
        timerManager.startTimers(giveawayId, userId, startTime);
        timerManager.stopTimers(giveawayId, userId);
        timerManager.startTimers(giveawayId, userId, startTime);
        timerManager.stopTimers(giveawayId, userId);
        timerManager.startTimers(giveawayId, userId, startTime);

        // Should have active timers from final start
        expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(true);

        // Fast-forward to expiry
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

        // Should only have one expiry call (from final start)
        expect(expiryCalls).toHaveLength(1);
      });

      it('should handle starting timers for same winner while timers are active', async () => {
        const giveawayId = 'giveaway-1';
        const userId = 'user-1';
        const startTime = new Date();

        // Start timers
        timerManager.startTimers(giveawayId, userId, startTime);

        // Fast-forward 1 minute
        await vi.advanceTimersByTimeAsync(1 * 60 * 1000);

        // Start timers again (should replace existing)
        const newStartTime = new Date();
        timerManager.startTimers(giveawayId, userId, newStartTime);

        // Fast-forward 2 minutes (from second start)
        await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

        // Should have exactly one reminder (from second start)
        expect(reminderCalls).toHaveLength(1);

        // Fast-forward to expiry (3 more minutes)
        await vi.advanceTimersByTimeAsync(3 * 60 * 1000);

        // Should have exactly one expiry (from second start)
        expect(expiryCalls).toHaveLength(1);
      });

      it('should handle concurrent operations on different winners', async () => {
        const giveawayId = 'giveaway-1';
        const users = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];
        const startTime = new Date();

        // Start timers for all users
        users.forEach(userId => {
          timerManager.startTimers(giveawayId, userId, startTime);
        });

        // All should have active timers
        users.forEach(userId => {
          expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(true);
        });

        // Stop some timers at different times
        await vi.advanceTimersByTimeAsync(30 * 1000); // 30 seconds
        timerManager.stopTimers(giveawayId, 'user-1');

        await vi.advanceTimersByTimeAsync(90 * 1000); // 2 minutes total
        timerManager.stopTimers(giveawayId, 'user-3');

        // At this point, user-2, user-4, user-5 should have reminders triggered
        expect(reminderCalls.length).toBeGreaterThanOrEqual(3);
        expect(reminderCalls.some(call => call.userId === 'user-2')).toBe(true);
        expect(reminderCalls.some(call => call.userId === 'user-4')).toBe(true);
        expect(reminderCalls.some(call => call.userId === 'user-5')).toBe(true);

        // Stop another user
        timerManager.stopTimers(giveawayId, 'user-4');

        // Fast-forward to expiry
        await vi.advanceTimersByTimeAsync(3 * 60 * 1000);

        // Only user-2 and user-5 should have expired
        expect(expiryCalls).toHaveLength(2);
        expect(expiryCalls.some(call => call.userId === 'user-2')).toBe(true);
        expect(expiryCalls.some(call => call.userId === 'user-5')).toBe(true);
      });

      it('should handle stopping non-existent timers during concurrent operations', () => {
        const giveawayId = 'giveaway-1';
        const userId = 'user-1';
        const startTime = new Date();

        // Stop non-existent timer
        timerManager.stopTimers(giveawayId, userId);

        // Start timer
        timerManager.startTimers(giveawayId, userId, startTime);

        // Stop existing timer
        timerManager.stopTimers(giveawayId, userId);

        // Stop again (already stopped)
        timerManager.stopTimers(giveawayId, userId);

        // Should not throw and should have no active timers
        expect(timerManager.hasActiveTimers(giveawayId, userId)).toBe(false);
      });

      it('should handle restoring timers while other timers are active', async () => {
        const giveawayId = 'giveaway-1';
        const startTime = new Date();

        // Start some timers normally
        timerManager.startTimers(giveawayId, 'user-1', startTime);
        timerManager.startTimers(giveawayId, 'user-2', startTime);

        // Fast-forward 1 minute
        await vi.advanceTimersByTimeAsync(1 * 60 * 1000);

        // Restore additional timers (simulating restart with some already running)
        const activeWinners = [
          {
            giveawayId: 'giveaway-1',
            userId: 'user-3',
            timerStartTime: new Date(Date.now() - 1 * 60 * 1000), // 1 minute ago (same as user-1 and user-2)
          },
          {
            giveawayId: 'giveaway-1',
            userId: 'user-4',
            timerStartTime: new Date(Date.now() - 3 * 60 * 1000), // 3 minutes ago
          },
        ];

        timerManager.restoreTimers(activeWinners);

        // All should have active timers
        expect(timerManager.hasActiveTimers(giveawayId, 'user-1')).toBe(true);
        expect(timerManager.hasActiveTimers(giveawayId, 'user-2')).toBe(true);
        expect(timerManager.hasActiveTimers(giveawayId, 'user-3')).toBe(true);
        expect(timerManager.hasActiveTimers(giveawayId, 'user-4')).toBe(true);

        // Fast-forward to 2 minutes from original start
        await vi.advanceTimersByTimeAsync(1 * 60 * 1000);

        // user-1, user-2, and user-3 should have reminders (all at 2 minutes)
        // user-4 should not (already past 2 minutes)
        expect(reminderCalls.some(call => call.userId === 'user-1')).toBe(true);
        expect(reminderCalls.some(call => call.userId === 'user-2')).toBe(true);
        expect(reminderCalls.some(call => call.userId === 'user-3')).toBe(true);
        expect(reminderCalls.some(call => call.userId === 'user-4')).toBe(false);
      });
    });
  });
});
