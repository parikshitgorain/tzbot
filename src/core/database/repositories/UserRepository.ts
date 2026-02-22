import type { Pool } from 'pg';
import type { User } from '../../../types/models.js';

/**
 * UserRepository handles all user-related database operations
 * Provides clean data access methods following the repository pattern
 */
export class UserRepository {
  constructor(private pool: Pool) {}

  /**
   * Save or update a user in the database
   * Uses UPSERT to handle both insert and update cases
   */
  async save(user: Partial<User> & { discordId: string }): Promise<void> {
    const query = `
      INSERT INTO users (discord_id, kick_username, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (discord_id) 
      DO UPDATE SET 
        kick_username = EXCLUDED.kick_username,
        updated_at = CURRENT_TIMESTAMP
    `;

    try {
      await this.pool.query(query, [user.discordId, user.kickUsername || null]);
    } catch (error) {
      throw new Error(`Failed to save user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a user by Discord ID
   * Returns null if user not found
   */
  async get(discordId: string): Promise<User | null> {
    const query = `
      SELECT discord_id, kick_username, created_at, updated_at
      FROM users
      WHERE discord_id = $1
    `;

    try {
      const result = await this.pool.query(query, [discordId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        discordId: row.discord_id,
        kickUsername: row.kick_username,
        roles: [], // Roles are managed by Discord, not stored in DB
        violations: [], // Violations are fetched separately
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      throw new Error(`Failed to get user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a user by Kick username
   * Used for account linking and role synchronization
   */
  async getByKickUsername(kickUsername: string): Promise<User | null> {
    const query = `
      SELECT discord_id, kick_username, created_at, updated_at
      FROM users
      WHERE kick_username = $1
    `;

    try {
      const result = await this.pool.query(query, [kickUsername]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        discordId: row.discord_id,
        kickUsername: row.kick_username,
        roles: [],
        violations: [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      throw new Error(`Failed to get user by Kick username: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Link a Discord user to a Kick username
   * Updates the user record with the Kick username
   */
  async linkKickUsername(discordId: string, kickUsername: string): Promise<void> {
    const query = `
      INSERT INTO users (discord_id, kick_username, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (discord_id) 
      DO UPDATE SET 
        kick_username = EXCLUDED.kick_username,
        updated_at = CURRENT_TIMESTAMP
    `;

    try {
      await this.pool.query(query, [discordId, kickUsername]);
    } catch (error) {
      throw new Error(`Failed to link Kick username: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Unlink a Kick username from a Discord user
   * Sets kick_username to NULL
   */
  async unlinkKickUsername(discordId: string): Promise<void> {
    const query = `
      UPDATE users
      SET kick_username = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE discord_id = $1
    `;

    try {
      await this.pool.query(query, [discordId]);
    } catch (error) {
      throw new Error(`Failed to unlink Kick username: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete all data for a user (GDPR compliance)
   * Cascading deletes will remove related records
   */
  async deleteUserData(discordId: string): Promise<void> {
    const query = `DELETE FROM users WHERE discord_id = $1`;

    try {
      await this.pool.query(query, [discordId]);
    } catch (error) {
      throw new Error(`Failed to delete user data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
