/**
 * @file config-manager.ts
 * @description Manages giveaway command permissions and configuration
 * @module giveaway
 */

import { GuildMember, PermissionFlagsBits } from 'discord.js';
import { GiveawayConfigRepository } from '../core/database/repositories/GiveawayConfigRepository.js';
import { GiveawayConfig } from '../types/models.js';
import { logger } from '../core/logger/logger.js';

/**
 * ConfigManager handles giveaway command permissions
 * Manages who can use giveaway commands based on roles and user IDs
 * Defaults to administrator-only access when no config exists
 */
export class ConfigManager {
  constructor(private configRepository: GiveawayConfigRepository) {}

  /**
   * Get giveaway command permissions for a guild
   * Returns default admin-only config if no configuration exists
   */
  async getGiveawayPermissions(guildId: string): Promise<GiveawayConfig> {
    try {
      const config = await this.configRepository.getGiveawayPermissions(guildId);

      // Return default admin-only config if none exists
      if (!config) {
        return {
          guildId,
          allowedRoles: [],
          allowedUsers: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      return config;
    } catch (error) {
      logger.error('Failed to get giveaway permissions', {
        guildId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update giveaway command permissions for a guild
   * Creates new config if doesn't exist, updates if it does
   */
  async updateGiveawayPermissions(
    guildId: string,
    allowedRoles: string[],
    allowedUsers: string[],
  ): Promise<void> {
    try {
      await this.configRepository.updateGiveawayPermissions(
        guildId,
        allowedRoles,
        allowedUsers,
      );

      logger.info('Updated giveaway permissions', {
        guildId,
        allowedRoles,
        allowedUsers,
      });
    } catch (error) {
      logger.error('Failed to update giveaway permissions', {
        guildId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Check if a user can use giveaway commands
   * Returns true if:
   * - User has Administrator permission (always allowed)
   * - User's ID is in allowedUsers list
   * - User has any role in allowedRoles list
   * - No config exists (defaults to admin-only)
   */
  async canUseGiveawayCommands(
    guildId: string,
    member: GuildMember,
  ): Promise<boolean> {
    try {
      // Administrators always have access
      if (member.permissions.has(PermissionFlagsBits.Administrator)) {
        return true;
      }

      // Get guild configuration
      const config = await this.getGiveawayPermissions(guildId);

      // If no roles or users configured, only admins can use commands
      if (config.allowedRoles.length === 0 && config.allowedUsers.length === 0) {
        return false;
      }

      // Check if user ID is in allowed users
      if (config.allowedUsers.includes(member.id)) {
        return true;
      }

      // Check if user has any of the allowed roles
      const hasAllowedRole = Array.from(member.roles.cache.values()).some((role) =>
        config.allowedRoles.includes(role.id),
      );

      return hasAllowedRole;
    } catch (error) {
      logger.error('Failed to check giveaway command permissions', {
        guildId,
        userId: member.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Default to denying access on error
      return false;
    }
  }
}
