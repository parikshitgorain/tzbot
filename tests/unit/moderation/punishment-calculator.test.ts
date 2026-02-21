/**
 * @file punishment-calculator.test.ts
 * @description Unit tests for PunishmentCalculator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PunishmentCalculator, PunishmentType } from '../../../src/moderation/punishment-calculator.js';

describe('PunishmentCalculator', () => {
  let calculator: PunishmentCalculator;

  beforeEach(() => {
    calculator = new PunishmentCalculator();
  });

  describe('calculatePunishment', () => {
    it('should return WARNING for first offense', () => {
      const punishment = calculator.calculatePunishment(1, 0);
      
      expect(punishment.type).toBe(PunishmentType.WARNING);
      expect(punishment.duration).toBeUndefined();
      expect(punishment.nextPunishment).toBe('Next offense: Final warning');
    });

    it('should return WARNING for second offense', () => {
      const punishment = calculator.calculatePunishment(2, 0);
      
      expect(punishment.type).toBe(PunishmentType.WARNING);
      expect(punishment.duration).toBeUndefined();
      expect(punishment.nextPunishment).toBe('Next offense: 1 hour timeout');
    });

    it('should return 1 hour TIMEOUT for third offense', () => {
      const punishment = calculator.calculatePunishment(3, 0);
      
      expect(punishment.type).toBe(PunishmentType.TIMEOUT);
      expect(punishment.duration).toBe(1);
      expect(punishment.nextPunishment).toBe('Next offense: 2 hour timeout');
    });

    it('should return 2 hour TIMEOUT for fourth offense', () => {
      const punishment = calculator.calculatePunishment(4, 1);
      
      expect(punishment.type).toBe(PunishmentType.TIMEOUT);
      expect(punishment.duration).toBe(2);
      expect(punishment.nextPunishment).toBe('Next offense: 4 hour timeout');
    });

    it('should return 4 hour TIMEOUT for fifth offense', () => {
      const punishment = calculator.calculatePunishment(5, 2);
      
      expect(punishment.type).toBe(PunishmentType.TIMEOUT);
      expect(punishment.duration).toBe(4);
      expect(punishment.nextPunishment).toBe('Next offense: 8 hour timeout');
    });

    it('should return 8 hour TIMEOUT for sixth offense', () => {
      const punishment = calculator.calculatePunishment(6, 4);
      
      expect(punishment.type).toBe(PunishmentType.TIMEOUT);
      expect(punishment.duration).toBe(8);
      expect(punishment.nextPunishment).toBe('Next offense: 16 hour timeout');
    });

    it('should return 16 hour TIMEOUT for seventh offense', () => {
      const punishment = calculator.calculatePunishment(7, 8);
      
      expect(punishment.type).toBe(PunishmentType.TIMEOUT);
      expect(punishment.duration).toBe(16);
      expect(punishment.nextPunishment).toBe('Next offense: Permanent ban');
    });

    it('should return PERMANENT_BAN for eighth offense (would be 32h)', () => {
      const punishment = calculator.calculatePunishment(8, 16);
      
      expect(punishment.type).toBe(PunishmentType.PERMANENT_BAN);
      expect(punishment.duration).toBeUndefined();
      expect(punishment.nextPunishment).toBe('Permanent ban - no further escalation');
    });

    it('should return PERMANENT_BAN when calculated timeout >= 24 hours', () => {
      const punishment = calculator.calculatePunishment(8, 16);
      
      // 16 * 2 = 32 hours, which is >= 24
      expect(punishment.type).toBe(PunishmentType.PERMANENT_BAN);
      expect(punishment.duration).toBeUndefined();
    });

    it('should handle edge case at exactly 24 hours', () => {
      // If previous timeout was 12 hours, next would be 24
      const punishment = calculator.calculatePunishment(8, 12);
      
      expect(punishment.type).toBe(PunishmentType.PERMANENT_BAN);
      expect(punishment.duration).toBeUndefined();
    });
  });

  describe('shouldResetOffenses', () => {
    it('should return true when 30 days have passed', () => {
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
      
      const shouldReset = calculator.shouldResetOffenses(thirtyOneDaysAgo);
      
      expect(shouldReset).toBe(true);
    });

    it('should return true when exactly 30 days have passed', () => {
      const exactlyThirtyDaysAgo = new Date();
      exactlyThirtyDaysAgo.setDate(exactlyThirtyDaysAgo.getDate() - 30);
      
      const shouldReset = calculator.shouldResetOffenses(exactlyThirtyDaysAgo);
      
      expect(shouldReset).toBe(true);
    });

    it('should return false when less than 30 days have passed', () => {
      const twentyNineDaysAgo = new Date();
      twentyNineDaysAgo.setDate(twentyNineDaysAgo.getDate() - 29);
      
      const shouldReset = calculator.shouldResetOffenses(twentyNineDaysAgo);
      
      expect(shouldReset).toBe(false);
    });

    it('should return false when only 1 day has passed', () => {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const shouldReset = calculator.shouldResetOffenses(oneDayAgo);
      
      expect(shouldReset).toBe(false);
    });

    it('should return false for recent offense (same day)', () => {
      const now = new Date();
      
      const shouldReset = calculator.shouldResetOffenses(now);
      
      expect(shouldReset).toBe(false);
    });
  });

  describe('getNextPunishmentDescription', () => {
    it('should describe next punishment for offense 0', () => {
      const description = calculator.getNextPunishmentDescription(0);
      expect(description).toBe('Next offense: Warning');
    });

    it('should describe next punishment for offense 1', () => {
      const description = calculator.getNextPunishmentDescription(1);
      expect(description).toBe('Next offense: Final warning');
    });

    it('should describe next punishment for offense 2', () => {
      const description = calculator.getNextPunishmentDescription(2);
      expect(description).toBe('Next offense: 1 hour timeout');
    });

    it('should describe next punishment for offense 3', () => {
      const description = calculator.getNextPunishmentDescription(3);
      expect(description).toBe('Next offense: 2 hour timeout');
    });

    it('should describe next punishment for offense 4', () => {
      const description = calculator.getNextPunishmentDescription(4);
      expect(description).toBe('Next offense: 4 hour timeout');
    });

    it('should describe next punishment for offense 5', () => {
      const description = calculator.getNextPunishmentDescription(5);
      expect(description).toBe('Next offense: 8 hour timeout');
    });

    it('should describe next punishment for offense 6', () => {
      const description = calculator.getNextPunishmentDescription(6);
      expect(description).toBe('Next offense: 16 hour timeout');
    });

    it('should describe permanent ban for offense 7+', () => {
      const description = calculator.getNextPunishmentDescription(7);
      expect(description).toBe('Next offense: Permanent ban');
    });

    it('should describe permanent ban for high offense counts', () => {
      const description = calculator.getNextPunishmentDescription(10);
      expect(description).toBe('Next offense: Permanent ban');
    });
  });
});
