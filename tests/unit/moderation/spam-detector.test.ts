import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SpamDetector,
  DEFAULT_SPAM_THRESHOLDS,
  type SpamThresholds,
} from '../../../src/moderation/spam-detector.js';

describe('SpamDetector', () => {
  let detector: SpamDetector;

  beforeEach(() => {
    detector = new SpamDetector();
  });

  describe('checkSpam - not spam', () => {
    it('should not flag a single message as spam', () => {
      const result = detector.checkSpam('user1', 'msg1', 'hello world');
      expect(result.isSpam).toBe(false);
    });

    it('should not flag a few different messages as spam', () => {
      const now = new Date();
      detector.checkSpam('user1', 'msg1', 'message one', now);
      detector.checkSpam('user1', 'msg2', 'message two', now);
      const result = detector.checkSpam('user1', 'msg3', 'message three', now);
      expect(result.isSpam).toBe(false);
    });
  });

  describe('checkSpam - identical message spam', () => {
    it('should detect identical message spam when threshold is reached', () => {
      const thresholds: SpamThresholds = {
        identicalMessages: 3,
        identicalWindow: 10,
        rapidMessages: 100,
        rapidWindow: 5,
      };
      const det = new SpamDetector(thresholds);
      const now = new Date();

      det.checkSpam('user1', 'msg1', 'spam spam', now);
      det.checkSpam('user1', 'msg2', 'spam spam', now);
      const result = det.checkSpam('user1', 'msg3', 'spam spam', now);

      expect(result.isSpam).toBe(true);
      expect(result.reason).toBeTruthy();
    });
  });

  describe('checkSpam - rapid message spam', () => {
    it('should detect rapid message spam when threshold is reached', () => {
      const thresholds: SpamThresholds = {
        identicalMessages: 100,
        identicalWindow: 10,
        rapidMessages: 3,
        rapidWindow: 5,
      };
      const det = new SpamDetector(thresholds);
      const now = new Date();

      det.checkSpam('user1', 'msg1', 'message one', now);
      det.checkSpam('user1', 'msg2', 'message two', now);
      const result = det.checkSpam('user1', 'msg3', 'message three', now);

      expect(result.isSpam).toBe(true);
    });
  });

  describe('clearUserHistory', () => {
    it('should clear history for a specific user', () => {
      const thresholds: SpamThresholds = {
        identicalMessages: 2,
        identicalWindow: 10,
        rapidMessages: 100,
        rapidWindow: 5,
      };
      const det = new SpamDetector(thresholds);
      const now = new Date();

      det.checkSpam('user1', 'msg1', 'spam', now);
      det.clearUserHistory('user1');

      // After clearing, should not be spam since history is gone
      const result = det.checkSpam('user1', 'msg2', 'spam', now);
      expect(result.isSpam).toBe(false);
    });
  });

  describe('DEFAULT_SPAM_THRESHOLDS', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_SPAM_THRESHOLDS.identicalMessages).toBe(5);
      expect(DEFAULT_SPAM_THRESHOLDS.identicalWindow).toBe(10);
      expect(DEFAULT_SPAM_THRESHOLDS.rapidMessages).toBe(10);
      expect(DEFAULT_SPAM_THRESHOLDS.rapidWindow).toBe(5);
    });
  });

  describe('setSpamCooldown()', () => {
    it('sets cooldown so isInSpamCooldown returns true', () => {
      detector.setSpamCooldown('user1');
      expect(detector.isInSpamCooldown('user1')).toBe(true);
    });

    it('creates history entry when user has none', () => {
      detector.setSpamCooldown('newuser');
      expect(detector.isInSpamCooldown('newuser')).toBe(true);
    });
  });

  describe('isInSpamCooldown()', () => {
    it('returns false for user with no history', () => {
      expect(detector.isInSpamCooldown('nobody')).toBe(false);
    });

    it('returns false after cooldown expires', () => {
      detector.setSpamCooldown('user1');
      // Manually expire cooldown
      const h = (detector as any).userHistory as Map<string, { spamCooldownUntil?: Date }>;
      h.get('user1')!.spamCooldownUntil = new Date(Date.now() - 1000);
      expect(detector.isInSpamCooldown('user1')).toBe(false);
    });
  });

  describe('incrementSpamCount()', () => {
    it('increments and returns current count', () => {
      detector.setSpamCooldown('user1');
      expect(detector.incrementSpamCount('user1')).toBe(1);
      expect(detector.incrementSpamCount('user1')).toBe(2);
    });

    it('returns 0 for user with no history', () => {
      expect(detector.incrementSpamCount('ghost')).toBe(0);
    });
  });

  describe('getSpamCount()', () => {
    it('returns 0 for user with no history', () => {
      expect(detector.getSpamCount('nobody')).toBe(0);
    });

    it('returns accumulated count', () => {
      detector.setSpamCooldown('user1');
      detector.incrementSpamCount('user1');
      detector.incrementSpamCount('user1');
      expect(detector.getSpamCount('user1')).toBe(2);
    });
  });

  describe('clearAllHistory()', () => {
    it('clears all user histories', () => {
      const thresholds: SpamThresholds = {
        identicalMessages: 2, identicalWindow: 10, rapidMessages: 100, rapidWindow: 5,
      };
      const det = new SpamDetector(thresholds);
      const now = new Date();
      det.checkSpam('u1', 'm1', 'msg', now);
      det.checkSpam('u2', 'm2', 'msg', now);
      det.clearAllHistory();
      expect(det.checkSpam('u1', 'm3', 'msg', now).isSpam).toBe(false);
      expect(det.checkSpam('u2', 'm4', 'msg', now).isSpam).toBe(false);
    });
  });

  describe('getUserMessageCount()', () => {
    it('returns 0 for user with no history', () => {
      expect(detector.getUserMessageCount('nobody', 10)).toBe(0);
    });

    it('counts messages within the window', () => {
      const now = new Date();
      detector.checkSpam('user1', 'm1', 'a', now);
      detector.checkSpam('user1', 'm2', 'b', now);
      detector.checkSpam('user1', 'm3', 'c', now);
      expect(detector.getUserMessageCount('user1', 30, now)).toBe(3);
    });

    it('excludes messages outside the window', () => {
      const old = new Date(Date.now() - 60_000);
      const now = new Date();
      detector.checkSpam('user1', 'm1', 'old msg', old);
      detector.checkSpam('user1', 'm2', 'new msg', now);
      expect(detector.getUserMessageCount('user1', 5, now)).toBe(1);
    });
  });
});
