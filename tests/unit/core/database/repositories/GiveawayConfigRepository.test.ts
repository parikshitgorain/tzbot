import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GiveawayConfigRepository } from '../../../../../src/core/database/repositories/GiveawayConfigRepository.js';
import type { Pool, QueryResult } from 'pg';

describe('GiveawayConfigRepository', () => {
  let mockPool: Pool;
  let repository: GiveawayConfigRepository;
  const testGuildId = '123456789012345678';

  beforeEach(() => {
    mockPool = {
      query: vi.fn(),
    } as unknown as Pool;

    repository = new GiveawayConfigRepository(mockPool);
  });

  describe('getGiveawayPermissions', () => {
    it('should return null for guild with no configuration', async () => {
      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [],
      } as QueryResult);

      const config = await repository.getGiveawayPermissions(testGuildId);
      expect(config).toBeNull();
    });

    it('should return configuration for guild', async () => {
      const allowedRoles = ['role1', 'role2'];
      const allowedUsers = ['user1', 'user2'];
      const now = new Date();

      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [{
          guild_id: testGuildId,
          allowed_roles: allowedRoles,
          allowed_users: allowedUsers,
          created_at: now,
          updated_at: now,
        }],
      } as QueryResult);

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

      vi.mocked(mockPool.query).mockResolvedValueOnce({} as QueryResult);

      await repository.updateGiveawayPermissions(testGuildId, allowedRoles, allowedUsers);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO giveaway_config'),
        [testGuildId, allowedRoles, allowedUsers]
      );
    });

    it('should update existing configuration', async () => {
      const newRoles = ['role2', 'role3'];
      const newUsers = ['user2', 'user3'];

      vi.mocked(mockPool.query).mockResolvedValue({} as QueryResult);

      await repository.updateGiveawayPermissions(testGuildId, newRoles, newUsers);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        [testGuildId, newRoles, newUsers]
      );
    });

    it('should handle empty arrays', async () => {
      vi.mocked(mockPool.query).mockResolvedValueOnce({} as QueryResult);

      await repository.updateGiveawayPermissions(testGuildId, [], []);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.anything(),
        [testGuildId, [], []]
      );
    });
  });
});
