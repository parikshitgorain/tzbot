/**
 * @file rate-limiter.ts
 * @description Token bucket rate limiter using Redis
 * @module core/security
 */

import { redisClient } from '@/core/cache/redis.client.js';
import { logger, logError } from '@/core/logger/logger.js';

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
 * Token bucket data structure
 */
interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

/**
 * Rate limiter using token bucket algorithm with Redis
 */
export class RateLimiter {
  private readonly keyPrefix: string;

  constructor(keyPrefix = 'ratelimit') {
    this.keyPrefix = keyPrefix;
  }

  /**
   * Check if a request is allowed and consume a token
   * @param key - Unique identifier for the rate limit (e.g., user ID, IP address)
   * @param config - Rate limit configuration
   * @param tokens - Number of tokens to consume (default: 1)
   * @returns Rate limit result
   */
  async checkLimit(
    key: string,
    config: RateLimitConfig,
    tokens = 1,
  ): Promise<RateLimitResult> {
    try {
      const redisKey = this.buildKey(key, config.keyPrefix);
      const now = Date.now();

      // Get current bucket state
      const bucketData = await redisClient.get(redisKey);
      let bucket: TokenBucket;

      if (!bucketData) {
        // First request - initialize bucket with max tokens minus consumed
        bucket = {
          tokens: Math.max(0, config.maxTokens - tokens),
          lastRefill: now,
        };

        // Save bucket state with TTL (2x the time to refill from 0 to max)
        const ttl = Math.ceil((config.maxTokens / config.refillRate) * 2);
        await redisClient.set(redisKey, JSON.stringify(bucket), ttl);

        return {
          allowed: tokens <= config.maxTokens,
          remaining: bucket.tokens,
        };
      }

      // Parse existing bucket
      bucket = JSON.parse(bucketData);

      // Calculate tokens to add based on time passed
      const timePassed = now - bucket.lastRefill;
      const tokensToAdd = (timePassed / 1000) * config.refillRate;
      const newTokens = Math.min(config.maxTokens, bucket.tokens + tokensToAdd);

      // Check if enough tokens available
      if (newTokens < tokens) {
        // Calculate retry after time
        const tokensNeeded = tokens - newTokens;
        const retryAfter = Math.ceil((tokensNeeded / config.refillRate) * 1000);

        logger.debug('Rate limit exceeded', {
          key: redisKey,
          available: newTokens,
          needed: tokens,
          retryAfter,
        });

        return {
          allowed: false,
          remaining: Math.floor(newTokens),
          retryAfter,
        };
      }

      // Consume tokens
      bucket.tokens = newTokens - tokens;
      bucket.lastRefill = now;

      // Save updated bucket state
      const ttl = Math.ceil((config.maxTokens / config.refillRate) * 2);
      await redisClient.set(redisKey, JSON.stringify(bucket), ttl);

      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
      };
    } catch (error) {
      logError('Rate limit check failed', error as Error, { key });
      // Fail open - allow request if Redis is unavailable
      return {
        allowed: true,
        remaining: 0,
      };
    }
  }

  /**
   * Reset rate limit for a key
   * @param key - Unique identifier for the rate limit
   * @param keyPrefix - Optional custom key prefix
   */
  async reset(key: string, keyPrefix?: string): Promise<void> {
    try {
      const redisKey = this.buildKey(key, keyPrefix);
      await redisClient.del(redisKey);
      logger.debug('Rate limit reset', { key: redisKey });
    } catch (error) {
      logError('Rate limit reset failed', error as Error, { key });
      throw error;
    }
  }

  /**
   * Get current rate limit status without consuming tokens
   * @param key - Unique identifier for the rate limit
   * @param config - Rate limit configuration
   * @returns Current token count
   */
  async getStatus(key: string, config: RateLimitConfig): Promise<number> {
    try {
      const redisKey = this.buildKey(key, config.keyPrefix);
      const bucketData = await redisClient.get(redisKey);

      if (!bucketData) {
        return config.maxTokens;
      }

      const bucket: TokenBucket = JSON.parse(bucketData);
      const now = Date.now();
      const timePassed = now - bucket.lastRefill;
      const tokensToAdd = (timePassed / 1000) * config.refillRate;
      const currentTokens = Math.min(config.maxTokens, bucket.tokens + tokensToAdd);

      return Math.floor(currentTokens);
    } catch (error) {
      logError('Rate limit status check failed', error as Error, { key });
      return config.maxTokens;
    }
  }

  /**
   * Build Redis key with prefix
   */
  private buildKey(key: string, customPrefix?: string): string {
    const prefix = customPrefix || this.keyPrefix;
    return `${prefix}:${key}`;
  }
}

/**
 * Predefined rate limit configurations
 */
export const RateLimitPresets = {
  /** API requests: 60 per minute */
  API: {
    maxTokens: 60,
    refillRate: 1, // 1 token per second = 60 per minute
    keyPrefix: 'api',
  } as RateLimitConfig,

  /** Commands: 10 per minute */
  COMMAND: {
    maxTokens: 10,
    refillRate: 1 / 6, // 1 token per 6 seconds = 10 per minute
    keyPrefix: 'command',
  } as RateLimitConfig,

  /** AI responses: 1 per 30 seconds */
  AI_RESPONSE: {
    maxTokens: 1,
    refillRate: 1 / 30, // 1 token per 30 seconds
    keyPrefix: 'ai',
  } as RateLimitConfig,

  /** Giveaway entries: 1 per giveaway (no refill) */
  GIVEAWAY_ENTRY: {
    maxTokens: 1,
    refillRate: 0, // No refill
    keyPrefix: 'giveaway',
  } as RateLimitConfig,
} as const;

// Export singleton instance
export const rateLimiter = new RateLimiter();
