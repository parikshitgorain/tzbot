import { randomBytes } from 'crypto';
import type { GiveawayRepository } from '../core/database/repositories/GiveawayRepository.js';
import type { WinnerStateRepository } from '../core/database/repositories/WinnerStateRepository.js';

/**
 * RerollHandler manages winner reroll logic
 * Selects new winners when original winners fail to respond
 * 
 * Requirements: 4.3, 4.7, 7.6
 */
export class RerollHandler {
  constructor(
    private giveawayRepository: GiveawayRepository,
    private winnerStateRepository: WinnerStateRepository
  ) {}

  /**
   * Get eligible participants for reroll
   * Excludes all users who already have winner state (PENDING, CONFIRMED, or REROLLED)
   * 
   * @param giveawayId - The giveaway ID to query
   * @returns Array of eligible user IDs
   * 
   * Requirements: 4.7, 7.6
   */
  async getEligibleParticipants(giveawayId: string): Promise<string[]> {
    try {
      // Get all entries for the giveaway
      const giveaway = await this.giveawayRepository.get(giveawayId);
      
      if (!giveaway) {
        throw new Error(`Giveaway not found: ${giveawayId}`);
      }

      // Get all winner records for this giveaway
      const winners = await this.winnerStateRepository.getWinners(giveawayId);
      
      // Create a Set of user IDs who have already been selected
      const excludedUserIds = new Set(winners.map(w => w.userId));

      // Filter entries to only include users who haven't been selected
      const eligibleEntries = giveaway.entries.filter(
        entry => !excludedUserIds.has(entry.userId)
      );

      // Return array of eligible user IDs
      return eligibleEntries.map(entry => entry.userId);
    } catch (error) {
      throw new Error(
        `Failed to get eligible participants: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

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
  async rerollWinner(giveawayId: string): Promise<string | null> {
    try {
      // Get eligible participants
      const eligibleUserIds = await this.getEligibleParticipants(giveawayId);

      // Handle case where no eligible participants remain
      if (eligibleUserIds.length === 0) {
        return null;
      }

      // Use cryptographically secure random selection
      const selectedUserId = this.selectRandomUser(eligibleUserIds);

      return selectedUserId;
    } catch (error) {
      throw new Error(
        `Failed to reroll winner: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Select a random user from the eligible participants
   * Uses cryptographically secure random number generation
   * 
   * @param userIds - Array of eligible user IDs
   * @returns Randomly selected user ID
   * 
   * Requirements: 4.3
   */
  private selectRandomUser(userIds: string[]): string {
    if (userIds.length === 0) {
      throw new Error('Cannot select from empty array');
    }

    if (userIds.length === 1) {
      return userIds[0];
    }

    // Generate cryptographically secure random bytes
    // We need enough bytes to represent the array length
    const maxIndex = userIds.length - 1;
    const bytesNeeded = Math.ceil(Math.log2(userIds.length) / 8);
    
    // Use rejection sampling to avoid modulo bias
    let randomIndex: number;
    let attempts = 0;
    const maxAttempts = 100; // Prevent infinite loop

    do {
      const randomBytesBuffer = randomBytes(bytesNeeded);
      randomIndex = 0;
      
      // Convert bytes to integer
      for (let i = 0; i < bytesNeeded; i++) {
        randomIndex = (randomIndex << 8) | randomBytesBuffer[i];
      }

      attempts++;
      
      if (attempts >= maxAttempts) {
        // Fallback to simple modulo if rejection sampling takes too long
        randomIndex = randomIndex % userIds.length;
        break;
      }
    } while (randomIndex > maxIndex);

    // Ensure index is within bounds
    randomIndex = randomIndex % userIds.length;

    return userIds[randomIndex];
  }
}
