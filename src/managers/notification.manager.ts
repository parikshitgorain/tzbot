/**
 * @file notification.manager.ts
 * @description Notification manager for delivering Premium_Embeds to Discord channels
 * @module managers
 */

import { EmbedBuilder } from 'discord.js';
import type { IDiscordClient } from '@/core/discord/client.js';
import type { NotificationEvent, EventType } from '@/types/models.js';
import { logger, logError } from '@/core/logger/logger.js';
import { v4 as uuidv4 } from 'uuid';

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

      // Send to primary channel (Requirement 1.4)
      await this.discordClient.sendMessage(this.config.primaryChannelId, {
        embeds: [embed],
      });

      const deliveryTime = Date.now() - startTime;
      logger.info('Notification delivered', {
        eventId: event.id,
        eventType: event.type,
        channelId: this.config.primaryChannelId,
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
        primaryChannelId: this.config.primaryChannelId,
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
    if (this.config.fallbackChannelId) {
      try {
        const embed = this.formatPremiumEmbed(embedData, event.timestamp);
        await this.discordClient.sendMessage(this.config.fallbackChannelId, {
          embeds: [embed],
        });

        logger.info('Notification delivered to fallback channel', {
          eventId: event.id,
          eventType: event.type,
          fallbackChannelId: this.config.fallbackChannelId,
        });
        return;
      } catch (fallbackError) {
        logError(
          'Failed to deliver notification to fallback channel',
          fallbackError as Error,
          {
            eventId: event.id,
            eventType: event.type,
            fallbackChannelId: this.config.fallbackChannelId,
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

        // Try primary channel first
        await this.discordClient.sendMessage(this.config.primaryChannelId, {
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
        if (this.config.fallbackChannelId) {
          try {
            const embed = this.formatPremiumEmbed(
              notification.embedData,
              notification.event.timestamp
            );
            await this.discordClient.sendMessage(this.config.fallbackChannelId, {
              embeds: [embed],
            });

            logger.info('Queued notification delivered to fallback', {
              queueId: notification.id,
              eventId: notification.event.id,
              attempts: notification.attempts,
            });

            this.notificationQueue.delete(notification.id);
          } catch (fallbackError) {
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
}
