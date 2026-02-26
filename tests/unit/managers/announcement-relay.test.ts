/**
 * @file announcement-relay.test.ts
 * @description Tests for announcement relay manager with !embed support
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnnouncementRelayManager } from '@/managers/announcement-relay.manager.js';
import type { IDiscordClient } from '@/core/discord/client.js';
import type { Message, GuildMember, Collection } from 'discord.js';

describe('AnnouncementRelayManager - !embed feature', () => {
  let mockDiscordClient: IDiscordClient;
  let relayManager: AnnouncementRelayManager;
  const config = {
    privateChannelId: 'private-123',
    publicChannelIds: ['public-456', 'public-789'],
    guildId: 'guild-123',
    moderatorRoleId: 'mod-role-123',
  };

  beforeEach(() => {
    // Mock Discord client
    mockDiscordClient = {
      on: vi.fn(),
      off: vi.fn(),
      sendMessage: vi.fn().mockResolvedValue({ id: 'sent-message-123' }),
      getMember: vi.fn().mockResolvedValue({
        guild: {
          ownerId: 'different-user-id',
        },
        permissions: {
          has: vi.fn().mockReturnValue(false),
        },
        roles: {
          cache: {
            has: vi.fn((roleId: string) => roleId === config.moderatorRoleId),
            keys: vi.fn().mockReturnValue([config.moderatorRoleId]),
          },
        },
      } as unknown as GuildMember),
    } as unknown as IDiscordClient;

    relayManager = new AnnouncementRelayManager(mockDiscordClient, config);
  });

  it('should convert !embed message to Discord embed', async () => {
    const mockMessage = {
      id: 'msg-123',
      channelId: config.privateChannelId,
      author: {
        id: 'user-123',
        username: 'TestModerator',
        displayAvatarURL: vi.fn().mockReturnValue('https://example.com/avatar.png'),
        bot: false,
      },
      content: '!embed This is an important announcement!',
      embeds: [],
      attachments: new Map(),
      url: 'https://discord.com/channels/123/456/789',
    } as unknown as Message;

    relayManager.start();
    
    // Trigger message handler
    const messageHandler = (mockDiscordClient.on as any).mock.calls[0][1];
    await messageHandler(mockMessage);

    // Verify sendMessage was called with embed
    expect(mockDiscordClient.sendMessage).toHaveBeenCalledTimes(2); // Two public channels
    
    const firstCall = (mockDiscordClient.sendMessage as any).mock.calls[0];
    expect(firstCall[0]).toBe('public-456');
    expect(firstCall[1].embeds).toBeDefined();
    expect(firstCall[1].embeds[0].data.description).toBe('This is an important announcement!');
    expect(firstCall[1].embeds[0].data.footer?.text).toContain('TestModerator');
  });

  it('should handle !embed with multiline content', async () => {
    const mockMessage = {
      id: 'msg-124',
      channelId: config.privateChannelId,
      author: {
        id: 'user-123',
        username: 'TestModerator',
        displayAvatarURL: vi.fn().mockReturnValue('https://example.com/avatar.png'),
        bot: false,
      },
      content: '!embed Line 1\nLine 2\nLine 3',
      embeds: [],
      attachments: new Map(),
      url: 'https://discord.com/channels/123/456/790',
    } as unknown as Message;

    relayManager.start();
    
    const messageHandler = (mockDiscordClient.on as any).mock.calls[0][1];
    await messageHandler(mockMessage);

    const firstCall = (mockDiscordClient.sendMessage as any).mock.calls[0];
    expect(firstCall[1].embeds[0].data.description).toBe('Line 1\nLine 2\nLine 3');
  });

  it('should preserve attachments with !embed', async () => {
    const mockAttachment = {
      url: 'https://example.com/image.png',
      name: 'image.png',
    };

    const mockMessage = {
      id: 'msg-125',
      channelId: config.privateChannelId,
      author: {
        id: 'user-123',
        username: 'TestModerator',
        displayAvatarURL: vi.fn().mockReturnValue('https://example.com/avatar.png'),
        bot: false,
      },
      content: '!embed Check out this image!',
      embeds: [],
      attachments: new Map([['att-1', mockAttachment]]) as unknown as Collection<string, any>,
      url: 'https://discord.com/channels/123/456/791',
    } as unknown as Message;

    relayManager.start();
    
    const messageHandler = (mockDiscordClient.on as any).mock.calls[0][1];
    await messageHandler(mockMessage);

    const firstCall = (mockDiscordClient.sendMessage as any).mock.calls[0];
    expect(firstCall[1].files).toBeDefined();
    expect(firstCall[1].files[0].attachment).toBe('https://example.com/image.png');
  });

  it('should handle empty !embed gracefully', async () => {
    const mockMessage = {
      id: 'msg-126',
      channelId: config.privateChannelId,
      author: {
        id: 'user-123',
        username: 'TestModerator',
        displayAvatarURL: vi.fn().mockReturnValue('https://example.com/avatar.png'),
        bot: false,
      },
      content: '!embed',
      embeds: [],
      attachments: new Map(),
      url: 'https://discord.com/channels/123/456/792',
    } as unknown as Message;

    relayManager.start();
    
    const messageHandler = (mockDiscordClient.on as any).mock.calls[0][1];
    await messageHandler(mockMessage);

    const firstCall = (mockDiscordClient.sendMessage as any).mock.calls[0];
    expect(firstCall[1].content).toBe('⚠️ Empty embed content');
  });

  it('should not trigger !embed for regular messages', async () => {
    const mockMessage = {
      id: 'msg-127',
      channelId: config.privateChannelId,
      author: {
        id: 'user-123',
        username: 'TestModerator',
        bot: false,
      },
      content: 'This is a regular message',
      embeds: [],
      attachments: new Map(),
      url: 'https://discord.com/channels/123/456/793',
    } as unknown as Message;

    relayManager.start();
    
    const messageHandler = (mockDiscordClient.on as any).mock.calls[0][1];
    await messageHandler(mockMessage);

    // Verify sendMessage was called for regular message relay
    expect(mockDiscordClient.sendMessage).toHaveBeenCalled();
    
    const firstCall = (mockDiscordClient.sendMessage as any).mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(firstCall[1].content).toBe('This is a regular message');
    expect(firstCall[1].embeds).toBeUndefined();
  });
});
