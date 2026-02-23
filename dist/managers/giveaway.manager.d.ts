/**
 * @file giveaway.manager.ts
 * @description Giveaway manager for creating and managing role-gated giveaways
 * @module managers
 */
import { ButtonInteraction } from 'discord.js';
import type { IDiscordClient } from '../core/discord/client.js';
import type { GiveawayRepository } from '../core/database/repositories/GiveawayRepository.js';
import type { Giveaway } from '../types/models.js';
import { ConfirmationSystem } from '../giveaway/confirmation-system.js';
import { ConfigManager } from '../giveaway/config-manager.js';
/**
 * Options for creating a giveaway
 */
export interface CreateGiveawayOptions {
    title: string;
    description: string;
    channelId: string;
    guildId: string;
    requiredRoles: string[];
    winnerCount: number;
    durationMs: number;
    condition?: string;
    hostedBy?: string;
}
/**
 * Result of entry validation
 */
export interface EntryValidationResult {
    allowed: boolean;
    reason?: string;
}
/**
 * Giveaway manager handles creation, entry validation, and winner selection
 * Implements requirements 9.1, 9.2, 9.4, 9.5, 9.6
 */
export declare class GiveawayManager {
    private discordClient;
    private giveawayRepository;
    private activeGiveaways;
    private confirmationSystem;
    private configManager;
    constructor(discordClient: IDiscordClient, giveawayRepository: GiveawayRepository);
    /**
     * Set the confirmation system (called during initialization)
     */
    setConfirmationSystem(confirmationSystem: ConfirmationSystem): void;
    /**
     * Set the config manager (called during initialization)
     */
    setConfigManager(configManager: ConfigManager): void;
    /**
     * Get the config manager
     */
    getConfigManager(): ConfigManager;
    /**
     * Create a new giveaway with interactive button
     * Requirement 9.4: Interactive buttons for users to enter giveaways
     */
    createGiveaway(options: CreateGiveawayOptions): Promise<Giveaway>;
    /**
     * Handle giveaway entry button interaction
     * Requirements 9.1, 9.2, 9.5, 9.6
     */
    handleEntryInteraction(interaction: ButtonInteraction, guildId: string): Promise<void>;
    /**
     * Handle view participants button interaction
     * Shows real-time list of participants
     */
    private handleViewParticipants;
    /**
     * Validate if a user can enter a giveaway
     * Requirement 9.1: Only allow users with required roles to enter
     */
    private validateEntry;
    /**
     * Schedule giveaway end event
     */
    private scheduleGiveawayEnd;
    /**
     * End a giveaway and select winners
     */
    private endGiveaway;
    /**
     * Select random winners using CSPRNG
     * Uses crypto.randomBytes for cryptographically secure random selection
     */
    private selectWinners;
    /**
     * Generate cryptographically secure random integer in range [min, max)
     */
    private secureRandomInt;
    /**
     * Get cryptographically secure random bytes
     */
    private getRandomBytes;
    /**
     * Announce giveaway winners
     */
    private announceWinners;
    /**
     * Announce that giveaway ended with no winners
     */
    private announceNoWinners;
    /**
     * Create giveaway embed
     */
    private createGiveawayEmbed;
    /**
     * Update giveaway message with current entry count
     */
    private updateGiveawayMessage;
    /**
     * Update giveaway message when ended
     */
    private updateGiveawayMessageEnded;
    /**
     * Generate unique giveaway ID
     */
    private generateGiveawayId;
    /**
     * Recover active giveaways on startup
     * Used for state recovery after bot restart
     */
    recoverActiveGiveaways(guildId: string): Promise<void>;
    /**
     * Cancel a giveaway
     */
    cancelGiveaway(giveawayId: string): Promise<void>;
    /**
     * Get all active giveaways for a guild
     */
    getActiveGiveaways(guildId: string): Promise<Giveaway[]>;
    /**
     * Reroll a specific winner from a giveaway
     */
    rerollWinner(giveawayId: string, oldWinnerId: string, guildId: string): Promise<void>;
    /**
     * Update giveaway message when cancelled
     */
    private updateGiveawayMessageCancelled;
}
//# sourceMappingURL=giveaway.manager.d.ts.map