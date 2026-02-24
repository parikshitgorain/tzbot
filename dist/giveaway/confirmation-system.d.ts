import { Client, User } from 'discord.js';
import { WinnerStateRepository } from '../core/database/repositories/WinnerStateRepository.js';
import { GiveawayRepository } from '../core/database/repositories/GiveawayRepository.js';
import { ConfigManager } from './config-manager.js';
/**
 * ConfirmationSystem orchestrates the winner confirmation workflow
 *
 * Coordinates between Timer Manager, Message Listener, State Manager, and Reroll Handler
 * to implement the complete winner confirmation and reroll process.
 */
export declare class ConfirmationSystem {
    private winnerStateRepo;
    private giveawayRepo;
    private timerManager;
    private rerollHandler;
    private messageListener;
    private client;
    constructor(winnerStateRepo: WinnerStateRepository, giveawayRepo: GiveawayRepository, _configManager: ConfigManager);
    /**
     * Initialize the confirmation system with Discord client
     */
    initialize(client: Client): void;
    /**
     * Start confirmation process for winners
     * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
     */
    startConfirmation(giveawayId: string, winners: User[]): Promise<void>;
    /**
     * Handle winner confirmation
     * Requirements: 2.2, 2.3, 2.4, 2.5
     */
    confirmWinner(giveawayId: string, userId: string): Promise<void>;
    /**
     * Handle reminder callback
     * Requirements: 3.1, 3.2, 3.3, 3.4
     */
    private handleReminder;
    /**
     * Handle expiry callback
     * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
     */
    private handleExpiry;
    /**
     * Handle manual reroll command
     * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
     */
    manualReroll(giveawayId: string, userId: string, guildId: string): Promise<void>;
    /**
     * Restore active confirmations on system startup
     * Requirements: 9.4, 10.4, 10.5
     */
    restoreActiveConfirmations(): Promise<void>;
    /**
     * Send winner announcement message
     * Requirements: 1.4, 1.5, 8.1, 8.5
     */
    private sendWinnerAnnouncement;
    /**
     * Send confirmation message
     * Requirements: 2.4, 8.2
     */
    private sendConfirmationMessage;
    /**
     * Send reminder message
     * Requirements: 3.2, 3.3, 8.3
     */
    private sendReminderMessage;
    /**
     * Send reroll announcement
     * Requirements: 4.6, 8.4
     */
    private sendRerollAnnouncement;
    /**
     * Announce giveaway complete (no eligible participants)
     */
    private announceGiveawayComplete;
}
//# sourceMappingURL=confirmation-system.d.ts.map