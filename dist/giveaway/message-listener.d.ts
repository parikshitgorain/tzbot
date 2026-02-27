import { Client } from 'discord.js';
import { WinnerStateRepository } from '../core/database/repositories/WinnerStateRepository.js';
/**
 * Message Listener for Giveaway Winner Confirmation
 *
 * Monitors Discord message events to detect when pending winners send messages,
 * triggering the confirmation process. Uses an in-memory cache for performance.
 */
export declare class MessageListener {
    private client;
    private winnerStateRepo;
    private pendingWinnersCache;
    private confirmationCallback;
    private userConfirmationAttempts;
    private readonly MAX_CONFIRMATION_ATTEMPTS;
    constructor(winnerStateRepo: WinnerStateRepository, confirmationCallback: (giveawayId: string, userId: string) => Promise<void>);
    /**
     * Initialize message event listener
     */
    initialize(client: Client): void;
    /**
     * Handle incoming message
     */
    private handleMessage;
    /**
     * Check if user is a pending winner (with caching)
     */
    isPendingWinner(guildId: string, userId: string): Promise<boolean>;
    /**
     * Get all giveaways where user is a pending winner
     */
    getPendingGiveaways(guildId: string, userId: string): Promise<string[]>;
    /**
     * Refresh cache for a guild
     */
    refreshCache(guildId: string): Promise<void>;
    /**
     * Invalidate cache for a specific user
     */
    invalidateCache(guildId: string, userId: string): void;
    /**
     * Clear entire cache
     */
    clearCache(): void;
}
//# sourceMappingURL=message-listener.d.ts.map