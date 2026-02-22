/**
 * @file notification.manager.ts
 * @description Notification manager for delivering Premium_Embeds to Discord channels
 * @module managers
 */

import { EmbedBuilder } from 'discord.js';
import type { IDiscordClient } from '@/core/discord/client.js';
import type { NotificationEvent } from '@/types/models.js';
import { logger, logError } from '@/core/logger/logger.js';
import { v4 as uuidv4 } from 'uuid';
import type { Punishment } from '@/moderation/punishment-calculator.js';
import { PunishmentType } from '@/moderation/punishment-calculator.js';
import type { NotificationResult } from '@/moderation/offense-manager.js';

/**
 * Premium embed data structure
 */
export interface PremiumEmbedData {
  title: string;
  description: string;
  thumbnail?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
}

/**
 * Notification queue entry for retry logic
 */
interface QueuedNotification {
  id: string;
  event: NotificationEvent;
  embedData: PremiumEmbedData;
  attempts: number;
  lastAttempt?: Date;
  createdAt: Date;
}

/**
 * Notification manager configuration
 */
export interface NotificationManagerConfig {
  primaryChannelId: string;
  fallbackChannelId?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  getChannelId?: () => string; // Dynamic channel ID getter
  getFallbackChannelId?: () => string | undefined; // Dynamic fallback channel ID getter
  modLogChannelId?: string; // Mod-log channel for punishment notifications
  getModLogChannelId?: () => string | undefined; // Dynamic mod-log channel ID getter
}

/**
 * Notification manager for delivering Premium_Embeds
 * 
 * Requirements:
 * - 1.1: Deliver Premium_Embed within 1 second
 * - 1.2: Format embeds with title, description, thumbnail, timestamp, color
 * - 1.3: Deliver multiple events in chronological order
 * - 1.4: Only send to designated channel
 * - 1.5: Fallback channel delivery on error
 */
export class NotificationManager {
  private discordClient: IDiscordClient;
  private config: NotificationManagerConfig;
  private notificationQueue: Map<string, QueuedNotification>;
  private processingQueue: boolean = false;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(
    discordClient: IDiscordClient,
    config: NotificationManagerConfig
  ) {
    this.discordClient = discordClient;
    this.config = config;
    this.notificationQueue = new Map();
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 5000;

    logger.info('NotificationManager initialized', {
      primaryChannelId: config.primaryChannelId,
      fallbackChannelId: config.fallbackChannelId,
      maxRetries: this.maxRetries,
      retryDelayMs: this.retryDelayMs,
    });
  }

  /**
   * Get the current primary channel ID (supports dynamic updates)
   */
  private getPrimaryChannelId(): string {
    return this.config.getChannelId?.() || this.config.primaryChannelId;
  }

  /**
   * Get the current fallback channel ID (supports dynamic updates)
   */
  private getFallbackChannelId(): string | undefined {
    return this.config.getFallbackChannelId?.() || this.config.fallbackChannelId;
  }

  /**
   * Get the mod-log channel ID for punishment notifications
   */
  private getModLogChannelId(): string | undefined {
    return this.config.getModLogChannelId?.() || this.config.modLogChannelId;
  }

  /**
   * Send a notification event as a Premium_Embed
   * Requirement 1.1: Deliver within 1 second
   * Requirement 1.4: Only send to designated channel
   */
  async sendNotification(
    event: NotificationEvent,
    embedData: PremiumEmbedData
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Format Premium_Embed (Requirement 1.2)
      const embed = this.formatPremiumEmbed(embedData, event.timestamp);

      // Get current primary channel ID (supports dynamic updates)
      const primaryChannelId = this.getPrimaryChannelId();

      // Send to primary channel (Requirement 1.4)
      await this.discordClient.sendMessage(primaryChannelId, {
        embeds: [embed],
      });

      const deliveryTime = Date.now() - startTime;
      logger.info('Notification delivered', {
        eventId: event.id,
        eventType: event.type,
        channelId: primaryChannelId,
        deliveryTimeMs: deliveryTime,
      });

      // Log warning if delivery took longer than 1 second
      if (deliveryTime > 1000) {
        logger.warn('Notification delivery exceeded 1 second', {
          eventId: event.id,
          deliveryTimeMs: deliveryTime,
        });
      }
    } catch (error) {
      // Requirement 1.5: Fallback channel delivery on error
      logError('Failed to deliver notification to primary channel', error as Error, {
        eventId: event.id,
        eventType: event.type,
        primaryChannelId: this.getPrimaryChannelId(),
      });

      await this.handleDeliveryFailure(event, embedData);
    }
  }

  /**
   * Format a Premium_Embed with all required fields
   * Requirement 1.2: Include title, description, thumbnail, timestamp, color
   */
  private formatPremiumEmbed(
    data: PremiumEmbedData,
    timestamp: Date
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(data.title)
      .setDescription(data.description)
      .setTimestamp(timestamp)
      .setColor(data.color ?? 0x5865f2); // Default Discord blurple

    if (data.thumbnail) {
      embed.setThumbnail(data.thumbnail);
    }

    if (data.fields && data.fields.length > 0) {
      embed.addFields(data.fields);
    }

    return embed;
  }

  /**
   * Handle delivery failure with fallback channel
   * Requirement 1.5: Log error and attempt delivery to fallback channel
   */
  private async handleDeliveryFailure(
    event: NotificationEvent,
    embedData: PremiumEmbedData
  ): Promise<void> {
    // Try fallback channel if configured
    const fallbackChannelId = this.getFallbackChannelId();
    if (fallbackChannelId) {
      try {
        const embed = this.formatPremiumEmbed(embedData, event.timestamp);
        await this.discordClient.sendMessage(fallbackChannelId, {
          embeds: [embed],
        });

        logger.info('Notification delivered to fallback channel', {
          eventId: event.id,
          eventType: event.type,
          fallbackChannelId,
        });
        return;
      } catch {
        logError(
          'Failed to deliver notification to fallback channel',
          fallbackError as Error,
          {
            eventId: event.id,
            eventType: event.type,
            fallbackChannelId,
          }
        );
      }
    }

    // Queue for retry if both channels failed
    this.queueForRetry(event, embedData);
  }

  /**
   * Queue a notification for retry
   */
  private queueForRetry(
    event: NotificationEvent,
    embedData: PremiumEmbedData
  ): void {
    // Validate channel IDs before queueing
    const primaryChannelId = this.getPrimaryChannelId();
    const fallbackChannelId = this.getFallbackChannelId();
    const invalidIds = ['123456789012345678']; // Known placeholder IDs
    
    // Don't queue if channel IDs are still placeholders
    if (invalidIds.includes(primaryChannelId) || 
        (fallbackChannelId && invalidIds.includes(fallbackChannelId))) {
      logger.warn('Skipping notification queue - channel IDs are placeholders', {
        eventId: event.id,
        primaryChannelId,
        fallbackChannelId
      });
      return;
    }

    const queuedNotification: QueuedNotification = {
      id: uuidv4(),
      event,
      embedData,
      attempts: 0,
      createdAt: new Date(),
    };

    this.notificationQueue.set(queuedNotification.id, queuedNotification);

    logger.info('Notification queued for retry', {
      queueId: queuedNotification.id,
      eventId: event.id,
      eventType: event.type,
      queueSize: this.notificationQueue.size,
    });

    // Start processing queue if not already running
    if (!this.processingQueue) {
      this.processQueue();
    }
  }

  /**
   * Process the notification retry queue
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue) {
      return;
    }

    this.processingQueue = true;

    while (this.notificationQueue.size > 0) {
      // Get oldest notification (chronological order - Requirement 1.3)
      const entries = Array.from(this.notificationQueue.values());
      entries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      const notification = entries[0];

      // Check if we should retry
      if (notification.attempts >= this.maxRetries) {
        logger.error('Notification exceeded max retries', {
          queueId: notification.id,
          eventId: notification.event.id,
          attempts: notification.attempts,
          maxRetries: this.maxRetries,
        });
        this.notificationQueue.delete(notification.id);
        continue;
      }

      // Wait for retry delay
      if (notification.lastAttempt) {
        const timeSinceLastAttempt =
          Date.now() - notification.lastAttempt.getTime();
        if (timeSinceLastAttempt < this.retryDelayMs) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryDelayMs - timeSinceLastAttempt)
          );
        }
      }

      // Attempt delivery
      notification.attempts++;
      notification.lastAttempt = new Date();

      try {
        const embed = this.formatPremiumEmbed(
          notification.embedData,
          notification.event.timestamp
        );

        // Get current primary channel ID (supports dynamic updates)
        const primaryChannelId = this.getPrimaryChannelId();

        // Try primary channel first
        await this.discordClient.sendMessage(primaryChannelId, {
          embeds: [embed],
        });

        logger.info('Queued notification delivered', {
          queueId: notification.id,
          eventId: notification.event.id,
          attempts: notification.attempts,
        });

        this.notificationQueue.delete(notification.id);
      } catch (error) {
        logError('Retry attempt failed', error as Error, {
          queueId: notification.id,
          eventId: notification.event.id,
          attempts: notification.attempts,
        });

        // Try fallback channel
        const fallbackChannelId = this.getFallbackChannelId();
        if (fallbackChannelId) {
          try {
            const embed = this.formatPremiumEmbed(
              notification.embedData,
              notification.event.timestamp
            );
            await this.discordClient.sendMessage(fallbackChannelId, {
              embeds: [embed],
            });

            logger.info('Queued notification delivered to fallback', {
              queueId: notification.id,
              eventId: notification.event.id,
              attempts: notification.attempts,
            });

            this.notificationQueue.delete(notification.id);
          } catch {
            // Keep in queue for next retry
            logger.warn('Fallback also failed, will retry', {
              queueId: notification.id,
              eventId: notification.event.id,
              attempts: notification.attempts,
            });
          }
        }
      }
    }

    this.processingQueue = false;
  }

  /**
   * Send multiple notifications in chronological order
   * Requirement 1.3: Deliver all Premium_Embeds in chronological order
   */
  async sendNotifications(
    events: Array<{ event: NotificationEvent; embedData: PremiumEmbedData }>
  ): Promise<void> {
    // Sort by timestamp (chronological order)
    const sortedEvents = events.sort(
      (a, b) => a.event.timestamp.getTime() - b.event.timestamp.getTime()
    );

    logger.info('Sending multiple notifications', {
      count: sortedEvents.length,
      eventTypes: sortedEvents.map((e) => e.event.type),
    });

    // Send in order
    for (const { event, embedData } of sortedEvents) {
      await this.sendNotification(event, embedData);
    }
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    queueSize: number;
    processing: boolean;
    oldestQueuedAt?: Date;
  } {
    const entries = Array.from(this.notificationQueue.values());
    const oldestEntry = entries.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    )[0];

    return {
      queueSize: this.notificationQueue.size,
      processing: this.processingQueue,
      oldestQueuedAt: oldestEntry?.createdAt,
    };
  }

  /**
   * Clear the notification queue
   */
  clearQueue(): void {
    const queueSize = this.notificationQueue.size;
    this.notificationQueue.clear();
    logger.info('Notification queue cleared', { clearedCount: queueSize });
  }

  /**
   * Validate and clean queue on startup
   * Removes notifications with invalid channel IDs (placeholder values)
   */
  validateAndCleanQueue(): void {
    logger.info('Starting queue validation', {
      currentQueueSize: this.notificationQueue.size,
      primaryChannelId: this.getPrimaryChannelId(),
      fallbackChannelId: this.getFallbackChannelId()
    });

    const invalidIds = ['123456789012345678']; // Known placeholder IDs
    const primaryChannelId = this.getPrimaryChannelId();
    const fallbackChannelId = this.getFallbackChannelId();
    
    // If current channel IDs are still placeholders, clear entire queue
    if (invalidIds.includes(primaryChannelId) || 
        (fallbackChannelId && invalidIds.includes(fallbackChannelId))) {
      logger.warn('Current channel IDs are placeholders, clearing notification queue', {
        primaryChannelId,
        fallbackChannelId,
        queueSize: this.notificationQueue.size
      });
      this.clearQueue();
      return;
    }

    // Remove any queued notifications that were created with invalid channel IDs
    let removedCount = 0;
    for (const [id, notification] of this.notificationQueue.entries()) {
      // Check if notification is too old (more than 1 hour)
      const age = Date.now() - notification.createdAt.getTime();
      if (age > 3600000) { // 1 hour in milliseconds
        this.notificationQueue.delete(id);
        removedCount++;
        logger.debug('Removed stale notification from queue', {
          queueId: id,
          eventId: notification.event.id,
          ageMs: age
        });
      }
    }

    if (removedCount > 0) {
      logger.info('Cleaned notification queue on startup', {
        removedCount,
        remainingCount: this.notificationQueue.size
      });
    } else {
      logger.info('No stale notifications found in queue', {
        queueSize: this.notificationQueue.size
      });
    }
  }

  /**
   * Send punishment notification through triple notification system
   * Requirement 3.1-3.4: DM, ephemeral message, and mod-log notification
   * 
   * @param userId - Discord user ID
   * @param channelId - Channel where offense occurred
   * @param punishment - Calculated punishment
   * @param reason - Reason for the offense
   * @param offenseCount - Current offense count
   * @returns NotificationResult with success flags and failures
   */
  async sendPunishmentNotification(
    userId: string,
    channelId: string,
    punishment: Punishment,
    reason: string,
    offenseCount: number
  ): Promise<NotificationResult> {
    const result: NotificationResult = {
      dmSent: false,
      ephemeralSent: false,
      modLogSent: false,
      failures: [],
    };

    // Format punishment description
    const punishmentDescription = this.formatPunishmentDescription(punishment);

    // 1. Send DM to user
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle('⚠️ Moderation Action')
        .setDescription(`You have received a ${punishmentDescription}`)
        .addFields(
          { name: 'Reason', value: reason, inline: false },
          { name: 'Offense Count', value: offenseCount.toString(), inline: true },
          { name: 'Current Punishment', value: punishmentDescription, inline: true },
          { name: 'Next Offense', value: punishment.nextPunishment, inline: false }
        )
        .setColor(this.getPunishmentColor(punishment.type))
        .setTimestamp();

      await this.discordClient.sendDirectMessage(userId, {
        embeds: [dmEmbed],
      });

      result.dmSent = true;
      logger.info('DM notification sent', { userId, offenseCount });
    } catch (error) {
      const errorMsg = `Failed to send DM: ${(error as Error).message}`;
      result.failures.push(errorMsg);
      logError('Failed to send DM notification', error as Error, { userId });
    }

    // 2. Send ephemeral message in channel
    try {
      const ephemeralEmbed = new EmbedBuilder()
        .setTitle('⚠️ Moderation Action')
        .setDescription(`You have received a ${punishmentDescription} for: ${reason}`)
        .addFields(
          { name: 'Offense Count', value: offenseCount.toString(), inline: true },
          { name: 'Next Offense', value: punishment.nextPunishment, inline: false }
        )
        .setColor(this.getPunishmentColor(punishment.type))
        .setTimestamp();

      // Note: Ephemeral messages require interaction context
      // For now, we'll send a regular message that can be deleted
      await this.discordClient.sendMessage(channelId, {
        content: `<@${userId}>`,
        embeds: [ephemeralEmbed],
      });

      result.ephemeralSent = true;
      logger.info('Ephemeral notification sent', { userId, channelId, offenseCount });
    } catch (error) {
      const errorMsg = `Failed to send ephemeral message: ${(error as Error).message}`;
      result.failures.push(errorMsg);
      logError('Failed to send ephemeral notification', error as Error, { userId, channelId });
    }

    // 3. Send mod-log notification
    try {
      const modLogChannelId = this.getModLogChannelId();
      
      if (modLogChannelId) {
        const modLogEmbed = new EmbedBuilder()
          .setTitle('🔨 Moderation Action Applied')
          .setDescription(`Punishment applied to <@${userId}>`)
          .addFields(
            { name: 'User', value: `<@${userId}>`, inline: true },
            { name: 'Action', value: punishmentDescription, inline: true },
            { name: 'Offense Count', value: offenseCount.toString(), inline: true },
            { name: 'Reason', value: reason, inline: false },
            { name: 'Channel', value: `<#${channelId}>`, inline: true }
          )
          .setColor(this.getPunishmentColor(punishment.type))
          .setTimestamp();

        await this.discordClient.sendMessage(modLogChannelId, {
          embeds: [modLogEmbed],
        });

        result.modLogSent = true;
        logger.info('Mod-log notification sent', { userId, offenseCount, modLogChannelId });
      } else {
        const errorMsg = 'Mod-log channel not configured';
        result.failures.push(errorMsg);
        logger.warn('Mod-log channel not configured, skipping notification');
      }
    } catch (error) {
      const errorMsg = `Failed to send mod-log notification: ${(error as Error).message}`;
      result.failures.push(errorMsg);
      logError('Failed to send mod-log notification', error as Error, { userId });
    }

    return result;
  }

  /**
   * Format punishment description for display
   */
  private formatPunishmentDescription(punishment: Punishment): string {
    switch (punishment.type) {
      case PunishmentType.WARNING:
        return 'warning';
      case PunishmentType.TIMEOUT:
        return `${punishment.duration} hour timeout`;
      case PunishmentType.PERMANENT_BAN:
        return 'permanent ban';
      default:
        return 'unknown punishment';
    }
  }

  /**
   * Get color for punishment type
   */
  private getPunishmentColor(type: PunishmentType): number {
    switch (type) {
      case PunishmentType.WARNING:
        return 0xffa500; // Orange
      case PunishmentType.TIMEOUT:
        return 0xff6b6b; // Red
      case PunishmentType.PERMANENT_BAN:
        return 0x8b0000; // Dark red
      default:
        return 0x5865f2; // Discord blurple
    }
  }
}
