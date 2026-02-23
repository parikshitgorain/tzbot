import type { Pool, PoolClient } from 'pg';
/**
 * OffenseRecord represents a user's complete offense history
 */
export interface OffenseRecord {
    user_id: string;
    total_offenses: number;
    last_offense_timestamp: Date | null;
    current_timeout_duration: number;
    is_banned: boolean;
    warning_history: OffenseEntry[];
}
/**
 * OffenseEntry represents a single offense incident
 */
export interface OffenseEntry {
    id?: number;
    timestamp: Date;
    reason: string;
    punishment_applied: string;
    moderator_id: string;
    timeout_duration?: number;
}
/**
 * OffenseRepository handles all offense-related database operations
 * Provides data access for the progressive spam punishment system
 */
export declare class OffenseRepository {
    private pool;
    constructor(pool: Pool);
    /**
     * Get offense record for a user with all offense entries
     * Returns null if user has no offense record
     */
    getOffenseRecord(userId: string): Promise<OffenseRecord | null>;
    /**
     * Save or update an offense record (upsert)
     * Creates new record if doesn't exist, updates if it does
     */
    saveOffenseRecord(record: OffenseRecord): Promise<void>;
    /**
     * Add a new offense entry to the offense_entries table
     * Must be called after saveOffenseRecord to ensure parent record exists
     */
    addOffenseEntry(userId: string, entry: OffenseEntry): Promise<void>;
    /**
     * Get all users with active offenses
     * Returns array of offense records with their entries
     */
    getAllActiveOffenses(): Promise<OffenseRecord[]>;
    /**
     * Remove the most recent offense entry for a user
     * Used by /clearwarn command
     */
    removeLastOffense(userId: string): Promise<void>;
    /**
     * Reset all offenses for a user
     * Deletes the offense_record which cascades to delete all offense_entries
     * Used by /resetoffenses command and 30-day auto-reset
     */
    resetOffenses(userId: string): Promise<void>;
    /**
     * Execute a function within a database transaction
     * Provides transaction support for complex operations
     */
    withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
}
//# sourceMappingURL=OffenseRepository.d.ts.map