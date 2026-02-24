/**
 * @file config-manager.ts
 * @description Manages giveaway command permissions and configuration
 * @module giveaway
 */
import { GuildMember } from 'discord.js';
import { GiveawayConfigRepository } from '../core/database/repositories/GiveawayConfigRepository.js';
import { GiveawayConfig } from '../types/models.js';
/**
 * ConfigManager handles giveaway command permissions
 * Manages who can use giveaway commands based on roles and user IDs
 * Defaults to administrator-only access when no config exists
 */
export declare class ConfigManager {
    private configRepository;
    private readonly CACHE_TTL;
    private readonly CACHE_PREFIX;
    constructor(configRepository: GiveawayConfigRepository);
    /**
     * Get giveaway command permissions for a guild
     * Returns default admin-only config if no configuration exists
     * Uses Redis cache to reduce database queries
     */
    getGiveawayPermissions(guildId: string): Promise<GiveawayConfig>;
    /**
     * Update giveaway command permissions for a guild
     * Creates new config if doesn't exist, updates if it does
     * Updates cache immediately after database write for instant effect
     */
    updateGiveawayPermissions(guildId: string, allowedRoles: string[], allowedUsers: string[]): Promise<void>;
    /**
     * Check if a user can use giveaway commands
     * Returns true if:
     * - User has Administrator permission (always allowed)
     * - User's ID is in allowedUsers list
     * - User has any role in allowedRoles list
     * - No config exists (defaults to admin-only)
     */
    canUseGiveawayCommands(guildId: string, member: GuildMember): Promise<boolean>;
}
//# sourceMappingURL=config-manager.d.ts.map