/**
 * @file redis.client.test.ts
 * @description Unit tests for Redis client
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RedisClient } from '@/core/cache/redis.client.js';
import Redis from 'ioredis';

// Mock ioredis
vi.mock('ioredis');

// Mock logger
vi.mock('@/core/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  logError: vi.fn(),
  logSystemTransition: vi.fn(),
}));

// Mock config
vi.mock('@/config/index.js', () => ({
  config: {
    redisUrl: 'redis://localhost:6379',
    redisPassword: undefined,
  },
}));

describe('RedisClient', () => {
  let redisClient: RedisClient;
  let mockRedisInstance: any;

  beforeEach(() => {
    // Create mock Redis instance
    mockRedisInstance = {
      on: vi.fn(),
      ping: vi.fn().mockResolvedValue('PONG'),
      get: vi.fn(),
      set: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
      expire: vi.fn(),
      exists: vi.fn(),
      incr: vi.fn(),
      decr: vi.fn(),
      mget: vi.fn(),
      mset: vi.fn(),
      quit: vi.fn(),
    };

    // Mock Redis constructor
    (Redis as any).mockImplementation(() => mockRedisInstance);

    redisClient = new RedisClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('connect', () => {
    it('should connect to Redis successfully', async () => {
      // Simulate successful connection
      mockRedisInstance.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'connect') {
          setTimeout(() => handler(), 0);
        }
      });

      await redisClient.connect();

      expect(Redis).toHaveBeenCalledWith(
        'redis://localhost:6379',
        expect.objectContaining({
          lazyConnect: false,
          enableReadyCheck: true,
        })
      );
    });

    it('should handle connection errors', async () => {
      // Don't trigger connect event, let it timeout
      mockRedisInstance.on.mockImplementation(() => {
        // Do nothing - connection will timeout
      });

      // Connection should timeout
      await expect(redisClient.connect()).rejects.toThrow('Redis connection timeout');
    }, 15000); // Increase timeout for this test

    it('should not reconnect if already connected', async () => {
      mockRedisInstance.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'connect') {
          setTimeout(() => handler(), 0);
        }
      });

      await redisClient.connect();
      const firstCallCount = (Redis as any).mock.calls.length;

      await redisClient.connect();
      const secondCallCount = (Redis as any).mock.calls.length;

      expect(secondCallCount).toBe(firstCallCount);
    });
  });

  describe('testConnection', () => {
    it('should return true when connection is healthy', async () => {
      mockRedisInstance.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'connect') {
          setTimeout(() => handler(), 0);
        }
      });

      await redisClient.connect();
      const result = await redisClient.testConnection();

      expect(result).toBe(true);
      expect(mockRedisInstance.ping).toHaveBeenCalled();
    });

    it('should return false when not connected', async () => {
      const result = await redisClient.testConnection();
      expect(result).toBe(false);
    });

    it('should return false when ping fails', async () => {
      mockRedisInstance.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'connect') {
          setTimeout(() => handler(), 0);
        }
      });
      mockRedisInstance.ping.mockRejectedValue(new Error('Ping failed'));

      await redisClient.connect();
      const result = await redisClient.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      mockRedisInstance.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'connect') {
          setTimeout(() => handler(), 0);
        }
      });
      await redisClient.connect();
    });

    it('should get a value from Redis', async () => {
      mockRedisInstance.get.mockResolvedValue('test-value');

      const result = await redisClient.get('test-key');

      expect(result).toBe('test-value');
      expect(mockRedisInstance.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null for non-existent key', async () => {
      mockRedisInstance.get.mockResolvedValue(null);

      const result = await redisClient.get('non-existent');

      expect(result).toBeNull();
    });

    it('should throw error when not connected', async () => {
      await redisClient.disconnect();

      await expect(redisClient.get('test-key')).rejects.toThrow('Redis client not connected');
    });
  });

  describe('set', () => {
    beforeEach(async () => {
      mockRedisInstance.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'connect') {
          setTimeout(() => handler(), 0);
        }
      });
      await redisClient.connect();
    });

    it('should set a value without TTL', async () => {
      await redisClient.set('test-key', 'test-value');

      expect(mockRedisInstance.set).toHaveBeenCalledWith('test-key', 'test-value');
    });

    it('should set a value with TTL', async () => {
      await redisClient.set('test-key', 'test-value', 60);

      expect(mockRedisInstance.setex).toHaveBeenCalledWith('test-key', 60, 'test-value');
    });

    it('should throw error when not connected', async () => {
      await redisClient.disconnect();

      await expect(redisClient.set('test-key', 'test-value')).rejects.toThrow(
        'Redis client not connected'
      );
    });
  });

  describe('del', () => {
    beforeEach(async () => {
      mockRedisInstance.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'connect') {
          setTimeout(() => handler(), 0);
        }
      });
      await redisClient.connect();
    });

    it('should delete a key', async () => {
      mockRedisInstance.del.mockResolvedValue(1);

      const result = await redisClient.del('test-key');

      expect(result).toBe(1);
      expect(mockRedisInstance.del).toHaveBeenCalledWith('test-key');
    });

    it('should return 0 for non-existent key', async () => {
      mockRedisInstance.del.mockResolvedValue(0);

      const result = await redisClient.del('non-existent');

      expect(result).toBe(0);
    });
  });

  describe('expire', () => {
    beforeEach(async () => {
      mockRedisInstance.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'connect') {
          setTimeout(() => handler(), 0);
        }
      });
      await redisClient.connect();
    });

    it('should set expiration on existing key', async () => {
      mockRedisInstance.expire.mockResolvedValue(1);

      const result = await redisClient.expire('test-key', 60);

      expect(result).toBe(true);
      expect(mockRedisInstance.expire).toHaveBeenCalledWith('test-key', 60);
    });

    it('should return false for non-existent key', async () => {
      mockRedisInstance.expire.mockResolvedValue(0);

      const result = await redisClient.expire('non-existent', 60);

      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    beforeEach(async () => {
      mockRedisInstance.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'connect') {
          setTimeout(() => handler(), 0);
        }
      });
      await redisClient.connect();
    });

    it('should return true for existing key', async () => {
      mockRedisInstance.exists.mockResolvedValue(1);

      const result = await redisClient.exists('test-key');

      expect(result).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      mockRedisInstance.exists.mockResolvedValue(0);

      const result = await redisClient.exists('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('incr and decr', () => {
    beforeEach(async () => {
      mockRedisInstance.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'connect') {
          setTimeout(() => handler(), 0);
        }
      });
      await redisClient.connect();
    });

    it('should increment a value', async () => {
      mockRedisInstance.incr.mockResolvedValue(5);

      const result = await redisClient.incr('counter');

      expect(result).toBe(5);
      expect(mockRedisInstance.incr).toHaveBeenCalledWith('counter');
    });

    it('should decrement a value', async () => {
      mockRedisInstance.decr.mockResolvedValue(3);

      const result = await redisClient.decr('counter');

      expect(result).toBe(3);
      expect(mockRedisInstance.decr).toHaveBeenCalledWith('counter');
    });
  });

  describe('mget and mset', () => {
    beforeEach(async () => {
      mockRedisInstance.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'connect') {
          setTimeout(() => handler(), 0);
        }
      });
      await redisClient.connect();
    });

    it('should get multiple values', async () => {
      mockRedisInstance.mget.mockResolvedValue(['value1', 'value2', null]);

      const result = await redisClient.mget('key1', 'key2', 'key3');

      expect(result).toEqual(['value1', 'value2', null]);
      expect(mockRedisInstance.mget).toHaveBeenCalledWith('key1', 'key2', 'key3');
    });

    it('should set multiple values', async () => {
      await redisClient.mset({ key1: 'value1', key2: 'value2' });

      expect(mockRedisInstance.mset).toHaveBeenCalledWith('key1', 'value1', 'key2', 'value2');
    });
  });

  describe('getConnectionStatus', () => {
    it('should return connection status', async () => {
      const status = redisClient.getConnectionStatus();

      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('reconnectAttempts');
      expect(typeof status.connected).toBe('boolean');
      expect(typeof status.reconnectAttempts).toBe('number');
    });
  });

  describe('disconnect', () => {
    it('should disconnect from Redis', async () => {
      mockRedisInstance.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'connect') {
          setTimeout(() => handler(), 0);
        }
      });

      await redisClient.connect();
      await redisClient.disconnect();

      expect(mockRedisInstance.quit).toHaveBeenCalled();
    });

    it('should handle disconnect when not connected', async () => {
      await expect(redisClient.disconnect()).resolves.not.toThrow();
    });
  });
});
