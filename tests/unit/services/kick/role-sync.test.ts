/**
 * @file role-sync.test.ts
 * @description Unit tests for role synchronization system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoleSyncSystem } from '@/services/kick/role-sync.js';
import type { IDiscordClient } from '@/core/discord/client.js';
import type { IUserLinkingSystem } from '@/services/kick/user-linking.js';
import type { KickChatMessage } from '@/services/pusher/types.js';
import type { GuildMember } from 'discord.js';

// Mock logger
vi.mock('@/core/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  logError: vi.fn(),
}));

// Mock Discord client
const createMockDiscordClient = (): IDiscordClient => {
  const memberRoles = new Map<string, Set<string>>();

  return {
    addRole: vi.fn(async (guildId: string, userId: string, roleId: string) => {
      if (!memberRoles.has(userId)) {
        memberRoles.set(userId, new Set());
      }
      memberRoles.get(userId)!.add(roleId);
    }),

    removeRole: vi.fn(async (guildId: string, userId: string, roleId: string) => {
      memberRoles.get(userId)?.delete(roleId);
    }),

    getMember: vi.fn(async (guildId: string, userId: string) => {
      const roles = memberRoles.get(userId) || new Set();
      return {
        roles: {
          cache: {
            has: (roleId: string) => roles.has(roleId),
          },
        },
      } as unknown as GuildMember;
    }),

    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn(() => true),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    sendMessage: vi.fn(),
    deleteMessage: vi.fn(),
    banUser: vi.fn(),
    kickUser: vi.fn(),
    timeoutUser: vi.fn(),
    getGuild: vi.fn(),
  } as unknown as IDiscordClient;
};

// Mock user linking system
const createMockLinkingSystem = (): IUserLinkingSystem => {
  const links = new Map<string, string>(); // kickUsername -> discordId

  return {
    getDiscordId: vi.fn(async (kickUsername: string) => {
      return links.get(kickUsername) || null;
    }),

    getKickUsername: vi.fn(async (discordId: string) => {
      for (const [kickUsername, id] of links.entries()) {
        if (id === discordId) {
          return kickUsername;
        }
      }
      return null;
    }),

    // Helper to set up links for testing
    _setLink: (kickUsername: string, discordId: string) => {
      links.set(kickUsername, discordId);
    },

    startLinking: vi.fn(),
    verifyToken: vi.fn(),
    completeLink: vi.fn(),
    unlinkAccounts: vi.fn(),
    isLinked: vi.fn(),
    processVerificationMessage: vi.fn(),
    cleanupExpiredTokens: vi.fn(),
  } as unknown as IUserLinkingSystem & { _setLink: (k: string, d: string) => void };
};

describe('RoleSyncSystem', () => {
  let roleSyncSystem: RoleSyncSystem;
  let mockDiscordClient: IDiscordClient;
  let mockLinkingSystem: IUserLinkingSystem & { _setLink: (k: string, d: string) => void };

  const config = {
    guildId: '123456789',
    subscriberRoleId: 'sub-role-id',
    vipRoleId: 'vip-role-id',
    enabled: true,
  };

  beforeEach(() => {
    mockDiscordClient = createMockDiscordClient();
    mockLinkingSystem = createMockLinkingSystem();
    roleSyncSystem = new RoleSyncSystem(
      config,
      mockDiscordClient,
      mockLinkingSystem
    );
  });

  describe('syncRolesFromMessage', () => {
    it('should return null if role sync is disabled', async () => {
      roleSyncSystem.setEnabled(false);

      const message: KickChatMessage = {
        id: '1',
        username: 'testuser',
        content: 'Hello',
        timestamp: new Date(),
        badges: [{ type: 'subscriber' }],
      };

      const result = await roleSyncSystem.syncRolesFromMessage(message);
      expect(result).toBeNull();
    });

    it('should return null if user is not linked', async () => {
      const message: KickChatMessage = {
        id: '1',
        username: 'unlinkeduser',
        content: 'Hello',
        timestamp: new Date(),
        badges: [{ type: 'subscriber' }],
      };

      const result = await roleSyncSystem.syncRolesFromMessage(message);
      expect(result).toBeNull();
    });

    it('should add subscriber role when subscriber badge is detected', async () => {
      const discordId = '111111111';
      const kickUsername = 'testuser';
      mockLinkingSystem._setLink(kickUsername, discordId);

      const message: KickChatMessage = {
        id: '1',
        username: kickUsername,
        content: 'Hello',
        timestamp: new Date(),
        badges: [{ type: 'subscriber', months: 3 }],
      };

      const result = await roleSyncSystem.syncRolesFromMessage(message);

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.rolesAdded).toContain('subscriber');
      expect(mockDiscordClient.addRole).toHaveBeenCalledWith(
        config.guildId,
        discordId,
        config.subscriberRoleId
      );
    });

    it('should add VIP role when VIP badge is detected', async () => {
      const discordId = '111111111';
      const kickUsername = 'testuser';
      mockLinkingSystem._setLink(kickUsername, discordId);

      const message: KickChatMessage = {
        id: '1',
        username: kickUsername,
        content: 'Hello',
        timestamp: new Date(),
        badges: [{ type: 'vip' }],
      };

      const result = await roleSyncSystem.syncRolesFromMessage(message);

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.rolesAdded).toContain('vip');
      expect(mockDiscordClient.addRole).toHaveBeenCalledWith(
        config.guildId,
        discordId,
        config.vipRoleId
      );
    });

    it('should add both roles when both badges are detected', async () => {
      const discordId = '111111111';
      const kickUsername = 'testuser';
      mockLinkingSystem._setLink(kickUsername, discordId);

      const message: KickChatMessage = {
        id: '1',
        username: kickUsername,
        content: 'Hello',
        timestamp: new Date(),
        badges: [{ type: 'subscriber', months: 3 }, { type: 'vip' }],
      };

      const result = await roleSyncSystem.syncRolesFromMessage(message);

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.rolesAdded).toContain('subscriber');
      expect(result?.rolesAdded).toContain('vip');
    });

    it('should not add role if user already has it', async () => {
      const discordId = '111111111';
      const kickUsername = 'testuser';
      mockLinkingSystem._setLink(kickUsername, discordId);

      // Add role first
      await mockDiscordClient.addRole(
        config.guildId,
        discordId,
        config.subscriberRoleId
      );

      const message: KickChatMessage = {
        id: '1',
        username: kickUsername,
        content: 'Hello',
        timestamp: new Date(),
        badges: [{ type: 'subscriber' }],
      };

      const result = await roleSyncSystem.syncRolesFromMessage(message);

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.rolesAdded).toHaveLength(0);
      expect(result?.rolesRemoved).toHaveLength(0);
    });
  });

  describe('syncUserRoles', () => {
    it('should add subscriber role when badge is present', async () => {
      const discordId = '111111111';
      mockLinkingSystem._setLink('testuser', discordId);

      const result = await roleSyncSystem.syncUserRoles(discordId, true, false);

      expect(result.success).toBe(true);
      expect(result.rolesAdded).toContain('subscriber');
      expect(mockDiscordClient.addRole).toHaveBeenCalledWith(
        config.guildId,
        discordId,
        config.subscriberRoleId
      );
    });

    it('should remove subscriber role when badge is not present', async () => {
      const discordId = '111111111';
      mockLinkingSystem._setLink('testuser', discordId);

      // Add role first
      await mockDiscordClient.addRole(
        config.guildId,
        discordId,
        config.subscriberRoleId
      );

      const result = await roleSyncSystem.syncUserRoles(discordId, false, false);

      expect(result.success).toBe(true);
      expect(result.rolesRemoved).toContain('subscriber');
      expect(mockDiscordClient.removeRole).toHaveBeenCalledWith(
        config.guildId,
        discordId,
        config.subscriberRoleId
      );
    });

    it('should add VIP role when badge is present', async () => {
      const discordId = '111111111';
      mockLinkingSystem._setLink('testuser', discordId);

      const result = await roleSyncSystem.syncUserRoles(discordId, false, true);

      expect(result.success).toBe(true);
      expect(result.rolesAdded).toContain('vip');
      expect(mockDiscordClient.addRole).toHaveBeenCalledWith(
        config.guildId,
        discordId,
        config.vipRoleId
      );
    });

    it('should remove VIP role when badge is not present', async () => {
      const discordId = '111111111';
      mockLinkingSystem._setLink('testuser', discordId);

      // Add role first
      await mockDiscordClient.addRole(config.guildId, discordId, config.vipRoleId);

      const result = await roleSyncSystem.syncUserRoles(discordId, false, false);

      expect(result.success).toBe(true);
      expect(result.rolesRemoved).toContain('vip');
      expect(mockDiscordClient.removeRole).toHaveBeenCalledWith(
        config.guildId,
        discordId,
        config.vipRoleId
      );
    });

    it('should handle both roles simultaneously', async () => {
      const discordId = '111111111';
      mockLinkingSystem._setLink('testuser', discordId);

      const result = await roleSyncSystem.syncUserRoles(discordId, true, true);

      expect(result.success).toBe(true);
      expect(result.rolesAdded).toContain('subscriber');
      expect(result.rolesAdded).toContain('vip');
    });

    it('should handle errors gracefully', async () => {
      const discordId = '111111111';
      mockLinkingSystem._setLink('testuser', discordId);

      // Make addRole throw an error
      vi.mocked(mockDiscordClient.addRole).mockRejectedValueOnce(
        new Error('Discord API error')
      );

      const result = await roleSyncSystem.syncUserRoles(discordId, true, false);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('hasRole', () => {
    it('should return true if user has role', async () => {
      const discordId = '111111111';
      await mockDiscordClient.addRole(
        config.guildId,
        discordId,
        config.subscriberRoleId
      );

      const hasRole = await roleSyncSystem.hasRole(
        discordId,
        config.subscriberRoleId
      );

      expect(hasRole).toBe(true);
    });

    it('should return false if user does not have role', async () => {
      const discordId = '111111111';

      const hasRole = await roleSyncSystem.hasRole(
        discordId,
        config.subscriberRoleId
      );

      expect(hasRole).toBe(false);
    });

    it('should return false if member not found', async () => {
      vi.mocked(mockDiscordClient.getMember).mockResolvedValueOnce(null);

      const hasRole = await roleSyncSystem.hasRole('999999999', config.subscriberRoleId);

      expect(hasRole).toBe(false);
    });
  });

  describe('setEnabled/isEnabled', () => {
    it('should enable and disable role sync', () => {
      expect(roleSyncSystem.isEnabled()).toBe(true);

      roleSyncSystem.setEnabled(false);
      expect(roleSyncSystem.isEnabled()).toBe(false);

      roleSyncSystem.setEnabled(true);
      expect(roleSyncSystem.isEnabled()).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle messages with no badges', async () => {
      const discordId = '111111111';
      const kickUsername = 'testuser';
      mockLinkingSystem._setLink(kickUsername, discordId);

      // Add roles first
      await mockDiscordClient.addRole(
        config.guildId,
        discordId,
        config.subscriberRoleId
      );
      await mockDiscordClient.addRole(config.guildId, discordId, config.vipRoleId);

      const message: KickChatMessage = {
        id: '1',
        username: kickUsername,
        content: 'Hello',
        timestamp: new Date(),
        badges: [],
      };

      const result = await roleSyncSystem.syncRolesFromMessage(message);

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.rolesRemoved).toContain('subscriber');
      expect(result?.rolesRemoved).toContain('vip');
    });

    it('should handle messages with moderator and broadcaster badges', async () => {
      const discordId = '111111111';
      const kickUsername = 'testuser';
      mockLinkingSystem._setLink(kickUsername, discordId);

      const message: KickChatMessage = {
        id: '1',
        username: kickUsername,
        content: 'Hello',
        timestamp: new Date(),
        badges: [{ type: 'moderator' }, { type: 'broadcaster' }],
      };

      const result = await roleSyncSystem.syncRolesFromMessage(message);

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      // Should not add subscriber or VIP roles
      expect(result?.rolesAdded).toHaveLength(0);
    });

    it('should handle multiple messages from same user', async () => {
      const discordId = '111111111';
      const kickUsername = 'testuser';
      mockLinkingSystem._setLink(kickUsername, discordId);

      // First message with subscriber badge
      const message1: KickChatMessage = {
        id: '1',
        username: kickUsername,
        content: 'Hello',
        timestamp: new Date(),
        badges: [{ type: 'subscriber' }],
      };

      const result1 = await roleSyncSystem.syncRolesFromMessage(message1);
      expect(result1?.rolesAdded).toContain('subscriber');

      // Second message with subscriber badge (should not add again)
      const message2: KickChatMessage = {
        id: '2',
        username: kickUsername,
        content: 'Hello again',
        timestamp: new Date(),
        badges: [{ type: 'subscriber' }],
      };

      const result2 = await roleSyncSystem.syncRolesFromMessage(message2);
      expect(result2?.rolesAdded).toHaveLength(0);
      expect(result2?.rolesRemoved).toHaveLength(0);
    });
  });
});
