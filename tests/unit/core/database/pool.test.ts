import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createPool,
  getPool,
  testConnection,
  closePool,
  getPoolStats,
  type DatabaseConfig,
} from '../../../../src/core/database/pool.js';

describe('Database Pool', () => {
  const testConfig: DatabaseConfig = {
    host: 'localhost',
    port: 5432,
    database: 'tzbot_test',
    user: 'postgres',
    password: 'test',
    max: 5,
  };

  afterEach(async () => {
    await closePool();
  });

  describe('createPool', () => {
    it('should create a pool with correct configuration', () => {
      const pool = createPool(testConfig);
      
      expect(pool).toBeDefined();
      expect(pool.options.max).toBe(5);
      expect(pool.options.host).toBe('localhost');
      expect(pool.options.port).toBe(5432);
    });

    it('should default to 20 max connections if not specified', () => {
      const configWithoutMax = { ...testConfig };
      delete configWithoutMax.max;
      
      const pool = createPool(configWithoutMax);
      
      expect(pool.options.max).toBe(20);
    });

    it('should return existing pool if already created', () => {
      const pool1 = createPool(testConfig);
      const pool2 = createPool(testConfig);
      
      expect(pool1).toBe(pool2);
    });
  });

  describe('getPool', () => {
    it('should return the created pool', () => {
      const createdPool = createPool(testConfig);
      const retrievedPool = getPool();
      
      expect(retrievedPool).toBe(createdPool);
    });

    it('should throw error if pool not initialized', async () => {
      expect(() => getPool()).toThrow('Database pool not initialized');
    });
  });

  describe('getPoolStats', () => {
    it('should return null if pool not initialized', () => {
      const stats = getPoolStats();
      expect(stats).toBeNull();
    });

    it('should return pool statistics when pool exists', () => {
      createPool(testConfig);
      const stats = getPoolStats();
      
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('totalCount');
      expect(stats).toHaveProperty('idleCount');
      expect(stats).toHaveProperty('waitingCount');
    });
  });

  describe('closePool', () => {
    it('should close the pool successfully', async () => {
      createPool(testConfig);
      await closePool();
      
      // Pool should be null after closing
      expect(getPoolStats()).toBeNull();
    });

    it('should handle closing when pool is already null', async () => {
      await expect(closePool()).resolves.not.toThrow();
    });
  });

  describe('testConnection', () => {
    it('should return false if connection fails', async () => {
      const badConfig: DatabaseConfig = {
        host: 'invalid-host',
        port: 9999,
        database: 'nonexistent',
        user: 'invalid',
        password: 'invalid',
      };
      
      createPool(badConfig);
      const result = await testConnection();
      
      expect(result).toBe(false);
    });
  });
});
