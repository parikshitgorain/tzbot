/**
 * @file retention.service.ts
 * @description Data retention and cleanup service for GDPR compliance
 * @module core/data-retention
 */
import type { Pool } from 'pg';
/**
 * Configuration for data retention policies
 */
export interface RetentionConfig {
    messageContentRetentionDays: number;
    chatActivityRetentionDays: number;
    cleanupIntervalMinutes: number;
}
/**
 * Default retention configuration
 */
export declare const DEFAULT_RETENTION_CONFIG: RetentionConfig;
/**
 * Data retention service
 * Handles automatic cleanup of old data according to retention policies
 */
export declare class DataRetentionService {
    private readonly pool;
    private readonly config;
    private cleanupInterval;
    private isRunning;
    constructor(pool: Pool, config?: RetentionConfig);
    /**
     * Start the automatic cleanup scheduler
     */
    start(): void;
    /**
     * Stop the automatic cleanup scheduler
     */
    stop(): void;
    /**
     * Run all cleanup tasks
     */
    private runCleanup;
    /**
     * Delete message content older than retention period
     * Requirement 15.2: Message content should not be stored longer than 7 days
     */
    cleanupOldMessageContent(): Promise<number>;
    /**
     * Delete chat activity older than retention period
     */
    cleanupOldChatActivity(): Promise<number>;
    /**
     * Delete all data for a specific user (GDPR compliance)
     * Requirement 15.4: Provide /deletemydata command to remove all stored data
     */
    deleteAllUserData(userId: string): Promise<void>;
    /**
     * Get statistics about data retention
     */
    getRetentionStats(): Promise<{
        messageContentCount: number;
        oldMessageContentCount: number;
        chatActivityCount: number;
        oldChatActivityCount: number;
    }>;
}
//# sourceMappingURL=retention.service.d.ts.map