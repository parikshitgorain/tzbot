import { logger } from '../../core/logger/logger.js';
/**
 * In-memory implementation of StateStore
 * Used as fallback when Redis is unavailable
 */
export class InMemoryStateStore {
    messageTimestamps = new Map();
    violationExpiries = new Map();
    getKey(userId, channelId, prefix) {
        return `${prefix}:${channelId}:${userId}`;
    }
    async getLastMessageTime(userId, channelId) {
        const key = this.getKey(userId, channelId, 'msg');
        return this.messageTimestamps.get(key) ?? null;
    }
    async setLastMessageTime(userId, channelId, timestamp) {
        const key = this.getKey(userId, channelId, 'msg');
        this.messageTimestamps.set(key, timestamp);
    }
    async getViolationExpiry(userId, channelId) {
        const key = this.getKey(userId, channelId, 'violation');
        return this.violationExpiries.get(key) ?? null;
    }
    async setViolationExpiry(userId, channelId, expiryTime) {
        const key = this.getKey(userId, channelId, 'violation');
        this.violationExpiries.set(key, expiryTime);
    }
    async removeExpired(currentTime) {
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
    async getAllKeys() {
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
export class RedisStateStore {
    redisClient;
    fallbackStore;
    useRedis = true;
    constructor(redisClient) {
        this.redisClient = redisClient;
        this.fallbackStore = new InMemoryStateStore();
    }
    getKey(userId, channelId, prefix) {
        return `ratelimit:${prefix}:${channelId}:${userId}`;
    }
    async getLastMessageTime(userId, channelId) {
        if (!this.useRedis) {
            return this.fallbackStore.getLastMessageTime(userId, channelId);
        }
        try {
            const key = this.getKey(userId, channelId, 'msg');
            const value = await this.redisClient.get(key);
            return value ? parseInt(value, 10) : null;
        }
        catch (error) {
            logger.error('Redis get failed, falling back to in-memory', { error });
            this.useRedis = false;
            return this.fallbackStore.getLastMessageTime(userId, channelId);
        }
    }
    async setLastMessageTime(userId, channelId, timestamp) {
        if (!this.useRedis) {
            return this.fallbackStore.setLastMessageTime(userId, channelId, timestamp);
        }
        try {
            const key = this.getKey(userId, channelId, 'msg');
            await this.redisClient.set(key, timestamp.toString(), 60); // TTL 60 seconds
        }
        catch (error) {
            logger.error('Redis set failed, falling back to in-memory', { error });
            this.useRedis = false;
            return this.fallbackStore.setLastMessageTime(userId, channelId, timestamp);
        }
    }
    async getViolationExpiry(userId, channelId) {
        if (!this.useRedis) {
            return this.fallbackStore.getViolationExpiry(userId, channelId);
        }
        try {
            const key = this.getKey(userId, channelId, 'violation');
            const value = await this.redisClient.get(key);
            return value ? parseInt(value, 10) : null;
        }
        catch (error) {
            logger.error('Redis get failed, falling back to in-memory', { error });
            this.useRedis = false;
            return this.fallbackStore.getViolationExpiry(userId, channelId);
        }
    }
    async setViolationExpiry(userId, channelId, expiryTime) {
        if (!this.useRedis) {
            return this.fallbackStore.setViolationExpiry(userId, channelId, expiryTime);
        }
        try {
            const key = this.getKey(userId, channelId, 'violation');
            const ttl = Math.max(1, Math.ceil((expiryTime - Date.now()) / 1000)); // TTL in seconds
            await this.redisClient.set(key, expiryTime.toString(), ttl);
        }
        catch (error) {
            logger.error('Redis set failed, falling back to in-memory', { error });
            this.useRedis = false;
            return this.fallbackStore.setViolationExpiry(userId, channelId, expiryTime);
        }
    }
    async removeExpired(currentTime) {
        // Redis handles expiration automatically via TTL
        // Only need to clean up fallback store
        if (!this.useRedis) {
            return this.fallbackStore.removeExpired(currentTime);
        }
    }
    async getAllKeys() {
        if (!this.useRedis) {
            return this.fallbackStore.getAllKeys();
        }
        try {
            const msgKeys = await this.redisClient.keys('ratelimit:msg:*');
            const violationKeys = await this.redisClient.keys('ratelimit:violation:*');
            return [...msgKeys, ...violationKeys];
        }
        catch (error) {
            logger.error('Redis keys failed, falling back to in-memory', { error });
            this.useRedis = false;
            return this.fallbackStore.getAllKeys();
        }
    }
}
//# sourceMappingURL=state-store.js.map