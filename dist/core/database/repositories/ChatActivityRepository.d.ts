import type { Pool } from 'pg';
/**
 * ChatActivityRepository handles chat activity tracking for chat rain system
 * Tracks user messages to determine active chatters
 * Uses Redis caching and batch writes to minimize database load
 */
export declare class ChatActivityRepository {
    private pool;
    private batchQueue;
    private batchTimer;
    private readonly BATCH_SIZE;
    private readonly BATCH_TIMEOUT_MS;
    private readonly CACHE_TTL;
    constructor(pool: Pool);
    /**
     * Record a chat activity event for a user
     * Uses batching to reduce database writes
     */
    record(userId: string, timestamp: Date): Promise<void>;
    /**
     * Flush batched chat activities to database
     */
    private flushBatch;
    /**
     * Force flush any pending batched writes
     * Should be called on shutdown
     */
    forceFlush(): Promise<void>;
    /**
     * Get active chatters who have sent messages since a specific time
     * Returns array of user IDs
     * Uses cache when possible
     */
    getActiveChatters(since: Date): Promise<string[]>;
    /**
     * Get message count for a user within a time window
     * Used to determine if user meets minimum message threshold (3+ messages)
     * Uses cache when possible
     */
    getMessageCount(userId: string, since: Date): Promise<number>;
    /**
     * Get users who meet the active chatter criteria
     * Must have sent at least minMessages within the time window
     */
    getQualifiedChatters(since: Date, minMessages?: number): Promise<string[]>;
    /**
     * Clean up old chat activity records
     * Should be run periodically to prevent table bloat
     */
    cleanupOldActivity(olderThan: Date): Promise<number>;
    /**
     * Record a chat rain winner
     * Used to track cooldown period (60 minutes)
     */
    recordWinner(userId: string, timestamp: Date, rewardType: string, rewardValue?: string): Promise<void>;
    /**
     * Get recent chat rain winners
     * Used to enforce cooldown period
     */
    getRecentWinners(since: Date): Promise<string[]>;
    /**
     * Check if a user has won chat rain recently
     * Returns true if user won within the cooldown period
     */
    hasRecentWin(userId: string, since: Date): Promise<boolean>;
    /**
     * Get the last chat rain winner timestamp
     * Used to enforce minimum delay between chat rain events
     */
    getLastChatRainTime(): Promise<Date | null>;
    /**
     * Get reward history for a user
     * Returns all rewards received by the user, optionally filtered by date
     */
    getRewardHistory(userId: string, since?: Date): Promise<RewardRecord[]>;
}
/**
 * Record of a reward distribution
 */
export interface RewardRecord {
    userId: string;
    timestamp: Date;
    rewardType: string;
    rewardValue?: string;
}
//# sourceMappingURL=ChatActivityRepository.d.ts.map