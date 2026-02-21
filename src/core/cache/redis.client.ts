/**
 * @file redis.client.ts
 * @description Redis client with connection pooling and error handling
 * @module core/cache
 */

import Redis, { type RedisOptions } from 'ioredis';
import { config } from '@/config/index.js';
import { logger, logError, logSystemTransition } from '@/core/logger/logger.js';

/**
 * Redis client wrapper with connection management
 */
export class RedisClient {
  private client: Redis | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;

  /**
   * Initialize and connect to Redis
   */
  async connect(): Promise<void> {
    if (this.client && this.isConnected) {
      logger.warn('Redis client already connected');
      return;
    }

    try {
      const options: RedisOptions = {
        // Connection settings
        lazyConnect: false,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        
        // Connection pooling
        enableOfflineQueue: true,
        
        // Reconnection strategy
        retryStrategy: (times: number) => {
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

      // Create Redis client
      this.client = new Redis(config.redisUrl, options);

      // Set up event handlers
      this.setupEventHandlers();

      // Wait for connection
      await this.waitForConnection();

      logger.info('Redis client connected successfully', {
        url: this.sanitizeUrl(config.redisUrl),
      });
    } catch (error) {
      logError('Failed to connect to Redis', error as Error);
      throw error;
    }
  }

  /**
   * Set up Redis event handlers
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      logger.info('Redis connection established');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
      logSystemTransition('disconnected', 'connected', 'Redis connection ready');
    });

    this.client.on('error', (error: Error) => {
      logError('Redis client error', error, { isConnected: this.isConnected });
    });

    this.client.on('close', () => {
      logger.warn('Redis connection closed');
      this.isConnected = false;
      logSystemTransition('connected', 'disconnected', 'Redis connection closed');
    });

    this.client.on('reconnecting', (delay: number) => {
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
  private async waitForConnection(timeoutMs = 10000): Promise<void> {
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
  async testConnection(): Promise<boolean> {
    try {
      if (!this.client || !this.isConnected) {
        return false;
      }

      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logError('Redis connectivity test failed', error as Error);
      return false;
    }
  }

  /**
   * Ping Redis server (for health checks)
   */
  async ping(): Promise<void> {
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
  async get(key: string): Promise<string | null> {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis client not connected');
      }

      return await this.client.get(key);
    } catch (error) {
      logError('Redis GET operation failed', error as Error, { key });
      throw error;
    }
  }

  /**
   * Set a value in Redis
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis client not connected');
      }

      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      logError('Redis SET operation failed', error as Error, { key, ttlSeconds });
      throw error;
    }
  }

  /**
   * Delete a key from Redis
   */
  async del(key: string): Promise<number> {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis client not connected');
      }

      return await this.client.del(key);
    } catch (error) {
      logError('Redis DEL operation failed', error as Error, { key });
      throw error;
    }
  }

  /**
   * Set expiration time for a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis client not connected');
      }

      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      logError('Redis EXPIRE operation failed', error as Error, { key, seconds });
      throw error;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis client not connected');
      }

      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logError('Redis EXISTS operation failed', error as Error, { key });
      throw error;
    }
  }

  /**
   * Increment a value
   */
  async incr(key: string): Promise<number> {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis client not connected');
      }

      return await this.client.incr(key);
    } catch (error) {
      logError('Redis INCR operation failed', error as Error, { key });
      throw error;
    }
  }

  /**
   * Decrement a value
   */
  async decr(key: string): Promise<number> {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis client not connected');
      }

      return await this.client.decr(key);
    } catch (error) {
      logError('Redis DECR operation failed', error as Error, { key });
      throw error;
    }
  }

  /**
   * Get multiple values
   */
  async mget(...keys: string[]): Promise<(string | null)[]> {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis client not connected');
      }

      return await this.client.mget(...keys);
    } catch (error) {
      logError('Redis MGET operation failed', error as Error, { keys });
      throw error;
    }
  }

  /**
   * Set multiple values
   */
  async mset(keyValues: Record<string, string>): Promise<void> {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis client not connected');
      }

      const args: string[] = [];
      for (const [key, value] of Object.entries(keyValues)) {
        args.push(key, value);
      }

      await this.client.mset(...args);
    } catch (error) {
      logError('Redis MSET operation failed', error as Error);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): { connected: boolean; reconnectAttempts: number } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.quit();
        this.client = null;
        this.isConnected = false;
        logger.info('Redis client disconnected');
      }
    } catch (error) {
      logError('Error disconnecting Redis client', error as Error);
      throw error;
    }
  }

  /**
   * Sanitize Redis URL for logging (remove password)
   */
  private sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      if (urlObj.password) {
        urlObj.password = '***';
      }
      return urlObj.toString();
    } catch {
      return 'invalid-url';
    }
  }
}

// Export singleton instance
export const redisClient = new RedisClient();
