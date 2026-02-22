import type { Pool, PoolClient } from 'pg';
import { WinnerRecord, WinnerStatus } from '../../../types/models.js';

/**
 * WinnerStateRepository handles all winner state database operations
 * Manages winner confirmation state, transitions, and persistence
 */
export class WinnerStateRepository {
  constructor(private pool: Pool) {}

  /**
   * Create a new winner record
   * Initial status should be PENDING
   */
  async createWinner(record: Omit<WinnerRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const query = `
      INSERT INTO giveaway_winners (
        giveaway_id, user_id, status, selected_at,
        timer_start_time, timer_active
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    try {
      await this.pool.query(query, [
        record.giveawayId,
        record.userId,
        record.status,
        record.selectedAt,
        record.timerStartTime,
        record.timerActive,
      ]);
    } catch (error) {
      throw new Error(
        `Failed to create winner: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update winner status with state transition enforcement
   * Only allows PENDING → CONFIRMED or PENDING → REROLLED transitions
   * Terminal states (CONFIRMED, REROLLED) cannot be changed
   */
  async updateStatus(
    giveawayId: string,
    userId: string,
    newStatus: WinnerStatus
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get current status
      const selectQuery = `
        SELECT status FROM giveaway_winners
        WHERE giveaway_id = $1 AND user_id = $2
        FOR UPDATE
      `;
      
      const result = await client.query(selectQuery, [giveawayId, userId]);

      if (result.rows.length === 0) {
        throw new Error('Winner record not found');
      }

      const currentStatus = result.rows[0].status as WinnerStatus;

      // Enforce state transition rules
      if (currentStatus === WinnerStatus.CONFIRMED || currentStatus === WinnerStatus.REROLLED) {
        // Terminal states - no transitions allowed
        await client.query('ROLLBACK');
        return; // Silently ignore attempts to change terminal states
      }

      if (currentStatus !== WinnerStatus.PENDING) {
        throw new Error(`Invalid state transition from ${currentStatus} to ${newStatus}`);
      }

      if (newStatus !== WinnerStatus.CONFIRMED && newStatus !== WinnerStatus.REROLLED) {
        throw new Error(`Invalid target status: ${newStatus}`);
      }

      // Update status and set appropriate timestamp
      const timestampColumn = newStatus === WinnerStatus.CONFIRMED ? 'confirmed_at' : 'rerolled_at';
      const updateQuery = `
        UPDATE giveaway_winners
        SET status = $1, ${timestampColumn} = CURRENT_TIMESTAMP, 
            timer_active = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE giveaway_id = $2 AND user_id = $3
      `;

      await client.query(updateQuery, [newStatus, giveawayId, userId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(
        `Failed to update winner status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get a specific winner record
   * Returns null if not found
   */
  async getWinner(giveawayId: string, userId: string): Promise<WinnerRecord | null> {
    const query = `
      SELECT id, giveaway_id, user_id, status, selected_at,
             confirmed_at, rerolled_at, timer_start_time, timer_active,
             created_at, updated_at
      FROM giveaway_winners
      WHERE giveaway_id = $1 AND user_id = $2
    `;

    try {
      const result = await this.pool.query(query, [giveawayId, userId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return this.mapRowToWinnerRecord(row);
    } catch (error) {
      throw new Error(
        `Failed to get winner: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all winners for a giveaway
   * Returns array of winner records
   */
  async getWinners(giveawayId: string): Promise<WinnerRecord[]> {
    const query = `
      SELECT id, giveaway_id, user_id, status, selected_at,
             confirmed_at, rerolled_at, timer_start_time, timer_active,
             created_at, updated_at
      FROM giveaway_winners
      WHERE giveaway_id = $1
      ORDER BY selected_at ASC
    `;

    try {
      const result = await this.pool.query(query, [giveawayId]);
      return result.rows.map(row => this.mapRowToWinnerRecord(row));
    } catch (error) {
      throw new Error(
        `Failed to get winners: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all pending winners across all giveaways
   * Used for system restart recovery
   */
  async getAllPendingWinners(): Promise<WinnerRecord[]> {
    const query = `
      SELECT id, giveaway_id, user_id, status, selected_at,
             confirmed_at, rerolled_at, timer_start_time, timer_active,
             created_at, updated_at
      FROM giveaway_winners
      WHERE status = $1 AND timer_active = TRUE
      ORDER BY timer_start_time ASC
    `;

    try {
      const result = await this.pool.query(query, [WinnerStatus.PENDING]);
      return result.rows.map(row => this.mapRowToWinnerRecord(row));
    } catch (error) {
      throw new Error(
        `Failed to get pending winners: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if a user has any winner state for a giveaway
   * Used to prevent duplicate winner selection
   */
  async hasWinnerState(giveawayId: string, userId: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM giveaway_winners
      WHERE giveaway_id = $1 AND user_id = $2
    `;

    try {
      const result = await this.pool.query(query, [giveawayId, userId]);
      return result.rows.length > 0;
    } catch (error) {
      throw new Error(
        `Failed to check winner state: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all pending winners for a specific user in a guild
   * Used by MessageListener to check if user is a pending winner
   */
  async getPendingWinnersByUser(guildId: string, userId: string): Promise<WinnerRecord[]> {
    const query = `
      SELECT gw.id, gw.giveaway_id, gw.user_id, gw.status, gw.selected_at,
             gw.confirmed_at, gw.rerolled_at, gw.timer_start_time, gw.timer_active,
             gw.created_at, gw.updated_at
      FROM giveaway_winners gw
      JOIN giveaways g ON gw.giveaway_id = g.id
      WHERE g.guild_id = $1 AND gw.user_id = $2 AND gw.status = $3 AND gw.timer_active = TRUE
    `;

    try {
      const result = await this.pool.query(query, [guildId, userId, WinnerStatus.PENDING]);
      return result.rows.map(row => this.mapRowToWinnerRecord(row));
    } catch (error) {
      throw new Error(
        `Failed to get pending winners by user: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Execute a function within a database transaction
   * Provides transaction support for complex operations
   */
  async withTransaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Map database row to WinnerRecord interface
   */
  private mapRowToWinnerRecord(row: Record<string, unknown>): WinnerRecord {
    return {
      id: row.id as string,
      giveawayId: row.giveaway_id as string,
      userId: row.user_id as string,
      status: row.status as WinnerStatus,
      selectedAt: row.selected_at as Date,
      confirmedAt: (row.confirmed_at as Date | null) || undefined,
      rerolledAt: (row.rerolled_at as Date | null) || undefined,
      timerStartTime: row.timer_start_time,
      timerActive: row.timer_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
