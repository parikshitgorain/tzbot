import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigManager } from '../../../src/giveaway/config-manager.js';

// Mock Redis client
vi.mock('../../../src/core/cache/redis.client.js', () => ({
  redisClient: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  },
}));

// Mock logger
vi.mock('../../../src/core/logger/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

function makeRepo() {
  return {
    getGiveawayPermissions: vi.fn(),
    updateGiveawayPermissions: vi.fn().mockResolvedValue(undefined),
  };
}

function makeMember(overrides: {
  id?: string;
  isAdmin?: boolean;
  roleIds?: string[];
} = {}) {
  const { id = 'u1', isAdmin = false, roleIds = [] } = overrides;
  return {
    id,
    permissions: {
      has: vi.fn().mockReturnValue(isAdmin),
    },
    roles: {
      cache: {
        values: vi.fn().mockReturnValue(roleIds.map((rid) => ({ id: rid }))),
      },
    },
  } as any;
}

describe('ConfigManager (giveaway)', () => {
  let repo: ReturnType<typeof makeRepo>;
  let manager: ConfigManager;

  beforeEach(() => {
    repo = makeRepo();
    manager = new ConfigManager(repo as any);
    vi.clearAllMocks();
  });

  describe('getGiveawayPermissions()', () => {
    it('returns default empty config when none exists in DB', async () => {
      repo.getGiveawayPermissions.mockResolvedValue(null);
      const cfg = await manager.getGiveawayPermissions('guild1');
      expect(cfg.guildId).toBe('guild1');
      expect(cfg.allowedRoles).toEqual([]);
      expect(cfg.allowedUsers).toEqual([]);
    });

    it('returns existing config from DB', async () => {
      repo.getGiveawayPermissions.mockResolvedValue({
        guildId: 'guild1', allowedRoles: ['r1'], allowedUsers: ['u1'],
        createdAt: new Date(), updatedAt: new Date(),
      });
      const cfg = await manager.getGiveawayPermissions('guild1');
      expect(cfg.allowedRoles).toEqual(['r1']);
    });

    it('throws when repository throws', async () => {
      repo.getGiveawayPermissions.mockRejectedValue(new Error('DB error'));
      await expect(manager.getGiveawayPermissions('guild1')).rejects.toThrow('DB error');
    });
  });

  describe('updateGiveawayPermissions()', () => {
    it('delegates to repository with correct params', async () => {
      await manager.updateGiveawayPermissions('guild1', ['r1'], ['u1']);
      expect(repo.updateGiveawayPermissions).toHaveBeenCalledWith('guild1', ['r1'], ['u1']);
    });

    it('throws when repository throws', async () => {
      repo.updateGiveawayPermissions.mockRejectedValue(new Error('DB error'));
      await expect(manager.updateGiveawayPermissions('guild1', [], [])).rejects.toThrow('DB error');
    });
  });

  describe('canUseGiveawayCommands()', () => {
    it('returns true for administrator regardless of config', async () => {
      const member = makeMember({ isAdmin: true });
      expect(await manager.canUseGiveawayCommands('guild1', member)).toBe(true);
    });

    it('returns false when no config and not admin (default deny)', async () => {
      repo.getGiveawayPermissions.mockResolvedValue(null);
      const member = makeMember();
      expect(await manager.canUseGiveawayCommands('guild1', member)).toBe(false);
    });

    it('returns false when config exists but user not in lists', async () => {
      repo.getGiveawayPermissions.mockResolvedValue({
        guildId: 'guild1', allowedRoles: ['r1'], allowedUsers: ['other'],
        createdAt: new Date(), updatedAt: new Date(),
      });
      const member = makeMember({ id: 'u1', roleIds: ['r2'] });
      expect(await manager.canUseGiveawayCommands('guild1', member)).toBe(false);
    });

    it('returns true when user ID is in allowedUsers', async () => {
      repo.getGiveawayPermissions.mockResolvedValue({
        guildId: 'guild1', allowedRoles: [], allowedUsers: ['u1'],
        createdAt: new Date(), updatedAt: new Date(),
      });
      const member = makeMember({ id: 'u1' });
      expect(await manager.canUseGiveawayCommands('guild1', member)).toBe(true);
    });

    it('returns true when user has an allowed role', async () => {
      repo.getGiveawayPermissions.mockResolvedValue({
        guildId: 'guild1', allowedRoles: ['role1'], allowedUsers: [],
        createdAt: new Date(), updatedAt: new Date(),
      });
      const member = makeMember({ roleIds: ['role1'] });
      expect(await manager.canUseGiveawayCommands('guild1', member)).toBe(true);
    });

    it('returns false on repository error (default deny on error)', async () => {
      repo.getGiveawayPermissions.mockRejectedValue(new Error('DB error'));
      const member = makeMember();
      expect(await manager.canUseGiveawayCommands('guild1', member)).toBe(false);
    });
  });
});
