/**
 * @file punishment-calculator.property.test.ts
 * @description Property-based tests for PunishmentCalculator
 * @module tests/property
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PunishmentCalculator, PunishmentType } from '@/moderation/punishment-calculator.js';

describe('PunishmentCalculator - Property-Based Tests', () => {
  const calculator = new PunishmentCalculator();

  /**
   * Property 1: Punishment Severity Monotonicity
   * **Validates: Requirements 1.1-1.7**
   * 
   * For any user, the punishment severity must never decrease as offense count increases
   */
  describe('Property 1: Punishment severity is monotonically increasing', () => {
    it('should never decrease severity as offense count increases', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 2, maxLength: 10 }),
          (offenseCounts) => {
            // Sort to ensure increasing offense counts
            const sortedCounts = [...offenseCounts].sort((a, b) => a - b);
            
            let previousSeverity = 0;
            let previousTimeout = 0;

            for (const count of sortedCounts) {
              const punishment = calculator.calculatePunishment(count, previousTimeout);
              const currentSeverity = getSeverity(punishment.type);

              // Severity should never decrease
              expect(currentSeverity).toBeGreaterThanOrEqual(previousSeverity);

              previousSeverity = currentSeverity;
              if (punishment.duration) {
                previousTimeout = punishment.duration;
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Timeout Duration Doubling
   * **Validates: Requirements 1.4-1.6, 8.1-8.4**
   * 
   * For offenses 3 through 7, each timeout duration must be exactly double the previous timeout duration
   */
  describe('Property 2: Timeout duration doubles correctly', () => {
    it('should double timeout duration for offenses 4-7', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 4, max: 7 }),
          (offenseCount) => {
            // Get previous punishment
            const previousPunishment = calculator.calculatePunishment(offenseCount - 1, 0);
            
            // Calculate current punishment with previous timeout
            const currentPunishment = calculator.calculatePunishment(
              offenseCount,
              previousPunishment.duration || 0
            );

            // For offenses 4-7, duration should double
            if (previousPunishment.duration && currentPunishment.duration) {
              expect(currentPunishment.duration).toBe(previousPunishment.duration * 2);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should follow exact doubling sequence: 1h -> 2h -> 4h -> 8h -> 16h', () => {
      const expectedSequence = [
        { offense: 3, duration: 1 },
        { offense: 4, duration: 2 },
        { offense: 5, duration: 4 },
        { offense: 6, duration: 8 },
        { offense: 7, duration: 16 },
      ];

      let previousTimeout = 0;
      for (const { offense, duration } of expectedSequence) {
        const punishment = calculator.calculatePunishment(offense, previousTimeout);
        expect(punishment.type).toBe(PunishmentType.TIMEOUT);
        expect(punishment.duration).toBe(duration);
        previousTimeout = punishment.duration!;
      }
    });
  });

  /**
   * Property 7: First Two Offenses Are Warnings
   * **Validates: Requirements 1.1-1.2**
   * 
   * The first and second offenses must always result in warnings with no timeout
   */
  describe('Property 7: First two offenses are always warnings', () => {
    it('should always return WARNING for offense counts 1 and 2', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }), // previousTimeout can be any value
          (previousTimeout) => {
            // First offense
            const punishment1 = calculator.calculatePunishment(1, previousTimeout);
            expect(punishment1.type).toBe(PunishmentType.WARNING);
            expect(punishment1.duration).toBeUndefined();

            // Second offense
            const punishment2 = calculator.calculatePunishment(2, previousTimeout);
            expect(punishment2.type).toBe(PunishmentType.WARNING);
            expect(punishment2.duration).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 8: Third Offense Timeout Duration
   * **Validates: Requirements 1.3, 8.1**
   * 
   * The third offense must always result in exactly a 1-hour timeout
   */
  describe('Property 8: Third offense is 1-hour timeout', () => {
    it('should always return 1-hour timeout for offense count 3', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }), // previousTimeout can be any value
          (previousTimeout) => {
            const punishment = calculator.calculatePunishment(3, previousTimeout);
            expect(punishment.type).toBe(PunishmentType.TIMEOUT);
            expect(punishment.duration).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Ban Threshold Enforcement
   * **Validates: Requirements 1.7, 8.5**
   * 
   * When calculated timeout duration reaches or exceeds 24 hours, a permanent ban must be applied
   */
  describe('Property 4: Ban applied when timeout >= 24 hours', () => {
    it('should apply permanent ban when timeout would be >= 24 hours', () => {
      // Offense 8 would be 32 hours (16 * 2)
      const punishment8 = calculator.calculatePunishment(8, 16);
      expect(punishment8.type).toBe(PunishmentType.PERMANENT_BAN);
      expect(punishment8.duration).toBeUndefined();
    });

    it('should apply ban for any offense that would result in >= 24h timeout', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 12, max: 100 }), // previousTimeout >= 12 would lead to 24h+
          (previousTimeout) => {
            // Any offense that would double to >= 24 hours
            const punishment = calculator.calculatePunishment(8, previousTimeout);
            
            if (previousTimeout * 2 >= 24) {
              expect(punishment.type).toBe(PunishmentType.PERMANENT_BAN);
              expect(punishment.duration).toBeUndefined();
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Additional property: Next punishment description is always provided
   */
  describe('Property: Next punishment description', () => {
    it('should always provide a next punishment description', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 0, max: 100 }),
          (offenseCount, previousTimeout) => {
            const punishment = calculator.calculatePunishment(offenseCount, previousTimeout);
            expect(punishment.nextPunishment).toBeDefined();
            expect(typeof punishment.nextPunishment).toBe('string');
            expect(punishment.nextPunishment.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: 30-day reset check
   */
  describe('Property: 30-day reset correctness', () => {
    it('should return true for dates >= 30 days ago', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 30, max: 365 }), // days in the past
          (daysAgo) => {
            const date = new Date();
            date.setDate(date.getDate() - daysAgo);
            
            const shouldReset = calculator.shouldResetOffenses(date);
            expect(shouldReset).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return false for dates < 30 days ago', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 29 }), // days in the past
          (daysAgo) => {
            const date = new Date();
            date.setDate(date.getDate() - daysAgo);
            
            const shouldReset = calculator.shouldResetOffenses(date);
            expect(shouldReset).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Helper function to get severity level for punishment type
 * WARNING = 1, TIMEOUT = 2, PERMANENT_BAN = 3
 */
function getSeverity(type: PunishmentType): number {
  switch (type) {
    case PunishmentType.WARNING:
      return 1;
    case PunishmentType.TIMEOUT:
      return 2;
    case PunishmentType.PERMANENT_BAN:
      return 3;
    default:
      return 0;
  }
}
