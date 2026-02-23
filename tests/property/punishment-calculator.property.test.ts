import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { PunishmentCalculator, PunishmentType } from '../../src/moderation/punishment-calculator.js';

describe('PunishmentCalculator – property-based tests', () => {
  const calc = new PunishmentCalculator();
  const validTypes = Object.values(PunishmentType);

  // -------------------------------------------------------------------------
  // Property 1: Offenses 1-2 always get WARNING
  // -------------------------------------------------------------------------

  it('offenses 1-2 always get WARNING', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2 }),   // offense count in [1,2]
        fc.integer({ min: 0, max: 100 }), // previous timeout (irrelevant for warnings)
        (offenseCount, previousTimeout) => {
          const punishment = calc.calculatePunishment(offenseCount, previousTimeout);
          return punishment.type === PunishmentType.WARNING;
        },
      ),
    );
  });

  // -------------------------------------------------------------------------
  // Property 2: Offenses 3-7 (no prior timeout) get TIMEOUT
  // -------------------------------------------------------------------------

  it('offenses 3-7 get TIMEOUT when previousTimeout is 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 7 }), // offense count in [3,7]
        (offenseCount) => {
          const punishment = calc.calculatePunishment(offenseCount, 0);
          return punishment.type === PunishmentType.TIMEOUT;
        },
      ),
    );
  });

  // -------------------------------------------------------------------------
  // Property 3: nextPunishment is always a non-empty string
  // -------------------------------------------------------------------------

  it('nextPunishment is always a non-empty string for offense counts 1-10', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (offenseCount) => {
          const desc = calc.getNextPunishmentDescription(offenseCount);
          return typeof desc === 'string' && desc.length > 0;
        },
      ),
    );
  });

  // -------------------------------------------------------------------------
  // Property 4: shouldResetOffenses returns false for dates within 29 days
  // -------------------------------------------------------------------------

  it('shouldResetOffenses: recent date (within 29 days) never triggers reset', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 29 * 24 * 60 * 60 * 1000 - 1 }), // ms within 29 days
        (msDiff) => {
          const recentDate = new Date(Date.now() - msDiff);
          return calc.shouldResetOffenses(recentDate) === false;
        },
      ),
    );
  });

  // -------------------------------------------------------------------------
  // Property 5: shouldResetOffenses returns true for dates 31+ days ago
  // -------------------------------------------------------------------------

  it('shouldResetOffenses: old date (31+ days ago) always triggers reset', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 365 * 24 * 60 * 60 * 1000 }), // up to 1 year extra
        (extraMs) => {
          const oldDate = new Date(Date.now() - (31 * 24 * 60 * 60 * 1000 + extraMs));
          return calc.shouldResetOffenses(oldDate) === true;
        },
      ),
    );
  });

  // -------------------------------------------------------------------------
  // Property 6: Punishment type is always one of the valid PunishmentType values
  // -------------------------------------------------------------------------

  it('punishment type is always one of the valid PunishmentType enum values', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        (offenseCount, previousTimeout) => {
          const punishment = calc.calculatePunishment(offenseCount, previousTimeout);
          return validTypes.includes(punishment.type as PunishmentType);
        },
      ),
    );
  });
});
