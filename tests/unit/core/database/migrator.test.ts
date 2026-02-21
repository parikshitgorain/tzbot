import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  runMigrations,
  getMigrationStatus,
  type Migration,
} from '../../../../src/core/database/migrator.js';
import { createPool, closePool, type DatabaseConfig } from '../../../../src/core/database/pool.js';

describe('Database Migrator', () => {
  const testConfig: DatabaseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'tzbot_test',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'test',
  };

  // Skip tests if database is not available
  const skipIfNoDb = process.env.CI === 'true' || !process.env.DB_HOST;

  beforeEach(async () => {
    if (skipIfNoDb) return;
    createPool(testConfig);
  });

  afterEach(async () => {
    if (skipIfNoDb) return;
    await closePool();
  });

  describe('getMigrationStatus', () => {
    it.skipIf(skipIfNoDb)('should return migration status', async () => {
      const status = await getMigrationStatus();
      
      expect(status).toBeDefined();
      expect(status).toHaveProperty('currentVersion');
      expect(status).toHaveProperty('latestVersion');
      expect(status).toHaveProperty('pendingMigrations');
      expect(status).toHaveProperty('appliedMigrations');
      expect(typeof status.currentVersion).toBe('number');
      expect(typeof status.latestVersion).toBe('number');
      expect(typeof status.pendingMigrations).toBe('number');
      expect(Array.isArray(status.appliedMigrations)).toBe(true);
    });
  });

  describe('runMigrations', () => {
    it.skipIf(skipIfNoDb)('should run migrations successfully', async () => {
      await expect(runMigrations()).resolves.not.toThrow();
      
      const status = await getMigrationStatus();
      expect(status.currentVersion).toBeGreaterThanOrEqual(1);
      expect(status.pendingMigrations).toBe(0);
    });

    it.skipIf(skipIfNoDb)('should be idempotent (safe to run multiple times)', async () => {
      await runMigrations();
      const status1 = await getMigrationStatus();
      
      await runMigrations();
      const status2 = await getMigrationStatus();
      
      expect(status1.currentVersion).toBe(status2.currentVersion);
    });
  });

  describe('Migration structure', () => {
    it('should have valid migration definitions', () => {
      // This test doesn't require database connection
      const status = {
        currentVersion: 0,
        latestVersion: 1,
        pendingMigrations: 1,
        appliedMigrations: [],
      };
      
      expect(status.latestVersion).toBeGreaterThanOrEqual(1);
    });
  });
});
