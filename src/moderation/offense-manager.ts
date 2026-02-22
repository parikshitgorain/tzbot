/**
 * @file offense-manager.ts
 * @description Manages offense processing, punishment application, and offense history
 * @module moderation
 */

import type { Pool } from 'pg';
import type { OffenseRepository, OffenseRecord, OffenseEntry } from '@/core/database/repositories/OffenseRepository.js';
import type { PunishmentCalculator, Punishment } from './punishment-calculator.js';
import { PunishmentType } from './punishment-calculator.js';
import { logger, logError } from '@/core/logger/logger.js';

/**
 * NotificationService interface for punishment notifications
 */
export interface NotificationService {
  sendPunishmentNotification(
    userId: string,
    channelId: string,
    punishment: Punishment,
    reason: string,
    offenseCount: number
  ): Promise<NotificationResult>;
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
export class OffenseManager {
  constructor(
    private pool: Pool,
    private offenseRepository: OffenseRepository,
    private punishmentCalculator: PunishmentCalculator,
    private notificationService: NotificationService
  ) {
    logger.info('OffenseManager initialized');
  }

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
  async processOffense(
    userId: string,
    reason: string,
    moderatorId: string,
    channelId: string
  ): Promise<Punishment> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get current offense record
      let record = await this.offenseRepository.getOffenseRecord(userId);

      // Check if 30-day reset is needed
      if (record && record.last_offense_timestamp) {
        if (this.punishmentCalculator.shouldResetOffenses(record.last_offense_timestamp)) {
          logger.info('30-day reset triggered', { userId });
          await this.offenseRepository.resetOffenses(userId);
          record = null; // Start fresh
        }
      }

      // Initialize record if doesn't exist
      if (!record) {
        record = {
          user_id: userId,
          total_offenses: 0,
          last_offense_timestamp: null,
          current_timeout_duration: 0,
          is_banned: false,
          warning_history: [],
        };
      }

      // Increment offense count
      const newOffenseCount = record.total_offenses + 1;

      // Calculate punishment
      const punishment = this.punishmentCalculator.calculatePunishment(
        newOffenseCount,
        record.current_timeout_duration
      );

      // Update record
      record.total_offenses = newOffenseCount;
      record.last_offense_timestamp = new Date();
      
      if (punishment.type === PunishmentType.TIMEOUT && punishment.duration) {
        record.current_timeout_duration = punishment.duration;
      } else if (punishment.type === PunishmentType.PERMANENT_BAN) {
        record.is_banned = true;
        record.current_timeout_duration = 0;
      }

      // Save updated record
      await this.offenseRepository.saveOffenseRecord(record);

      // Add offense entry
      const entry: OffenseEntry = {
        timestamp: new Date(),
        reason,
        punishment_applied: punishment.type,
        moderator_id: moderatorId,
        timeout_duration: punishment.duration,
      };

      await this.offenseRepository.addOffenseEntry(userId, entry);

      await client.query('COMMIT');

      logger.info('Offense processed', {
        userId,
        offenseCount: newOffenseCount,
        punishmentType: punishment.type,
        duration: punishment.duration,
      });

      // Send notifications (don't block on failures)
      try {
        await this.notificationService.sendPunishmentNotification(
          userId,
          channelId,
          punishment,
          reason,
          newOffenseCount
        );
      } catch (error) {
        logError('Failed to send punishment notifications', error as Error, {
          userId,
          offenseCount: newOffenseCount,
        });
      }

      return punishment;
    } catch (error) {
      await client.query('ROLLBACK');
      logError('Failed to process offense', error as Error, { userId, reason });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get offense history for a user
   * 
   * @param userId - Discord user ID
   * @returns OffenseRecord or null if no history
   */
  async getOffenseHistory(userId: string): Promise<OffenseRecord | null> {
    try {
      return await this.offenseRepository.getOffenseRecord(userId);
    } catch (error) {
      logError('Failed to get offense history', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Clear the last offense for a user
   * Recalculates current_timeout_duration based on remaining offenses
   * 
   * @param userId - Discord user ID
   */
  async clearLastOffense(userId: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Remove last offense entry
      await this.offenseRepository.removeLastOffense(userId);

      // Get updated record
      const record = await this.offenseRepository.getOffenseRecord(userId);

      if (record && record.total_offenses > 0) {
        // Recalculate timeout duration based on new offense count
        const punishment = this.punishmentCalculator.calculatePunishment(
          record.total_offenses,
          0 // Reset to recalculate from scratch
        );

        record.current_timeout_duration = punishment.duration || 0;
        record.is_banned = punishment.type === PunishmentType.PERMANENT_BAN;

        await this.offenseRepository.saveOffenseRecord(record);
      }

      await client.query('COMMIT');

      logger.info('Last offense cleared', { userId });
    } catch (error) {
      await client.query('ROLLBACK');
      logError('Failed to clear last offense', error as Error, { userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reset all offenses for a user
   * Clears offense record and all entries
   * 
   * @param userId - Discord user ID
   */
  async resetAllOffenses(userId: string): Promise<void> {
    try {
      await this.offenseRepository.resetOffenses(userId);
      logger.info('All offenses reset', { userId });
    } catch (error) {
      logError('Failed to reset offenses', error as Error, { userId });
      throw error;
    }
  }
}
