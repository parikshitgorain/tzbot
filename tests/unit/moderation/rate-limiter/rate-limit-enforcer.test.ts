import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimitEnforcer } from '../../../../src/moderation/rate-limiter/rate-limit-enforcer.js';
import { InMemoryStateStore } from '../../../../src/moderation/rate-limiter/state-store.js';
import type { RateLimiterConfig } from '../../../../src/moderation/rate-limiter/types.js';

const config: RateLimiterConfig = {
  restrictedChannels: new Map(),
  rateLimitWindowMs: 1000,   // 1 second window
  violationWindowMs: 5000,   // 5 second violation window
  warningDeleteDelayMs: 3000,
  cleanupIntervalMs: 60_000,
};

describe('RateLimitEnforcer', () => {
  let store: InMemoryStateStore;
  let enforcer: RateLimitEnforcer;

  beforeEach(() => {
    store = new InMemoryStateStore();
    enforcer = new RateLimitEnforcer(store, config);
  });

  // -------------------------------------------------------------------------
  // checkRateLimit()
  // -------------------------------------------------------------------------

  describe('checkRateLimit()', () => {
    it('returns null for the first message from a user', async () => {
      const result = await enforcer.checkRateLimit('user1', 'channel1', Date.now());
      expect(result).toBeNull();
    });

    it('returns a violation when second message is within the rate limit window', async () => {
      const now = Date.now();
      await enforcer.recordMessage('user1', 'channel1', now);
      const violation = await enforcer.checkRateLimit('user1', 'channel1', now + 500); // within 1s window
      expect(violation).not.toBeNull();
      expect(violation!.userId).toBe('user1');
      expect(violation!.channelId).toBe('channel1');
    });

    it('returns null when message arrives after the rate limit window has expired', async () => {
      const now = Date.now();
      await enforcer.recordMessage('user1', 'channel1', now);
      const violation = await enforcer.checkRateLimit('user1', 'channel1', now + 2000); // after 1s window
      expect(violation).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // recordMessage()
  // -------------------------------------------------------------------------

  describe('recordMessage()', () => {
    it('stores message time so subsequent checkRateLimit can detect violation', async () => {
      const now = Date.now();
      await enforcer.recordMessage('user1', 'channel1', now);
      const violation = await enforcer.checkRateLimit('user1', 'channel1', now + 100);
      expect(violation).not.toBeNull();
    });

    it('records independently for different channels', async () => {
      const now = Date.now();
      await enforcer.recordMessage('user1', 'ch1', now);
      const violation = await enforcer.checkRateLimit('user1', 'ch2', now + 100);
      // ch2 has no prior record → no violation
      expect(violation).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // isInViolationWindow()
  // -------------------------------------------------------------------------

  describe('isInViolationWindow()', () => {
    it('returns false initially when no violation window is set', async () => {
      const result = await enforcer.isInViolationWindow('user1', 'channel1', Date.now());
      expect(result).toBe(false);
    });

    it('returns true after enterViolationWindow within the duration', async () => {
      const now = Date.now();
      await enforcer.enterViolationWindow('user1', 'channel1', now, 5000);
      const result = await enforcer.isInViolationWindow('user1', 'channel1', now + 1000);
      expect(result).toBe(true);
    });

    it('returns false after the violation window has expired', async () => {
      const now = Date.now();
      await enforcer.enterViolationWindow('user1', 'channel1', now, 5000);
      const result = await enforcer.isInViolationWindow('user1', 'channel1', now + 6000);
      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // enterViolationWindow()
  // -------------------------------------------------------------------------

  describe('enterViolationWindow()', () => {
    it('sets the violation expiry correctly (now + duration)', async () => {
      const now = Date.now();
      await enforcer.enterViolationWindow('user1', 'channel1', now, 3000);
      // Just before expiry → still in window
      expect(await enforcer.isInViolationWindow('user1', 'channel1', now + 2999)).toBe(true);
      // At or past expiry → no longer in window
      expect(await enforcer.isInViolationWindow('user1', 'channel1', now + 3001)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // cleanupExpired()
  // -------------------------------------------------------------------------

  describe('cleanupExpired()', () => {
    it('removes expired message timestamps and violation windows', async () => {
      const oldTime = Date.now() - 70_000; // 70 s ago (> 60 s threshold)
      await enforcer.recordMessage('user1', 'channel1', oldTime);
      await enforcer.enterViolationWindow('user1', 'channel1', oldTime, 1); // already expired

      await enforcer.cleanupExpired(Date.now());

      // Message and violation state should now be gone
      expect(await store.getLastMessageTime('user1', 'channel1')).toBeNull();
      expect(await store.getViolationExpiry('user1', 'channel1')).toBeNull();
    });

    it('keeps recent entries after cleanup', async () => {
      const now = Date.now();
      await enforcer.recordMessage('user1', 'channel1', now - 5000); // 5 s ago → within 60 s
      await enforcer.enterViolationWindow('user1', 'channel1', now, 10_000); // expires in 10 s

      await enforcer.cleanupExpired(now);

      expect(await store.getLastMessageTime('user1', 'channel1')).not.toBeNull();
      expect(await store.getViolationExpiry('user1', 'channel1')).not.toBeNull();
    });
  });
});
