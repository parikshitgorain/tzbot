/**
 * @file channel-access.test.ts
 * @description Unit tests for channel access enforcement
 * @module tests/unit/moderation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IDiscordClient } from '@/core/discord/client.js';
import type { ViolationRepository } from '@/core/database/repositories/ViolationRepository.js';
import { ViolationType } from '@/types/models.js';
import type { Message, GuildMember, User, TextChannel, Collection } from 'discord.js';

// Mock the logger before importing the module
vi.mock('@/core/logger/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  logError: vi.fn(),
}));

// Now import the module that uses the logger
const { ChannelAccessEnforcer } = await import('@/moderation/channel-access.js');

// Mock Discord client
const createMockDiscordClient = (): IDiscordClient => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  isConnected: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  sendMessage: vi.fn(),
  deleteMessage: vi.fn(),
  banUser: vi.fn(),
  kickUser: vi.fn(),
  timeoutUser: vi.fn(),
  addRole: vi.fn(),
  removeRole: vi.fn(),
  getGuild: vi.fn(),
  getMember: vi.fn(),
});

// Mock violation repository
const createMockViolationRepo = (): ViolationRepository => ({
  save: vi.fn(),
  getCount: vi.fn(),
  getLatest: vi.fn(),
  clear: vi.fn(),
  getAll: vi.fn(),
});

// Mock Discord message
const createMockMessage = (
  channelId: string,
  userId: string,
  content: string,
  guildId?: string
): Message => {
  const mockUser: Partial<User> = {
    id: userId,
    send: vi.fn(),
  };

  const mockChannel: Partial<TextChannel> = {
    id: channelId,
    name: 'test-channel',
  };

  return {
    channelId,
    id: 'message-123',
    author: mockUser as User,
    content,
    guildId: guildId || 'guild-123',
    channel: mockChannel as TextChannel,
  } as Message;
};

// Mock Discord guild member
const createMockMember = (userId: string, roleIds: string[]): GuildMember => {
  const roleCache = new Map();
  roleIds.forEach((roleId) => {
    roleCache.set(roleId, { id: roleId });
  });

  return {
    id: userId,
    roles: {
      cache: roleCache as Collection<string, any>,
    },
  } as GuildMember;
};

describe('ChannelAccessEnforcer', () => {
  let enforcer: ChannelAccessEnforcer;
  let mockClient: IDiscordClient;
  let mockViolationRepo: ViolationRepository;
  const moderatorRoleId = 'mod-role-123';
  const whitelistRoleId = 'whitelist-role-456';
  const readOnlyChannelId = 'readonly-channel-789';

  beforeEach(() => {
    mockClient = createMockDiscordClient();
    mockViolationRepo = createMockViolationRepo();

    enforcer = new ChannelAccessEnforcer(
      mockClient,
      mockViolationRepo,
      moderatorRoleId,
      [
        {
          channelId: readOnlyChannelId,
          whitelistRoleIds: [whitelistRoleId],
        },
      ]
    );
  });

  describe('isReadOnlyChannel', () => {
    it('should return true for configured read-only channels', () => {
      expect(enforcer.isReadOnlyChannel(readOnlyChannelId)).toBe(true);
    });

    it('should return false for non-read-only channels', () => {
      expect(enforcer.isReadOnlyChannel('other-channel-999')).toBe(false);
    });
  });

  describe('checkAccess', () => {
    it('should allow messages in non-read-only channels', async () => {
      const message = createMockMessage('normal-channel', 'user-123', 'Hello');
      const result = await enforcer.checkAccess(message);

      expect(result.isAuthorized).toBe(true);
    });

    it('should allow moderators to post in read-only channels', async () => {
      const message = createMockMessage(readOnlyChannelId, 'mod-user', 'Announcement');
      const mockMember = createMockMember('mod-user', [moderatorRoleId]);

      vi.mocked(mockClient.getMember).mockResolvedValue(mockMember);

      const result = await enforcer.checkAccess(message);

      expect(result.isAuthorized).toBe(true);
      expect(mockClient.getMember).toHaveBeenCalledWith('guild-123', 'mod-user');
    });

    it('should allow whitelisted users to post in read-only channels', async () => {
      const message = createMockMessage(readOnlyChannelId, 'whitelist-user', 'Message');
      const mockMember = createMockMember('whitelist-user', [whitelistRoleId]);

      vi.mocked(mockClient.getMember).mockResolvedValue(mockMember);

      const result = await enforcer.checkAccess(message);

      expect(result.isAuthorized).toBe(true);
    });

    it('should deny unauthorized users in read-only channels', async () => {
      const message = createMockMessage(readOnlyChannelId, 'regular-user', 'Message');
      const mockMember = createMockMember('regular-user', ['some-other-role']);

      vi.mocked(mockClient.getMember).mockResolvedValue(mockMember);

      const result = await enforcer.checkAccess(message);

      expect(result.isAuthorized).toBe(false);
      expect(result.reason).toContain('do not have permission');
    });

    it('should deny if user is not found in guild', async () => {
      const message = createMockMessage(readOnlyChannelId, 'unknown-user', 'Message');

      vi.mocked(mockClient.getMember).mockResolvedValue(null);

      const result = await enforcer.checkAccess(message);

      expect(result.isAuthorized).toBe(false);
      expect(result.reason).toContain('not found');
    });

    it('should deny if message has no guild (DM)', async () => {
      const message = createMockMessage(readOnlyChannelId, 'user-123', 'Message', undefined);
      message.guildId = null;

      const result = await enforcer.checkAccess(message);

      expect(result.isAuthorized).toBe(false);
      expect(result.reason).toContain('DM');
    });
  });

  describe('enforceAccess', () => {
    it('should not delete messages from authorized users', async () => {
      const message = createMockMessage(readOnlyChannelId, 'mod-user', 'Announcement');
      const mockMember = createMockMember('mod-user', [moderatorRoleId]);

      vi.mocked(mockClient.getMember).mockResolvedValue(mockMember);

      const wasDeleted = await enforcer.enforceAccess(message);

      expect(wasDeleted).toBe(false);
      expect(mockClient.deleteMessage).not.toHaveBeenCalled();
    });

    it('should delete messages from unauthorized users', async () => {
      const message = createMockMessage(readOnlyChannelId, 'regular-user', 'Spam message');
      const mockMember = createMockMember('regular-user', []);

      vi.mocked(mockClient.getMember).mockResolvedValue(mockMember);
      vi.mocked(mockClient.deleteMessage).mockResolvedValue();

      const wasDeleted = await enforcer.enforceAccess(message);

      expect(wasDeleted).toBe(true);
      expect(mockClient.deleteMessage).toHaveBeenCalledWith(
        readOnlyChannelId,
        'message-123'
      );
    });

    it('should log violation when deleting unauthorized message', async () => {
      const message = createMockMessage(readOnlyChannelId, 'regular-user', 'Test message');
      const mockMember = createMockMember('regular-user', []);

      vi.mocked(mockClient.getMember).mockResolvedValue(mockMember);
      vi.mocked(mockClient.deleteMessage).mockResolvedValue();

      await enforcer.enforceAccess(message);

      expect(mockViolationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'regular-user',
          type: ViolationType.UNAUTHORIZED_POST,
          severity: 1,
          details: expect.stringContaining('Unauthorized post'),
        })
      );
    });

    it('should send DM notification when deleting message', async () => {
      const mockUser = {
        id: 'regular-user',
        send: vi.fn().mockResolvedValue(undefined),
      };

      const message = createMockMessage(readOnlyChannelId, 'regular-user', 'Test');
      message.author = mockUser as User;

      const mockMember = createMockMember('regular-user', []);

      vi.mocked(mockClient.getMember).mockResolvedValue(mockMember);
      vi.mocked(mockClient.deleteMessage).mockResolvedValue();

      await enforcer.enforceAccess(message);

      expect(mockUser.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Message Deleted'),
        })
      );
    });

    it('should handle DM send failure gracefully', async () => {
      const mockUser = {
        id: 'regular-user',
        send: vi.fn().mockRejectedValue(new Error('Cannot send DM')),
      };

      const message = createMockMessage(readOnlyChannelId, 'regular-user', 'Test');
      message.author = mockUser as User;

      const mockMember = createMockMember('regular-user', []);

      vi.mocked(mockClient.getMember).mockResolvedValue(mockMember);
      vi.mocked(mockClient.deleteMessage).mockResolvedValue();

      // Should not throw
      const wasDeleted = await enforcer.enforceAccess(message);

      expect(wasDeleted).toBe(true);
      expect(mockClient.deleteMessage).toHaveBeenCalled();
    });

    it('should handle deletion failure gracefully', async () => {
      const message = createMockMessage(readOnlyChannelId, 'regular-user', 'Test');
      const mockMember = createMockMember('regular-user', []);

      vi.mocked(mockClient.getMember).mockResolvedValue(mockMember);
      vi.mocked(mockClient.deleteMessage).mockRejectedValue(
        new Error('Missing permissions')
      );

      const wasDeleted = await enforcer.enforceAccess(message);

      expect(wasDeleted).toBe(false);
    });
  });

  describe('configuration management', () => {
    it('should add new read-only channel', () => {
      const newChannelId = 'new-channel-999';
      enforcer.addReadOnlyChannel({
        channelId: newChannelId,
        whitelistRoleIds: ['role-1', 'role-2'],
      });

      expect(enforcer.isReadOnlyChannel(newChannelId)).toBe(true);
      expect(enforcer.getWhitelistRoles(newChannelId)).toEqual(['role-1', 'role-2']);
    });

    it('should remove read-only channel', () => {
      enforcer.removeReadOnlyChannel(readOnlyChannelId);

      expect(enforcer.isReadOnlyChannel(readOnlyChannelId)).toBe(false);
    });

    it('should update whitelist roles', () => {
      const newRoles = ['new-role-1', 'new-role-2'];
      enforcer.updateWhitelistRoles(readOnlyChannelId, newRoles);

      expect(enforcer.getWhitelistRoles(readOnlyChannelId)).toEqual(newRoles);
    });

    it('should get all read-only channels', () => {
      const channels = enforcer.getReadOnlyChannels();

      expect(channels).toHaveLength(1);
      expect(channels[0].channelId).toBe(readOnlyChannelId);
    });

    it('should return empty array for non-existent channel whitelist', () => {
      const roles = enforcer.getWhitelistRoles('non-existent-channel');

      expect(roles).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle user with multiple roles including whitelist', async () => {
      const message = createMockMessage(readOnlyChannelId, 'multi-role-user', 'Message');
      const mockMember = createMockMember('multi-role-user', [
        'role-1',
        whitelistRoleId,
        'role-2',
      ]);

      vi.mocked(mockClient.getMember).mockResolvedValue(mockMember);

      const result = await enforcer.checkAccess(message);

      expect(result.isAuthorized).toBe(true);
    });

    it('should handle user with both moderator and whitelist roles', async () => {
      const message = createMockMessage(readOnlyChannelId, 'super-user', 'Message');
      const mockMember = createMockMember('super-user', [
        moderatorRoleId,
        whitelistRoleId,
      ]);

      vi.mocked(mockClient.getMember).mockResolvedValue(mockMember);

      const result = await enforcer.checkAccess(message);

      expect(result.isAuthorized).toBe(true);
    });

    it('should handle empty message content', async () => {
      const message = createMockMessage(readOnlyChannelId, 'regular-user', '');
      const mockMember = createMockMember('regular-user', []);

      vi.mocked(mockClient.getMember).mockResolvedValue(mockMember);
      vi.mocked(mockClient.deleteMessage).mockResolvedValue();

      const wasDeleted = await enforcer.enforceAccess(message);

      expect(wasDeleted).toBe(true);
    });

    it('should handle very long message content', async () => {
      const longMessage = 'A'.repeat(2000);
      const message = createMockMessage(readOnlyChannelId, 'regular-user', longMessage);
      const mockMember = createMockMember('regular-user', []);

      vi.mocked(mockClient.getMember).mockResolvedValue(mockMember);
      vi.mocked(mockClient.deleteMessage).mockResolvedValue();

      await enforcer.enforceAccess(message);

      expect(mockViolationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.stringMatching(/^Unauthorized post/),
        })
      );
    });
  });
});
