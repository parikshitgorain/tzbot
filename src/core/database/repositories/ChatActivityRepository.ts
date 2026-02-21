import type { Pool } from 'pg';

/**
 * ChatActivityRepository handles chat activity tracking for chat rain system
 * Tracks user messages to determine active chatters
 */
export class ChatActivityRepository {
  constructor(private pool: Pool) {}

  /**
   * Record a chat activity event for a user
   * Used to track active chatters for chat rain eligibility
   */
  async record(userId: string, timestamp: Date): Promise<void> {
    const query = `
      INSERT INTO chat_activity (user_id, timestamp)
      VALUES ($1, $2)
      ON CONFLICT (user_id, timestamp) DO NOTHING
    `;

    try {
      await this.pool.query(query, [userId, timestamp]);
    } catch (error) {
      throw new Error(`Failed to record chat activity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get active chatters who have sent messages since a specific time
   * Returns array of user IDs
   */
  async getActiveChatters(since: Date): Promise<string[]> {
    const query = `
      SELECT DISTINCT user_id
      FROM chat_activity
      WHERE timestamp >= $1
    `;

    try {
      const result = await this.pool.query(query, [since]);
      return result.rows.map(row => row.user_id);
    } catch (error) {
      throw new Error(`Failed to get active chatters: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get message count for a user within a time window
   * Used to determine if user meets minimum message threshold (3+ messages)
   */
  async getMessageCount(userId: string, since: Date): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM chat_activity
      WHERE user_id = $1 AND timestamp >= $2
    `;

    try {
      const result = await this.pool.query(query, [userId, since]);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      throw new Error(`Failed to get message count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get users who meet the active chatter criteria
   * Must have sent at least minMessages within the time window
   */
  async getQualifiedChatters(since: Date, minMessages: number = 3): Promise<string[]> {
    const query = `
      SELECT user_id
      FROM chat_activity
      WHERE timestamp >= $1
      GROUP BY user_id
      HAVING COUNT(*) >= $2
    `;

    try {
      const result = await this.pool.query(query, [since, minMessages]);
      return result.rows.map(row => row.user_id);
    } catch (error) {
      throw new Error(`Failed to get qualified chatters: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up old chat activity records
   * Should be run periodically to prevent table bloat
   */
  async cleanupOldActivity(olderThan: Date): Promise<number> {
    const query = `
      DELETE FROM chat_activity
      WHERE timestamp < $1
    `;

    try {
      const result = await this.pool.query(query, [olderThan]);
      return result.rowCount || 0;
    } catch (error) {
      throw new Error(`Failed to cleanup old activity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Record a chat rain winner
   * Used to track cooldown period (60 minutes)
   */
  async recordWinner(userId: string, timestamp: Date, rewardType: string, rewardValue?: string): Promise<void> {
    const query = `
      INSERT INTO chat_rain_winners (user_id, timestamp, reward_type, reward_value)
      VALUES ($1, $2, $3, $4)
    `;

    try {
      await this.pool.query(query, [userId, timestamp, rewardType, rewardValue || null]);
    } catch (error) {
      throw new Error(`Failed to record chat rain winner: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get recent chat rain winners
   * Used to enforce cooldown period
   */
  async getRecentWinners(since: Date): Promise<string[]> {
    const query = `
      SELECT DISTINCT user_id
      FROM chat_rain_winners
      WHERE timestamp >= $1
    `;

    try {
      const result = await this.pool.query(query, [since]);
      return result.rows.map(row => row.user_id);
    } catch (error) {
      throw new Error(`Failed to get recent winners: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a user has won chat rain recently
   * Returns true if user won within the cooldown period
   */
  async hasRecentWin(userId: string, since: Date): Promise<boolean> {
    const query = `
      SELECT 1
      FROM chat_rain_winners
      WHERE user_id = $1 AND timestamp >= $2
      LIMIT 1
    `;

    try {
      const result = await this.pool.query(query, [userId, since]);
      return result.rows.length > 0;
    } catch (error) {
      throw new Error(`Failed to check recent win: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the last chat rain winner timestamp
   * Used to enforce minimum delay between chat rain events
   */
  async getLastChatRainTime(): Promise<Date | null> {
    const query = `
      SELECT MAX(timestamp) as last_time
      FROM chat_rain_winners
    `;

    try {
      const result = await this.pool.query(query);
      return result.rows[0].last_time || null;
    } catch (error) {
      throw new Error(`Failed to get last chat rain time: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get reward history for a user
   * Returns all rewards received by the user, optionally filtered by date
   */
  async getRewardHistory(userId: string, since?: Date): Promise<RewardRecord[]> {
    let query = `
      SELECT user_id, timestamp, reward_type, reward_value
      FROM chat_rain_winners
      WHERE user_id = $1
    `;
    
    const params: any[] = [userId];
    
    if (since) {
      query += ` AND timestamp >= $2`;
      params.push(since);
    }
    
    query += ` ORDER BY timestamp DESC`;

    try {
      const result = await this.pool.query(query, params);
      return result.rows.map(row => ({
        userId: row.user_id,
        timestamp: row.timestamp,
        rewardType: row.reward_type,
        rewardValue: row.reward_value
      }));
    } catch (error) {
      throw new Error(`Failed to get reward history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Record of a reward distribution
 */
export interface RewardRecord {
  userId: string;
  timestamp: Date;
  rewardType: string;
  rewardValue?: string;
}
