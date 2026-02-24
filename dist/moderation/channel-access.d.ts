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
import type { IDiscordClient } from '../core/discord/client.js';
import type { ViolationRepository } from '../core/database/repositories/ViolationRepository.js';
import type { Message } from 'discord.js';
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
export declare class ChannelAccessEnforcer {
    private discordClient;
    private violationRepo;
    private readOnlyChannels;
    private moderatorRoleId;
    constructor(discordClient: IDiscordClient, violationRepo: ViolationRepository, moderatorRoleId: string, readOnlyChannelConfigs?: ReadOnlyChannelConfig[]);
    /**
     * Check if a channel is read-only
     * @param channelId - Channel ID to check
     * @returns True if the channel is read-only
     */
    isReadOnlyChannel(channelId: string): boolean;
    /**
     * Check if a user is authorized to post in a read-only channel
     * Requirements 3.3: Moderators can post
     * Requirements 3.4: Users with whitelist roles can post
     *
     * @param message - Discord message object
     * @returns Channel access result
     */
    checkAccess(message: Message): Promise<ChannelAccessResult>;
    /**
     * Enforce channel access restrictions on a message
     * Requirements 3.1: Delete unauthorized messages within 1 second
     * Requirements 3.2: Send DM notification to user
     * Requirements 3.5: Log deleted messages
     *
     * @param message - Discord message object
     * @returns True if message was deleted, false if allowed
     */
    enforceAccess(message: Message): Promise<boolean>;
    /**
     * Send DM notification to user about deleted message
     * Requirements 3.2: Explain the restriction
     *
     * @param message - Original message that was deleted
     * @param reason - Reason for deletion
     */
    private sendDMNotification;
    /**
     * Check if a member is a moderator
     * @param member - Guild member to check
     * @returns True if member has moderator role
     */
    private isModerator;
    /**
     * Check if a member has any whitelist role
     * @param member - Guild member to check
     * @param whitelistRoleIds - Array of role IDs to check
     * @returns True if member has at least one whitelist role
     */
    private hasWhitelistRole;
    /**
     * Add a read-only channel configuration
     * @param config - Read-only channel configuration
     */
    addReadOnlyChannel(config: ReadOnlyChannelConfig): void;
    /**
     * Remove a read-only channel configuration
     * @param channelId - Channel ID to remove
     */
    removeReadOnlyChannel(channelId: string): void;
    /**
     * Update whitelist roles for a read-only channel
     * @param channelId - Channel ID
     * @param whitelistRoleIds - New array of whitelist role IDs
     */
    updateWhitelistRoles(channelId: string, whitelistRoleIds: string[]): void;
    /**
     * Get all read-only channel configurations
     * @returns Array of read-only channel configurations
     */
    getReadOnlyChannels(): ReadOnlyChannelConfig[];
    /**
     * Get whitelist roles for a specific channel
     * @param channelId - Channel ID
     * @returns Array of whitelist role IDs, or empty array if not a read-only channel
     */
    getWhitelistRoles(channelId: string): string[];
}
//# sourceMappingURL=channel-access.d.ts.map