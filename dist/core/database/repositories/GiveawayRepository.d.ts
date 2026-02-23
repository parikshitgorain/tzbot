import type { Pool } from 'pg';
import type { Giveaway, GiveawayEntry, GiveawayStatus } from '../../../types/models.js';
/**
 * GiveawayRepository handles all giveaway-related database operations
 * Manages giveaway state, entries, and winner selection
 */
export declare class GiveawayRepository {
    private pool;
    constructor(pool: Pool);
    /**
     * Save a new giveaway or update an existing one
     * Uses UPSERT to handle both insert and update cases
     */
    save(giveaway: Giveaway): Promise<void>;
    /**
     * Get a giveaway by ID
     * Returns null if giveaway not found
     */
    get(giveawayId: string): Promise<Giveaway | null>;
    /**
     * Get all active giveaways
     * Used for state recovery on bot restart
     */
    getActive(): Promise<Giveaway[]>;
    /**
     * Add an entry to a giveaway
     * Prevents duplicate entries (enforced by primary key constraint)
     */
    addEntry(giveawayId: string, userId: string): Promise<void>;
    /**
     * Get all entries for a giveaway
     * Returns array of entries with user IDs and timestamps
     */
    getEntries(giveawayId: string): Promise<GiveawayEntry[]>;
    /**
     * Check if a user has already entered a giveaway
     * Used to prevent duplicate entries
     */
    hasEntry(giveawayId: string, userId: string): Promise<boolean>;
    /**
     * Update giveaway status
     * Used when ending or cancelling a giveaway
     */
    updateStatus(giveawayId: string, status: GiveawayStatus): Promise<void>;
    /**
     * Get giveaways by channel
     * Used for displaying active giveaways in a channel
     */
    getByChannel(channelId: string, status?: GiveawayStatus): Promise<Giveaway[]>;
    /**
     * Update winners array for a giveaway
     * Used when announcing winners or rerolling
     */
    updateWinners(giveawayId: string, winners: string[]): Promise<void>;
}
//# sourceMappingURL=GiveawayRepository.d.ts.map