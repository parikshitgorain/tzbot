/**
 * @file violation-tracker.test.ts
 * @description Unit tests for ViolationTracker (LEGACY - replaced by OffenseManager + PunishmentCalculator)
 * 
 * NOTE: This is a legacy/stub implementation. The actual punishment system uses:
 * - SpamDetector: Detects spam (5 identical messages in 10s OR 10 messages in 5s)
 * - OffenseManager + PunishmentCalculator: Handles progressive punishment escalation
 * 
 * See tests/unit/moderation/punishment-calculator.test.ts for the correct escalation tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ViolationTracker } from '../../../src/moderation/violation-tracker.js';
import type { ViolationRepository } from '../../../src/core/database/repositories/ViolationRepository.js';
import { ViolationType, PunishmentLevel } from '../../../src/types/models.js';

describe.skip('ViolationTracker (LEGACY)', () => {
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

      expect(result.punishment).toBe(PunishmentLevel.WARNING);
      expect(result.violationId).toBeDefined();

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

      expect(result.punishment).toBe(PunishmentLevel.TIMEOUT_1H);
      expect(result.violationId).toBeDefined();

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

      expect(result.punishment).toBe(PunishmentLevel.TIMEOUT_24H);
      expect(result.violationId).toBeDefined();

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

      expect(result.punishment).toBe(PunishmentLevel.BAN);
      expect(result.violationId).toBeDefined();

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          punishmentApplied: PunishmentLevel.BAN,
        })
      );
    });

    it('should handle violations with custom timestamps', async () => {
      vi.mocked(mockRepo.getCount).mockResolvedValue(0);

      const result = await tracker.recordViolation(
        'user123',
        ViolationType.SPAM,
        'Test violation'
      );

      expect(result.punishment).toBe(PunishmentLevel.WARNING);
      expect(result.violationId).toBeDefined();
    });
  });

  describe('clearViolations', () => {
    it('should clear violations for a user', async () => {
      await tracker.clearViolations('user123');

      expect(mockRepo.clear).toHaveBeenCalledWith('user123');
    });
  });



  describe('getViolationCount', () => {
    it('should return violation count for a user', async () => {
      vi.mocked(mockRepo.getCount).mockResolvedValue(3);

      const count = await tracker.getViolationCount('user123');

      expect(count).toBe(3);
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

        expect(result.punishment).toBe(PunishmentLevel.WARNING);
        expect(mockRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({
            type,
          })
        );
      }
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
      // First violation
      vi.mocked(mockRepo.getCount).mockResolvedValue(0);
      const result1 = await tracker.recordViolation(
        'user123',
        ViolationType.SPAM,
        'First spam'
      );
      expect(result1.punishment).toBe(PunishmentLevel.WARNING);

      // Second violation 1 hour later
      vi.mocked(mockRepo.getCount)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);
      const result2 = await tracker.recordViolation(
        'user123',
        ViolationType.SPAM,
        'Second spam'
      );
      expect(result2.punishment).toBe(PunishmentLevel.TIMEOUT_1H);

      // Third violation 2 hours later
      vi.mocked(mockRepo.getCount)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(2);
      const result3 = await tracker.recordViolation(
        'user123',
        ViolationType.SPAM,
        'Third spam'
      );
      expect(result3.punishment).toBe(PunishmentLevel.TIMEOUT_24H);
    });

    it('should handle violations spread over 7 days', async () => {
      // Violation on day 1
      vi.mocked(mockRepo.getCount).mockResolvedValue(0);
      const result1 = await tracker.recordViolation(
        'user123',
        ViolationType.SPAM,
        'Day 1'
      );
      expect(result1.punishment).toBe(PunishmentLevel.WARNING);

      // Violation on day 3 (24h window expired, but within 7d)
      vi.mocked(mockRepo.getCount)
        .mockResolvedValueOnce(0) // No violations in last 24h
        .mockResolvedValueOnce(1); // 1 violation in last 7d
      const result2 = await tracker.recordViolation(
        'user123',
        ViolationType.SPAM,
        'Day 3'
      );
      expect(result2.punishment).toBe(PunishmentLevel.WARNING); // Resets to warning

      // Violation on day 5
      vi.mocked(mockRepo.getCount)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(2);
      const result3 = await tracker.recordViolation(
        'user123',
        ViolationType.SPAM,
        'Day 5'
      );
      expect(result3.punishment).toBe(PunishmentLevel.WARNING);

      // Fourth violation on day 6 (within 7d window)
      vi.mocked(mockRepo.getCount)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(3);
      const result4 = await tracker.recordViolation(
        'user123',
        ViolationType.SPAM,
        'Day 6'
      );
      expect(result4.punishment).toBe(PunishmentLevel.BAN); // 4th violation in 7 days
    });
  });
});
