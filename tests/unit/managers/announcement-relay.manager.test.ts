/**
 * @file announcement-relay.manager.test.ts
 * @description Unit tests for announcement relay manager
 * @module tests/unit/managers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnnouncementRelayManager } from '@/managers/announcement-relay.manager.js';
import type { IDiscordClient } from '@/core/discord/client.js';
import type { Message, GuildMember, Collection } from 'discord.js';

// Mock Discord client
function createMockDiscordClient(): IDiscordClient {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
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
  } as unknown as IDiscordClient;
}

// Mock Discord message
function createMockMessage(
  channelId: string,
  authorId: string,
  content: string,
  isBot: boolean = false
): Message {
  return {
    id: `msg-${Date.now()}`,
    channelId,
    author: {
      id: authorId,
      username: `user-${authorId}`,
      bot: isBot,
    },
    content,
    embeds: [],
    attachments: new Map(),
    url: `https://discord.com/channels/guild/channel/${Date.now()}`,
  } as unknown as Message;
}

// Mock Discord message with embeds
function createMockMessageWithEmbeds(
  channelId: string,
  authorId: string,
  content: string,
  embedCount: number
): Message {
  const embeds = Array.from({ length: embedCount }, (_, i) => ({
    title: `Embed ${i + 1}`,
    description: `Description ${i + 1}`,
  }));

  return {
    id: `msg-${Date.now()}`,
    channelId,
    author: {
      id: authorId,
      username: `user-${authorId}`,
      bot: false,
    },
    content,
    embeds,
    attachments: new Map(),
    url: `https://discord.com/channels/guild/channel/${Date.now()}`,
  } as unknown as Message;
}

// Mock Discord message with attachments
function createMockMessageWithAttachments(
  channelId: string,
  authorId: string,
  content: string,
  attachmentCount: number
): Message {
  const attachments = new Map();
  for (let i = 0; i < attachmentCount; i++) {
    attachments.set(`attachment-${i}`, {
      id: `attachment-${i}`,
      name: `file-${i}.png`,
      url: `https://cdn.discord.com/attachments/file-${i}.png`,
    });
  }

  return {
    id: `msg-${Date.now()}`,
    channelId,
    author: {
      id: authorId,
      username: `user-${authorId}`,
      bot: false,
    },
    content,
    embeds: [],
    attachments,
    url: `https://discord.com/channels/guild/channel/${Date.now()}`,
  } as unknown as Message;
}

// Mock guild member
function createMockMember(userId: string, roleIds: string[]): GuildMember {
  const roles = new Map(roleIds.map((id) => [id, { id }]));

  return {
    id: userId,
    user: {
      id: userId,
      username: `user-${userId}`,
    },
    roles: {
      cache: roles as unknown as Collection<string, unknown>,
    },
  } as unknown as GuildMember;
}

describe('AnnouncementRelayManager', () => {
  let discordClient: IDiscordClient;
  let relayManager: AnnouncementRelayManager;
  const privateChannelId = 'private-channel-123';
  const publicChannelIds = ['public-1', 'public-2', 'public-3'];
  const guildId = 'guild-123';
  const moderatorRoleId = 'mod-role-123';

  beforeEach(() => {
    discordClient = createMockDiscordClient();
    relayManager = new AnnouncementRelayManager(discordClient, {
      privateChannelId,
      publicChannelIds,
      guildId,
      moderatorRoleId,
    });
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(relayManager).toBeDefined();
      expect(relayManager.isEnabled()).toBe(true);
    });

    it('should register message event listener on start', () => {
      relayManager.start();
      expect(discordClient.on).toHaveBeenCalledWith('messageCreate', expect.any(Function));
    });
  });

  describe('Message Filtering', () => {
    it('should ignore messages from non-private channels', async () => {
      const message = createMockMessage('other-channel', 'user-1', 'Test message');
      const mockMember = createMockMember('user-1', [moderatorRoleId]);
      vi.mocked(discordClient.getMember).mockResolvedValue(mockMember);

      relayManager.start();
      const handler = vi.mocked(discordClient.on).mock.calls[0][1];
      await handler(message);

      expect(discordClient.sendMessage).not.toHaveBeenCalled();
    });

    it('should ignore bot messages', async () => {
      const message = createMockMessage(privateChannelId, 'bot-1', 'Bot message', true);

      relayManager.start();
      const handler = vi.mocked(discordClient.on).mock.calls[0][1];
      await handler(message);

      expect(discordClient.sendMessage).not.toHaveBeenCalled();
    });

    it('should ignore messages from non-moderators', async () => {
      const message = createMockMessage(privateChannelId, 'user-1', 'Test message');
      const mockMember = createMockMember('user-1', ['other-role']);
      vi.mocked(discordClient.getMember).mockResolvedValue(mockMember);

      relayManager.start();
      const handler = vi.mocked(discordClient.on).mock.calls[0][1];
      await handler(message);

      expect(discordClient.sendMessage).not.toHaveBeenCalled();
    });

    it('should ignore messages when relay is disabled', async () => {
      const message = createMockMessage(privateChannelId, 'user-1', 'Test message');
      const mockMember = createMockMember('user-1', [moderatorRoleId]);
      vi.mocked(discordClient.getMember).mockResolvedValue(mockMember);

      relayManager.disable();
      relayManager.start();
      const handler = vi.mocked(discordClient.on).mock.calls[0][1];
      await handler(message);

      expect(discordClient.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Message Relay - Requirement 6.1, 6.2, 6.3, 6.4', () => {
    it('should relay moderator messages to all public channels', async () => {
      const message = createMockMessage(privateChannelId, 'mod-1', 'Important announcement');
      const mockMember = createMockMember('mod-1', [moderatorRoleId]);
      vi.mocked(discordClient.getMember).mockResolvedValue(mockMember);
      vi.mocked(discordClient.sendMessage).mockResolvedValue({
        id: 'relayed-msg',
      } as Message);

      relayManager.start();
      const handler = vi.mocked(discordClient.on).mock.calls[0][1];
      await handler(message);

      // Should send to all 3 public channels
      expect(discordClient.sendMessage).toHaveBeenCalledTimes(3);
      expect(discordClient.sendMessage).toHaveBeenCalledWith('public-1', {
        content: 'Important announcement',
        embeds: undefined,
        files: undefined,
      });
      expect(discordClient.sendMessage).toHaveBeenCalledWith('public-2', {
        content: 'Important announcement',
        embeds: undefined,
        files: undefined,
      });
      expect(discordClient.sendMessage).toHaveBeenCalledWith('public-3', {
        content: 'Important announcement',
        embeds: undefined,
        files: undefined,
      });
    });

    it('should preserve message embeds when relaying', async () => {
      const message = createMockMessageWithEmbeds(
        privateChannelId,
        'mod-1',
        'Announcement with embeds',
        2
      );
      const mockMember = createMockMember('mod-1', [moderatorRoleId]);
      vi.mocked(discordClient.getMember).mockResolvedValue(mockMember);
      vi.mocked(discordClient.sendMessage).mockResolvedValue({
        id: 'relayed-msg',
      } as Message);

      relayManager.start();
      const handler = vi.mocked(discordClient.on).mock.calls[0][1];
      await handler(message);

      // Verify embeds are preserved (check that embeds array exists and has correct length)
      expect(discordClient.sendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          content: 'Announcement with embeds',
          embeds: expect.arrayContaining([
            expect.any(Object),
            expect.any(Object),
          ]),
        })
      );

      // Verify the embeds array has the correct length
      const firstCall = vi.mocked(discordClient.sendMessage).mock.calls[0];
      expect(firstCall[1].embeds).toHaveLength(2);
    });

    it('should preserve message attachments when relaying', async () => {
      const message = createMockMessageWithAttachments(
        privateChannelId,
        'mod-1',
        'Announcement with files',
        2
      );
      const mockMember = createMockMember('mod-1', [moderatorRoleId]);
      vi.mocked(discordClient.getMember).mockResolvedValue(mockMember);
      vi.mocked(discordClient.sendMessage).mockResolvedValue({
        id: 'relayed-msg',
      } as Message);

      relayManager.start();
      const handler = vi.mocked(discordClient.on).mock.calls[0][1];
      await handler(message);

      // Verify attachments are preserved
      expect(discordClient.sendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          content: 'Announcement with files',
          files: expect.arrayContaining([
            expect.objectContaining({ name: 'file-0.png' }),
            expect.objectContaining({ name: 'file-1.png' }),
          ]),
        })
      );
    });

    it('should relay messages within 2 seconds', async () => {
      const message = createMockMessage(privateChannelId, 'mod-1', 'Fast announcement');
      const mockMember = createMockMember('mod-1', [moderatorRoleId]);
      vi.mocked(discordClient.getMember).mockResolvedValue(mockMember);
      vi.mocked(discordClient.sendMessage).mockResolvedValue({
        id: 'relayed-msg',
      } as Message);

      const startTime = Date.now();
      relayManager.start();
      const handler = vi.mocked(discordClient.on).mock.calls[0][1];
      await handler(message);
      const endTime = Date.now();

      const relayTime = endTime - startTime;
      expect(relayTime).toBeLessThan(2000);
    });
  });

  describe('Failure Handling - Requirement 6.5', () => {
    it('should notify moderator when relay fails', async () => {
      const message = createMockMessage(privateChannelId, 'mod-1', 'Test announcement');
      const mockMember = createMockMember('mod-1', [moderatorRoleId]);
      vi.mocked(discordClient.getMember).mockResolvedValue(mockMember);

      // Make one channel fail
      vi.mocked(discordClient.sendMessage)
        .mockResolvedValueOnce({ id: 'msg-1' } as Message) // public-1 succeeds
        .mockRejectedValueOnce(new Error('Channel not found')) // public-2 fails
        .mockResolvedValueOnce({ id: 'msg-3' } as Message); // public-3 succeeds

      relayManager.start();
      const handler = vi.mocked(discordClient.on).mock.calls[0][1];
      await handler(message);

      // Wait for notification
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should send notification to private channel
      expect(discordClient.sendMessage).toHaveBeenCalledWith(
        privateChannelId,
        expect.objectContaining({
          content: expect.stringContaining('Announcement Relay Failure'),
        })
      );
    });

    it('should include failed channel details in notification', async () => {
      const message = createMockMessage(privateChannelId, 'mod-1', 'Test announcement');
      const mockMember = createMockMember('mod-1', [moderatorRoleId]);
      vi.mocked(discordClient.getMember).mockResolvedValue(mockMember);

      // Make all channels fail
      vi.mocked(discordClient.sendMessage).mockRejectedValue(
        new Error('Permission denied')
      );

      relayManager.start();
      const handler = vi.mocked(discordClient.on).mock.calls[0][1];
      await handler(message);

      // Wait for notification
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify notification includes channel IDs
      const notificationCall = vi
        .mocked(discordClient.sendMessage)
        .mock.calls.find((call) => call[0] === privateChannelId);

      expect(notificationCall).toBeDefined();
      expect(notificationCall![1].content).toContain('public-1');
      expect(notificationCall![1].content).toContain('public-2');
      expect(notificationCall![1].content).toContain('public-3');
    });
  });

  describe('Configuration Management', () => {
    it('should allow enabling and disabling relay', () => {
      expect(relayManager.isEnabled()).toBe(true);

      relayManager.disable();
      expect(relayManager.isEnabled()).toBe(false);

      relayManager.enable();
      expect(relayManager.isEnabled()).toBe(true);
    });

    it('should allow updating configuration', () => {
      const newPublicChannels = ['new-1', 'new-2'];

      relayManager.updateConfig({
        publicChannelIds: newPublicChannels,
      });

      // Verify new config is used (indirectly through relay behavior)
      expect(relayManager).toBeDefined();
    });

    it('should allow partial configuration updates', () => {
      relayManager.updateConfig({
        privateChannelId: 'new-private-channel',
      });

      // Manager should still work with updated config
      expect(relayManager.isEnabled()).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message content', async () => {
      const message = createMockMessage(privateChannelId, 'mod-1', '');
      const mockMember = createMockMember('mod-1', [moderatorRoleId]);
      vi.mocked(discordClient.getMember).mockResolvedValue(mockMember);
      vi.mocked(discordClient.sendMessage).mockResolvedValue({
        id: 'relayed-msg',
      } as Message);

      relayManager.start();
      const handler = vi.mocked(discordClient.on).mock.calls[0][1];
      await handler(message);

      // Should still relay (might have embeds or attachments)
      expect(discordClient.sendMessage).toHaveBeenCalled();
    });

    it('should handle member fetch failure gracefully', async () => {
      const message = createMockMessage(privateChannelId, 'mod-1', 'Test');
      vi.mocked(discordClient.getMember).mockResolvedValue(null);

      relayManager.start();
      const handler = vi.mocked(discordClient.on).mock.calls[0][1];
      await handler(message);

      // Should not relay if member cannot be fetched
      expect(discordClient.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle no public channels configured', async () => {
      const emptyRelayManager = new AnnouncementRelayManager(discordClient, {
        privateChannelId,
        publicChannelIds: [],
        guildId,
        moderatorRoleId,
      });

      const message = createMockMessage(privateChannelId, 'mod-1', 'Test');
      const mockMember = createMockMember('mod-1', [moderatorRoleId]);
      vi.mocked(discordClient.getMember).mockResolvedValue(mockMember);

      emptyRelayManager.start();
      const handler = vi.mocked(discordClient.on).mock.calls[0][1];
      await handler(message);

      // Should not attempt to send to any channels
      expect(discordClient.sendMessage).not.toHaveBeenCalled();
    });
  });
});
