/**
 * @file punishment-calculator.test.ts
 * @description Unit tests for PunishmentCalculator
 */

import { describe, it, expect } from 'vitest';
import { PunishmentCalculator, PunishmentType } from '../../../src/moderation/punishment-calculator.js';

describe('PunishmentCalculator', () => {
  const calculator = new PunishmentCalculator();

  describe('calculatePunishment - Progressive Escalation', () => {
    it('should issue WARNING for 1st offense', () => {
      const punishment = calculator.calculatePunishment(1, 0);

      expect(punishment.type).toBe(PunishmentType.WARNING);
      expect(punishment.duration).toBeUndefined();
      expect(punishment.nextPunishment).toContain('Final warning');
    });

    it('should issue WARNING for 2nd offense', () => {
      const punishment = calculator.calculatePunishment(2, 0);

      expect(punishment.type).toBe(PunishmentType.WARNING);
      expect(punishment.duration).toBeUndefined();
      expect(punishment.nextPunishment).toContain('1 hour timeout');
    });

    it('should issue 1-hour TIMEOUT for 3rd offense', () => {
      const punishment = calculator.calculatePunishment(3, 0);

      expect(punishment.type).toBe(PunishmentType.TIMEOUT);
      expect(punishment.duration).toBe(1);
      expect(punishment.nextPunishment).toContain('2 hour timeout');
    });

    it('should issue 2-hour TIMEOUT for 4th offense', () => {
      const punishment = calculator.calculatePunishment(4, 1);

      expect(punishment.type).toBe(PunishmentType.TIMEOUT);
      expect(punishment.duration).toBe(2);
      expect(punishment.nextPunishment).toContain('4 hour timeout');
    });

    it('should issue 4-hour TIMEOUT for 5th offense', () => {
      const punishment = calculator.calculatePunishment(5, 2);

      expect(punishment.type).toBe(PunishmentType.TIMEOUT);
      expect(punishment.duration).toBe(4);
      expect(punishment.nextPunishment).toContain('8 hour timeout');
    });

    it('should issue 8-hour TIMEOUT for 6th offense', () => {
      const punishment = calculator.calculatePunishment(6, 4);

      expect(punishment.type).toBe(PunishmentType.TIMEOUT);
      expect(punishment.duration).toBe(8);
      expect(punishment.nextPunishment).toContain('16 hour timeout');
    });

    it('should issue 16-hour TIMEOUT for 7th offense', () => {
      const punishment = calculator.calculatePunishment(7, 8);

      expect(punishment.type).toBe(PunishmentType.TIMEOUT);
      expect(punishment.duration).toBe(16);
      expect(punishment.nextPunishment).toContain('Permanent ban');
    });

    it('should issue PERMANENT_BAN for 8th offense (32 hours >= 24 hour threshold)', () => {
      const punishment = calculator.calculatePunishment(8, 16);

      expect(punishment.type).toBe(PunishmentType.PERMANENT_BAN);
      expect(punishment.duration).toBeUndefined();
      expect(punishment.nextPunishment).toContain('Permanent ban - no further escalation');
    });

    it('should issue PERMANENT_BAN for any offense that would result in 24+ hour timeout', () => {
      const punishment = calculator.calculatePunishment(9, 32);

      expect(punishment.type).toBe(PunishmentType.PERMANENT_BAN);
      expect(punishment.duration).toBeUndefined();
    });
  });

  describe('shouldResetOffenses', () => {
    it('should return false if last offense was less than 30 days ago', () => {
      const twentyNineDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
      const shouldReset = calculator.shouldResetOffenses(twentyNineDaysAgo);

      expect(shouldReset).toBe(false);
    });

    it('should return true if last offense was exactly 30 days ago', () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const shouldReset = calculator.shouldResetOffenses(thirtyDaysAgo);

      expect(shouldReset).toBe(true);
    });

    it('should return true if last offense was more than 30 days ago', () => {
      const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      const shouldReset = calculator.shouldResetOffenses(fortyDaysAgo);

      expect(shouldReset).toBe(true);
    });

    it('should return false if last offense was 1 day ago', () => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const shouldReset = calculator.shouldResetOffenses(oneDayAgo);

      expect(shouldReset).toBe(false);
    });
  });

  describe('getNextPunishmentDescription', () => {
    it('should return correct description for offense 0 (next is 1st)', () => {
      const description = calculator.getNextPunishmentDescription(0);
      expect(description).toBe('Next offense: Warning');
    });

    it('should return correct description for offense 1 (next is 2nd)', () => {
      const description = calculator.getNextPunishmentDescription(1);
      expect(description).toBe('Next offense: Final warning');
    });

    it('should return correct description for offense 2 (next is 3rd)', () => {
      const description = calculator.getNextPunishmentDescription(2);
      expect(description).toBe('Next offense: 1 hour timeout');
    });

    it('should return correct description for offense 3 (next is 4th)', () => {
      const description = calculator.getNextPunishmentDescription(3);
      expect(description).toBe('Next offense: 2 hour timeout');
    });

    it('should return correct description for offense 4 (next is 5th)', () => {
      const description = calculator.getNextPunishmentDescription(4);
      expect(description).toBe('Next offense: 4 hour timeout');
    });

    it('should return correct description for offense 5 (next is 6th)', () => {
      const description = calculator.getNextPunishmentDescription(5);
      expect(description).toBe('Next offense: 8 hour timeout');
    });

    it('should return correct description for offense 6 (next is 7th)', () => {
      const description = calculator.getNextPunishmentDescription(6);
      expect(description).toBe('Next offense: 16 hour timeout');
    });

    it('should return correct description for offense 7+ (next is ban)', () => {
      const description = calculator.getNextPunishmentDescription(7);
      expect(description).toBe('Next offense: Permanent ban');
    });

    it('should return ban description for offense 10+', () => {
      const description = calculator.getNextPunishmentDescription(10);
      expect(description).toBe('Next offense: Permanent ban');
    });
  });

  describe('Edge Cases', () => {
    it('should handle offense count of 0 gracefully', () => {
      const punishment = calculator.calculatePunishment(0, 0);
      // Should treat as pre-first offense
      expect(punishment.type).toBe(PunishmentType.WARNING);
    });

    it('should handle very high offense counts', () => {
      const punishment = calculator.calculatePunishment(100, 16);
      expect(punishment.type).toBe(PunishmentType.PERMANENT_BAN);
    });

    it('should handle negative offense count gracefully', () => {
      const punishment = calculator.calculatePunishment(-1, 0);
      expect(punishment.type).toBe(PunishmentType.WARNING);
    });
  });

  describe('Complete Escalation Scenario', () => {
    it('should follow complete escalation path from 1st offense to ban', () => {
      let previousTimeout = 0;

      // 1st offense: Warning
      let punishment = calculator.calculatePunishment(1, previousTimeout);
      expect(punishment.type).toBe(PunishmentType.WARNING);

      // 2nd offense: Warning
      punishment = calculator.calculatePunishment(2, previousTimeout);
      expect(punishment.type).toBe(PunishmentType.WARNING);

      // 3rd offense: 1h timeout
      punishment = calculator.calculatePunishment(3, previousTimeout);
      expect(punishment.type).toBe(PunishmentType.TIMEOUT);
      expect(punishment.duration).toBe(1);
      previousTimeout = punishment.duration!;

      // 4th offense: 2h timeout
      punishment = calculator.calculatePunishment(4, previousTimeout);
      expect(punishment.type).toBe(PunishmentType.TIMEOUT);
      expect(punishment.duration).toBe(2);
      previousTimeout = punishment.duration!;

      // 5th offense: 4h timeout
      punishment = calculator.calculatePunishment(5, previousTimeout);
      expect(punishment.type).toBe(PunishmentType.TIMEOUT);
      expect(punishment.duration).toBe(4);
      previousTimeout = punishment.duration!;

      // 6th offense: 8h timeout
      punishment = calculator.calculatePunishment(6, previousTimeout);
      expect(punishment.type).toBe(PunishmentType.TIMEOUT);
      expect(punishment.duration).toBe(8);
      previousTimeout = punishment.duration!;

      // 7th offense: 16h timeout
      punishment = calculator.calculatePunishment(7, previousTimeout);
      expect(punishment.type).toBe(PunishmentType.TIMEOUT);
      expect(punishment.duration).toBe(16);
      previousTimeout = punishment.duration!;

      // 8th offense: Ban (would be 32h)
      punishment = calculator.calculatePunishment(8, previousTimeout);
      expect(punishment.type).toBe(PunishmentType.PERMANENT_BAN);
      expect(punishment.duration).toBeUndefined();
    });
  });
});
