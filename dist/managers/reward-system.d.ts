import type { Client } from 'discord.js';
import type { ChatActivityRepository, RewardRecord } from '../core/database/repositories/ChatActivityRepository.js';
/**
 * RewardSystem handles distribution of rewards to chat rain winners
 * Supports multiple reward types: role, currency, announcement
 *
 * Requirements:
 * - 11.7: Announce winners in chat
 */
/**
 * Types of rewards that can be distributed
 */
export declare enum RewardType {
    /** Assign a temporary or permanent role */
    ROLE = "role",
    /** Award server currency/points (requires external economy bot) */
    CURRENCY = "currency",
    /** Announce winner without tangible reward */
    ANNOUNCEMENT = "announcement",
    /** Custom reward via webhook or external system */
    CUSTOM = "custom"
}
/**
 * Reward configuration
 */
export interface Reward {
    /** Type of reward */
    type: RewardType;
    /** Value depends on type:
     * - ROLE: Discord role ID
     * - CURRENCY: Amount as string
     * - ANNOUNCEMENT: Custom message template
     * - CUSTOM: JSON payload for webhook
     */
    value?: string;
    /** Duration in milliseconds for temporary rewards (e.g., temporary role) */
    durationMs?: number;
    /** Custom message to include in announcement */
    customMessage?: string;
}
/**
 * Result of reward distribution
 */
export interface RewardDistributionResult {
    /** User IDs that successfully received rewards */
    successful: string[];
    /** User IDs that failed to receive rewards */
    failed: string[];
    /** Error messages for failed distributions */
    errors: Map<string, string>;
}
/**
 * RewardSystem manages distribution of rewards to chat rain winners
 */
export declare class RewardSystem {
    private client;
    private chatActivityRepo;
    private guildId;
    constructor(client: Client, chatActivityRepo: ChatActivityRepository, guildId: string);
    /**
     * Distribute rewards to multiple winners
     *
     * @param userIds Array of Discord user IDs
     * @param reward Reward configuration
     * @param channelId Channel to announce winners in
     * @returns Distribution result with successful and failed recipients
     *
     * Validates: Requirement 11.7
     */
    distributeRewards(userIds: string[], reward: Reward, channelId: string): Promise<RewardDistributionResult>;
    /**
     * Distribute reward to a single user
     */
    private distributeRewardToUser;
    /**
     * Assign a role to a member
     */
    private assignRole;
    /**
     * Award currency to a member
     * Note: This requires integration with an economy bot or custom currency system
     */
    private awardCurrency;
    /**
     * Handle custom reward via webhook or external system
     */
    private handleCustomReward;
    /**
     * Announce winners in the chat channel
     *
     * Validates: Requirement 11.7
     */
    private announceWinners;
    /**
     * Build the announcement message for winners
     */
    private buildAnnouncementMessage;
    /**
     * Record reward distribution in the database
     */
    private recordRewardDistribution;
    /**
     * Get reward history for a user
     *
     * @param userId Discord user ID
     * @param since Optional date to filter rewards after
     * @returns Array of reward records
     */
    getRewardHistory(userId: string, since?: Date): Promise<RewardRecord[]>;
}
//# sourceMappingURL=reward-system.d.ts.map