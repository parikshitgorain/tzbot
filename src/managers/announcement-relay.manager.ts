/**
 * @file announcement-relay.manager.ts
 * @description Announcement relay system for moderator messages
 * @module managers
 */

import { EmbedBuilder } from 'discord.js';
import type { Message } from 'discord.js';
import type { IDiscordClient } from '@/core/discord/client.js';
import { logger, logError } from '@/core/logger/logger.js';

/**
 * Announcement relay configuration
 */
export interface AnnouncementRelayConfig {
  privateChannelId: string;
  publicChannelIds: string[];
  guildId: string;
  moderatorRoleId: string;
}

/**
 * Relay result for a single channel
 */
interface RelayResult {
  channelId: string;
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Announcement relay manager
 * 
 * Requirements:
 * - 6.1: Relay messages within 2 seconds
 * - 6.2: Preserve message formatting, embeds, and attachments
 * - 6.3: Attribute messages to TZBOT
 * - 6.4: Relay to all configured public channels
 * - 6.5: Notify moderator on relay failure
 */
export class AnnouncementRelayManager {
  private discordClient: IDiscordClient;
  private config: AnnouncementRelayConfig;
  private enabled: boolean = true;
  private isListening: boolean = false;

  constructor(
    discordClient: IDiscordClient,
    config: AnnouncementRelayConfig
  ) {
    this.discordClient = discordClient;
    this.config = config;

    logger.info('AnnouncementRelayManager initialized', {
      privateChannelId: config.privateChannelId,
      publicChannelCount: config.publicChannelIds.length,
      publicChannelIds: config.publicChannelIds,
    });
  }

  /**
   * Message handler bound to this instance
   */
  private boundMessageHandler?: (message: Message) => Promise<void>;

  /**
   * Start monitoring the private channel for announcements
   */
  start(): void {
    // Prevent duplicate listener registration
    if (this.isListening) {
      logger.debug('AnnouncementRelayManager already listening, skipping start');
      return;
    }

    // Create bound handler for this instance
    this.boundMessageHandler = async (message: Message) => {
      await this.handleMessage(message);
    };

    this.discordClient.on('messageCreate', this.boundMessageHandler);

    this.isListening = true;
    logger.info('AnnouncementRelayManager started');
  }

  /**
   * Handle incoming messages from the private channel
   */
  private async handleMessage(message: Message): Promise<void> {
    // Ignore if relay is disabled
    if (!this.enabled) {
      return;
    }

    // Only process messages from the designated private channel
    if (message.channelId !== this.config.privateChannelId) {
      return;
    }

    // Ignore bot messages to prevent loops
    if (message.author.bot) {
      return;
    }

    // Verify the user is a moderator
    const isModerator = await this.isUserModerator(message);
    if (!isModerator) {
      logger.debug('Non-moderator message in private channel ignored', {
        userId: message.author.id,
        username: message.author.username,
        channelId: message.channelId,
      });
      return;
    }

    // Relay the message
    await this.relayMessage(message);
  }

  /**
   * Check if the message author is a moderator
   */
  private async isUserModerator(message: Message): Promise<boolean> {
    try {
      const member = await this.discordClient.getMember(
        this.config.guildId,
        message.author.id
      );

      if (!member) {
        return false;
      }

      // Check if user has the moderator role
      return member.roles.cache.has(this.config.moderatorRoleId);
    } catch (error) {
      logError('Failed to check moderator status', error as Error, {
        userId: message.author.id,
        guildId: this.config.guildId,
      });
      return false;
    }
  }

  /**
   * Relay a message to all configured public channels
   * Requirement 6.1: Relay within 2 seconds
   * Requirement 6.2: Preserve formatting, embeds, and attachments
   * Requirement 6.3: Attribute to TZBOT
   * Requirement 6.4: Relay to all configured channels
   * Requirement 6.5: Notify on failure
   */
  private async relayMessage(originalMessage: Message): Promise<void> {
    const startTime = Date.now();

    logger.info('Relaying announcement', {
      messageId: originalMessage.id,
      authorId: originalMessage.author.id,
      authorUsername: originalMessage.author.username,
      targetChannels: this.config.publicChannelIds.length,
      hasContent: !!originalMessage.content,
      embedCount: originalMessage.embeds.length,
      attachmentCount: originalMessage.attachments.size,
    });

    // Prepare message content (Requirement 6.2: Preserve formatting)
    const messageContent = this.prepareMessageContent(originalMessage);

    // Relay to all public channels (Requirement 6.4)
    const relayResults = await Promise.allSettled(
      this.config.publicChannelIds.map((channelId) =>
        this.relayToChannel(channelId, messageContent)
      )
    );

    // Process results
    const results: RelayResult[] = relayResults.map((result, index) => {
      const channelId = this.config.publicChannelIds[index];
      
      if (result.status === 'fulfilled') {
        return {
          channelId,
          success: true,
          messageId: result.value.id,
        };
      } else {
        return {
          channelId,
          success: false,
          error: result.reason?.message || 'Unknown error',
        };
      }
    });

    // Check for failures
    const failures = results.filter((r) => !r.success);
    const successes = results.filter((r) => r.success);

    const relayTime = Date.now() - startTime;

    logger.info('Announcement relay completed', {
      messageId: originalMessage.id,
      relayTimeMs: relayTime,
      successCount: successes.length,
      failureCount: failures.length,
      totalChannels: this.config.publicChannelIds.length,
    });

    // Log warning if relay took longer than 2 seconds
    if (relayTime > 2000) {
      logger.warn('Announcement relay exceeded 2 seconds', {
        messageId: originalMessage.id,
        relayTimeMs: relayTime,
      });
    }

    // Notify moderator on failure (Requirement 6.5)
    if (failures.length > 0) {
      await this.notifyModeratorOfFailures(originalMessage, failures);
    }
  }

  /**
   * Prepare message content for relay
   * Requirement 6.2: Preserve message formatting, embeds, and attachments
   */
  private prepareMessageContent(message: Message) {
    // Convert Discord Embed objects to EmbedBuilder for sending
    const embeds = message.embeds.length > 0
      ? message.embeds.map((embed) => {
          const builder = new EmbedBuilder(embed.data);
          return builder;
        })
      : undefined;

    return {
      content: message.content || undefined,
      embeds,
      files: message.attachments.size > 0
        ? Array.from(message.attachments.values()).map((attachment) => ({
            attachment: attachment.url,
            name: attachment.name,
          }))
        : undefined,
    };
  }

  /**
   * Relay message to a specific channel
   */
  private async relayToChannel(
    channelId: string,
    messageContent: ReturnType<typeof this.prepareMessageContent>
  ): Promise<Message> {
    try {
      // Send message (Requirement 6.3: Attributed to TZBOT)
      const message = await this.discordClient.sendMessage(channelId, messageContent);

      logger.debug('Message relayed to channel', {
        channelId,
        messageId: message.id,
      });

      return message;
    } catch (error) {
      logError('Failed to relay message to channel', error as Error, {
        channelId,
      });
      throw error;
    }
  }

  /**
   * Notify moderator of relay failures
   * Requirement 6.5: Notify moderator in private channel on failure
   */
  private async notifyModeratorOfFailures(
    originalMessage: Message,
    failures: RelayResult[]
  ): Promise<void> {
    try {
      const failureList = failures
        .map((f) => `• <#${f.channelId}>: ${f.error}`)
        .join('\n');

      const notificationContent = {
        content: `⚠️ **Announcement Relay Failure**\n\nFailed to relay your message to the following channels:\n${failureList}\n\nOriginal message: ${originalMessage.url}`,
      };

      await this.discordClient.sendMessage(
        this.config.privateChannelId,
        notificationContent
      );

      logger.info('Moderator notified of relay failures', {
        originalMessageId: originalMessage.id,
        failureCount: failures.length,
      });
    } catch (error) {
      logError('Failed to notify moderator of relay failures', error as Error, {
        originalMessageId: originalMessage.id,
        failureCount: failures.length,
      });
    }
  }

  /**
   * Enable the announcement relay
   */
  enable(): void {
    this.enabled = true;
    logger.info('AnnouncementRelayManager enabled');
  }

  /**
   * Disable the announcement relay
   */
  disable(): void {
    this.enabled = false;
    logger.info('AnnouncementRelayManager disabled');
  }

  /**
   * Stop monitoring (remove event listener)
   */
  stop(): void {
    if (!this.isListening) {
      logger.debug('AnnouncementRelayManager not listening, skipping stop');
      return;
    }

    // Remove the specific event listener for this instance
    if (this.boundMessageHandler) {
      this.discordClient.off('messageCreate', this.boundMessageHandler);
      this.boundMessageHandler = undefined;
    }

    this.isListening = false;
    logger.info('AnnouncementRelayManager stopped');
  }

  /**
   * Check if relay is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AnnouncementRelayConfig>): void {
    if (config.privateChannelId) {
      this.config.privateChannelId = config.privateChannelId;
    }
    if (config.publicChannelIds) {
      this.config.publicChannelIds = config.publicChannelIds;
    }
    if (config.guildId) {
      this.config.guildId = config.guildId;
    }
    if (config.moderatorRoleId) {
      this.config.moderatorRoleId = config.moderatorRoleId;
    }

    logger.info('AnnouncementRelayManager configuration updated', {
      privateChannelId: this.config.privateChannelId,
      publicChannelCount: this.config.publicChannelIds.length,
    });
  }
}
