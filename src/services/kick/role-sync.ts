/**
 * @file role-sync.ts
 * @description Badge-based role synchronization system
 * @module services/kick
 *
 * This system automatically synchronizes Discord roles based on Kick chat badges:
 * - Detects subscriber/VIP badges in Kick chat messages
 * - Looks up linked Discord users
 * - Assigns/removes roles based on badge presence
 * - Logs all role sync operations
 *
 * Requirements: 2.1-2.4
 */

import { logger } from '../../core/logger/logger.js';
import type { IDiscordClient } from '../../core/discord/client.js';
import type { IUserLinkingSystem } from './user-linking.js';
import type { KickChatMessage } from '../pusher/types.js';
import type { UserBadgeInfo } from './chat-client.js';

/**
 * Role sync configuration
 */
export interface RoleSyncConfig {
  guildId: string;
  subscriberRoleId: string;
  vipRoleId: string;
  enabled: boolean;
}

/**
 * Role sync result
 */
export interface RoleSyncResult {
  success: boolean;
  kickUsername: string;
  discordId?: string;
  rolesAdded: string[];
  rolesRemoved: string[];
  error?: string;
}

/**
 * Role synchronization system interface
 */
export interface IRoleSyncSystem {
  /**
   * Process a Kick chat message and sync roles based on badges
   */
  syncRolesFromMessage(message: KickChatMessage): Promise<RoleSyncResult | null>;

  /**
   * Process badge information and sync roles
   */
  syncRolesFromBadges(badgeInfo: UserBadgeInfo): Promise<RoleSyncResult | null>;

  /**
   * Manually sync roles for a specific user
   */
  syncUserRoles(
    discordId: string,
    hasSubscriberBadge: boolean,
    hasVIPBadge: boolean
  ): Promise<RoleSyncResult>;

  /**
   * Check if a user has a specific role
   */
  hasRole(discordId: string, roleId: string): Promise<boolean>;

  /**
   * Enable or disable role synchronization
   */
  setEnabled(enabled: boolean): void;

  /**
   * Check if role synchronization is enabled
   */
  isEnabled(): boolean;
}

/**
 * Role synchronization system implementation
 */
export class RoleSyncSystem implements IRoleSyncSystem {
  private enabled: boolean;

  constructor(
    private config: RoleSyncConfig,
    private discordClient: IDiscordClient,
    private linkingSystem: IUserLinkingSystem,
  ) {
    this.enabled = config.enabled;
  }

  /**
   * Extract badge information from a chat message
   */
  private extractBadges(message: KickChatMessage): UserBadgeInfo {
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
   * Process a Kick chat message and sync roles based on badges
   */
  async syncRolesFromMessage(
    message: KickChatMessage,
  ): Promise<RoleSyncResult | null> {
    if (!this.enabled) {
      logger.debug('Role sync disabled, skipping', {
        username: message.username,
      });
      return null;
    }

    const badgeInfo = this.extractBadges(message);
    return this.syncRolesFromBadges(badgeInfo);
  }

  /**
   * Process badge information and sync roles
   */
  async syncRolesFromBadges(
    badgeInfo: UserBadgeInfo,
  ): Promise<RoleSyncResult | null> {
    if (!this.enabled) {
      logger.debug('Role sync disabled, skipping', {
        username: badgeInfo.username,
      });
      return null;
    }

    // Look up linked Discord user
    const discordId = await this.linkingSystem.getDiscordId(badgeInfo.username);

    if (!discordId) {
      logger.debug('No linked Discord account found for Kick user', {
        kickUsername: badgeInfo.username,
      });
      return null;
    }

    // Sync roles based on badges
    return this.syncUserRoles(
      discordId,
      badgeInfo.isSubscriber,
      badgeInfo.isVIP,
    );
  }

  /**
   * Manually sync roles for a specific user
   */
  async syncUserRoles(
    discordId: string,
    hasSubscriberBadge: boolean,
    hasVIPBadge: boolean,
  ): Promise<RoleSyncResult> {
    const result: RoleSyncResult = {
      success: true,
      kickUsername: '',
      discordId,
      rolesAdded: [],
      rolesRemoved: [],
    };

    try {
      // Get Kick username for logging
      const kickUsername = await this.linkingSystem.getKickUsername(discordId);
      result.kickUsername = kickUsername || 'unknown';

      // Check current roles
      const hasSubscriberRole = await this.hasRole(
        discordId,
        this.config.subscriberRoleId,
      );
      const hasVIPRole = await this.hasRole(discordId, this.config.vipRoleId);

      // Sync subscriber role
      if (hasSubscriberBadge && !hasSubscriberRole) {
        await this.discordClient.addRole(
          this.config.guildId,
          discordId,
          this.config.subscriberRoleId,
        );
        result.rolesAdded.push('subscriber');
        logger.info('Added subscriber role', {
          discordId,
          kickUsername: result.kickUsername,
        });
      } else if (!hasSubscriberBadge && hasSubscriberRole) {
        await this.discordClient.removeRole(
          this.config.guildId,
          discordId,
          this.config.subscriberRoleId,
        );
        result.rolesRemoved.push('subscriber');
        logger.info('Removed subscriber role', {
          discordId,
          kickUsername: result.kickUsername,
        });
      }

      // Sync VIP role
      if (hasVIPBadge && !hasVIPRole) {
        await this.discordClient.addRole(
          this.config.guildId,
          discordId,
          this.config.vipRoleId,
        );
        result.rolesAdded.push('vip');
        logger.info('Added VIP role', {
          discordId,
          kickUsername: result.kickUsername,
        });
      } else if (!hasVIPBadge && hasVIPRole) {
        await this.discordClient.removeRole(
          this.config.guildId,
          discordId,
          this.config.vipRoleId,
        );
        result.rolesRemoved.push('vip');
        logger.info('Removed VIP role', {
          discordId,
          kickUsername: result.kickUsername,
        });
      }

      // Log if no changes were made
      if (result.rolesAdded.length === 0 && result.rolesRemoved.length === 0) {
        logger.debug('No role changes needed', {
          discordId,
          kickUsername: result.kickUsername,
          hasSubscriberBadge,
          hasVIPBadge,
        });
      }

      return result;
    } catch (error) {
      logger.error('Failed to sync roles', {
        error,
        discordId,
        hasSubscriberBadge,
        hasVIPBadge,
      });

      result.success = false;
      result.error =
        error instanceof Error ? error.message : 'Unknown error occurred';
      return result;
    }
  }

  /**
   * Check if a user has a specific role
   */
  async hasRole(discordId: string, roleId: string): Promise<boolean> {
    try {
      const member = await this.discordClient.getMember(
        this.config.guildId,
        discordId,
      );

      if (!member) {
        logger.debug('Member not found in guild', {
          discordId,
          guildId: this.config.guildId,
        });
        return false;
      }

      return member.roles.cache.has(roleId);
    } catch (error) {
      logger.error('Failed to check role', {
        error,
        discordId,
        roleId,
      });
      return false;
    }
  }

  /**
   * Enable or disable role synchronization
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    logger.info('Role synchronization enabled state changed', { enabled });
  }

  /**
   * Check if role synchronization is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
