import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimerManager } from '../../../src/giveaway/timer-manager.js';

describe('TimerManager', () => {
  let onReminder: ReturnType<typeof vi.fn>;
  let onExpiry: ReturnType<typeof vi.fn>;
  let manager: TimerManager;

  beforeEach(() => {
    vi.useFakeTimers();
    onReminder = vi.fn().mockResolvedValue(undefined);
    onExpiry = vi.fn().mockResolvedValue(undefined);
    manager = new TimerManager({ onReminder, onExpiry });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startTimers()', () => {
    it('fires reminder callback after 2 minutes', async () => {
      manager.startTimers('g1', 'u1', new Date());
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
      expect(onReminder).toHaveBeenCalledWith('g1', 'u1');
    });

    it('fires expiry callback after 5 minutes', async () => {
      manager.startTimers('g1', 'u1', new Date());
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      expect(onExpiry).toHaveBeenCalledWith('g1', 'u1');
    });

    it('cancels existing timers before starting new ones', async () => {
      manager.startTimers('g1', 'u1', new Date());
      manager.startTimers('g1', 'u1', new Date()); // restart
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      // expiry should fire exactly once
      expect(onExpiry).toHaveBeenCalledTimes(1);
    });

    it('does not schedule reminder if 2 minutes already elapsed', async () => {
      const pastStart = new Date(Date.now() - 3 * 60 * 1000); // 3 min ago
      manager.startTimers('g1', 'u1', pastStart);
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      expect(onReminder).not.toHaveBeenCalled();
    });

    it('triggers expiry immediately via setImmediate when 5+ minutes elapsed', async () => {
      const pastStart = new Date(Date.now() - 6 * 60 * 1000); // 6 min ago
      manager.startTimers('g1', 'u1', pastStart);
      await vi.runAllTimersAsync();
      expect(onExpiry).toHaveBeenCalledWith('g1', 'u1');
    });

    it('handles errors in reminder callback gracefully', async () => {
      onReminder.mockRejectedValue(new Error('reminder failed'));
      manager.startTimers('g1', 'u1', new Date());
      await expect(vi.advanceTimersByTimeAsync(2 * 60 * 1000)).resolves.not.toThrow();
    });

    it('handles errors in expiry callback gracefully', async () => {
      onExpiry.mockRejectedValue(new Error('expiry failed'));
      manager.startTimers('g1', 'u1', new Date());
      await expect(vi.advanceTimersByTimeAsync(5 * 60 * 1000)).resolves.not.toThrow();
    });
  });

  describe('stopTimers()', () => {
    it('cancels pending timers', async () => {
      manager.startTimers('g1', 'u1', new Date());
      manager.stopTimers('g1', 'u1');
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      expect(onExpiry).not.toHaveBeenCalled();
    });

    it('is a no-op when no timers exist for key', () => {
      expect(() => manager.stopTimers('g1', 'u1')).not.toThrow();
    });
  });

  describe('hasActiveTimers()', () => {
    it('returns false when no timers set', () => {
      expect(manager.hasActiveTimers('g1', 'u1')).toBe(false);
    });

    it('returns true after startTimers', () => {
      manager.startTimers('g1', 'u1', new Date());
      expect(manager.hasActiveTimers('g1', 'u1')).toBe(true);
    });

    it('returns false after stopTimers', () => {
      manager.startTimers('g1', 'u1', new Date());
      manager.stopTimers('g1', 'u1');
      expect(manager.hasActiveTimers('g1', 'u1')).toBe(false);
    });

    it('returns false after expiry fires (timer key removed)', async () => {
      manager.startTimers('g1', 'u1', new Date());
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      expect(manager.hasActiveTimers('g1', 'u1')).toBe(false);
    });
  });

  describe('restoreTimers()', () => {
    it('restores timers for active winners', async () => {
      const timerStart = new Date();
      manager.restoreTimers([{ giveawayId: 'g1', userId: 'u1', timerStartTime: timerStart }]);
      expect(manager.hasActiveTimers('g1', 'u1')).toBe(true);
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      expect(onExpiry).toHaveBeenCalledWith('g1', 'u1');
    });
  });
});
