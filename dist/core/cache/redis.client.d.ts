/**
 * @file redis.client.ts
 * @description Redis client with connection pooling and error handling
 * @module core/cache
 */
/**
 * Redis client wrapper with connection management
 */
export declare class RedisClient {
    private client;
    private isConnected;
    private reconnectAttempts;
    private readonly maxReconnectAttempts;
    /**
     * Initialize and connect to Redis
     */
    connect(): Promise<void>;
    /**
     * Set up Redis event handlers
     */
    private setupEventHandlers;
    /**
     * Wait for Redis connection to be ready
     */
    private waitForConnection;
    /**
     * Test Redis connectivity
     */
    testConnection(): Promise<boolean>;
    /**
     * Ping Redis server (for health checks)
     */
    ping(): Promise<void>;
    /**
     * Get a value from Redis
     */
    get(key: string): Promise<string | null>;
    /**
     * Set a value in Redis
     */
    set(key: string, value: string, ttlSeconds?: number): Promise<void>;
    /**
     * Set a value only if it doesn't exist (atomic operation)
     * Returns true if the key was set, false if it already existed
     */
    setnx(key: string, value: string, ttlSeconds?: number): Promise<boolean>;
    /**
     * Delete a key from Redis
     */
    del(key: string): Promise<number>;
    /**
     * Set expiration time for a key
     */
    expire(key: string, seconds: number): Promise<boolean>;
    /**
     * Check if a key exists
     */
    exists(key: string): Promise<boolean>;
    /**
     * Increment a value
     */
    incr(key: string): Promise<number>;
    /**
     * Decrement a value
     */
    decr(key: string): Promise<number>;
    /**
     * Get multiple values
     */
    mget(...keys: string[]): Promise<(string | null)[]>;
    /**
     * Set multiple values
     */
    mset(keyValues: Record<string, string>): Promise<void>;
    /**
     * Get keys matching a pattern
     */
    keys(pattern: string): Promise<string[]>;
    /**
     * Get connection status
     */
    getConnectionStatus(): {
        connected: boolean;
        reconnectAttempts: number;
    };
    /**
     * Disconnect from Redis
     */
    disconnect(): Promise<void>;
    /**
     * Sanitize Redis URL for logging (remove password)
     */
    private sanitizeUrl;
}
export declare const redisClient: RedisClient;
//# sourceMappingURL=redis.client.d.ts.map