import { describe, it, expect } from 'vitest';
import {
  PunishmentCalculator,
  PunishmentType,
} from '../../../src/moderation/punishment-calculator.js';

describe('PunishmentCalculator', () => {
  const calculator = new PunishmentCalculator();

  describe('calculatePunishment', () => {
    it('should return a WARNING for offense count 1', () => {
      const result = calculator.calculatePunishment(1, 0);
      expect(result.type).toBe(PunishmentType.WARNING);
      expect(result.duration).toBeUndefined();
    });

    it('should return a WARNING for offense count 2', () => {
      const result = calculator.calculatePunishment(2, 0);
      expect(result.type).toBe(PunishmentType.WARNING);
      expect(result.duration).toBeUndefined();
    });

    it('should return a 1-hour TIMEOUT for offense count 3', () => {
      const result = calculator.calculatePunishment(3, 0);
      expect(result.type).toBe(PunishmentType.TIMEOUT);
      expect(result.duration).toBe(1);
    });

    it('should return a 2-hour TIMEOUT for offense count 4', () => {
      const result = calculator.calculatePunishment(4, 0);
      expect(result.type).toBe(PunishmentType.TIMEOUT);
      expect(result.duration).toBe(2);
    });

    it('should return a 4-hour TIMEOUT for offense count 5', () => {
      const result = calculator.calculatePunishment(5, 0);
      expect(result.type).toBe(PunishmentType.TIMEOUT);
      expect(result.duration).toBe(4);
    });

    it('should return an 8-hour TIMEOUT for offense count 6', () => {
      const result = calculator.calculatePunishment(6, 0);
      expect(result.type).toBe(PunishmentType.TIMEOUT);
      expect(result.duration).toBe(8);
    });

    it('should return a 16-hour TIMEOUT for offense count 7', () => {
      const result = calculator.calculatePunishment(7, 0);
      expect(result.type).toBe(PunishmentType.TIMEOUT);
      expect(result.duration).toBe(16);
    });

    it('should return PERMANENT_BAN when duration would reach ban threshold (offense 8, previous 16h)', () => {
      const result = calculator.calculatePunishment(8, 16);
      expect(result.type).toBe(PunishmentType.PERMANENT_BAN);
      expect(result.duration).toBeUndefined();
    });

    it('should include nextPunishment description', () => {
      const result = calculator.calculatePunishment(1, 0);
      expect(result.nextPunishment).toBeTruthy();
      expect(typeof result.nextPunishment).toBe('string');
    });
  });

  describe('shouldResetOffenses', () => {
    it('should return true when last offense was more than 30 days ago', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);
      expect(calculator.shouldResetOffenses(oldDate)).toBe(true);
    });

    it('should return false when last offense was less than 30 days ago', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);
      expect(calculator.shouldResetOffenses(recentDate)).toBe(false);
    });

    it('should return false when last offense was exactly 29 days ago', () => {
      const date = new Date();
      date.setDate(date.getDate() - 29);
      expect(calculator.shouldResetOffenses(date)).toBe(false);
    });
  });

  describe('getNextPunishmentDescription', () => {
    it('should describe next punishment for each offense level', () => {
      for (let i = 1; i <= 8; i++) {
        const desc = calculator.getNextPunishmentDescription(i);
        expect(typeof desc).toBe('string');
        expect(desc.length).toBeGreaterThan(0);
      }
    });
  });
});
