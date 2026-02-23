/**
 * @file redis.integration.test.ts
 * @description Integration tests for Redis client with real Redis instance
 * @note These tests require a running Redis instance and proper environment configuration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Skip these tests if environment is not configured
const hasRedisConfig = process.env.REDIS_URL && process.env.DISCORD_TOKEN;

describe.skipIf(!hasRedisConfig)('Redis Integration Tests', () => {
  let client: any;
  const testKeyPrefix = 'test:integration:';

  beforeAll(async () => {
    // Dynamically import to avoid config validation errors
    const { RedisClient } = await import('../../src/core/cache/redis.client.js');
    client = new RedisClient();
    
    try {
      await client.connect();
    } catch (error) {
      console.warn('Redis not available, skipping integration tests');
      return;
    }
  });

  afterAll(async () => {
    // Clean up test keys
    try {
      await client.del(`${testKeyPrefix}key1`);
      await client.del(`${testKeyPrefix}key2`);
      await client.del(`${testKeyPrefix}counter`);
      await client.disconnect();
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should connect to Redis and test connectivity', async () => {
    const isHealthy = await client.testConnection();
    expect(isHealthy).toBe(true);
  });

  it('should set and get a value', async () => {
    const key = `${testKeyPrefix}key1`;
    const value = 'test-value';

    await client.set(key, value);
    const result = await client.get(key);

    expect(result).toBe(value);
  });

  it('should set a value with TTL', async () => {
    const key = `${testKeyPrefix}key2`;
    const value = 'expiring-value';

    await client.set(key, value, 2); // 2 seconds TTL
    
    // Value should exist immediately
    const result1 = await client.get(key);
    expect(result1).toBe(value);

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 2500));

    // Value should be expired
    const result2 = await client.get(key);
    expect(result2).toBeNull();
  }, 5000);

  it('should delete a key', async () => {
    const key = `${testKeyPrefix}key1`;
    const value = 'to-be-deleted';

    await client.set(key, value);
    const deleted = await client.del(key);

    expect(deleted).toBe(1);

    const result = await client.get(key);
    expect(result).toBeNull();
  });

  it('should check if key exists', async () => {
    const key = `${testKeyPrefix}key1`;

    await client.set(key, 'exists');
    const exists1 = await client.exists(key);
    expect(exists1).toBe(true);

    await client.del(key);
    const exists2 = await client.exists(key);
    expect(exists2).toBe(false);
  });

  it('should increment and decrement counters', async () => {
    const key = `${testKeyPrefix}counter`;

    // Start fresh
    await client.del(key);

    const val1 = await client.incr(key);
    expect(val1).toBe(1);

    const val2 = await client.incr(key);
    expect(val2).toBe(2);

    const val3 = await client.decr(key);
    expect(val3).toBe(1);
  });

  it('should handle multiple get/set operations', async () => {
    const key1 = `${testKeyPrefix}multi1`;
    const key2 = `${testKeyPrefix}multi2`;

    await client.mset({
      [key1]: 'value1',
      [key2]: 'value2',
    });

    const results = await client.mget(key1, key2);
    expect(results).toEqual(['value1', 'value2']);

    // Cleanup
    await client.del(key1);
    await client.del(key2);
  });

  it('should report connection status', async () => {
    const status = client.getConnectionStatus();
    
    expect(status.connected).toBe(true);
    expect(status.reconnectAttempts).toBe(0);
  });
});
