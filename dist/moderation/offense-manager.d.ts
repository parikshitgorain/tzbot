/**
 * @file offense-manager.ts
 * @description Manages offense processing, punishment application, and offense history
 * @module moderation
 */
import type { Pool } from 'pg';
import type { OffenseRepository, OffenseRecord } from '../core/database/repositories/OffenseRepository.js';
import type { PunishmentCalculator, Punishment } from './punishment-calculator.js';
/**
 * NotificationService interface for punishment notifications
 */
export interface NotificationService {
    sendPunishmentNotification(userId: string, channelId: string, punishment: Punishment, reason: string, offenseCount: number): Promise<NotificationResult>;
}
/**
 * Result of notification delivery attempts
 */
export interface NotificationResult {
    dmSent: boolean;
    ephemeralSent: boolean;
    modLogSent: boolean;
    failures: string[];
}
/**
 * OffenseManager orchestrates offense processing and punishment application
 *
 * Responsibilities:
 * - Process new offenses with automatic 30-day reset
 * - Calculate and apply progressive punishments
 * - Manage offense history (view, clear, reset)
 * - Coordinate with notification service
 * - Ensure transactional integrity
 */
export declare class OffenseManager {
    private pool;
    private offenseRepository;
    private punishmentCalculator;
    private notificationService;
    constructor(pool: Pool, offenseRepository: OffenseRepository, punishmentCalculator: PunishmentCalculator, notificationService: NotificationService);
    /**
     * Process a new offense for a user
     *
     * Flow:
     * 1. Check if 30-day reset is needed
     * 2. Get or create offense record
     * 3. Calculate punishment based on offense count
     * 4. Update offense record and add entry
     * 5. Send notifications
     * 6. Return punishment for caller to apply
     *
     * @param userId - Discord user ID
     * @param reason - Reason for the offense
     * @param moderatorId - Discord ID of moderator issuing the offense
     * @param channelId - Channel where offense occurred
     * @returns Punishment to be applied by caller
     */
    processOffense(userId: string, reason: string, moderatorId: string, channelId: string): Promise<Punishment>;
    /**
     * Get offense history for a user
     *
     * @param userId - Discord user ID
     * @returns OffenseRecord or null if no history
     */
    getOffenseHistory(userId: string): Promise<OffenseRecord | null>;
    /**
     * Clear the last offense for a user
     * Recalculates current_timeout_duration based on remaining offenses
     *
     * @param userId - Discord user ID
     */
    clearLastOffense(userId: string): Promise<void>;
    /**
     * Reset all offenses for a user
     * Clears offense record and all entries
     *
     * @param userId - Discord user ID
     */
    resetAllOffenses(userId: string): Promise<void>;
}
//# sourceMappingURL=offense-manager.d.ts.map