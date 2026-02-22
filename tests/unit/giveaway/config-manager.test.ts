import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigManager } from '../../../src/giveaway/config-manager.js';
import type { GiveawayConfigRepository } from '../../../src/core/database/repositories/GiveawayConfigRepository.js';
import type { GiveawayConfig } from '../../../src/types/models.js';
import { GuildMember, PermissionsBitField, PermissionFlagsBits } from 'discord.js';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let mockConfigRepo: GiveawayConfigRepository;

  beforeEach(() => {
    // Create mock repository
    mockConfigRepo = {
      getGiveawayPermissions: vi.fn(),
      updateGiveawayPermissions: vi.fn(),
    } as any;

    configManager = new ConfigManager(mockConfigRepo);
  });

  describe('getGiveawayPermissions', () => {
    it('should return config from repository when it exists', async () => {
      const guildId = 'guild-1';
      const mockConfig: GiveawayConfig = {
        guildId,
        allowedRoles: ['role-1', 'role-2'],
        allowedUsers: ['user-1'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockConfigRepo.getGiveawayPermissions).mockResolvedValue(mockConfig);

      const result = await configManager.getGiveawayPermissions(guildId);

      expect(result).toEqual(mockConfig);
      expect(mockConfigRepo.getGiveawayPermissions).toHaveBeenCalledWith(guildId);
    });

    it('should return default admin-only config when no config exists', async () => {
      const guildId = 'guild-2';

      vi.mocked(mockConfigRepo.getGiveawayPermissions).mockResolvedValue(null);

      const result = await configManager.getGiveawayPermissions(guildId);

      expect(result.guildId).toBe(guildId);
      expect(result.allowedRoles).toEqual([]);
      expect(result.allowedUsers).toEqual([]);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw error when repository fails', async () => {
      const guildId = 'guild-3';
      const error = new Error('Database error');

      vi.mocked(mockConfigRepo.getGiveawayPermissions).mockRejectedValue(error);

      await expect(configManager.getGiveawayPermissions(guildId)).rejects.toThrow(error);
    });
  });

  describe('updateGiveawayPermissions', () => {
    it('should update permissions through repository', async () => {
      const guildId = 'guild-1';
      const allowedRoles = ['role-1', 'role-2'];
      const allowedUsers = ['user-1', 'user-2'];

      vi.mocked(mockConfigRepo.updateGiveawayPermissions).mockResolvedValue();

      await configManager.updateGiveawayPermissions(guildId, allowedRoles, allowedUsers);

      expect(mockConfigRepo.updateGiveawayPermissions).toHaveBeenCalledWith(
        guildId,
        allowedRoles,
        allowedUsers
      );
    });

    it('should throw error when repository fails', async () => {
      const guildId = 'guild-2';
      const error = new Error('Database error');

      vi.mocked(mockConfigRepo.updateGiveawayPermissions).mockRejectedValue(error);

      await expect(
        configManager.updateGiveawayPermissions(guildId, [], [])
      ).rejects.toThrow(error);
    });
  });

  describe('canUseGiveawayCommands', () => {
    const createMockMember = (
      userId: string,
      hasAdmin: boolean,
      roleIds: string[] = []
    ): GuildMember => {
      const permissions = new PermissionsBitField();
      if (hasAdmin) {
        permissions.add(PermissionFlagsBits.Administrator);
      }

      // Create a proper Map with some() method
      const rolesMap = new Map(roleIds.map((id) => [id, { id } as any]));

      return {
        id: userId,
        permissions,
        roles: {
          cache: rolesMap,
        },
      } as any;
    };

    it('should allow administrators regardless of config', async () => {
      const guildId = 'guild-1';
      const member = createMockMember('user-1', true);

      vi.mocked(mockConfigRepo.getGiveawayPermissions).mockResolvedValue(null);

      const result = await configManager.canUseGiveawayCommands(guildId, member);

      expect(result).toBe(true);
    });

    it('should deny non-admin when no config exists', async () => {
      const guildId = 'guild-1';
      const member = createMockMember('user-1', false);

      vi.mocked(mockConfigRepo.getGiveawayPermissions).mockResolvedValue(null);

      const result = await configManager.canUseGiveawayCommands(guildId, member);

      expect(result).toBe(false);
    });

    it('should deny non-admin when config has empty lists', async () => {
      const guildId = 'guild-1';
      const member = createMockMember('user-1', false);
      const mockConfig: GiveawayConfig = {
        guildId,
        allowedRoles: [],
        allowedUsers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockConfigRepo.getGiveawayPermissions).mockResolvedValue(mockConfig);

      const result = await configManager.canUseGiveawayCommands(guildId, member);

      expect(result).toBe(false);
    });

    it('should allow user in allowedUsers list', async () => {
      const guildId = 'guild-1';
      const member = createMockMember('user-1', false);
      const mockConfig: GiveawayConfig = {
        guildId,
        allowedRoles: [],
        allowedUsers: ['user-1'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockConfigRepo.getGiveawayPermissions).mockResolvedValue(mockConfig);

      const result = await configManager.canUseGiveawayCommands(guildId, member);

      expect(result).toBe(true);
    });

    it('should allow user with allowed role', async () => {
      const guildId = 'guild-1';
      const member = createMockMember('user-1', false, ['role-1', 'role-2']);
      const mockConfig: GiveawayConfig = {
        guildId,
        allowedRoles: ['role-1'],
        allowedUsers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockConfigRepo.getGiveawayPermissions).mockResolvedValue(mockConfig);

      const result = await configManager.canUseGiveawayCommands(guildId, member);

      expect(result).toBe(true);
    });

    it('should deny user without allowed role', async () => {
      const guildId = 'guild-1';
      const member = createMockMember('user-1', false, ['role-3']);
      const mockConfig: GiveawayConfig = {
        guildId,
        allowedRoles: ['role-1', 'role-2'],
        allowedUsers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockConfigRepo.getGiveawayPermissions).mockResolvedValue(mockConfig);

      const result = await configManager.canUseGiveawayCommands(guildId, member);

      expect(result).toBe(false);
    });

    it('should allow user with both role and user ID configured', async () => {
      const guildId = 'guild-1';
      const member = createMockMember('user-1', false, ['role-1']);
      const mockConfig: GiveawayConfig = {
        guildId,
        allowedRoles: ['role-1'],
        allowedUsers: ['user-1'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockConfigRepo.getGiveawayPermissions).mockResolvedValue(mockConfig);

      const result = await configManager.canUseGiveawayCommands(guildId, member);

      expect(result).toBe(true);
    });

    it('should deny access on error', async () => {
      const guildId = 'guild-1';
      const member = createMockMember('user-1', false);
      const error = new Error('Database error');

      vi.mocked(mockConfigRepo.getGiveawayPermissions).mockRejectedValue(error);

      const result = await configManager.canUseGiveawayCommands(guildId, member);

      expect(result).toBe(false);
    });
  });
});
