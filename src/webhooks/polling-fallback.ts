/**
 * @file polling-fallback.ts
 * @description Polling fallback system for Kick API when webhooks fail
 * @module webhooks
 * 
 * Requirements:
 * - 8.3: Activate polling if webhooks fail for 3 consecutive events or 60 seconds
 * - 8.4: Check Kick API every 10 seconds while polling is active
 * - 8.5: Deactivate polling when webhooks resume functioning
 * - 8.6: Log all monitoring system transitions
 */

import { logger, logError } from '@/core/logger/logger.js';
import type { KickAPIClient } from '@/services/kick/client.js';
import type { NotificationManager } from '@/managers/notification.manager.js';
import type { KickWebhookHandler } from './kick-webhook.js';
import type { KickEvent, KickEventType } from '@/services/kick/types.js';
import { EventType } from '@/types/models.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Monitoring system state
 */
export type MonitoringState = 'webhook' | 'polling' | 'transitioning';

/**
 * Polling fallback configuration
 */
export interface PollingFallbackConfig {
  kickAPIClient: KickAPIClient;
  notificationManager: NotificationManager;
  webhookHandler: KickWebhookHandler;
  channelId: number;
  notificationChannelId: string;
  pollingIntervalMs?: number;
  enabled?: boolean;
}

/**
 * System transition event
 */
interface SystemTransition {
  from: MonitoringState;
  to: MonitoringState;
  reason: string;
  timestamp: Date;
}

/**
 * Polling fallback system
 * 
 * Monitors webhook health and automatically switches to polling when webhooks fail.
 * Automatically recovers to webhooks when they resume functioning.
 */
export class PollingFallbackSystem {
  private kickAPIClient: KickAPIClient;
  private notificationManager: NotificationManager;
  private webhookHandler: KickWebhookHandler;
  private channelId: number;
  private notificationChannelId: string;
  private pollingIntervalMs: number;
  private enabled: boolean;

  private currentState: MonitoringState = 'webhook';
  private pollingTimer: NodeJS.Timeout | null = null;
  private lastPolledEventTimestamp: Date | null = null;
  private transitionHistory: SystemTransition[] = [];
  private isPolling: boolean = false;

  constructor(config: PollingFallbackConfig) {
    this.kickAPIClient = config.kickAPIClient;
    this.notificationManager = config.notificationManager;
    this.webhookHandler = config.webhookHandler;
    this.channelId = config.channelId;
    this.notificationChannelId = config.notificationChannelId;
    this.pollingIntervalMs = config.pollingIntervalMs ?? 10000; // 10 seconds (Requirement 8.4)
    this.enabled = config.enabled ?? true;

    logger.info('PollingFallbackSystem initialized', {
      channelId: this.channelId,
      pollingIntervalMs: this.pollingIntervalMs,
      enabled: this.enabled,
    });
  }

  /**
   * Start monitoring webhook health and activate polling if needed
   */
  start(): void {
    if (!this.enabled) {
      logger.info('Polling fallback system is disabled');
      return;
    }

    logger.info('Starting polling fallback system');

    // Check webhook health periodically
    this.checkWebhookHealth();
    
    // Set up periodic health checks (every 5 seconds)
    setInterval(() => {
      this.checkWebhookHealth();
    }, 5000);
  }

  /**
   * Stop the polling fallback system
   */
  stop(): void {
    logger.info('Stopping polling fallback system');
    
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    this.isPolling = false;
  }

  /**
   * Check webhook health and activate polling if needed
   * Requirement 8.3: Activate polling if webhooks fail
   */
  private checkWebhookHealth(): void {
    const shouldFallback = this.webhookHandler.shouldActivatePollingFallback();

    if (shouldFallback && this.currentState === 'webhook') {
      // Transition to polling
      this.transitionToPolling('Webhook failure threshold exceeded');
    } else if (!shouldFallback && this.currentState === 'polling') {
      // Webhooks recovered, transition back
      this.transitionToWebhook('Webhooks resumed functioning');
    }
  }

  /**
   * Transition from webhook to polling mode
   * Requirement 8.3: Activate polling fallback
   * Requirement 8.6: Log system transitions
   */
  private transitionToPolling(reason: string): void {
    if (this.isPolling) {
      return; // Already polling
    }

    logger.warn('Transitioning to polling mode', {
      reason,
      webhookHealth: this.webhookHandler.getHealthStatus(),
    });

    // Record transition (Requirement 8.6)
    this.recordTransition('webhook', 'polling', reason);

    this.currentState = 'polling';
    this.isPolling = true;

    // Start polling (Requirement 8.4: Check every 10 seconds)
    this.startPolling();
  }

  /**
   * Transition from polling back to webhook mode
   * Requirement 8.5: Deactivate polling when webhooks resume
   * Requirement 8.6: Log system transitions
   */
  private transitionToWebhook(reason: string): void {
    if (!this.isPolling) {
      return; // Not polling
    }

    logger.info('Transitioning back to webhook mode', {
      reason,
      webhookHealth: this.webhookHandler.getHealthStatus(),
    });

    // Record transition (Requirement 8.6)
    this.recordTransition('polling', 'webhook', reason);

    this.currentState = 'webhook';
    this.isPolling = false;

    // Stop polling
    this.stopPolling();

    // Reset webhook failure count
    this.webhookHandler.resetFailureCount();
  }

  /**
   * Start polling the Kick API
   * Requirement 8.4: Check Kick API every 10 seconds
   */
  private startPolling(): void {
    logger.info('Starting Kick API polling', {
      intervalMs: this.pollingIntervalMs,
      channelId: this.channelId,
    });

    // Set initial timestamp to now (to avoid fetching old events)
    if (!this.lastPolledEventTimestamp) {
      this.lastPolledEventTimestamp = new Date();
    }

    // Poll immediately
    this.pollKickAPI();

    // Set up periodic polling
    this.pollingTimer = setInterval(() => {
      this.pollKickAPI();
    }, this.pollingIntervalMs);
  }

  /**
   * Stop polling the Kick API
   */
  private stopPolling(): void {
    logger.info('Stopping Kick API polling');

    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * Poll the Kick API for new events
   */
  private async pollKickAPI(): Promise<void> {
    try {
      logger.debug('Polling Kick API for events', {
        channelId: this.channelId,
        since: this.lastPolledEventTimestamp,
      });

      // Fetch events since last poll
      const events = await this.kickAPIClient.getLiveEvents(
        this.channelId,
        this.lastPolledEventTimestamp || new Date()
      );

      if (events.length > 0) {
        logger.info('Received events from polling', {
          eventCount: events.length,
          eventTypes: events.map(e => e.type),
        });

        // Process each event
        for (const event of events) {
          await this.processPolledEvent(event);
        }

        // Update last polled timestamp to the latest event
        const latestEvent = events.reduce((latest, current) => {
          const currentTime = current.timestamp.getTime();
          const latestTime = latest.timestamp.getTime();
          return currentTime > latestTime ? current : latest;
        });

        this.lastPolledEventTimestamp = latestEvent.timestamp;
      } else {
        logger.debug('No new events from polling');
      }
    } catch (error) {
      logError('Error polling Kick API', error as Error, {
        additionalContext: {
          channelId: this.channelId,
        },
      });
    }
  }

  /**
   * Process an event received from polling
   */
  private async processPolledEvent(event: KickEvent): Promise<void> {
    try {
      logger.info('Processing polled event', {
        eventType: event.type,
        eventId: event.id,
        timestamp: event.timestamp,
      });

      // Convert to notification event
      const notificationEvent = {
        id: uuidv4(),
        type: this.mapEventType(event.type),
        channelId: this.notificationChannelId,
        data: event.data,
        timestamp: event.timestamp,
        delivered: false,
      };

      // Generate embed data
      const embedData = this.generateEmbedData(event);

      // Send notification
      await this.notificationManager.sendNotification(
        notificationEvent,
        embedData
      );

      logger.info('Polled event processed successfully', {
        eventType: event.type,
        eventId: event.id,
      });
    } catch (error) {
      logError('Error processing polled event', error as Error, {
        additionalContext: {
          eventType: event.type,
          eventId: event.id,
        },
      });
    }
  }

  /**
   * Map Kick event type to internal event type
   */
  private mapEventType(kickEventType: KickEventType): EventType {
    const eventMap: Record<KickEventType, EventType> = {
      'stream_live': EventType.STREAM_LIVE,
      'stream_offline': EventType.STREAM_OFFLINE,
      'new_subscriber': EventType.NEW_SUBSCRIBER,
      'new_vip': EventType.NEW_VIP,
      'raid': EventType.RAID,
      'host': EventType.HOST,
    };

    return eventMap[kickEventType];
  }

  /**
   * Generate embed data for polled event
   */
  private generateEmbedData(event: KickEvent) {
    switch (event.type) {
      case 'stream_live':
        return {
          title: '🔴 Stream Started!',
          description: `${event.data.streamer_name || 'Streamer'} is now live!`,
          thumbnail: event.data.thumbnail_url,
          color: 0x00ff00, // Green
          fields: [
            {
              name: 'Title',
              value: event.data.title || 'No title',
              inline: false,
            },
            {
              name: 'Category',
              value: event.data.category || 'Unknown',
              inline: true,
            },
          ],
        };

      case 'stream_offline':
        return {
          title: '⚫ Stream Ended',
          description: `${event.data.streamer_name || 'Streamer'} has gone offline`,
          color: 0xff0000, // Red
          fields: [
            {
              name: 'Duration',
              value: event.data.duration || 'Unknown',
              inline: true,
            },
            {
              name: 'Peak Viewers',
              value: event.data.peak_viewers?.toString() || 'Unknown',
              inline: true,
            },
          ],
        };

      case 'new_subscriber':
        return {
          title: '🎁 Subscription Gifted!',
          description: `${event.data.gifter_name} gifted a subscription to ${event.data.recipient_name}!`,
          color: 0xffd700, // Gold
          fields: [
            {
              name: 'Gifter',
              value: event.data.gifter_name || 'Anonymous',
              inline: true,
            },
            {
              name: 'Recipient',
              value: event.data.recipient_name || 'Unknown',
              inline: true,
            },
          ],
        };

      default:
        return {
          title: '📢 Kick Event',
          description: `Event: ${event.type}`,
          color: 0x5865f2, // Discord blurple
        };
    }
  }

  /**
   * Record a system transition
   * Requirement 8.6: Log all system transitions
   */
  private recordTransition(
    from: MonitoringState,
    to: MonitoringState,
    reason: string
  ): void {
    const transition: SystemTransition = {
      from,
      to,
      reason,
      timestamp: new Date(),
    };

    this.transitionHistory.push(transition);

    // Keep only last 100 transitions
    if (this.transitionHistory.length > 100) {
      this.transitionHistory.shift();
    }

    logger.info('System transition recorded', {
      from,
      to,
      reason,
      timestamp: transition.timestamp,
    });
  }

  /**
   * Get current monitoring state
   */
  getCurrentState(): MonitoringState {
    return this.currentState;
  }

  /**
   * Get transition history
   */
  getTransitionHistory(): SystemTransition[] {
    return [...this.transitionHistory];
  }

  /**
   * Get system status
   */
  getStatus(): {
    currentState: MonitoringState;
    isPolling: boolean;
    lastPolledAt: Date | null;
    webhookHealth: ReturnType<KickWebhookHandler['getHealthStatus']>;
    transitionCount: number;
  } {
    return {
      currentState: this.currentState,
      isPolling: this.isPolling,
      lastPolledAt: this.lastPolledEventTimestamp,
      webhookHealth: this.webhookHandler.getHealthStatus(),
      transitionCount: this.transitionHistory.length,
    };
  }

  /**
   * Force transition to polling mode (for testing)
   */
  forcePollingMode(): void {
    logger.warn('Forcing transition to polling mode');
    this.transitionToPolling('Manual override');
  }

  /**
   * Force transition to webhook mode (for testing)
   */
  forceWebhookMode(): void {
    logger.warn('Forcing transition to webhook mode');
    this.transitionToWebhook('Manual override');
  }
}
