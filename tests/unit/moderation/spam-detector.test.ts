import { describe, it, expect, beforeEach } from 'vitest';
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
});
