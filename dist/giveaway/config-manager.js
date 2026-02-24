/**
 * @file config-manager.ts
 * @description Manages giveaway command permissions and configuration
 * @module giveaway
 */
import { PermissionFlagsBits } from 'discord.js';
import { logger } from '../core/logger/logger.js';
import { redisClient } from '../core/cache/redis.client.js';
/**
 * ConfigManager handles giveaway command permissions
 * Manages who can use giveaway commands based on roles and user IDs
 * Defaults to administrator-only access when no config exists
 */
export class ConfigManager {
    configRepository;
    CACHE_TTL = 300; // 5 minutes cache
    CACHE_PREFIX = 'giveaway:permissions:';
    constructor(configRepository) {
        this.configRepository = configRepository;
    }
    /**
     * Get giveaway command permissions for a guild
     * Returns default admin-only config if no configuration exists
     * Uses Redis cache to reduce database queries
     */
    async getGiveawayPermissions(guildId) {
        try {
            // Try to get from cache first
            const cacheKey = `${this.CACHE_PREFIX}${guildId}`;
            try {
                const cached = await redisClient.get(cacheKey);
                if (cached) {
                    const config = JSON.parse(cached);
                    // Convert date strings back to Date objects
                    config.createdAt = new Date(config.createdAt);
                    config.updatedAt = new Date(config.updatedAt);
                    return config;
                }
            }
            catch (cacheError) {
                // If cache fails, continue to database
                logger.warn('Cache read failed, falling back to database', {
                    guildId,
                    error: cacheError instanceof Error ? cacheError.message : 'Unknown error',
                });
            }
            // Get from database
            const config = await this.configRepository.getGiveawayPermissions(guildId);
            // Return default admin-only config if none exists
            const result = config || {
                guildId,
                allowedRoles: [],
                allowedUsers: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            // Cache the result
            try {
                await redisClient.set(cacheKey, JSON.stringify(result), this.CACHE_TTL);
            }
            catch (cacheError) {
                // Log but don't fail if cache write fails
                logger.warn('Failed to cache giveaway permissions', {
                    guildId,
                    error: cacheError instanceof Error ? cacheError.message : 'Unknown error',
                });
            }
            return result;
        }
        catch (error) {
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
     * Updates cache immediately after database write for instant effect
     */
    async updateGiveawayPermissions(guildId, allowedRoles, allowedUsers) {
        try {
            // Write to database FIRST (source of truth)
            await this.configRepository.updateGiveawayPermissions(guildId, allowedRoles, allowedUsers);
            // Update cache immediately with new data (instead of just invalidating)
            // This makes the change take effect instantly without waiting for next read
            const cacheKey = `${this.CACHE_PREFIX}${guildId}`;
            try {
                const updatedConfig = {
                    guildId,
                    allowedRoles,
                    allowedUsers,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
                await redisClient.set(cacheKey, JSON.stringify(updatedConfig), this.CACHE_TTL);
                logger.debug('Updated cache with new permissions', { guildId });
            }
            catch (cacheError) {
                // If cache update fails, just log warning - database is already updated
                logger.warn('Failed to update cache after permission change', {
                    guildId,
                    error: cacheError instanceof Error ? cacheError.message : 'Unknown error',
                });
            }
            logger.info('Updated giveaway permissions', {
                guildId,
                allowedRoles,
                allowedUsers,
            });
        }
        catch (error) {
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
    async canUseGiveawayCommands(guildId, member) {
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
            const hasAllowedRole = Array.from(member.roles.cache.values()).some((role) => config.allowedRoles.includes(role.id));
            return hasAllowedRole;
        }
        catch (error) {
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
//# sourceMappingURL=config-manager.js.map