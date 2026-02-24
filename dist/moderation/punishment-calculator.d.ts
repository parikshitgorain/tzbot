/**
 * @file punishment-calculator.ts
 * @description Calculates progressive punishments for spam offenses
 * @module moderation
 */
/**
 * Types of punishments that can be applied
 */
export declare enum PunishmentType {
    WARNING = "WARNING",
    TIMEOUT = "TIMEOUT",
    PERMANENT_BAN = "PERMANENT_BAN"
}
/**
 * Represents a calculated punishment
 */
export interface Punishment {
    type: PunishmentType;
    duration?: number;
    nextPunishment: string;
}
/**
 * Calculates progressive punishments based on offense count
 * Implements the punishment ladder: warnings -> timeouts -> ban
 */
export declare class PunishmentCalculator {
    private static readonly RESET_PERIOD_DAYS;
    private static readonly BAN_THRESHOLD_HOURS;
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
    calculatePunishment(offenseCount: number, previousTimeout: number): Punishment;
    /**
     * Check if offenses should be reset based on last offense timestamp
     * Offenses reset after 30 days of no violations
     *
     * @param lastOffenseTimestamp - Timestamp of last offense
     * @returns True if offenses should be reset
     */
    shouldResetOffenses(lastOffenseTimestamp: Date): boolean;
    /**
     * Get human-readable description of next punishment
     *
     * @param currentOffenseCount - Current offense count
     * @returns Description of what happens on next offense
     */
    getNextPunishmentDescription(currentOffenseCount: number): string;
}
//# sourceMappingURL=punishment-calculator.d.ts.map