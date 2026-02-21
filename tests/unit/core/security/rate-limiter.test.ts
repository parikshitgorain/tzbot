/**
 * @file rate-limiter.test.ts
 * @description Unit tests for rate limiter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter, RateLimitPresets } from '@/core/security/rate-limiter.js';
import { redisClient } from '@/core/cache/redis.client.js';

// Mock Redis client
vi.mock('@/core/cache/redis.client.js', () => {
  const store = new Map();
  
  return {
    redisClient: {
      get: vi.fn(async (key) => store.get(key) || null),
      set: vi.fn(async (key, value) => {
        store.set(key, value);
      }),
      del: vi.fn(async (key) => {
        const existed = store.has(key);
        store.delete(key);
        return existed ? 1 : 0;
      }),
      exists: vi.fn(async (key) => store.has(key)),
      _testStore: store,
    },
  };
});

describe('RateLimiter', () => {
  let rateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter('test');
    redisClient._testStore.clear();
    vi.clearAllMocks();
  });

  describe('checkLimit', () => {
    it('should allow first request', async () => {
      const result = await rateLimiter.checkLimit('user1', {
        maxTokens: 10,
        refillRate: 1,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should deny request when tokens exhausted', async () => {
      const config = { maxTokens: 2, refillRate: 1 };

      await rateLimiter.checkLimit('user1', config);
      await rateLimiter.checkLimit('user1', config);

      const result = await rateLimiter.checkLimit('user1', config);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should isolate rate limits by key', async () => {
      const config = { maxTokens: 2, refillRate: 1 };

      await rateLimiter.checkLimit('user1', config);
      await rateLimiter.checkLimit('user1', config);

      const result = await rateLimiter.checkLimit('user2', config);
      expect(result.allowed).toBe(true);
    });
  });

  describe('RateLimitPresets', () => {
    it('should have API preset with correct values', () => {
      expect(RateLimitPresets.API.maxTokens).toBe(60);
      expect(RateLimitPresets.API.refillRate).toBe(1);
    });

    it('should have COMMAND preset with correct values', () => {
      expect(RateLimitPresets.COMMAND.maxTokens).toBe(10);
    });
  });

  describe('Error handling', () => {
    it('should fail open when Redis is unavailable', async () => {
      vi.mocked(redisClient.get).mockRejectedValueOnce(new Error('Redis unavailable'));

      const result = await rateLimiter.checkLimit('user1', {
        maxTokens: 1,
        refillRate: 1,
      });

      expect(result.allowed).toBe(true);
    });
  });
});
