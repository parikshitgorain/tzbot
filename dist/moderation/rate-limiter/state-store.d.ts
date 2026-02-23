import { StateStore } from './types.js';
import { RedisClient } from '../../core/cache/redis.client.js';
/**
 * In-memory implementation of StateStore
 * Used as fallback when Redis is unavailable
 */
export declare class InMemoryStateStore implements StateStore {
    private messageTimestamps;
    private violationExpiries;
    private getKey;
    getLastMessageTime(userId: string, channelId: string): Promise<number | null>;
    setLastMessageTime(userId: string, channelId: string, timestamp: number): Promise<void>;
    getViolationExpiry(userId: string, channelId: string): Promise<number | null>;
    setViolationExpiry(userId: string, channelId: string, expiryTime: number): Promise<void>;
    removeExpired(currentTime: number): Promise<void>;
    getAllKeys(): Promise<string[]>;
}
/**
 * Redis implementation of StateStore
 * Falls back to in-memory storage on connection failure
 */
export declare class RedisStateStore implements StateStore {
    private redisClient;
    private fallbackStore;
    private useRedis;
    constructor(redisClient: RedisClient);
    private getKey;
    getLastMessageTime(userId: string, channelId: string): Promise<number | null>;
    setLastMessageTime(userId: string, channelId: string, timestamp: number): Promise<void>;
    getViolationExpiry(userId: string, channelId: string): Promise<number | null>;
    setViolationExpiry(userId: string, channelId: string, expiryTime: number): Promise<void>;
    removeExpired(currentTime: number): Promise<void>;
    getAllKeys(): Promise<string[]>;
}
//# sourceMappingURL=state-store.d.ts.map