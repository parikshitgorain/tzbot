/**
 * @file redis.client.ts
 * @description Redis client with connection pooling and error handling
 * @module core/cache
 */
import Redis from 'ioredis';
import { config } from '../../config/index.js';
import { logger, logError, logSystemTransition } from '../../core/logger/logger.js';
/**
 * Redis client wrapper with connection management
 */
export class RedisClient {
    client = null;
    isConnected = false;
    reconnectAttempts = 0;
    maxReconnectAttempts = 10;
    /**
     * Initialize and connect to Redis
     */
    async connect() {
        if (this.client && this.isConnected) {
            logger.warn('Redis client already connected');
            return;
        }
        try {
            const options = {
                // Connection settings
                lazyConnect: false,
                enableReadyCheck: true,
                maxRetriesPerRequest: 3,
                // Connection pooling
                enableOfflineQueue: true,
                // Reconnection strategy
                retryStrategy: (times) => {
                    if (times > this.maxReconnectAttempts) {
                        logger.error('Redis max reconnection attempts reached', { attempts: times });
                        return null; // Stop retrying
                    }
                    // Exponential backoff: 1s, 2s, 4s, 8s, ..., max 60s
                    const delay = Math.min(Math.pow(2, times) * 1000, 60000);
                    logger.info('Redis reconnection attempt', { attempt: times, delayMs: delay });
                    return delay;
                },
            };
            // Add password if configured
            if (config.redisPassword) {
                options.password = config.redisPassword;
            }
            // Validate Redis URL is provided
            if (!config.redisUrl) {
                throw new Error('Redis URL is required for connection');
            }
            // Create Redis client
            this.client = new Redis(config.redisUrl, options);
            // Set up event handlers
            this.setupEventHandlers();
            // Wait for connection
            await this.waitForConnection();
            logger.info('Redis client connected successfully', {
                url: this.sanitizeUrl(config.redisUrl),
            });
        }
        catch (error) {
            logError('Failed to connect to Redis', error);
            throw error;
        }
    }
    /**
     * Set up Redis event handlers
     */
    setupEventHandlers() {
        if (!this.client) {
            return;
        }
        this.client.on('connect', () => {
            logger.info('Redis connection established');
            this.isConnected = true;
            this.reconnectAttempts = 0;
        });
        this.client.on('ready', () => {
            logger.info('Redis client ready');
            logSystemTransition({
                from: 'disconnected',
                to: 'connected',
                reason: 'Redis connection ready',
                component: 'redis',
                automatic: true,
            });
        });
        this.client.on('error', (error) => {
            logError('Redis client error', error, {
                additionalContext: { isConnected: this.isConnected },
            });
        });
        this.client.on('close', () => {
            logger.warn('Redis connection closed');
            this.isConnected = false;
            logSystemTransition({
                from: 'connected',
                to: 'disconnected',
                reason: 'Redis connection closed',
                component: 'redis',
                automatic: true,
            });
        });
        this.client.on('reconnecting', (delay) => {
            this.reconnectAttempts++;
            logger.info('Redis reconnecting', {
                attempt: this.reconnectAttempts,
                delayMs: delay,
            });
        });
        this.client.on('end', () => {
            logger.info('Redis connection ended');
            this.isConnected = false;
        });
    }
    /**
     * Wait for Redis connection to be ready
     */
    async waitForConnection(timeoutMs = 10000) {
        if (!this.client) {
            throw new Error('Redis client not initialized');
        }
        const startTime = Date.now();
        while (!this.isConnected && Date.now() - startTime < timeoutMs) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (!this.isConnected) {
            throw new Error('Redis connection timeout');
        }
    }
    /**
     * Test Redis connectivity
     */
    async testConnection() {
        try {
            if (!this.client || !this.isConnected) {
                return false;
            }
            const result = await this.client.ping();
            return result === 'PONG';
        }
        catch (error) {
            logError('Redis connectivity test failed', error);
            return false;
        }
    }
    /**
     * Ping Redis server (for health checks)
     */
    async ping() {
        if (!this.client || !this.isConnected) {
            throw new Error('Redis client not connected');
        }
        const result = await this.client.ping();
        if (result !== 'PONG') {
            throw new Error('Redis ping failed');
        }
    }
    /**
     * Get a value from Redis
     */
    async get(key) {
        if (!this.client || !this.isConnected) {
            // Silently return null when Redis is not connected (optional service)
            return null;
        }
        try {
            return await this.client.get(key);
        }
        catch (error) {
            logError('Redis GET operation failed', error, {
                additionalContext: { key },
            });
            throw error;
        }
    }
    /**
     * Set a value in Redis
     */
    async set(key, value, ttlSeconds) {
        if (!this.client || !this.isConnected) {
            // Silently skip when Redis is not connected (optional service)
            return;
        }
        try {
            if (ttlSeconds) {
                await this.client.setex(key, ttlSeconds, value);
            }
            else {
                await this.client.set(key, value);
            }
        }
        catch (error) {
            logError('Redis SET operation failed', error, {
                additionalContext: { key, ttlSeconds },
            });
            throw error;
        }
    }
    /**
     * Delete a key from Redis
     */
    async del(key) {
        if (!this.client || !this.isConnected) {
            // Silently return 0 when Redis is not connected (optional service)
            return 0;
        }
        try {
            return await this.client.del(key);
        }
        catch (error) {
            logError('Redis DEL operation failed', error, {
                additionalContext: { key },
            });
            throw error;
        }
    }
    /**
     * Set expiration time for a key
     */
    async expire(key, seconds) {
        if (!this.client || !this.isConnected) {
            // Silently return false when Redis is not connected (optional service)
            return false;
        }
        try {
            const result = await this.client.expire(key, seconds);
            return result === 1;
        }
        catch (error) {
            logError('Redis EXPIRE operation failed', error, {
                additionalContext: { key, seconds },
            });
            throw error;
        }
    }
    /**
     * Check if a key exists
     */
    async exists(key) {
        try {
            if (!this.client || !this.isConnected) {
                throw new Error('Redis client not connected');
            }
            const result = await this.client.exists(key);
            return result === 1;
        }
        catch (error) {
            logError('Redis EXISTS operation failed', error, {
                additionalContext: { key },
            });
            throw error;
        }
    }
    /**
     * Increment a value
     */
    async incr(key) {
        try {
            if (!this.client || !this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.incr(key);
        }
        catch (error) {
            logError('Redis INCR operation failed', error, {
                additionalContext: { key },
            });
            throw error;
        }
    }
    /**
     * Decrement a value
     */
    async decr(key) {
        try {
            if (!this.client || !this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.decr(key);
        }
        catch (error) {
            logError('Redis DECR operation failed', error, {
                additionalContext: { key },
            });
            throw error;
        }
    }
    /**
     * Get multiple values
     */
    async mget(...keys) {
        try {
            if (!this.client || !this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.mget(...keys);
        }
        catch (error) {
            logError('Redis MGET operation failed', error, {
                additionalContext: { keys },
            });
            throw error;
        }
    }
    /**
     * Set multiple values
     */
    async mset(keyValues) {
        try {
            if (!this.client || !this.isConnected) {
                throw new Error('Redis client not connected');
            }
            const args = [];
            for (const [key, value] of Object.entries(keyValues)) {
                args.push(key, value);
            }
            await this.client.mset(...args);
        }
        catch (error) {
            logError('Redis MSET operation failed', error);
            throw error;
        }
    }
    /**
     * Get keys matching a pattern
     */
    async keys(pattern) {
        try {
            if (!this.client || !this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.keys(pattern);
        }
        catch (error) {
            logError('Redis KEYS operation failed', error, {
                additionalContext: { pattern },
            });
            throw error;
        }
    }
    /**
     * Get connection status
     */
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
        };
    }
    /**
     * Disconnect from Redis
     */
    async disconnect() {
        try {
            if (this.client) {
                await this.client.quit();
                this.client = null;
                this.isConnected = false;
                logger.info('Redis client disconnected');
            }
        }
        catch (error) {
            logError('Error disconnecting Redis client', error);
            throw error;
        }
    }
    /**
     * Sanitize Redis URL for logging (remove password)
     */
    sanitizeUrl(url) {
        try {
            const urlObj = new URL(url);
            if (urlObj.password) {
                urlObj.password = '***';
            }
            return urlObj.toString();
        }
        catch {
            return 'invalid-url';
        }
    }
}
// Export singleton instance
export const redisClient = new RedisClient();
//# sourceMappingURL=redis.client.js.map