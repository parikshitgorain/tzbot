import type { Pool, PoolClient } from 'pg';
import { WinnerRecord, WinnerStatus } from '../../../types/models.js';
/**
 * WinnerStateRepository handles all winner state database operations
 * Manages winner confirmation state, transitions, and persistence
 */
export declare class WinnerStateRepository {
    private pool;
    constructor(pool: Pool);
    /**
     * Create a new winner record
     * Initial status should be PENDING
     */
    createWinner(record: Omit<WinnerRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<void>;
    /**
     * Update winner status with state transition enforcement
     * Only allows PENDING → CONFIRMED or PENDING → REROLLED transitions
     * Terminal states (CONFIRMED, REROLLED) cannot be changed
     */
    updateStatus(giveawayId: string, userId: string, newStatus: WinnerStatus): Promise<void>;
    /**
     * Get a specific winner record
     * Returns null if not found
     */
    getWinner(giveawayId: string, userId: string): Promise<WinnerRecord | null>;
    /**
     * Get all winners for a giveaway
     * Returns array of winner records
     */
    getWinners(giveawayId: string): Promise<WinnerRecord[]>;
    /**
     * Get all pending winners across all giveaways
     * Used for system restart recovery
     */
    getAllPendingWinners(): Promise<WinnerRecord[]>;
    /**
     * Check if a user has any winner state for a giveaway
     * Used to prevent duplicate winner selection
     */
    hasWinnerState(giveawayId: string, userId: string): Promise<boolean>;
    /**
     * Get all pending winners for a specific user in a guild
     * Used by MessageListener to check if user is a pending winner
     */
    getPendingWinnersByUser(guildId: string, userId: string): Promise<WinnerRecord[]>;
    /**
     * Execute a function within a database transaction
     * Provides transaction support for complex operations
     */
    withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
    /**
     * Map database row to WinnerRecord interface
     */
    private mapRowToWinnerRecord;
}
//# sourceMappingURL=WinnerStateRepository.d.ts.map