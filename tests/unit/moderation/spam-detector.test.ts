/**
 * @file spam-detector.test.ts
 * @description Unit tests for spam detection system
 * @module tests/unit/moderation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SpamDetector,
  DEFAULT_SPAM_THRESHOLDS,
} from '../../../src/moderation/spam-detector.js';
import { ViolationType } from '../../../src/types/index.js';

describe('SpamDetector', () => {
  let detector: SpamDetector;
  const userId = 'user123';

  beforeEach(() => {
    detector = new SpamDetector();
  });

  describe('Identical Message Spam Detection', () => {
    it('should not flag spam for less than 5 identical messages', () => {
      const message = 'Hello world';
      const baseTime = new Date('2025-01-01T00:00:00Z');

      // Send 4 identical messages within 10 seconds
      for (let i = 0; i < 4; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 1000);
        const result = detector.checkSpam(userId, message, timestamp);
        expect(result.isSpam).toBe(false);
      }
    });

    it('should flag spam for 5 identical messages within 10 seconds', () => {
      const message = 'Spam message';
      const baseTime = new Date('2025-01-01T00:00:00Z');

      // Send 4 messages first
      for (let i = 0; i < 4; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 1000);
        detector.checkSpam(userId, message, timestamp);
      }

      // 5th message should trigger spam detection
      const fifthTime = new Date(baseTime.getTime() + 4000);
      const result = detector.checkSpam(userId, message, fifthTime);

      expect(result.isSpam).toBe(true);
      expect(result.reason).toContain('5 identical messages');
      expect(result.reason).toContain('10 seconds');
      expect(result.violationType).toBe(ViolationType.SPAM);
    });

    it('should not flag spam for identical messages outside 10 second window', () => {
      const message = 'Test message';
      const baseTime = new Date('2025-01-01T00:00:00Z');

      // Send 4 messages
      for (let i = 0; i < 4; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 1000);
        detector.checkSpam(userId, message, timestamp);
      }

      // Send 5th message after 11 seconds (outside window)
      const lateTime = new Date(baseTime.getTime() + 11000);
      const result = detector.checkSpam(userId, message, lateTime);

      expect(result.isSpam).toBe(false);
    });

    it('should track different messages separately', () => {
      const baseTime = new Date('2025-01-01T00:00:00Z');

      // Send 3 of message A
      for (let i = 0; i < 3; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 1000);
        detector.checkSpam(userId, 'Message A', timestamp);
      }

      // Send 3 of message B
      for (let i = 0; i < 3; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 1000);
        const result = detector.checkSpam(userId, 'Message B', timestamp);
        expect(result.isSpam).toBe(false);
      }
    });
  });

  describe('Rapid Message Spam Detection', () => {
    it('should not flag spam for less than 10 messages in 5 seconds', () => {
      const baseTime = new Date('2025-01-01T00:00:00Z');

      // Send 9 different messages within 5 seconds
      for (let i = 0; i < 9; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 500);
        const result = detector.checkSpam(userId, `Message ${i}`, timestamp);
        expect(result.isSpam).toBe(false);
      }
    });

    it('should flag spam for 10 messages within 5 seconds', () => {
      const baseTime = new Date('2025-01-01T00:00:00Z');

      // Send 9 messages first
      for (let i = 0; i < 9; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 500);
        detector.checkSpam(userId, `Message ${i}`, timestamp);
      }

      // 10th message should trigger spam detection
      const tenthTime = new Date(baseTime.getTime() + 4500);
      const result = detector.checkSpam(userId, 'Message 9', tenthTime);

      expect(result.isSpam).toBe(true);
      expect(result.reason).toContain('10 messages');
      expect(result.reason).toContain('5 seconds');
      expect(result.violationType).toBe(ViolationType.SPAM);
    });

    it('should not flag spam for messages outside 5 second window', () => {
      const baseTime = new Date('2025-01-01T00:00:00Z');

      // Send 9 messages
      for (let i = 0; i < 9; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 500);
        detector.checkSpam(userId, `Message ${i}`, timestamp);
      }

      // Send 10th message after 6 seconds (outside window)
      const lateTime = new Date(baseTime.getTime() + 6000);
      const result = detector.checkSpam(userId, 'Message 9', lateTime);

      expect(result.isSpam).toBe(false);
    });
  });

  describe('Priority: Identical Message Detection First', () => {
    it('should detect identical spam even if rapid spam threshold is also met', () => {
      const message = 'Spam';
      const baseTime = new Date('2025-01-01T00:00:00Z');

      // Send 10 identical messages within 5 seconds
      // This meets both criteria, but identical should be detected first
      for (let i = 0; i < 9; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 500);
        detector.checkSpam(userId, message, timestamp);
      }

      const tenthTime = new Date(baseTime.getTime() + 4500);
      const result = detector.checkSpam(userId, message, tenthTime);

      expect(result.isSpam).toBe(true);
      expect(result.reason).toContain('identical messages');
    });
  });

  describe('User Isolation', () => {
    it('should track messages separately for different users', () => {
      const message = 'Test';
      const baseTime = new Date('2025-01-01T00:00:00Z');

      // User 1 sends 4 messages
      for (let i = 0; i < 4; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 1000);
        detector.checkSpam('user1', message, timestamp);
      }

      // User 2 sends 4 messages
      for (let i = 0; i < 4; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 1000);
        const result = detector.checkSpam('user2', message, timestamp);
        expect(result.isSpam).toBe(false);
      }
    });
  });

  describe('History Cleanup', () => {
    it('should clean up old messages to prevent memory leaks', () => {
      const baseTime = new Date('2025-01-01T00:00:00Z');

      // Send messages over 20 seconds
      for (let i = 0; i < 20; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 1000);
        detector.checkSpam(userId, `Message ${i}`, timestamp);
      }

      // Check that old messages are cleaned up
      // Only messages within the last 10 seconds should remain
      const messageCount = detector.getUserMessageCount(userId, 10);
      expect(messageCount).toBeLessThanOrEqual(10);
    });
  });

  describe('Custom Thresholds', () => {
    it('should respect custom identical message thresholds', () => {
      const customDetector = new SpamDetector({
        identicalMessages: 3,
        identicalWindow: 5,
        rapidMessages: 10,
        rapidWindow: 5,
      });

      const message = 'Test';
      const baseTime = new Date('2025-01-01T00:00:00Z');

      // Send 2 messages (should not trigger)
      for (let i = 0; i < 2; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 1000);
        const result = customDetector.checkSpam(userId, message, timestamp);
        expect(result.isSpam).toBe(false);
      }

      // 3rd message should trigger with custom threshold
      const thirdTime = new Date(baseTime.getTime() + 2000);
      const result = customDetector.checkSpam(userId, message, thirdTime);
      expect(result.isSpam).toBe(true);
    });

    it('should respect custom rapid message thresholds', () => {
      const customDetector = new SpamDetector({
        identicalMessages: 5,
        identicalWindow: 10,
        rapidMessages: 5,
        rapidWindow: 3,
      });

      const baseTime = new Date('2025-01-01T00:00:00Z');

      // Send 4 different messages
      for (let i = 0; i < 4; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 500);
        customDetector.checkSpam(userId, `Message ${i}`, timestamp);
      }

      // 5th message should trigger with custom threshold
      const fifthTime = new Date(baseTime.getTime() + 2000);
      const result = customDetector.checkSpam(userId, 'Message 4', fifthTime);
      expect(result.isSpam).toBe(true);
    });
  });

  describe('Utility Methods', () => {
    it('should clear user history', () => {
      const baseTime = new Date('2025-01-01T00:00:00Z');

      // Send some messages
      for (let i = 0; i < 5; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 1000);
        detector.checkSpam(userId, `Message ${i}`, timestamp);
      }

      // Clear history
      detector.clearUserHistory(userId);

      // Check that history is cleared
      const messageCount = detector.getUserMessageCount(userId, 10);
      expect(messageCount).toBe(0);
    });

    it('should clear all history', () => {
      const baseTime = new Date('2025-01-01T00:00:00Z');

      // Send messages for multiple users
      for (let i = 0; i < 3; i++) {
        detector.checkSpam(`user${i}`, 'Test', baseTime);
      }

      // Clear all history
      detector.clearAllHistory();

      // Check that all histories are cleared
      for (let i = 0; i < 3; i++) {
        const count = detector.getUserMessageCount(`user${i}`, 10);
        expect(count).toBe(0);
      }
    });

    it('should return correct message count for user', () => {
      const baseTime = new Date('2025-01-01T00:00:00Z');

      // Send 5 messages
      for (let i = 0; i < 5; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 1000);
        detector.checkSpam(userId, `Message ${i}`, timestamp);
      }

      const referenceTime = new Date(baseTime.getTime() + 5000);
      const count = detector.getUserMessageCount(userId, 10, referenceTime);
      expect(count).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message content', () => {
      const result = detector.checkSpam(userId, '', new Date());
      expect(result.isSpam).toBe(false);
    });

    it('should handle very long message content', () => {
      const longMessage = 'a'.repeat(10000);
      const result = detector.checkSpam(userId, longMessage, new Date());
      expect(result.isSpam).toBe(false);
    });

    it('should handle messages with special characters', () => {
      const message = '!@#$%^&*()_+{}[]|\\:";\'<>?,./';
      const baseTime = new Date('2025-01-01T00:00:00Z');

      for (let i = 0; i < 5; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 1000);
        detector.checkSpam(userId, message, timestamp);
      }

      const result = detector.checkSpam(
        userId,
        message,
        new Date(baseTime.getTime() + 5000)
      );
      expect(result.isSpam).toBe(true);
    });

    it('should handle messages with unicode characters', () => {
      const message = '你好世界 🌍 مرحبا';
      const baseTime = new Date('2025-01-01T00:00:00Z');

      for (let i = 0; i < 5; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 1000);
        detector.checkSpam(userId, message, timestamp);
      }

      const result = detector.checkSpam(
        userId,
        message,
        new Date(baseTime.getTime() + 5000)
      );
      expect(result.isSpam).toBe(true);
    });
  });
});
