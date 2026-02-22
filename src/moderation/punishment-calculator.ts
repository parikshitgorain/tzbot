/**
 * @file punishment-calculator.ts
 * @description Calculates progressive punishments for spam offenses
 * @module moderation
 */

/**
 * Types of punishments that can be applied
 */
export enum PunishmentType {
  WARNING = 'WARNING',
  TIMEOUT = 'TIMEOUT',
  PERMANENT_BAN = 'PERMANENT_BAN',
}

/**
 * Represents a calculated punishment
 */
export interface Punishment {
  type: PunishmentType;
  duration?: number; // in hours, undefined for warnings and bans
  nextPunishment: string; // description of next punishment
}

/**
 * Calculates progressive punishments based on offense count
 * Implements the punishment ladder: warnings -> timeouts -> ban
 */
export class PunishmentCalculator {
  private static readonly RESET_PERIOD_DAYS = 30;
  private static readonly BAN_THRESHOLD_HOURS = 24;

  /**
   * Calculate punishment based on offense count and previous timeout
   *
   * Punishment ladder:
   * - Offense 1-2: WARNING
   * - Offense 3: 1 hour timeout
   * - Offense 4: 2 hour timeout
   * - Offense 5: 4 hour timeout
   * - Offense 6: 8 hour timeout
   * - Offense 7: 16 hour timeout
   * - Offense 8+: PERMANENT_BAN (would be 32h+)
   *
   * @param offenseCount - Current offense count (1-based)
   * @param previousTimeout - Previous timeout duration in hours
   * @returns Calculated punishment
   */
  calculatePunishment(offenseCount: number, previousTimeout: number): Punishment {
    // First two offenses are warnings
    if (offenseCount <= 2) {
      return {
        type: PunishmentType.WARNING,
        duration: undefined,
        nextPunishment: this.getNextPunishmentDescription(offenseCount),
      };
    }

    // Calculate timeout duration
    let duration: number;

    if (offenseCount === 3) {
      duration = 1; // 1 hour
    } else if (offenseCount === 4) {
      duration = 2; // 2 hours
    } else if (offenseCount === 5) {
      duration = 4; // 4 hours
    } else if (offenseCount === 6) {
      duration = 8; // 8 hours
    } else if (offenseCount === 7) {
      duration = 16; // 16 hours
    } else {
      // Offense 8+: double the previous timeout
      duration = previousTimeout * 2;
    }

    // Check if we've reached ban threshold
    if (duration >= PunishmentCalculator.BAN_THRESHOLD_HOURS) {
      return {
        type: PunishmentType.PERMANENT_BAN,
        duration: undefined,
        nextPunishment: 'Permanent ban - no further escalation',
      };
    }

    return {
      type: PunishmentType.TIMEOUT,
      duration,
      nextPunishment: this.getNextPunishmentDescription(offenseCount),
    };
  }

  /**
   * Check if offenses should be reset based on last offense timestamp
   * Offenses reset after 30 days of no violations
   *
   * @param lastOffenseTimestamp - Timestamp of last offense
   * @returns True if offenses should be reset
   */
  shouldResetOffenses(lastOffenseTimestamp: Date): boolean {
    const now = new Date();
    const daysSinceLastOffense =
      (now.getTime() - lastOffenseTimestamp.getTime()) / (1000 * 60 * 60 * 24);

    return daysSinceLastOffense >= PunishmentCalculator.RESET_PERIOD_DAYS;
  }

  /**
   * Get human-readable description of next punishment
   *
   * @param currentOffenseCount - Current offense count
   * @returns Description of what happens on next offense
   */
  getNextPunishmentDescription(currentOffenseCount: number): string {
    const nextCount = currentOffenseCount + 1;

    if (nextCount === 1) {
      return 'Next offense: Warning';
    } else if (nextCount === 2) {
      return 'Next offense: Final warning';
    } else if (nextCount === 3) {
      return 'Next offense: 1 hour timeout';
    } else if (nextCount === 4) {
      return 'Next offense: 2 hour timeout';
    } else if (nextCount === 5) {
      return 'Next offense: 4 hour timeout';
    } else if (nextCount === 6) {
      return 'Next offense: 8 hour timeout';
    } else if (nextCount === 7) {
      return 'Next offense: 16 hour timeout';
    } else {
      return 'Next offense: Permanent ban';
    }
  }
}
