/**
 * @file chat-client.ts
 * @description Kick chat monitoring client using Pusher
 * @module services/kick
 *
 * This client provides a high-level interface for monitoring Kick chat,
 * extracting user badges, and handling chat events for role synchronization.
 *
 * Requirements: 2.1-2.4
 */

import { pusherClient } from '../pusher/client.js';
import type { KickChatMessage, ConnectionState } from '../pusher/types.js';
import { logger } from '../../core/logger/logger.js';

export interface KickChatClientOptions {
  channelId: string;
  onMessage?: (message: KickChatMessage) => void | Promise<void>;
  onSubscriberDetected?: (username: string, months?: number) => void | Promise<void>;
  onVIPDetected?: (username: string) => void | Promise<void>;
  onConnectionChange?: (state: ConnectionState) => void;
  onError?: (error: Error) => void;
}

export interface UserBadgeInfo {
  username: string;
  isSubscriber: boolean;
  isVIP: boolean;
  isModerator: boolean;
  isBroadcaster: boolean;
  subscriberMonths?: number;
}

/**
 * High-level client for monitoring Kick chat and extracting badge information
 */
export class KickChatClient {
  private options: KickChatClientOptions | null = null;
  private isMonitoring = false;

  /**
   * Start monitoring Kick chat for the specified channel
   */
  async connect(options: KickChatClientOptions): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('KickChatClient already monitoring, disconnecting first');
      await this.disconnect();
    }

    this.options = options;
    this.isMonitoring = true;

    logger.info('Starting Kick chat monitoring', {
      channelId: options.channelId,
    });

    try {
      await pusherClient.connect({
        channelId: options.channelId,
        onMessage: (message) => this.handleMessage(message),
        onConnectionChange: (state) => this.handleConnectionChange(state),
        onError: (error) => this.handleError(error),
      });

      logger.info('Kick chat monitoring started successfully', {
        channelId: options.channelId,
      });
    } catch (error) {
      this.isMonitoring = false;
      logger.error('Failed to start Kick chat monitoring', { error });
      throw error;
    }
  }

  /**
   * Stop monitoring Kick chat
   */
  async disconnect(): Promise<void> {
    if (!this.isMonitoring) {
      logger.debug('KickChatClient not monitoring, nothing to disconnect');
      return;
    }

    logger.info('Stopping Kick chat monitoring');

    try {
      await pusherClient.disconnect();
      this.isMonitoring = false;
      this.options = null;

      logger.info('Kick chat monitoring stopped');
    } catch (error) {
      logger.error('Error stopping Kick chat monitoring', { error });
      throw error;
    }
  }

  /**
   * Check if currently monitoring
   */
  isConnected(): boolean {
    return this.isMonitoring && pusherClient.isConnected();
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return pusherClient.getConnectionState();
  }

  /**
   * Extract badge information from a chat message
   */
  extractBadges(message: KickChatMessage): UserBadgeInfo {
    const badgeInfo: UserBadgeInfo = {
      username: message.username,
      isSubscriber: false,
      isVIP: false,
      isModerator: false,
      isBroadcaster: false,
    };

    for (const badge of message.badges) {
      switch (badge.type) {
        case 'subscriber':
          badgeInfo.isSubscriber = true;
          badgeInfo.subscriberMonths = badge.months;
          break;
        case 'vip':
          badgeInfo.isVIP = true;
          break;
        case 'moderator':
          badgeInfo.isModerator = true;
          break;
        case 'broadcaster':
          badgeInfo.isBroadcaster = true;
          break;
      }
    }

    return badgeInfo;
  }

  /**
   * Handle incoming chat messages
   */
  private async handleMessage(message: KickChatMessage): Promise<void> {
    if (!this.options) {
      return;
    }

    try {
      // Extract badge information
      const badgeInfo = this.extractBadges(message);

      // Log badge detection
      if (badgeInfo.isSubscriber || badgeInfo.isVIP) {
        logger.debug('Detected user with badges', {
          username: badgeInfo.username,
          isSubscriber: badgeInfo.isSubscriber,
          isVIP: badgeInfo.isVIP,
          subscriberMonths: badgeInfo.subscriberMonths,
        });
      }

      // Notify subscriber detection
      if (badgeInfo.isSubscriber && this.options.onSubscriberDetected) {
        await this.options.onSubscriberDetected(
          badgeInfo.username,
          badgeInfo.subscriberMonths,
        );
      }

      // Notify VIP detection
      if (badgeInfo.isVIP && this.options.onVIPDetected) {
        await this.options.onVIPDetected(badgeInfo.username);
      }

      // Forward message to general handler
      if (this.options.onMessage) {
        await this.options.onMessage(message);
      }
    } catch (error) {
      logger.error('Error handling Kick chat message', {
        error,
        messageId: message.id,
        username: message.username,
      });
    }
  }

  /**
   * Handle connection state changes
   */
  private handleConnectionChange(state: ConnectionState): void {
    logger.info('Kick chat connection state changed', { state });

    if (this.options?.onConnectionChange) {
      this.options.onConnectionChange(state);
    }

    // Update monitoring flag based on state
    if (state === 'disconnected' || state === 'failed') {
      this.isMonitoring = false;
    } else if (state === 'connected') {
      this.isMonitoring = true;
    }
  }

  /**
   * Handle connection errors
   */
  private handleError(error: Error): void {
    logger.error('Kick chat connection error', { error });

    if (this.options?.onError) {
      this.options.onError(error);
    }
  }
}

// Export singleton instance
export const kickChatClient = new KickChatClient();
