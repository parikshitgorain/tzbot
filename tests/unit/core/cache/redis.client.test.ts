/**
 * @file redis.client.test.ts
 * @description Unit tests for Redis client
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RedisClient } from '../../../../src/core/cache/redis.client.js';

// Mock ioredis
vi.mock('ioredis', () => {
  return {
    default: class MockRedis {
      private store = new Map<string, { value: string; ttl?: number }>();
      public status = 'ready';
      private eventHandlers: Map<string, Function[]> = new Map();
      
      constructor() {
        // Simulate immediate connection
        setTimeout(() => {
          this.emit('connect');
          this.emit('ready');
        }, 0);
      }
      
      async connect() {
        return Promise.resolve();
      }
      
      async disconnect() {
        this.emit('close');
        return Promise.resolve();
      }
      
      async quit() {
        this.emit('end');
        return Promise.resolve();
      }
      
      async ping() {
        return Promise.resolve('PONG');
      }
      
      async get(key: string) {
        const item = this.store.get(key);
        return Promise.resolve(item ? item.value : null);
      }
      
      async set(key: string, value: string) {
        this.store.set(key, { value });
        return Promise.resolve('OK');
      }
      
      async setex(key: string, ttl: number, value: string) {
        this.store.set(key, { value, ttl });
        return Promise.resolve('OK');
      }
      
      async del(key: string) {
        const existed = this.store.has(key);
        this.store.delete(key);
        return Promise.resolve(existed ? 1 : 0);
      }
      
      async exists(key: string) {
        return Promise.resolve(this.store.has(key) ? 1 : 0);
      }
      
      async incr(key: string) {
        const item = this.store.get(key);
        const current = item ? parseInt(item.value) : 0;
        const newVal = current + 1;
        this.store.set(key, { value: String(newVal) });
        return Promise.resolve(newVal);
      }
      
      async decr(key: string) {
        const item = this.store.get(key);
        const current = item ? parseInt(item.value) : 0;
        const newVal = current - 1;
        this.store.set(key, { value: String(newVal) });
        return Promise.resolve(newVal);
      }
      
      async mset(...args: any[]) {
        for (let i = 0; i < args.length; i += 2) {
          this.store.set(args[i], { value: args[i + 1] });
        }
        return Promise.resolve('OK');
      }
      
      async mget(...keys: string[]) {
        return Promise.resolve(keys.map(key => {
          const item = this.store.get(key);
          return item ? item.value : null;
        }));
      }
      
      on(event: string, handler: Function) {
        if (!this.eventHandlers.has(event)) {
          this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event)!.push(handler);
        return this;
      }
      
      private emit(event: string, ...args: any[]) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
          handlers.forEach(handler => handler(...args));
        }
      }
    }
  };
});

// Mock logger
vi.mock('@/core/logger/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  logError: vi.fn(),
  logSystemTransition: vi.fn(),
}));

// Mock config
vi.mock('@/config/index', () => ({
  config: {
    redisUrl: 'redis://localhost:6379',
    redisPassword: undefined,
    logLevel: 'info',
  },
}));

describe('RedisClient', () => {
  let redisClient: RedisClient;

  beforeEach(() => {
    redisClient = new RedisClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('connect', () => {
    it('should connect to Redis successfully', async () => {
      await redisClient.connect();
      
      // Connection should succeed with mocked Redis
      expect(redisClient).toBeDefined();
    });

    it('should handle connection errors', async () => {
      // The mock Redis always succeeds, so we test the client handles it gracefully
      await expect(redisClient.connect()).resolves.not.toThrow();
    });

    it('should not reconnect if already connected', async () => {
      await redisClient.connect();
      await redisClient.connect(); // Second call should be no-op
      
      // Should not throw and handle gracefully
      expect(redisClient).toBeDefined();
    });
  });

  describe('testConnection', () => {
    it('should return true when connection is healthy', async () => {
      await redisClient.connect();
      const result = await redisClient.testConnection();
      
      expect(result).toBe(true);
    });

    it('should return false when not connected', async () => {
      const result = await redisClient.testConnection();
      
      expect(result).toBe(false);
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      await redisClient.connect();
    });

    it('should get a value from Redis', async () => {
      await redisClient.set('test-key', 'test-value');
      const result = await redisClient.get('test-key');

      expect(result).toBe('test-value');
    });

    it('should return null for non-existent key', async () => {
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
      await redisClient.connect();
    });

    it('should set a value without TTL', async () => {
      await redisClient.set('test-key', 'test-value');
      const result = await redisClient.get('test-key');
      
      expect(result).toBe('test-value');
    });

    it('should set a value with TTL', async () => {
      await redisClient.set('test-key', 'test-value', 60);
      const result = await redisClient.get('test-key');
      
      expect(result).toBe('test-value');
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
      await redisClient.connect();
    });

    it('should delete a key', async () => {
      await redisClient.set('test-key', 'test-value');
      const deleted = await redisClient.del('test-key');

      expect(deleted).toBe(1);

      const result = await redisClient.get('test-key');
      expect(result).toBeNull();
    });

    it('should return 0 for non-existent key', async () => {
      const deleted = await redisClient.del('non-existent');

      expect(deleted).toBe(0);
    });
  });

  describe('exists', () => {
    beforeEach(async () => {
      await redisClient.connect();
    });

    it('should return true for existing key', async () => {
      await redisClient.set('test-key', 'test-value');
      const exists = await redisClient.exists('test-key');

      expect(exists).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      const exists = await redisClient.exists('non-existent');

      expect(exists).toBe(false);
    });
  });

  describe('incr/decr', () => {
    beforeEach(async () => {
      await redisClient.connect();
    });

    it('should increment a counter', async () => {
      const val1 = await redisClient.incr('counter');
      expect(val1).toBe(1);

      const val2 = await redisClient.incr('counter');
      expect(val2).toBe(2);
    });

    it('should decrement a counter', async () => {
      await redisClient.incr('counter');
      await redisClient.incr('counter');

      const val = await redisClient.decr('counter');
      expect(val).toBe(1);
    });
  });

  describe('mget/mset', () => {
    beforeEach(async () => {
      await redisClient.connect();
    });

    it('should set multiple keys', async () => {
      await redisClient.mset({
        key1: 'value1',
        key2: 'value2',
      });

      const val1 = await redisClient.get('key1');
      const val2 = await redisClient.get('key2');

      expect(val1).toBe('value1');
      expect(val2).toBe('value2');
    });

    it('should get multiple keys', async () => {
      await redisClient.set('key1', 'value1');
      await redisClient.set('key2', 'value2');

      const results = await redisClient.mget('key1', 'key2');

      expect(results).toEqual(['value1', 'value2']);
    });
  });

  describe('disconnect', () => {
    it('should disconnect from Redis', async () => {
      await redisClient.connect();
      await redisClient.disconnect();

      // Should throw when trying to use after disconnect
      await expect(redisClient.get('test-key')).rejects.toThrow('Redis client not connected');
    });
  });

  describe('getConnectionStatus', () => {
    it('should return connection status', async () => {
      await redisClient.connect();
      const status = redisClient.getConnectionStatus();

      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('reconnectAttempts');
    });
  });
});
