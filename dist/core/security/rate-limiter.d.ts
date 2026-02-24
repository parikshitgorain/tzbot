/**
 * @file rate-limiter.ts
 * @description Token bucket rate limiter using Redis
 * @module core/security
 */
/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
    /** Maximum number of tokens in the bucket */
    maxTokens: number;
    /** Number of tokens to refill per second */
    refillRate: number;
    /** Optional custom key prefix */
    keyPrefix?: string;
}
/**
 * Rate limit result
 */
export interface RateLimitResult {
    /** Whether the request is allowed */
    allowed: boolean;
    /** Remaining tokens */
    remaining: number;
    /** Time until next token refill (ms) */
    retryAfter?: number;
}
/**
 * Rate limiter using token bucket algorithm with Redis
 */
export declare class RateLimiter {
    private readonly keyPrefix;
    constructor(keyPrefix?: string);
    /**
     * Check if a request is allowed and consume a token
     * @param key - Unique identifier for the rate limit (e.g., user ID, IP address)
     * @param config - Rate limit configuration
     * @param tokens - Number of tokens to consume (default: 1)
     * @returns Rate limit result
     */
    checkLimit(key: string, config: RateLimitConfig, tokens?: number): Promise<RateLimitResult>;
    /**
     * Reset rate limit for a key
     * @param key - Unique identifier for the rate limit
     * @param keyPrefix - Optional custom key prefix
     */
    reset(key: string, keyPrefix?: string): Promise<void>;
    /**
     * Get current rate limit status without consuming tokens
     * @param key - Unique identifier for the rate limit
     * @param config - Rate limit configuration
     * @returns Current token count
     */
    getStatus(key: string, config: RateLimitConfig): Promise<number>;
    /**
     * Build Redis key with prefix
     */
    private buildKey;
}
/**
 * Predefined rate limit configurations
 */
export declare const RateLimitPresets: {
    /** API requests: 60 per minute */
    readonly API: RateLimitConfig;
    /** Commands: 10 per minute */
    readonly COMMAND: RateLimitConfig;
    /** AI responses: 1 per 30 seconds */
    readonly AI_RESPONSE: RateLimitConfig;
    /** Giveaway entries: 1 per giveaway (no refill) */
    readonly GIVEAWAY_ENTRY: RateLimitConfig;
};
export declare const rateLimiter: RateLimiter;
//# sourceMappingURL=rate-limiter.d.ts.map