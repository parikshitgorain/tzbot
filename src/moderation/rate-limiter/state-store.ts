import { StateStore } from './types.js';
import { RedisClient } from '../../core/cache/redis.client.js';
import { logger } from '../../core/logger/logger.js';

/**
 * In-memory implementation of StateStore
 * Used as fallback when Redis is unavailable
 */
export class InMemoryStateStore implements StateStore {
  private messageTimestamps: Map<string, number> = new Map();
  private violationExpiries: Map<string, number> = new Map();

  private getKey(userId: string, channelId: string, prefix: string): string {
    return `${prefix}:${channelId}:${userId}`;
  }

  async getLastMessageTime(userId: string, channelId: string): Promise<number | null> {
    const key = this.getKey(userId, channelId, 'msg');
    return this.messageTimestamps.get(key) ?? null;
  }

  async setLastMessageTime(userId: string, channelId: string, timestamp: number): Promise<void> {
    const key = this.getKey(userId, channelId, 'msg');
    this.messageTimestamps.set(key, timestamp);
  }

  async getViolationExpiry(userId: string, channelId: string): Promise<number | null> {
    const key = this.getKey(userId, channelId, 'violation');
    return this.violationExpiries.get(key) ?? null;
  }

  async setViolationExpiry(userId: string, channelId: string, expiryTime: number): Promise<void> {
    const key = this.getKey(userId, channelId, 'violation');
    this.violationExpiries.set(key, expiryTime);
  }

  async removeExpired(currentTime: number): Promise<void> {
    // Remove expired message timestamps
    for (const [key, timestamp] of this.messageTimestamps.entries()) {
      if (currentTime - timestamp > 60000) {
        this.messageTimestamps.delete(key);
      }
    }

    // Remove expired violation windows
    for (const [key, expiryTime] of this.violationExpiries.entries()) {
      if (currentTime >= expiryTime) {
        this.violationExpiries.delete(key);
      }
    }
  }

  async getAllKeys(): Promise<string[]> {
    return [
      ...Array.from(this.messageTimestamps.keys()),
      ...Array.from(this.violationExpiries.keys()),
    ];
  }
}

/**
 * Redis implementation of StateStore
 * Falls back to in-memory storage on connection failure
 */
export class RedisStateStore implements StateStore {
  private redisClient: RedisClient;
  private fallbackStore: InMemoryStateStore;
  private useRedis: boolean = true;

  constructor(redisClient: RedisClient) {
    this.redisClient = redisClient;
    this.fallbackStore = new InMemoryStateStore();
  }

  private getKey(userId: string, channelId: string, prefix: string): string {
    return `ratelimit:${prefix}:${channelId}:${userId}`;
  }

  async getLastMessageTime(userId: string, channelId: string): Promise<number | null> {
    if (!this.useRedis) {
      return this.fallbackStore.getLastMessageTime(userId, channelId);
    }

    try {
      const key = this.getKey(userId, channelId, 'msg');
      const value = await this.redisClient.get(key);
      return value ? parseInt(value, 10) : null;
    } catch (error) {
      logger.error('Redis get failed, falling back to in-memory', { error });
      this.useRedis = false;
      return this.fallbackStore.getLastMessageTime(userId, channelId);
    }
  }

  async setLastMessageTime(userId: string, channelId: string, timestamp: number): Promise<void> {
    if (!this.useRedis) {
      return this.fallbackStore.setLastMessageTime(userId, channelId, timestamp);
    }

    try {
      const key = this.getKey(userId, channelId, 'msg');
      await this.redisClient.set(key, timestamp.toString(), 60); // TTL 60 seconds
    } catch (error) {
      logger.error('Redis set failed, falling back to in-memory', { error });
      this.useRedis = false;
      return this.fallbackStore.setLastMessageTime(userId, channelId, timestamp);
    }
  }

  async getViolationExpiry(userId: string, channelId: string): Promise<number | null> {
    if (!this.useRedis) {
      return this.fallbackStore.getViolationExpiry(userId, channelId);
    }

    try {
      const key = this.getKey(userId, channelId, 'violation');
      const value = await this.redisClient.get(key);
      return value ? parseInt(value, 10) : null;
    } catch (error) {
      logger.error('Redis get failed, falling back to in-memory', { error });
      this.useRedis = false;
      return this.fallbackStore.getViolationExpiry(userId, channelId);
    }
  }

  async setViolationExpiry(userId: string, channelId: string, expiryTime: number): Promise<void> {
    if (!this.useRedis) {
      return this.fallbackStore.setViolationExpiry(userId, channelId, expiryTime);
    }

    try {
      const key = this.getKey(userId, channelId, 'violation');
      const ttl = Math.max(1, Math.ceil((expiryTime - Date.now()) / 1000)); // TTL in seconds
      await this.redisClient.set(key, expiryTime.toString(), ttl);
    } catch (error) {
      logger.error('Redis set failed, falling back to in-memory', { error });
      this.useRedis = false;
      return this.fallbackStore.setViolationExpiry(userId, channelId, expiryTime);
    }
  }

  async removeExpired(currentTime: number): Promise<void> {
    // Redis handles expiration automatically via TTL
    // Only need to clean up fallback store
    if (!this.useRedis) {
      return this.fallbackStore.removeExpired(currentTime);
    }
  }

  async getAllKeys(): Promise<string[]> {
    if (!this.useRedis) {
      return this.fallbackStore.getAllKeys();
    }

    try {
      const msgKeys = await this.redisClient.keys('ratelimit:msg:*');
      const violationKeys = await this.redisClient.keys('ratelimit:violation:*');
      return [...msgKeys, ...violationKeys];
    } catch (error) {
      logger.error('Redis keys failed, falling back to in-memory', { error });
      this.useRedis = false;
      return this.fallbackStore.getAllKeys();
    }
  }
}
