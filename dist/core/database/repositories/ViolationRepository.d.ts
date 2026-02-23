import type { Pool } from 'pg';
import type { Violation, ViolationType, PunishmentLevel } from '../../../types/models.js';
/**
 * ViolationRepository handles all violation-related database operations
 * Tracks user violations for spam escalation and moderation
 */
export declare class ViolationRepository {
    private pool;
    constructor(pool: Pool);
    /**
     * Save a new violation record
     * Used when a user violates rules (spam, malicious links, etc.)
     */
    save(violation: Omit<Violation, 'id'>): Promise<string>;
    /**
     * Get all violations for a user since a specific date
     * Used for escalation matrix calculations
     */
    get(userId: string, since: Date): Promise<Violation[]>;
    /**
     * Get violation count for a user within a time window
     * Used for spam detection and escalation
     */
    getCount(userId: string, since: Date, type?: ViolationType): Promise<number>;
    /**
     * Clear all violations for a user
     * Used when violation expiry period passes (7 days)
     */
    clear(userId: string): Promise<void>;
    /**
     * Clear old violations (older than 7 days)
     * Should be run periodically as a cleanup job
     */
    clearOldViolations(olderThan: Date): Promise<number>;
    /**
     * Get the most recent violation for a user
     * Used to determine next punishment level
     */
    getLatest(userId: string): Promise<Violation | null>;
    /**
     * Get violation count by punishment level within a time window
     * Used for progressive punishment system
     */
    getCountByPunishment(userId: string, since: Date, punishmentLevel: PunishmentLevel | PunishmentLevel[]): Promise<number>;
}
//# sourceMappingURL=ViolationRepository.d.ts.map