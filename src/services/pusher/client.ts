/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file client.ts
 * @description Pusher client for Kick chat monitoring
 * @module services/pusher
 * 
 * This client connects to Kick's chat system via Pusher WebSocket.
 * It handles connection management, automatic reconnection, and message parsing.
 * 
 * Requirements: 2.1-2.4
 */

import Pusher from 'pusher-js';
import type { Channel } from 'pusher-js';
import { logger } from '../../core/logger/logger.js';
import type {
  KickChatMessage,
  KickChatBadge,
  PusherConfig,
  ConnectionState,
  PusherConnectionOptions,
} from './types.js';

export class PusherClient {
  private pusher: Pusher | null = null;
  private channel: Channel | null = null;
  private connectionState: ConnectionState = 'initialized';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start at 1 second
  private maxReconnectDelay = 60000; // Cap at 60 seconds
  private reconnectTimer: NodeJS.Timeout | null = null;

  private readonly config: PusherConfig = {
    cluster: 'us2', // Kick uses us2 cluster
    encrypted: true,
  };

  /**
   * Connect to Pusher and subscribe to Kick chat channel
   */
  async connect(options: PusherConnectionOptions): Promise<void> {
    try {
      this.updateConnectionState('connecting');
      logger.info('Connecting to Pusher for Kick chat', {
        channelId: options.channelId,
        cluster: this.config.cluster,
      });

      // Initialize Pusher client
      this.pusher = new Pusher('eb1d5f283081a78b932c', {
        cluster: this.config.cluster,
        forceTLS: this.config.encrypted,
      });

      // Set up connection state handlers
      this.setupConnectionHandlers(options);

      // Subscribe to the chat channel
      const channelName = `chatrooms.${options.channelId}.v2`;
      this.channel = this.pusher.subscribe(channelName);

      // Set up message handlers
      this.setupMessageHandlers(options);

      // Test connectivity
      await this.testConnectivity();

      this.reconnectAttempts = 0; // Reset on successful connection
      this.updateConnectionState('connected', options);

      logger.info('Successfully connected to Kick chat', {
        channelId: options.channelId,
        channelName,
      });
    } catch (error) {
      this.updateConnectionState('failed', options);
      logger.error('Failed to connect to Pusher', { error });
      
      // Attempt reconnection
      this.scheduleReconnect(options);
      throw error;
    }
  }

  /**
   * Disconnect from Pusher
   */
  async disconnect(): Promise<void> {
    logger.info('Disconnecting from Pusher');

    // Clear any pending reconnect timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Unsubscribe from channel
    if (this.channel) {
      this.channel.unbind_all();
      this.pusher?.unsubscribe(this.channel.name);
      this.channel = null;
    }

    // Disconnect Pusher
    if (this.pusher) {
      this.pusher.disconnect();
      this.pusher = null;
    }

    this.updateConnectionState('disconnected');
    logger.info('Disconnected from Pusher');
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  /**
   * Set up Pusher connection state handlers
   */
  private setupConnectionHandlers(options: PusherConnectionOptions): void {
    if (!this.pusher) return;

    this.pusher.connection.bind('connected', () => {
      logger.info('Pusher connection established');
      this.reconnectAttempts = 0;
      this.updateConnectionState('connected', options);
    });

    this.pusher.connection.bind('disconnected', () => {
      logger.warn('Pusher connection lost');
      this.updateConnectionState('disconnected', options);
      this.scheduleReconnect(options);
    });

    this.pusher.connection.bind('error', (error: Error) => {
      logger.error('Pusher connection error', { error });
      this.updateConnectionState('failed', options);
      if (options.onError) {
        options.onError(error);
      }
      this.scheduleReconnect(options);
    });

    this.pusher.connection.bind('unavailable', () => {
      logger.error('Pusher connection unavailable');
      this.updateConnectionState('failed', options);
      this.scheduleReconnect(options);
    });
  }

  /**
   * Set up message event handlers
   */
  private setupMessageHandlers(options: PusherConnectionOptions): void {
    if (!this.channel) return;

    // Listen for chat messages
    this.channel.bind('App\\Events\\ChatMessageEvent', (data: any) => {
      try {
        const message = this.parseChatMessage(data);
        logger.debug('Received Kick chat message', {
          username: message.username,
          badges: message.badges.map(b => b.type),
        });

        if (options.onMessage) {
          options.onMessage(message);
        }
      } catch (error) {
        logger.error('Failed to parse chat message', { error, data });
      }
    });

    // Listen for subscription events
    this.channel.bind('App\\Events\\SubscriptionEvent', (data: any) => {
      logger.info('Subscription event received', { data });
    });

    // Listen for channel errors
    this.channel.bind('pusher:subscription_error', (error: any) => {
      logger.error('Channel subscription error', { error });
      if (options.onError) {
        options.onError(new Error(`Subscription error: ${error.error}`));
      }
    });

    // Listen for subscription success
    this.channel.bind('pusher:subscription_succeeded', () => {
      logger.info('Successfully subscribed to Kick chat channel');
    });
  }

  /**
   * Parse raw Kick chat message data
   */
  private parseChatMessage(data: any): KickChatMessage {
    const badges: KickChatBadge[] = [];

    // Parse badges from sender identity
    if (data.sender?.identity?.badges) {
      for (const badge of data.sender.identity.badges) {
        const badgeType = badge.type?.toLowerCase();
        if (
          badgeType === 'subscriber' ||
          badgeType === 'vip' ||
          badgeType === 'moderator' ||
          badgeType === 'broadcaster'
        ) {
          badges.push({
            type: badgeType,
            months: badge.months,
          });
        }
      }
    }

    return {
      id: data.id || '',
      username: data.sender?.username || 'unknown',
      content: data.content || '',
      timestamp: data.created_at ? new Date(data.created_at) : new Date(),
      badges,
    };
  }

  /**
   * Test Pusher connectivity
   */
  private async testConnectivity(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.pusher) {
        reject(new Error('Pusher client not initialized'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Pusher connection timeout'));
      }, 10000); // 10 second timeout

      const checkConnection = () => {
        if (this.pusher?.connection.state === 'connected') {
          clearTimeout(timeout);
          resolve();
        }
      };

      // Check immediately
      checkConnection();

      // Also listen for connection event
      this.pusher.connection.bind('connected', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  /**
   * Schedule automatic reconnection with exponential backoff
   */
  private scheduleReconnect(options: PusherConnectionOptions): void {
    // Don't schedule if already scheduled or max attempts reached
    if (this.reconnectTimer || this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        logger.error('Max reconnection attempts reached', {
          attempts: this.reconnectAttempts,
        });
      }
      return;
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    this.reconnectAttempts++;

    logger.info('Scheduling Pusher reconnection', {
      attempt: this.reconnectAttempts,
      delayMs: delay,
    });

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.disconnect();
        await this.connect(options);
      } catch (error) {
        logger.error('Reconnection attempt failed', { error });
        // scheduleReconnect will be called again by the error handler
      }
    }, delay);
  }

  /**
   * Update connection state and notify listeners
   */
  private updateConnectionState(
    state: ConnectionState,
    options?: PusherConnectionOptions
  ): void {
    this.connectionState = state;
    logger.debug('Pusher connection state changed', { state });

    if (options?.onConnectionChange) {
      options.onConnectionChange(state);
    }
  }
}

// Export singleton instance
export const pusherClient = new PusherClient();
