import { redisClient } from '../../../core/cache/redis.client.js';
import { logger } from '../../../core/logger/logger.js';
/**
 * ChatActivityRepository handles chat activity tracking for chat rain system
 * Tracks user messages to determine active chatters
 * Uses Redis caching and batch writes to minimize database load
 */
export class ChatActivityRepository {
    pool;
    batchQueue = [];
    batchTimer = null;
    BATCH_SIZE = 50; // Write to DB after 50 messages
    BATCH_TIMEOUT_MS = 30000; // Or after 30 seconds
    CACHE_TTL = 3600; // 1 hour cache for activity tracking
    constructor(pool) {
        this.pool = pool;
    }
    /**
     * Record a chat activity event for a user
     * Uses batching to reduce database writes
     */
    async record(userId, timestamp) {
        // Increment counter in Redis cache for real-time tracking
        try {
            await redisClient.incr(`chat:count:${userId}`);
            await redisClient.expire(`chat:count:${userId}`, this.CACHE_TTL);
        }
        catch (cacheError) {
            logger.warn('Failed to cache chat activity', {
                userId,
                error: cacheError instanceof Error ? cacheError.message : 'Unknown error',
            });
        }
        // Add to batch queue for database write
        this.batchQueue.push({ userId, timestamp });
        // Flush if batch is full
        if (this.batchQueue.length >= this.BATCH_SIZE) {
            await this.flushBatch();
        }
        else if (!this.batchTimer) {
            // Start timer if not already running
            this.batchTimer = setTimeout(() => {
                this.flushBatch().catch((error) => {
                    logger.error('Failed to flush chat activity batch', { error });
                });
            }, this.BATCH_TIMEOUT_MS);
        }
    }
    /**
     * Flush batched chat activities to database
     */
    async flushBatch() {
        if (this.batchQueue.length === 0) {
            return;
        }
        // Clear timer
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
        // Get batch to write
        const batch = [...this.batchQueue];
        this.batchQueue = [];
        // Batch insert to database
        if (batch.length > 0) {
            const values = batch.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
            const params = batch.flatMap(item => [item.userId, item.timestamp]);
            const query = `
        INSERT INTO chat_activity (user_id, timestamp)
        VALUES ${values}
        ON CONFLICT (user_id, timestamp) DO NOTHING
      `;
            try {
                await this.pool.query(query, params);
                logger.debug('Flushed chat activity batch', { count: batch.length });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                logger.error('Failed to flush chat activity batch to database', {
                    batchSize: batch.length,
                    error: errorMessage,
                });
                // Re-queue failed items
                this.batchQueue.unshift(...batch);
                // Throw error for test compatibility
                throw new Error(`Failed to record chat activity: ${errorMessage}`);
            }
        }
    }
    /**
     * Force flush any pending batched writes
     * Should be called on shutdown
     */
    async forceFlush() {
        await this.flushBatch();
    }
    /**
     * Get active chatters who have sent messages since a specific time
     * Returns array of user IDs
     * Uses cache when possible
     */
    async getActiveChatters(since) {
        // Try cache first
        const cacheKey = `chat:active:${since.getTime()}`;
        try {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        }
        catch (cacheError) {
            logger.warn('Cache read failed for active chatters', {
                error: cacheError instanceof Error ? cacheError.message : 'Unknown error',
            });
        }
        // Query database
        const query = `
      SELECT DISTINCT user_id
      FROM chat_activity
      WHERE timestamp >= $1
    `;
        try {
            const result = await this.pool.query(query, [since]);
            const userIds = result.rows.map(row => row.user_id);
            // Cache result for 5 minutes
            try {
                await redisClient.set(cacheKey, JSON.stringify(userIds), 300);
            }
            catch (cacheError) {
                logger.warn('Failed to cache active chatters', {
                    error: cacheError instanceof Error ? cacheError.message : 'Unknown error',
                });
            }
            return userIds;
        }
        catch (error) {
            throw new Error(`Failed to get active chatters: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Get message count for a user within a time window
     * Used to determine if user meets minimum message threshold (3+ messages)
     * Uses cache when possible
     */
    async getMessageCount(userId, since) {
        // Try cache first
        const cacheKey = `chat:count:${userId}`;
        try {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                return parseInt(cached, 10);
            }
        }
        catch (cacheError) {
            logger.warn('Cache read failed for message count', {
                userId,
                error: cacheError instanceof Error ? cacheError.message : 'Unknown error',
            });
        }
        // Query database
        const query = `
      SELECT COUNT(*) as count
      FROM chat_activity
      WHERE user_id = $1 AND timestamp >= $2
    `;
        try {
            const result = await this.pool.query(query, [userId, since]);
            const count = parseInt(result.rows[0].count, 10);
            // Cache result
            try {
                await redisClient.set(cacheKey, count.toString(), this.CACHE_TTL);
            }
            catch (cacheError) {
                logger.warn('Failed to cache message count', {
                    userId,
                    error: cacheError instanceof Error ? cacheError.message : 'Unknown error',
                });
            }
            return count;
        }
        catch (error) {
            throw new Error(`Failed to get message count: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Get users who meet the active chatter criteria
     * Must have sent at least minMessages within the time window
     */
    async getQualifiedChatters(since, minMessages = 3) {
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
        }
        catch (error) {
            throw new Error(`Failed to get qualified chatters: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Clean up old chat activity records
     * Should be run periodically to prevent table bloat
     */
    async cleanupOldActivity(olderThan) {
        const query = `
      DELETE FROM chat_activity
      WHERE timestamp < $1
    `;
        try {
            const result = await this.pool.query(query, [olderThan]);
            return result.rowCount || 0;
        }
        catch (error) {
            throw new Error(`Failed to cleanup old activity: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Record a chat rain winner
     * Used to track cooldown period (60 minutes)
     */
    async recordWinner(userId, timestamp, rewardType, rewardValue) {
        const query = `
      INSERT INTO chat_rain_winners (user_id, timestamp, reward_type, reward_value)
      VALUES ($1, $2, $3, $4)
    `;
        try {
            await this.pool.query(query, [userId, timestamp, rewardType, rewardValue || null]);
        }
        catch (error) {
            throw new Error(`Failed to record chat rain winner: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Get recent chat rain winners
     * Used to enforce cooldown period
     */
    async getRecentWinners(since) {
        const query = `
      SELECT DISTINCT user_id
      FROM chat_rain_winners
      WHERE timestamp >= $1
    `;
        try {
            const result = await this.pool.query(query, [since]);
            return result.rows.map(row => row.user_id);
        }
        catch (error) {
            throw new Error(`Failed to get recent winners: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Check if a user has won chat rain recently
     * Returns true if user won within the cooldown period
     */
    async hasRecentWin(userId, since) {
        const query = `
      SELECT 1
      FROM chat_rain_winners
      WHERE user_id = $1 AND timestamp >= $2
      LIMIT 1
    `;
        try {
            const result = await this.pool.query(query, [userId, since]);
            return result.rows.length > 0;
        }
        catch (error) {
            throw new Error(`Failed to check recent win: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Get the last chat rain winner timestamp
     * Used to enforce minimum delay between chat rain events
     */
    async getLastChatRainTime() {
        const query = `
      SELECT MAX(timestamp) as last_time
      FROM chat_rain_winners
    `;
        try {
            const result = await this.pool.query(query);
            return result.rows[0].last_time || null;
        }
        catch (error) {
            throw new Error(`Failed to get last chat rain time: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Get reward history for a user
     * Returns all rewards received by the user, optionally filtered by date
     */
    async getRewardHistory(userId, since) {
        let query = `
      SELECT user_id, timestamp, reward_type, reward_value
      FROM chat_rain_winners
      WHERE user_id = $1
    `;
        const params = [userId];
        if (since) {
            query += ' AND timestamp >= $2';
            params.push(since);
        }
        query += ' ORDER BY timestamp DESC';
        try {
            const result = await this.pool.query(query, params);
            return result.rows.map(row => ({
                userId: row.user_id,
                timestamp: row.timestamp,
                rewardType: row.reward_type,
                rewardValue: row.reward_value,
            }));
        }
        catch (error) {
            throw new Error(`Failed to get reward history: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
//# sourceMappingURL=ChatActivityRepository.js.map