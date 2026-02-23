/**
 * @file spam-detector.ts
 * @description Spam detection system for TZBOT
 * @module moderation
 */
import type { SpamResult } from '../types/index.js';
/**
 * Spam detection thresholds from Requirements 4.5
 */
export interface SpamThresholds {
    /** Number of identical messages to trigger spam detection */
    identicalMessages: number;
    /** Time window (seconds) for identical message detection */
    identicalWindow: number;
    /** Number of rapid messages to trigger spam detection */
    rapidMessages: number;
    /** Time window (seconds) for rapid message detection */
    rapidWindow: number;
}
/**
 * Default spam detection thresholds
 * - 5+ identical messages within 10 seconds = spam
 * - 10+ messages within 5 seconds = spam
 */
export declare const DEFAULT_SPAM_THRESHOLDS: SpamThresholds;
/**
 * SpamDetector class
 * Implements spam detection algorithm for identical and rapid messages
 * Validates: Requirements 4.5
 */
export declare class SpamDetector {
    private userHistory;
    private thresholds;
    constructor(thresholds?: SpamThresholds);
    /**
     * Check if a message is spam
     * @param userId - Discord user ID
     * @param messageId - Discord message ID
     * @param messageContent - Message content to check
     * @param timestamp - Message timestamp (defaults to now)
     * @returns SpamResult with detection details
     */
    checkSpam(userId: string, messageId: string, messageContent: string, timestamp?: Date): SpamResult;
    /**
     * Check for identical message spam
     * Requirements 4.5: 5+ identical messages within 10 seconds
     */
    private checkIdenticalMessages;
    /**
     * Check for rapid message spam
     * Requirements 4.5: 10+ messages within 5 seconds
     */
    private checkRapidMessages;
    /**
     * Clean up old messages outside the detection window
     */
    private cleanupOldMessages;
    /**
     * Clear history for a specific user
     * Useful for testing or manual resets
     */
    clearUserHistory(userId: string): void;
    /**
     * Set spam cooldown for a user (1 minute)
     * During cooldown, ALL messages from this user should be deleted
     */
    setSpamCooldown(userId: string): void;
    /**
     * Check if a user is in spam cooldown
     * Returns true if the user should have ALL their messages deleted
     */
    isInSpamCooldown(userId: string): boolean;
    /**
     * Increment spam message count during cooldown
     */
    incrementSpamCount(userId: string): number;
    /**
     * Get total spam messages during cooldown
     */
    getSpamCount(userId: string): number;
    /**
     * Clear all user histories
     * Useful for testing
     */
    clearAllHistory(): void;
    /**
     * Get current message count for a user within a time window
     * Useful for monitoring and debugging
     * @param userId - User ID to check
     * @param windowSeconds - Time window in seconds
     * @param referenceTime - Reference time (defaults to now)
     */
    getUserMessageCount(userId: string, windowSeconds: number, referenceTime?: Date): number;
}
//# sourceMappingURL=spam-detector.d.ts.map