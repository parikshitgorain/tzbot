/**
 * @file user-linking.test.ts
 * @description Unit tests for user linking system
 */

import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import { UserLinkingSystem } from '@/services/kick/user-linking.js';
import type { UserRepository } from '@/core/database/repositories/UserRepository.js';
import type { KickChatMessage } from '@/services/pusher/types.js';
import type { User } from '@/types/models.js';

// Mock logger to avoid config validation
vi.mock('@/core/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  logError: vi.fn(),
}));

// Mock UserRepository
const createMockUserRepository = (): UserRepository => {
  const users = new Map<string, User>();
  const kickUsernameMap = new Map<string, string>(); // kickUsername -> discordId

  return {
    save: vi.fn(async (user: Partial<User> & { discordId: string }) => {
      const existing = users.get(user.discordId);
      users.set(user.discordId, {
        discordId: user.discordId,
        kickUsername: user.kickUsername,
        roles: existing?.roles || [],
        violations: existing?.violations || [],
        createdAt: existing?.createdAt || new Date(),
        updatedAt: new Date(),
      });
    }),

    get: vi.fn(async (discordId: string) => {
      return users.get(discordId) || null;
    }),

    getByKickUsername: vi.fn(async (kickUsername: string) => {
      const discordId = kickUsernameMap.get(kickUsername);
      return discordId ? users.get(discordId) || null : null;
    }),

    linkKickUsername: vi.fn(async (discordId: string, kickUsername: string) => {
      // Remove old mapping if exists
      const existing = users.get(discordId);
      if (existing?.kickUsername) {
        kickUsernameMap.delete(existing.kickUsername);
      }

      // Check if kickUsername is already linked
      if (kickUsernameMap.has(kickUsername)) {
        const existingDiscordId = kickUsernameMap.get(kickUsername);
        if (existingDiscordId !== discordId) {
          throw new Error('Kick username already linked to another account');
        }
      }

      // Create or update user
      const user = users.get(discordId) || {
        discordId,
        kickUsername: undefined,
        roles: [],
        violations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      user.kickUsername = kickUsername;
      user.updatedAt = new Date();
      users.set(discordId, user);
      kickUsernameMap.set(kickUsername, discordId);
    }),

    unlinkKickUsername: vi.fn(async (discordId: string) => {
      const user = users.get(discordId);
      if (user?.kickUsername) {
        kickUsernameMap.delete(user.kickUsername);
        user.kickUsername = undefined;
        user.updatedAt = new Date();
      }
    }),

    deleteUserData: vi.fn(async (discordId: string) => {
      const user = users.get(discordId);
      if (user?.kickUsername) {
        kickUsernameMap.delete(user.kickUsername);
      }
      users.delete(discordId);
    }),
  } as unknown as UserRepository;
};

describe('UserLinkingSystem', () => {
  let linkingSystem: UserLinkingSystem;
  let mockUserRepository: UserRepository;

  beforeEach(() => {
    mockUserRepository = createMockUserRepository();
    linkingSystem = new UserLinkingSystem(mockUserRepository);
  });

  describe('startLinking', () => {
    it('should generate a unique token for a Discord user', async () => {
      const discordId = '123456789';
      const linkToken = await linkingSystem.startLinking(discordId);

      expect(linkToken.token).toBeDefined();
      expect(linkToken.token).toHaveLength(8);
      expect(linkToken.discordId).toBe(discordId);
      expect(linkToken.expiresAt).toBeInstanceOf(Date);
      expect(linkToken.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return existing token if user already has pending link', async () => {
      const discordId = '123456789';
      const firstToken = await linkingSystem.startLinking(discordId);
      const secondToken = await linkingSystem.startLinking(discordId);

      expect(secondToken.token).toBe(firstToken.token);
      expect(secondToken.discordId).toBe(firstToken.discordId);
    });

    it('should generate alphanumeric uppercase tokens', async () => {
      const discordId = '123456789';
      const linkToken = await linkingSystem.startLinking(discordId);

      expect(linkToken.token).toMatch(/^[A-Z0-9]{8}$/);
    });
  });

  describe('verifyToken', () => {
    it('should return Discord ID for valid token', async () => {
      const discordId = '123456789';
      const linkToken = await linkingSystem.startLinking(discordId);

      const verifiedDiscordId = await linkingSystem.verifyToken(linkToken.token);

      expect(verifiedDiscordId).toBe(discordId);
    });

    it('should return null for invalid token', async () => {
      const verifiedDiscordId = await linkingSystem.verifyToken('INVALID');

      expect(verifiedDiscordId).toBeNull();
    });

    it('should be case-insensitive', async () => {
      const discordId = '123456789';
      const linkToken = await linkingSystem.startLinking(discordId);

      const verifiedDiscordId = await linkingSystem.verifyToken(
        linkToken.token.toLowerCase()
      );

      expect(verifiedDiscordId).toBe(discordId);
    });

    it('should return null for expired token', async () => {
      const discordId = '123456789';
      const linkToken = await linkingSystem.startLinking(discordId);

      // Manually expire the token
      linkToken.expiresAt = new Date(Date.now() - 1000);

      const verifiedDiscordId = await linkingSystem.verifyToken(linkToken.token);

      expect(verifiedDiscordId).toBeNull();
    });
  });

  describe('completeLink', () => {
    it('should link Discord user to Kick username', async () => {
      const discordId = '123456789';
      const kickUsername = 'testuser';

      await linkingSystem.completeLink(discordId, kickUsername);

      expect(mockUserRepository.linkKickUsername).toHaveBeenCalledWith(
        discordId,
        kickUsername
      );

      const isLinked = await linkingSystem.isLinked(discordId);
      expect(isLinked).toBe(true);
    });

    it('should throw error if Kick username already linked to different account', async () => {
      const discordId1 = '111111111';
      const discordId2 = '222222222';
      const kickUsername = 'testuser';

      // Link first account
      await linkingSystem.completeLink(discordId1, kickUsername);

      // Try to link same Kick username to different Discord account
      await expect(
        linkingSystem.completeLink(discordId2, kickUsername)
      ).rejects.toThrow();
    });

    it('should allow relinking same accounts', async () => {
      const discordId = '123456789';
      const kickUsername = 'testuser';

      await linkingSystem.completeLink(discordId, kickUsername);
      await linkingSystem.completeLink(discordId, kickUsername);

      const isLinked = await linkingSystem.isLinked(discordId);
      expect(isLinked).toBe(true);
    });
  });

  describe('unlinkAccounts', () => {
    it('should unlink Discord user from Kick username', async () => {
      const discordId = '123456789';
      const kickUsername = 'testuser';

      await linkingSystem.completeLink(discordId, kickUsername);
      await linkingSystem.unlinkAccounts(discordId);

      expect(mockUserRepository.unlinkKickUsername).toHaveBeenCalledWith(discordId);

      const isLinked = await linkingSystem.isLinked(discordId);
      expect(isLinked).toBe(false);
    });
  });

  describe('isLinked', () => {
    it('should return true for linked accounts', async () => {
      const discordId = '123456789';
      const kickUsername = 'testuser';

      await linkingSystem.completeLink(discordId, kickUsername);

      const isLinked = await linkingSystem.isLinked(discordId);
      expect(isLinked).toBe(true);
    });

    it('should return false for unlinked accounts', async () => {
      const discordId = '123456789';

      const isLinked = await linkingSystem.isLinked(discordId);
      expect(isLinked).toBe(false);
    });
  });

  describe('getKickUsername', () => {
    it('should return Kick username for linked Discord user', async () => {
      const discordId = '123456789';
      const kickUsername = 'testuser';

      await linkingSystem.completeLink(discordId, kickUsername);

      const result = await linkingSystem.getKickUsername(discordId);
      expect(result).toBe(kickUsername);
    });

    it('should return null for unlinked Discord user', async () => {
      const discordId = '123456789';

      const result = await linkingSystem.getKickUsername(discordId);
      expect(result).toBeNull();
    });
  });

  describe('getDiscordId', () => {
    it('should return Discord ID for linked Kick username', async () => {
      const discordId = '123456789';
      const kickUsername = 'testuser';

      await linkingSystem.completeLink(discordId, kickUsername);

      const result = await linkingSystem.getDiscordId(kickUsername);
      expect(result).toBe(discordId);
    });

    it('should return null for unlinked Kick username', async () => {
      const kickUsername = 'testuser';

      const result = await linkingSystem.getDiscordId(kickUsername);
      expect(result).toBeNull();
    });
  });

  describe('processVerificationMessage', () => {
    it('should return null for non-verification messages', async () => {
      const message: KickChatMessage = {
        id: '1',
        username: 'testuser',
        content: 'Hello world',
        timestamp: new Date(),
        badges: [],
      };

      const result = await linkingSystem.processVerificationMessage(message);
      expect(result).toBeNull();
    });

    it('should return error for invalid command format', async () => {
      const message: KickChatMessage = {
        id: '1',
        username: 'testuser',
        content: '!verify',
        timestamp: new Date(),
        badges: [],
      };

      const result = await linkingSystem.processVerificationMessage(message);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(false);
      expect(result?.error).toContain('Invalid command format');
    });

    it('should return error for invalid token', async () => {
      const message: KickChatMessage = {
        id: '1',
        username: 'testuser',
        content: '!verify INVALID',
        timestamp: new Date(),
        badges: [],
      };

      const result = await linkingSystem.processVerificationMessage(message);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(false);
      expect(result?.error).toContain('Invalid or expired token');
    });

    it('should complete linking for valid token', async () => {
      const discordId = '123456789';
      const kickUsername = 'testuser';
      const linkToken = await linkingSystem.startLinking(discordId);

      const message: KickChatMessage = {
        id: '1',
        username: kickUsername,
        content: `!verify ${linkToken.token}`,
        timestamp: new Date(),
        badges: [],
      };

      const result = await linkingSystem.processVerificationMessage(message);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.discordId).toBe(discordId);
      expect(result?.kickUsername).toBe(kickUsername);

      const isLinked = await linkingSystem.isLinked(discordId);
      expect(isLinked).toBe(true);
    });

    it('should handle case-insensitive tokens', async () => {
      const discordId = '123456789';
      const kickUsername = 'testuser';
      const linkToken = await linkingSystem.startLinking(discordId);

      const message: KickChatMessage = {
        id: '1',
        username: kickUsername,
        content: `!verify ${linkToken.token.toLowerCase()}`,
        timestamp: new Date(),
        badges: [],
      };

      const result = await linkingSystem.processVerificationMessage(message);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
    });

    it('should handle whitespace in command', async () => {
      const discordId = '123456789';
      const kickUsername = 'testuser';
      const linkToken = await linkingSystem.startLinking(discordId);

      const message: KickChatMessage = {
        id: '1',
        username: kickUsername,
        content: `  !verify   ${linkToken.token}  `,
        timestamp: new Date(),
        badges: [],
      };

      const result = await linkingSystem.processVerificationMessage(message);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should remove expired tokens', async () => {
      const discordId = '123456789';
      const linkToken = await linkingSystem.startLinking(discordId);

      // Manually expire the token
      linkToken.expiresAt = new Date(Date.now() - 1000);

      await linkingSystem.cleanupExpiredTokens();

      const verifiedDiscordId = await linkingSystem.verifyToken(linkToken.token);
      expect(verifiedDiscordId).toBeNull();
    });

    it('should keep valid tokens', async () => {
      const discordId = '123456789';
      const linkToken = await linkingSystem.startLinking(discordId);

      await linkingSystem.cleanupExpiredTokens();

      const verifiedDiscordId = await linkingSystem.verifyToken(linkToken.token);
      expect(verifiedDiscordId).toBe(discordId);
    });
  });
});
