import type { Pool } from 'pg';
import type { Giveaway, GiveawayEntry, GiveawayStatus } from '../../../types/models.js';

/**
 * GiveawayRepository handles all giveaway-related database operations
 * Manages giveaway state, entries, and winner selection
 */
export class GiveawayRepository {
  constructor(private pool: Pool) {}

  /**
   * Save a new giveaway or update an existing one
   * Uses UPSERT to handle both insert and update cases
   */
  async save(giveaway: Giveaway): Promise<void> {
    const query = `
      INSERT INTO giveaways (
        id, guild_id, title, description, channel_id, message_id, 
        required_roles, winner_count, status, ends_at, created_at,
        condition, winners, hosted_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) 
      DO UPDATE SET 
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        ends_at = EXCLUDED.ends_at,
        condition = EXCLUDED.condition,
        winners = EXCLUDED.winners,
        hosted_by = EXCLUDED.hosted_by
    `;

    try {
      await this.pool.query(query, [
        giveaway.id,
        giveaway.guildId,
        giveaway.title,
        giveaway.description,
        giveaway.channelId,
        giveaway.messageId,
        JSON.stringify(giveaway.requiredRoles),
        giveaway.winnerCount,
        giveaway.status,
        giveaway.endsAt,
        giveaway.createdAt,
        giveaway.condition || null,
        JSON.stringify(giveaway.winners || []),
        giveaway.hostedBy || null,
      ]);
    } catch (error) {
      throw new Error(`Failed to save giveaway: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a giveaway by ID
   * Returns null if giveaway not found
   */
  async get(giveawayId: string): Promise<Giveaway | null> {
    const query = `
      SELECT 
        g.id, g.guild_id, g.title, g.description, g.channel_id, g.message_id,
        g.required_roles, g.winner_count, g.status, g.ends_at, g.created_at,
        g.condition, g.winners, g.hosted_by
      FROM giveaways g
      WHERE g.id = $1
    `;

    try {
      const result = await this.pool.query(query, [giveawayId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      // Fetch entries separately
      const entries = await this.getEntries(giveawayId);

      return {
        id: row.id,
        guildId: row.guild_id,
        title: row.title,
        description: row.description,
        channelId: row.channel_id,
        messageId: row.message_id,
        requiredRoles: row.required_roles,
        winnerCount: row.winner_count,
        status: row.status as GiveawayStatus,
        endsAt: row.ends_at,
        createdAt: row.created_at,
        entries,
        condition: row.condition || undefined,
        winners: row.winners || [],
        hostedBy: row.hosted_by || undefined,
      };
    } catch (error) {
      throw new Error(`Failed to get giveaway: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a giveaway by message ID
   * Returns null if giveaway not found
   * Used for prefix commands that reference the giveaway message
   */
  async getByMessageId(messageId: string): Promise<Giveaway | null> {
    const query = `
      SELECT 
        g.id, g.guild_id, g.title, g.description, g.channel_id, g.message_id,
        g.required_roles, g.winner_count, g.status, g.ends_at, g.created_at,
        g.condition, g.winners, g.hosted_by
      FROM giveaways g
      WHERE g.message_id = $1
    `;

    try {
      const result = await this.pool.query(query, [messageId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      // Fetch entries separately
      const entries = await this.getEntries(row.id);

      return {
        id: row.id,
        guildId: row.guild_id,
        title: row.title,
        description: row.description,
        channelId: row.channel_id,
        messageId: row.message_id,
        requiredRoles: row.required_roles,
        winnerCount: row.winner_count,
        status: row.status as GiveawayStatus,
        endsAt: row.ends_at,
        createdAt: row.created_at,
        entries,
        condition: row.condition || undefined,
        winners: row.winners || [],
        hostedBy: row.hosted_by || undefined,
      };
    } catch (error) {
      throw new Error(`Failed to get giveaway by message ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all active giveaways
   * Used for state recovery on bot restart
   */
  async getActive(): Promise<Giveaway[]> {
    const query = `
      SELECT 
        id, guild_id, title, description, channel_id, message_id,
        required_roles, winner_count, status, ends_at, created_at,
        condition, winners, hosted_by
      FROM giveaways
      WHERE status = 'active' AND ends_at > NOW()
      ORDER BY ends_at ASC
    `;

    try {
      const result = await this.pool.query(query);

      const giveaways: Giveaway[] = [];
      for (const row of result.rows) {
        const entries = await this.getEntries(row.id);

        giveaways.push({
          id: row.id,
          guildId: row.guild_id,
          title: row.title,
          description: row.description,
          channelId: row.channel_id,
          messageId: row.message_id,
          requiredRoles: row.required_roles,
          winnerCount: row.winner_count,
          status: row.status as GiveawayStatus,
          endsAt: row.ends_at,
          createdAt: row.created_at,
          entries,
          condition: row.condition || undefined,
          winners: row.winners || [],
          hostedBy: row.hosted_by || undefined,
        });
      }

      return giveaways;
    } catch (error) {
      throw new Error(`Failed to get active giveaways: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add an entry to a giveaway
   * Prevents duplicate entries (enforced by primary key constraint)
   */
  async addEntry(giveawayId: string, userId: string): Promise<void> {
    const query = `
      INSERT INTO giveaway_entries (giveaway_id, user_id, timestamp)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (giveaway_id, user_id) DO NOTHING
    `;

    try {
      await this.pool.query(query, [giveawayId, userId]);
    } catch (error) {
      throw new Error(`Failed to add giveaway entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all entries for a giveaway
   * Returns array of entries with user IDs and timestamps
   */
  async getEntries(giveawayId: string): Promise<GiveawayEntry[]> {
    const query = `
      SELECT user_id, timestamp
      FROM giveaway_entries
      WHERE giveaway_id = $1
      ORDER BY timestamp ASC
    `;

    try {
      const result = await this.pool.query(query, [giveawayId]);

      return result.rows.map(row => ({
        userId: row.user_id,
        timestamp: row.timestamp,
      }));
    } catch (error) {
      throw new Error(`Failed to get giveaway entries: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a user has already entered a giveaway
   * Used to prevent duplicate entries
   */
  async hasEntry(giveawayId: string, userId: string): Promise<boolean> {
    const query = `
      SELECT 1
      FROM giveaway_entries
      WHERE giveaway_id = $1 AND user_id = $2
    `;

    try {
      const result = await this.pool.query(query, [giveawayId, userId]);
      return result.rows.length > 0;
    } catch (error) {
      throw new Error(`Failed to check giveaway entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update giveaway status
   * Used when ending or cancelling a giveaway
   */
  async updateStatus(giveawayId: string, status: GiveawayStatus): Promise<void> {
    const query = `
      UPDATE giveaways
      SET status = $1
      WHERE id = $2
    `;

    try {
      await this.pool.query(query, [status, giveawayId]);
    } catch (error) {
      throw new Error(`Failed to update giveaway status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get giveaways by channel
   * Used for displaying active giveaways in a channel
   */
  async getByChannel(channelId: string, status?: GiveawayStatus): Promise<Giveaway[]> {
    let query = `
      SELECT 
        id, guild_id, title, description, channel_id, message_id,
        required_roles, winner_count, status, ends_at, created_at,
        condition, winners, hosted_by
      FROM giveaways
      WHERE channel_id = $1
    `;

    const params: (string | GiveawayStatus)[] = [channelId];

    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    try {
      const result = await this.pool.query(query, params);

      const giveaways: Giveaway[] = [];
      for (const row of result.rows) {
        const entries = await this.getEntries(row.id);

        giveaways.push({
          id: row.id,
          guildId: row.guild_id,
          title: row.title,
          description: row.description,
          channelId: row.channel_id,
          messageId: row.message_id,
          requiredRoles: row.required_roles,
          winnerCount: row.winner_count,
          status: row.status as GiveawayStatus,
          endsAt: row.ends_at,
          createdAt: row.created_at,
          entries,
          condition: row.condition || undefined,
          winners: row.winners || [],
          hostedBy: row.hosted_by || undefined,
        });
      }

      return giveaways;
    } catch (error) {
      throw new Error(`Failed to get giveaways by channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update winners array for a giveaway
   * Used when announcing winners or rerolling
   */
  async updateWinners(giveawayId: string, winners: string[]): Promise<void> {
    const query = `
      UPDATE giveaways
      SET winners = $1
      WHERE id = $2
    `;

    try {
      await this.pool.query(query, [JSON.stringify(winners), giveawayId]);
    } catch (error) {
      throw new Error(`Failed to update giveaway winners: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
