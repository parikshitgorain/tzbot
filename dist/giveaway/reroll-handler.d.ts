import type { GiveawayRepository } from '../core/database/repositories/GiveawayRepository.js';
import type { WinnerStateRepository } from '../core/database/repositories/WinnerStateRepository.js';
/**
 * RerollHandler manages winner reroll logic
 * Selects new winners when original winners fail to respond
 *
 * Requirements: 4.3, 4.7, 7.6
 */
export declare class RerollHandler {
    private giveawayRepository;
    private winnerStateRepository;
    constructor(giveawayRepository: GiveawayRepository, winnerStateRepository: WinnerStateRepository);
    /**
     * Get eligible participants for reroll
     * Excludes all users who already have winner state (PENDING, CONFIRMED, or REROLLED)
     *
     * @param giveawayId - The giveaway ID to query
     * @returns Array of eligible user IDs
     *
     * Requirements: 4.7, 7.6
     */
    getEligibleParticipants(giveawayId: string): Promise<string[]>;
    /**
     * Reroll a specific winner
     * Selects a new winner using cryptographically secure random selection
     * Returns null if no eligible participants remain
     *
     * @param giveawayId - The giveaway ID
     * @returns The new winner's user ID, or null if no eligible participants
     *
     * Requirements: 4.3, 4.7
     */
    rerollWinner(giveawayId: string): Promise<string | null>;
    /**
     * Select a random user from the eligible participants
     * Uses cryptographically secure random number generation
     *
     * @param userIds - Array of eligible user IDs
     * @returns Randomly selected user ID
     *
     * Requirements: 4.3
     */
    private selectRandomUser;
}
//# sourceMappingURL=reroll-handler.d.ts.map