import type { Pool } from 'pg';
import type { User } from '../../../types/models.js';
/**
 * UserRepository handles all user-related database operations
 * Provides clean data access methods following the repository pattern
 */
export declare class UserRepository {
    private pool;
    constructor(pool: Pool);
    /**
     * Save or update a user in the database
     * Uses UPSERT to handle both insert and update cases
     */
    save(user: Partial<User> & {
        discordId: string;
    }): Promise<void>;
    /**
     * Get a user by Discord ID
     * Returns null if user not found
     */
    get(discordId: string): Promise<User | null>;
    /**
     * Get a user by Kick username
     * Used for account linking and role synchronization
     */
    getByKickUsername(kickUsername: string): Promise<User | null>;
    /**
     * Link a Discord user to a Kick username
     * Updates the user record with the Kick username
     */
    linkKickUsername(discordId: string, kickUsername: string): Promise<void>;
    /**
     * Unlink a Kick username from a Discord user
     * Sets kick_username to NULL
     */
    unlinkKickUsername(discordId: string): Promise<void>;
    /**
     * Delete all data for a user (GDPR compliance)
     * Cascading deletes will remove related records
     */
    deleteUserData(discordId: string): Promise<void>;
}
//# sourceMappingURL=UserRepository.d.ts.map