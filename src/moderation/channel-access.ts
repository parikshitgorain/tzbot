/**
 * @file channel-access.ts
 * @description Channel access enforcement system for TZBOT
 * @module moderation
 *
 * Implements read-only channel enforcement:
 * - Deletes unauthorized messages within 1 second
 * - Sends DM notifications to users
 * - Allows moderators and whitelisted roles to post
 * - Logs all deleted messages
 *
 * Validates: Requirements 3.1-3.4
 */

import type { IDiscordClient } from '@/core/discord/client.js';
import type { ViolationRepository } from '@/core/database/repositories/ViolationRepository.js';
import { ViolationType } from '@/types/models.js';
import { logger, logError } from '@/core/logger/logger.js';
import type { Message, GuildMember } from 'discord.js';

/**
 * Configuration for read-only channels
 */
export interface ReadOnlyChannelConfig {
  /** Channel ID that is read-only */
  channelId: string;
  /** Role IDs that are whitelisted to post in this channel */
  whitelistRoleIds: string[];
}

/**
 * Result of checking channel access
 */
export interface ChannelAccessResult {
  /** Whether the user is authorized to post */
  isAuthorized: boolean;
  /** Reason for denial (if not authorized) */
  reason?: string;
}

/**
 * ChannelAccessEnforcer class
 * Enforces read-only channel restrictions
 */
export class ChannelAccessEnforcer {
  private readOnlyChannels: Map<string, ReadOnlyChannelConfig>;
  private moderatorRoleId: string;

  constructor(
    private discordClient: IDiscordClient,
    private violationRepo: ViolationRepository,
    moderatorRoleId: string,
    readOnlyChannelConfigs: ReadOnlyChannelConfig[] = [],
  ) {
    this.moderatorRoleId = moderatorRoleId;
    this.readOnlyChannels = new Map();

    // Initialize read-only channel configurations
    for (const config of readOnlyChannelConfigs) {
      this.readOnlyChannels.set(config.channelId, config);
    }
  }

  /**
   * Check if a channel is read-only
   * @param channelId - Channel ID to check
   * @returns True if the channel is read-only
   */
  isReadOnlyChannel(channelId: string): boolean {
    return this.readOnlyChannels.has(channelId);
  }

  /**
   * Check if a user is authorized to post in a read-only channel
   * Requirements 3.3: Moderators can post
   * Requirements 3.4: Users with whitelist roles can post
   *
   * @param message - Discord message object
   * @returns Channel access result
   */
  async checkAccess(message: Message): Promise<ChannelAccessResult> {
    const channelId = message.channelId;
    const userId = message.author.id;
    const guildId = message.guildId;

    // If channel is not read-only, allow
    if (!this.isReadOnlyChannel(channelId)) {
      return { isAuthorized: true };
    }

    // If no guild (DM), deny
    if (!guildId) {
      return {
        isAuthorized: false,
        reason: 'Cannot post in read-only channels via DM',
      };
    }

    // Get member to check roles
    const member = await this.discordClient.getMember(guildId, userId);
    if (!member) {
      return {
        isAuthorized: false,
        reason: 'User not found in guild',
      };
    }

    // Check if user is a moderator (Requirements 3.3)
    if (this.isModerator(member)) {
      logger.debug('Moderator allowed in read-only channel', {
        userId,
        channelId,
      });
      return { isAuthorized: true };
    }

    // Check if user has whitelist role (Requirements 3.4)
    const config = this.readOnlyChannels.get(channelId);
    if (config && this.hasWhitelistRole(member, config.whitelistRoleIds)) {
      logger.debug('Whitelisted user allowed in read-only channel', {
        userId,
        channelId,
      });
      return { isAuthorized: true };
    }

    // User is not authorized
    return {
      isAuthorized: false,
      reason: 'You do not have permission to post in this read-only channel',
    };
  }

  /**
   * Enforce channel access restrictions on a message
   * Requirements 3.1: Delete unauthorized messages within 1 second
   * Requirements 3.2: Send DM notification to user
   * Requirements 3.5: Log deleted messages
   *
   * @param message - Discord message object
   * @returns True if message was deleted, false if allowed
   */
  async enforceAccess(message: Message): Promise<boolean> {
    const accessResult = await this.checkAccess(message);

    // If authorized, allow the message
    if (accessResult.isAuthorized) {
      return false;
    }

    // User is not authorized - delete the message
    const channelId = message.channelId;
    const messageId = message.id;
    const userId = message.author.id;
    const messageContent = message.content;

    try {
      // Requirements 3.1: Delete message within 1 second
      await this.discordClient.deleteMessage(channelId, messageId);

      logger.info('Deleted unauthorized message from read-only channel', {
        userId,
        channelId,
        messageId,
        messageContent: messageContent.substring(0, 100), // Log first 100 chars
      });

      // Requirements 3.5: Log the violation
      await this.violationRepo.save({
        userId,
        type: ViolationType.UNAUTHORIZED_POST,
        severity: 1,
        timestamp: new Date(),
        details: `Unauthorized post in read-only channel ${channelId}: ${messageContent.substring(0, 200)}`,
        punishmentApplied: undefined,
      });

      // Requirements 3.2: Send DM notification to user
      await this.sendDMNotification(message, accessResult.reason || 'Unknown reason');

      return true;
    } catch (error) {
      logError('Failed to enforce channel access', error as Error, {
        userId,
        channelId,
        messageId,
      });
      return false;
    }
  }

  /**
   * Send DM notification to user about deleted message
   * Requirements 3.2: Explain the restriction
   *
   * @param message - Original message that was deleted
   * @param reason - Reason for deletion
   */
  private async sendDMNotification(message: Message, reason: string): Promise<void> {
    try {
      const user = message.author;
      const channelName = message.channel && 'name' in message.channel
        ? message.channel.name
        : 'unknown-channel';

      const dmContent = {
        content: '⚠️ **Message Deleted**\n\n' +
          `Your message in **#${channelName}** was deleted because it's a read-only channel.\n\n` +
          `**Reason:** ${reason}\n\n` +
          'Only moderators and users with specific roles can post in this channel. ' +
          'If you believe this is an error, please contact a moderator.',
      };

      await user.send(dmContent);

      logger.debug('Sent DM notification for deleted message', {
        userId: user.id,
        channelId: message.channelId,
      });
    } catch (error) {
      // User might have DMs disabled - log but don't throw
      logger.warn('Failed to send DM notification', {
        userId: message.author.id,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Check if a member is a moderator
   * @param member - Guild member to check
   * @returns True if member has moderator role
   */
  private isModerator(member: GuildMember): boolean {
    return member.roles.cache.has(this.moderatorRoleId);
  }

  /**
   * Check if a member has any whitelist role
   * @param member - Guild member to check
   * @param whitelistRoleIds - Array of role IDs to check
   * @returns True if member has at least one whitelist role
   */
  private hasWhitelistRole(member: GuildMember, whitelistRoleIds: string[]): boolean {
    return whitelistRoleIds.some((roleId) => member.roles.cache.has(roleId));
  }

  /**
   * Add a read-only channel configuration
   * @param config - Read-only channel configuration
   */
  addReadOnlyChannel(config: ReadOnlyChannelConfig): void {
    this.readOnlyChannels.set(config.channelId, config);
    logger.info('Added read-only channel', {
      channelId: config.channelId,
      whitelistRoleCount: config.whitelistRoleIds.length,
    });
  }

  /**
   * Remove a read-only channel configuration
   * @param channelId - Channel ID to remove
   */
  removeReadOnlyChannel(channelId: string): void {
    this.readOnlyChannels.delete(channelId);
    logger.info('Removed read-only channel', { channelId });
  }

  /**
   * Update whitelist roles for a read-only channel
   * @param channelId - Channel ID
   * @param whitelistRoleIds - New array of whitelist role IDs
   */
  updateWhitelistRoles(channelId: string, whitelistRoleIds: string[]): void {
    const config = this.readOnlyChannels.get(channelId);
    if (config) {
      config.whitelistRoleIds = whitelistRoleIds;
      logger.info('Updated whitelist roles for read-only channel', {
        channelId,
        whitelistRoleCount: whitelistRoleIds.length,
      });
    } else {
      logger.warn('Attempted to update whitelist for non-existent read-only channel', {
        channelId,
      });
    }
  }

  /**
   * Get all read-only channel configurations
   * @returns Array of read-only channel configurations
   */
  getReadOnlyChannels(): ReadOnlyChannelConfig[] {
    return Array.from(this.readOnlyChannels.values());
  }

  /**
   * Get whitelist roles for a specific channel
   * @param channelId - Channel ID
   * @returns Array of whitelist role IDs, or empty array if not a read-only channel
   */
  getWhitelistRoles(channelId: string): string[] {
    const config = this.readOnlyChannels.get(channelId);
    return config ? config.whitelistRoleIds : [];
  }
}
