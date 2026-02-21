/**
 * @file retention.service.ts
 * @description Data retention and cleanup service for GDPR compliance
 * @module core/data-retention
 */

import { logger, logError } from '@/core/logger/logger.js';
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
export const DEFAULT_RETENTION_CONFIG: RetentionConfig = {
  messageContentRetentionDays: 7,
  chatActivityRetentionDays: 30,
  cleanupIntervalMinutes: 60, // Run cleanup every hour
};

/**
 * Data retention service
 * Handles automatic cleanup of old data according to retention policies
 */
export class DataRetentionService {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly pool: Pool,
    private readonly config: RetentionConfig = DEFAULT_RETENTION_CONFIG
  ) {}

  /**
   * Start the automatic cleanup scheduler
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Data retention service is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting data retention service', {
      messageRetentionDays: this.config.messageContentRetentionDays,
      chatActivityRetentionDays: this.config.chatActivityRetentionDays,
      cleanupIntervalMinutes: this.config.cleanupIntervalMinutes,
    });

    // Run cleanup immediately on start
    this.runCleanup().catch((error) => {
      logError('Initial cleanup failed', error as Error);
    });

    // Schedule periodic cleanup
    const intervalMs = this.config.cleanupIntervalMinutes * 60 * 1000;
    this.cleanupInterval = setInterval(() => {
      this.runCleanup().catch((error) => {
        logError('Scheduled cleanup failed', error as Error);
      });
    }, intervalMs);
  }

  /**
   * Stop the automatic cleanup scheduler
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.isRunning = false;
    logger.info('Data retention service stopped');
  }

  /**
   * Run all cleanup tasks
   */
  private async runCleanup(): Promise<void> {
    logger.info('Running data retention cleanup');

    const startTime = Date.now();
    const results = {
      messageContent: 0,
      chatActivity: 0,
    };

    try {
      // Clean up old message content
      results.messageContent = await this.cleanupOldMessageContent();

      // Clean up old chat activity
      results.chatActivity = await this.cleanupOldChatActivity();

      const duration = Date.now() - startTime;
      logger.info('Data retention cleanup completed', {
        duration,
        deletedMessageContent: results.messageContent,
        deletedChatActivity: results.chatActivity,
      });
    } catch (error) {
      logError('Data retention cleanup failed', error as Error);
      throw error;
    }
  }

  /**
   * Delete message content older than retention period
   * Requirement 15.2: Message content should not be stored longer than 7 days
   */
  async cleanupOldMessageContent(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.messageContentRetentionDays);

    try {
      const result = await this.pool.query(
        `DELETE FROM message_content 
         WHERE timestamp < $1 
         AND deleted_at IS NULL`,
        [cutoffDate]
      );

      const deletedCount = result.rowCount || 0;

      if (deletedCount > 0) {
        logger.info('Cleaned up old message content', {
          deletedCount,
          cutoffDate: cutoffDate.toISOString(),
        });
      }

      return deletedCount;
    } catch (error) {
      throw new Error(
        `Failed to cleanup old message content: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete chat activity older than retention period
   */
  async cleanupOldChatActivity(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.chatActivityRetentionDays);

    try {
      const result = await this.pool.query(
        `DELETE FROM chat_activity 
         WHERE timestamp < $1`,
        [cutoffDate]
      );

      const deletedCount = result.rowCount || 0;

      if (deletedCount > 0) {
        logger.info('Cleaned up old chat activity', {
          deletedCount,
          cutoffDate: cutoffDate.toISOString(),
        });
      }

      return deletedCount;
    } catch (error) {
      throw new Error(
        `Failed to cleanup old chat activity: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete all data for a specific user (GDPR compliance)
   * Requirement 15.4: Provide /deletemydata command to remove all stored data
   */
  async deleteAllUserData(userId: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Delete message content
      await client.query('DELETE FROM message_content WHERE user_id = $1', [userId]);

      // Delete chat activity
      await client.query('DELETE FROM chat_activity WHERE user_id = $1', [userId]);

      // Delete chat rain winners
      await client.query('DELETE FROM chat_rain_winners WHERE user_id = $1', [userId]);

      // Delete giveaway entries
      await client.query('DELETE FROM giveaway_entries WHERE user_id = $1', [userId]);

      // Delete violations (will cascade from user deletion, but explicit for clarity)
      await client.query('DELETE FROM violations WHERE user_id = $1', [userId]);

      // Delete moderation logs where user is the target
      await client.query('DELETE FROM moderation_logs WHERE target_user_id = $1', [userId]);

      // Delete user record (this will cascade to violations due to foreign key)
      await client.query('DELETE FROM users WHERE discord_id = $1', [userId]);

      await client.query('COMMIT');

      logger.info('Deleted all user data', { userId });
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(
        `Failed to delete user data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get statistics about data retention
   */
  async getRetentionStats(): Promise<{
    messageContentCount: number;
    oldMessageContentCount: number;
    chatActivityCount: number;
    oldChatActivityCount: number;
  }> {
    const messageCutoff = new Date();
    messageCutoff.setDate(messageCutoff.getDate() - this.config.messageContentRetentionDays);

    const activityCutoff = new Date();
    activityCutoff.setDate(activityCutoff.getDate() - this.config.chatActivityRetentionDays);

    try {
      const [messageTotal, messageOld, activityTotal, activityOld] = await Promise.all([
        this.pool.query('SELECT COUNT(*) FROM message_content WHERE deleted_at IS NULL'),
        this.pool.query('SELECT COUNT(*) FROM message_content WHERE timestamp < $1 AND deleted_at IS NULL', [
          messageCutoff,
        ]),
        this.pool.query('SELECT COUNT(*) FROM chat_activity'),
        this.pool.query('SELECT COUNT(*) FROM chat_activity WHERE timestamp < $1', [activityCutoff]),
      ]);

      return {
        messageContentCount: parseInt(messageTotal.rows[0].count, 10),
        oldMessageContentCount: parseInt(messageOld.rows[0].count, 10),
        chatActivityCount: parseInt(activityTotal.rows[0].count, 10),
        oldChatActivityCount: parseInt(activityOld.rows[0].count, 10),
      };
    } catch (error) {
      throw new Error(
        `Failed to get retention stats: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
