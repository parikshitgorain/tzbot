/**
 * @file violation-tracker.test.ts
 * @description Unit tests for ViolationTracker
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ViolationTracker } from '../../../src/moderation/violation-tracker.js';
import type { ViolationRepository } from '../../../src/core/database/repositories/ViolationRepository.js';
import { ViolationType, PunishmentLevel } from '../../../src/types/models.js';

describe('ViolationTracker', () => {
  let tracker: ViolationTracker;
  let mockRepo: ViolationRepository;

  beforeEach(() => {
    // Create mock repository
    mockRepo = {
      save: vi.fn().mockResolvedValue('violation-id'),
      get: vi.fn().mockResolvedValue([]),
      getCount: vi.fn().mockResolvedValue(0),
      clear: vi.fn().mockResolvedValue(undefined),
      clearOldViolations: vi.fn().mockResolvedValue(0),
      getLatest: vi.fn().mockResolvedValue(null),
    } as any;

    tracker = new ViolationTracker(mockRepo);
  });

  describe('recordViolation - Escalation Matrix', () => {
    it('should issue WARNING for first violation', async () => {
      // Mock: no previous violations
      vi.mocked(mockRepo.getCount).mockResolvedValue(0);

      const result = await tracker.recordViolation(
        'user123',
        ViolationType.SPAM,
        'Sent 5 identical messages'
      );

      expect(result.punishmentLevel).toBe(PunishmentLevel.WARNING);
      expect(result.violationCount).toBe(1);
      expect(result.reason).toContain('1st violation');
      expect(result.shouldNotify).toBe(true);

      // Verify violation was saved
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          type: ViolationType.SPAM,
          punishmentApplied: PunishmentLevel.WARNING,
        })
      );
    });

    it('should issue 1-hour TIMEOUT for second violation within 24 hours', async () => {
      // Mock: 1 violation in last 24h, 1 violation in last 7d
      vi.mocked(mockRepo.getCount)
        .mockResolvedValueOnce(1) // 24h count
        .mockResolvedValueOnce(1); // 7d count

      const result = await tracker.recordViolation(
        'user123',
        ViolationType.SPAM,
        'Sent 10 messages in 5 seconds'
      );

      expect(result.punishmentLevel).toBe(PunishmentLevel.TIMEOUT_1H);
      expect(result.violationCount).toBe(2);
      expect(result.reason).toContain('2nd violation within 24 hours');
      expect(result.shouldNotify).toBe(true);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          punishmentApplied: PunishmentLevel.TIMEOUT_1H,
        })
      );
    });

    it('should issue 24-hour TIMEOUT for third violation within 24 hours', async () => {
      // Mock: 2 violations in last 24h, 2 violations in last 7d
      vi.mocked(mockRepo.getCount)
        .mockResolvedValueOnce(2) // 24h count
        .mockResolvedValueOnce(2); // 7d count

      const result = await tracker.recordViolation(
        'user123',
        ViolationType.SPAM,
        'Repeated spam after timeout'
      );

      expect(result.punishmentLevel).toBe(PunishmentLevel.TIMEOUT_24H);
      expect(result.violationCount).toBe(3);
      expect(result.reason).toContain('3rd violation within 24 hours');
      expect(result.shouldNotify).toBe(true);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          punishmentApplied: PunishmentLevel.TIMEOUT_24H,
        })
      );
    });

    it('should issue BAN for fourth violation within 7 days', async () => {
      // Mock: 1 violation in last 24h (older ones expired), 3 violations in last 7d
      vi.mocked(mockRepo.getCount)
        .mockResolvedValueOnce(1) // 24h count
        .mockResolvedValueOnce(3); // 7d count

      const result = await tracker.recordViolation(
        'user123',
        ViolationType.SPAM,
        'Continued spam after multiple timeouts'
      );

      expect(result.punishmentLevel).toBe(PunishmentLevel.BAN);
      expect(result.violationCount).toBe(4);
      expect(result.reason).toContain('4th violation within 7 days');
      expect(result.shouldNotify).toBe(true);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          punishmentApplied: PunishmentLevel.BAN,
        })
      );
    });

    it('should handle violations with custom timestamps', async () => {
      vi.mocked(mockRepo.getCount).mockResolvedValue(0);

      const customTime = new Date('2024-01-15T12:00:00Z');
      const result = await tracker.recordViolation(
        'user123',
        ViolationType.SPAM,
        'Test violation',
        customTime
      );

      expect(result.punishmentLevel).toBe(PunishmentLevel.WARNING);

      // Verify the timestamp was passed to save
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: customTime,
        })
      );
    });
  });

  describe('shouldClearViolations', () => {
    it('should return true if user has old violations but none in last 7 days', async () => {
      // No violations in last 7 days
      vi.mocked(mockRepo.getCount).mockResolvedValue(0);
      
      // But has an old violation
      vi.mocked(mockRepo.getLatest).mockResolvedValue({
        id: 'old-violation',
        userId: 'user123',
        type: ViolationType.SPAM,
        severity: 1,
        timestamp: new Date('2024-01-01'),
        details: 'Old violation',
        punishmentApplied: PunishmentLevel.WARNING,
      });

      const result = await tracker.shouldClearViolations('user123');

      expect(result).toBe(true);
    });

    it('should return false if user has recent violations', async () => {
      // Has violations in last 7 days
      vi.mocked(mockRepo.getCount).mockResolvedValue(2);

      const result = await tracker.shouldClearViolations('user123');

      expect(result).toBe(false);
    });

    it('should return false if user has no violations at all', async () => {
      // No violations in last 7 days
      vi.mocked(mockRepo.getCount).mockResolvedValue(0);
      
      // No violations at all
      vi.mocked(mockRepo.getLatest).mockResolvedValue(null);

      const result = await tracker.shouldClearViolations('user123');

      expect(result).toBe(false);
    });
  });

  describe('clearExpiredViolations', () => {
    it('should clear violations if they have expired', async () => {
      // Mock: should clear
      vi.mocked(mockRepo.getCount).mockResolvedValue(0);
      vi.mocked(mockRepo.getLatest).mockResolvedValue({
        id: 'old-violation',
        userId: 'user123',
        type: ViolationType.SPAM,
        severity: 1,
        timestamp: new Date('2024-01-01'),
        details: 'Old violation',
      });

      await tracker.clearExpiredViolations('user123');

      expect(mockRepo.clear).toHaveBeenCalledWith('user123');
    });

    it('should not clear violations if they have not expired', async () => {
      // Mock: should not clear
      vi.mocked(mockRepo.getCount).mockResolvedValue(1);

      await tracker.clearExpiredViolations('user123');

      expect(mockRepo.clear).not.toHaveBeenCalled();
    });
  });

  describe('getViolationCount', () => {
    it('should return violation count for specified time window', async () => {
      vi.mocked(mockRepo.getCount).mockResolvedValue(3);

      const count = await tracker.getViolationCount(
        'user123',
        24 * 60 * 60 * 1000 // 24 hours
      );

      expect(count).toBe(3);
      expect(mockRepo.getCount).toHaveBeenCalledWith(
        'user123',
        expect.any(Date)
      );
    });

    it('should use custom reference time', async () => {
      vi.mocked(mockRepo.getCount).mockResolvedValue(2);

      const referenceTime = new Date('2024-01-15T12:00:00Z');
      const count = await tracker.getViolationCount(
        'user123',
        60 * 60 * 1000, // 1 hour
        referenceTime
      );

      expect(count).toBe(2);
    });
  });

  describe('getNextPunishmentLevel', () => {
    it('should return warning for user with no violations', async () => {
      vi.mocked(mockRepo.getCount).mockResolvedValue(0);

      const level = await tracker.getNextPunishmentLevel('user123');

      expect(level).toBe(PunishmentLevel.WARNING);
    });

    it('should return timeout_1h for user with 1 violation in 24h', async () => {
      vi.mocked(mockRepo.getCount)
        .mockResolvedValueOnce(1) // 24h
        .mockResolvedValueOnce(1); // 7d

      const level = await tracker.getNextPunishmentLevel('user123');

      expect(level).toBe(PunishmentLevel.TIMEOUT_1H);
    });

    it('should return timeout_24h for user with 2 violations in 24h', async () => {
      vi.mocked(mockRepo.getCount)
        .mockResolvedValueOnce(2) // 24h
        .mockResolvedValueOnce(2); // 7d

      const level = await tracker.getNextPunishmentLevel('user123');

      expect(level).toBe(PunishmentLevel.TIMEOUT_24H);
    });

    it('should return ban for user with 3 violations in 7d', async () => {
      vi.mocked(mockRepo.getCount)
        .mockResolvedValueOnce(0) // 24h (old violations expired)
        .mockResolvedValueOnce(3); // 7d

      const level = await tracker.getNextPunishmentLevel('user123');

      expect(level).toBe(PunishmentLevel.BAN);
    });
  });

  describe('Edge Cases', () => {
    it('should handle different violation types', async () => {
      vi.mocked(mockRepo.getCount).mockResolvedValue(0);

      const types = [
        ViolationType.SPAM,
        ViolationType.MALICIOUS_LINK,
        ViolationType.UNAUTHORIZED_POST,
        ViolationType.OTHER
      ];

      for (const type of types) {
        const result = await tracker.recordViolation(
          'user123',
          type,
          `Test ${type} violation`
        );

        expect(result.punishmentLevel).toBe(PunishmentLevel.WARNING);
        expect(mockRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({
            type,
          })
        );
      }
    });

    it('should handle violations at exact time boundaries', async () => {
      // Violation exactly 24 hours ago should not count
      const now = new Date('2024-01-15T12:00:00Z');
      const exactlyOneDayAgo = new Date('2024-01-14T12:00:00Z');

      vi.mocked(mockRepo.getCount).mockResolvedValue(0);

      const result = await tracker.recordViolation(
        'user123',
        ViolationType.SPAM,
        'Boundary test',
        now
      );

      expect(result.punishmentLevel).toBe(PunishmentLevel.WARNING);
    });

    it('should correctly calculate severity scores', async () => {
      vi.mocked(mockRepo.getCount).mockResolvedValue(0);

      await tracker.recordViolation('user123', ViolationType.SPAM, 'Test');

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 1, // warning = severity 1
        })
      );
    });
  });

  describe('Escalation Scenarios', () => {
    it('should handle rapid violations within 24 hours', async () => {
      const baseTime = new Date('2024-01-15T12:00:00Z');

      // First violation
      vi.mocked(mockRepo.getCount).mockResolvedValue(0);
      const result1 = await tracker.recordViolation(
        'user123',
        ViolationType.SPAM,
        'First spam',
        baseTime
      );
      expect(result1.punishmentLevel).toBe(PunishmentLevel.WARNING);

      // Second violation 1 hour later
      vi.mocked(mockRepo.getCount)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);
      const result2 = await tracker.recordViolation(
        'user123',
        ViolationType.SPAM,
        'Second spam',
        new Date(baseTime.getTime() + 60 * 60 * 1000)
      );
      expect(result2.punishmentLevel).toBe(PunishmentLevel.TIMEOUT_1H);

      // Third violation 2 hours later
      vi.mocked(mockRepo.getCount)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(2);
      const result3 = await tracker.recordViolation(
        'user123',
        ViolationType.SPAM,
        'Third spam',
        new Date(baseTime.getTime() + 3 * 60 * 60 * 1000)
      );
      expect(result3.punishmentLevel).toBe(PunishmentLevel.TIMEOUT_24H);
    });

    it('should handle violations spread over 7 days', async () => {
      const baseTime = new Date('2024-01-15T12:00:00Z');

      // Violation on day 1
      vi.mocked(mockRepo.getCount).mockResolvedValue(0);
      const result1 = await tracker.recordViolation(
        'user123',
        ViolationType.SPAM,
        'Day 1',
        baseTime
      );
      expect(result1.punishmentLevel).toBe(PunishmentLevel.WARNING);

      // Violation on day 3 (24h window expired, but within 7d)
      vi.mocked(mockRepo.getCount)
        .mockResolvedValueOnce(0) // No violations in last 24h
        .mockResolvedValueOnce(1); // 1 violation in last 7d
      const result2 = await tracker.recordViolation(
        'user123',
        ViolationType.SPAM,
        'Day 3',
        new Date(baseTime.getTime() + 2 * 24 * 60 * 60 * 1000)
      );
      expect(result2.punishmentLevel).toBe(PunishmentLevel.WARNING); // Resets to warning

      // Violation on day 5
      vi.mocked(mockRepo.getCount)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(2);
      const result3 = await tracker.recordViolation(
        'user123',
        ViolationType.SPAM,
        'Day 5',
        new Date(baseTime.getTime() + 4 * 24 * 60 * 60 * 1000)
      );
      expect(result3.punishmentLevel).toBe(PunishmentLevel.WARNING);

      // Fourth violation on day 6 (within 7d window)
      vi.mocked(mockRepo.getCount)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(3);
      const result4 = await tracker.recordViolation(
        'user123',
        ViolationType.SPAM,
        'Day 6',
        new Date(baseTime.getTime() + 5 * 24 * 60 * 60 * 1000)
      );
      expect(result4.punishmentLevel).toBe(PunishmentLevel.BAN); // 4th violation in 7 days
    });
  });
});
