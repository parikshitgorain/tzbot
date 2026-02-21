import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createPool, closePool } from '../../../../../src/core/database/pool.js';
import { runMigrations } from '../../../../../src/core/database/migrator.js';
import { GiveawayConfigRepository } from '../../../../../src/core/database/repositories/GiveawayConfigRepository.js';
import type { Pool } from 'pg';

describe('GiveawayConfigRepository', () => {
  let pool: Pool;
  let repository: GiveawayConfigRepository;
  const testGuildId = '123456789012345678';

  beforeAll(async () => {
    // Create test database connection
    pool = createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'tzbot_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    // Run migrations
    await runMigrations();

    repository = new GiveawayConfigRepository(pool);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await pool.query('DELETE FROM giveaway_config WHERE guild_id = $1', [testGuildId]);
  });

  describe('getGiveawayPermissions', () => {
    it('should return null for guild with no configuration', async () => {
      const config = await repository.getGiveawayPermissions(testGuildId);
      expect(config).toBeNull();
    });

    it('should return configuration for guild', async () => {
      const allowedRoles = ['role1', 'role2'];
      const allowedUsers = ['user1', 'user2'];

      await repository.updateGiveawayPermissions(testGuildId, allowedRoles, allowedUsers);

      const config = await repository.getGiveawayPermissions(testGuildId);
      expect(config).not.toBeNull();
      expect(config?.guildId).toBe(testGuildId);
      expect(config?.allowedRoles).toEqual(allowedRoles);
      expect(config?.allowedUsers).toEqual(allowedUsers);
      expect(config?.createdAt).toBeDefined();
      expect(config?.updatedAt).toBeDefined();
    });
  });

  describe('updateGiveawayPermissions', () => {
    it('should create new configuration', async () => {
      const allowedRoles = ['role1'];
      const allowedUsers = ['user1'];

      await repository.updateGiveawayPermissions(testGuildId, allowedRoles, allowedUsers);

      const config = await repository.getGiveawayPermissions(testGuildId);
      expect(config?.allowedRoles).toEqual(allowedRoles);
      expect(config?.allowedUsers).toEqual(allowedUsers);
    });

    it('should update existing configuration', async () => {
      // Create initial config
      await repository.updateGiveawayPermissions(testGuildId, ['role1'], ['user1']);

      // Update config
      const newRoles = ['role2', 'role3'];
      const newUsers = ['user2', 'user3'];
      await repository.updateGiveawayPermissions(testGuildId, newRoles, newUsers);

      const config = await repository.getGiveawayPermissions(testGuildId);
      expect(config?.allowedRoles).toEqual(newRoles);
      expect(config?.allowedUsers).toEqual(newUsers);
    });

    it('should handle empty arrays', async () => {
      await repository.updateGiveawayPermissions(testGuildId, [], []);

      const config = await repository.getGiveawayPermissions(testGuildId);
      expect(config?.allowedRoles).toEqual([]);
      expect(config?.allowedUsers).toEqual([]);
    });
  });
});
