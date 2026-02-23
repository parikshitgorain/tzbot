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
import type { IDiscordClient } from '../../core/discord/client.js';
import type { IUserLinkingSystem } from './user-linking.js';
import type { KickChatMessage } from '../pusher/types.js';
import type { UserBadgeInfo } from './chat-client.js';
/**
 * Role sync configuration
 */
export interface RoleSyncConfig {
    guildId: string;
    subscriberRoleId?: string;
    vipRoleId?: string;
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
    syncUserRoles(discordId: string, hasSubscriberBadge: boolean, hasVIPBadge: boolean): Promise<RoleSyncResult>;
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
export declare class RoleSyncSystem implements IRoleSyncSystem {
    private config;
    private discordClient;
    private linkingSystem;
    private enabled;
    constructor(config: RoleSyncConfig, discordClient: IDiscordClient, linkingSystem: IUserLinkingSystem);
    /**
     * Extract badge information from a chat message
     */
    private extractBadges;
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
    syncUserRoles(discordId: string, hasSubscriberBadge: boolean, hasVIPBadge: boolean): Promise<RoleSyncResult>;
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
//# sourceMappingURL=role-sync.d.ts.map