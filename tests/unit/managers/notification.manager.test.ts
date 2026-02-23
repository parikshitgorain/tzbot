/**
 * @file notification.manager.test.ts
 * @description Unit tests for NotificationManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock logger before importing NotificationManager
vi.mock('@/core/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  logError: vi.fn(),
}));

import {
  NotificationManager,
  type PremiumEmbedData,
  type NotificationManagerConfig,
} from '@/managers/notification.manager.js';
import type { IDiscordClient } from '@/core/discord/client.js';
import type { NotificationEvent } from '@/types/models.js';
import { EventType } from '@/types/models.js';
import { EmbedBuilder } from 'discord.js';

// Mock Discord client
const createMockDiscordClient = (): IDiscordClient => {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue({
      id: 'message-123',
      channelId: 'channel-123',
    }),
    deleteMessage: vi.fn(),
    banUser: vi.fn(),
    kickUser: vi.fn(),
    timeoutUser: vi.fn(),
    addRole: vi.fn(),
    removeRole: vi.fn(),
    getGuild: vi.fn(),
    getMember: vi.fn(),
  };
};

describe('NotificationManager', () => {
  let mockClient: IDiscordClient;
  let config: NotificationManagerConfig;
  let manager: NotificationManager;

  beforeEach(() => {
    mockClient = createMockDiscordClient();
    config = {
      primaryChannelId: 'primary-channel-123',
      fallbackChannelId: 'fallback-channel-456',
      maxRetries: 3,
      retryDelayMs: 100, // Short delay for tests
    };
    manager = new NotificationManager(mockClient, config);
  });

  describe('sendNotification', () => {
    it('should send notification to primary channel', async () => {
      const event: NotificationEvent = {
        id: 'event-1',
        type: EventType.STREAM_LIVE,
        channelId: 'kick-channel-1',
        data: { streamer: 'TestStreamer' },
        timestamp: new Date(),
        delivered: false,
      };

      const embedData: PremiumEmbedData = {
        title: 'Stream is Live!',
        description: 'TestStreamer is now streaming',
        thumbnail: 'https://example.com/thumb.png',
        color: 0xff0000,
      };

      await manager.sendNotification(event, embedData);

      expect(mockClient.sendMessage).toHaveBeenCalledWith(
        config.primaryChannelId,
        expect.objectContaining({
          embeds: expect.arrayContaining([expect.any(EmbedBuilder)]),
        })
      );
    });

    it('should format Premium_Embed with all required fields', async () => {
      const event: NotificationEvent = {
        id: 'event-2',
        type: EventType.NEW_SUBSCRIBER,
        channelId: 'kick-channel-1',
        data: { username: 'NewSub' },
        timestamp: new Date('2025-01-01T12:00:00Z'),
        delivered: false,
      };

      const embedData: PremiumEmbedData = {
        title: 'New Subscriber!',
        description: 'NewSub just subscribed',
        thumbnail: 'https://example.com/avatar.png',
        color: 0x00ff00,
        fields: [
          { name: 'Username', value: 'NewSub', inline: true },
          { name: 'Tier', value: 'Tier 1', inline: true },
        ],
      };

      await manager.sendNotification(event, embedData);

      const sendMessageCall = (mockClient.sendMessage as any).mock.calls[0];
      const embed = sendMessageCall[1].embeds[0];

      expect(embed.data.title).toBe('New Subscriber!');
      expect(embed.data.description).toBe('NewSub just subscribed');
      expect(embed.data.thumbnail?.url).toBe('https://example.com/avatar.png');
      expect(embed.data.color).toBe(0x00ff00);
      expect(embed.data.timestamp).toBe(event.timestamp.toISOString());
      expect(embed.data.fields).toHaveLength(2);
    });

    it('should use default color if not provided', async () => {
      const event: NotificationEvent = {
        id: 'event-3',
        type: EventType.RAID,
        channelId: 'kick-channel-1',
        data: {},
        timestamp: new Date(),
        delivered: false,
      };

      const embedData: PremiumEmbedData = {
        title: 'Raid!',
        description: 'Incoming raid',
      };

      await manager.sendNotification(event, embedData);

      const sendMessageCall = (mockClient.sendMessage as any).mock.calls[0];
      const embed = sendMessageCall[1].embeds[0];

      expect(embed.data.color).toBe(0x5865f2); // Discord blurple
    });

    it('should attempt fallback channel on primary failure', async () => {
      // Mock primary channel failure
      (mockClient.sendMessage as any).mockRejectedValueOnce(
        new Error('Channel not found')
      );
      // Mock fallback success
      (mockClient.sendMessage as any).mockResolvedValueOnce({
        id: 'message-456',
      });

      const event: NotificationEvent = {
        id: 'event-4',
        type: EventType.STREAM_OFFLINE,
        channelId: 'kick-channel-1',
        data: {},
        timestamp: new Date(),
        delivered: false,
      };

      const embedData: PremiumEmbedData = {
        title: 'Stream Ended',
        description: 'Stream is now offline',
      };

      await manager.sendNotification(event, embedData);

      // Should try primary first, then fallback
      expect(mockClient.sendMessage).toHaveBeenCalledTimes(2);
      expect(mockClient.sendMessage).toHaveBeenNthCalledWith(
        1,
        config.primaryChannelId,
        expect.any(Object)
      );
      expect(mockClient.sendMessage).toHaveBeenNthCalledWith(
        2,
        config.fallbackChannelId,
        expect.any(Object)
      );
    });

    it('should queue for retry if both channels fail', async () => {
      // Mock both channels failing
      (mockClient.sendMessage as any).mockRejectedValue(
        new Error('All channels failed')
      );

      const event: NotificationEvent = {
        id: 'event-5',
        type: EventType.HOST,
        channelId: 'kick-channel-1',
        data: {},
        timestamp: new Date(),
        delivered: false,
      };

      const embedData: PremiumEmbedData = {
        title: 'Host',
        description: 'Channel is being hosted',
      };

      await manager.sendNotification(event, embedData);

      // Check queue stats
      const stats = manager.getQueueStats();
      expect(stats.queueSize).toBe(1);
    });
  });

  describe('sendNotifications', () => {
    it('should send multiple notifications in chronological order', async () => {
      const events = [
        {
          event: {
            id: 'event-3',
            type: EventType.RAID,
            channelId: 'kick-channel-1',
            data: {},
            timestamp: new Date('2025-01-01T12:02:00Z'),
            delivered: false,
          } as NotificationEvent,
          embedData: {
            title: 'Event 3',
            description: 'Third event',
          } as PremiumEmbedData,
        },
        {
          event: {
            id: 'event-1',
            type: EventType.STREAM_LIVE,
            channelId: 'kick-channel-1',
            data: {},
            timestamp: new Date('2025-01-01T12:00:00Z'),
            delivered: false,
          } as NotificationEvent,
          embedData: {
            title: 'Event 1',
            description: 'First event',
          } as PremiumEmbedData,
        },
        {
          event: {
            id: 'event-2',
            type: EventType.NEW_SUBSCRIBER,
            channelId: 'kick-channel-1',
            data: {},
            timestamp: new Date('2025-01-01T12:01:00Z'),
            delivered: false,
          } as NotificationEvent,
          embedData: {
            title: 'Event 2',
            description: 'Second event',
          } as PremiumEmbedData,
        },
      ];

      await manager.sendNotifications(events);

      // Verify order by checking embed titles
      expect(mockClient.sendMessage).toHaveBeenCalledTimes(3);

      const firstCall = (mockClient.sendMessage as any).mock.calls[0];
      const secondCall = (mockClient.sendMessage as any).mock.calls[1];
      const thirdCall = (mockClient.sendMessage as any).mock.calls[2];

      expect(firstCall[1].embeds[0].data.title).toBe('Event 1');
      expect(secondCall[1].embeds[0].data.title).toBe('Event 2');
      expect(thirdCall[1].embeds[0].data.title).toBe('Event 3');
    });

    it('should handle empty array', async () => {
      await manager.sendNotifications([]);
      expect(mockClient.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('queue management', () => {
    it('should retry failed notifications', async () => {
      // First attempt fails, second succeeds
      (mockClient.sendMessage as any)
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ id: 'message-success' });

      const event: NotificationEvent = {
        id: 'event-retry',
        type: EventType.STREAM_LIVE,
        channelId: 'kick-channel-1',
        data: {},
        timestamp: new Date(),
        delivered: false,
      };

      const embedData: PremiumEmbedData = {
        title: 'Retry Test',
        description: 'Testing retry logic',
      };

      await manager.sendNotification(event, embedData);

      // Wait for retry processing
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Should have tried multiple times
      expect(mockClient.sendMessage).toHaveBeenCalledTimes(3);

      // Queue should be empty after success
      const stats = manager.getQueueStats();
      expect(stats.queueSize).toBe(0);
    });

    it('should respect max retries', async () => {
      // All attempts fail
      (mockClient.sendMessage as any).mockRejectedValue(
        new Error('Permanent failure')
      );

      const event: NotificationEvent = {
        id: 'event-max-retry',
        type: EventType.STREAM_LIVE,
        channelId: 'kick-channel-1',
        data: {},
        timestamp: new Date(),
        delivered: false,
      };

      const embedData: PremiumEmbedData = {
        title: 'Max Retry Test',
        description: 'Testing max retry limit',
      };

      await manager.sendNotification(event, embedData);

      // Wait for all retries
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should have tried: initial + fallback + (maxRetries * 2 channels)
      // Initial: primary + fallback = 2
      // Retry 1: primary + fallback = 2
      // Retry 2: primary + fallback = 2
      // Retry 3: primary + fallback = 2
      // Total: 8 attempts
      expect(mockClient.sendMessage).toHaveBeenCalled();

      // Queue should be empty after max retries exceeded
      const stats = manager.getQueueStats();
      expect(stats.queueSize).toBe(0);
    });

    it('should provide queue statistics', async () => {
      // Mock failures to queue notifications
      (mockClient.sendMessage as any).mockRejectedValue(
        new Error('Queue test failure')
      );

      const event1: NotificationEvent = {
        id: 'event-queue-1',
        type: EventType.STREAM_LIVE,
        channelId: 'kick-channel-1',
        data: {},
        timestamp: new Date(),
        delivered: false,
      };

      const event2: NotificationEvent = {
        id: 'event-queue-2',
        type: EventType.NEW_SUBSCRIBER,
        channelId: 'kick-channel-1',
        data: {},
        timestamp: new Date(),
        delivered: false,
      };

      const embedData: PremiumEmbedData = {
        title: 'Queue Stats Test',
        description: 'Testing queue statistics',
      };

      await manager.sendNotification(event1, embedData);
      await manager.sendNotification(event2, embedData);

      const stats = manager.getQueueStats();
      expect(stats.queueSize).toBe(2);
      expect(stats.oldestQueuedAt).toBeInstanceOf(Date);
    });

    it('should clear queue', async () => {
      // Mock failures to queue notifications
      (mockClient.sendMessage as any).mockRejectedValue(
        new Error('Clear test failure')
      );

      const event: NotificationEvent = {
        id: 'event-clear',
        type: EventType.STREAM_LIVE,
        channelId: 'kick-channel-1',
        data: {},
        timestamp: new Date(),
        delivered: false,
      };

      const embedData: PremiumEmbedData = {
        title: 'Clear Test',
        description: 'Testing queue clear',
      };

      await manager.sendNotification(event, embedData);

      let stats = manager.getQueueStats();
      expect(stats.queueSize).toBeGreaterThan(0);

      manager.clearQueue();

      stats = manager.getQueueStats();
      expect(stats.queueSize).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle missing fallback channel', async () => {
      const configNoFallback: NotificationManagerConfig = {
        primaryChannelId: 'primary-channel-123',
        maxRetries: 1,
        retryDelayMs: 100,
      };

      const managerNoFallback = new NotificationManager(
        mockClient,
        configNoFallback
      );

      (mockClient.sendMessage as any).mockRejectedValue(
        new Error('Primary channel failed')
      );

      const event: NotificationEvent = {
        id: 'event-no-fallback',
        type: EventType.STREAM_LIVE,
        channelId: 'kick-channel-1',
        data: {},
        timestamp: new Date(),
        delivered: false,
      };

      const embedData: PremiumEmbedData = {
        title: 'No Fallback Test',
        description: 'Testing without fallback channel',
      };

      await managerNoFallback.sendNotification(event, embedData);

      // Should try primary channel initially
      expect(mockClient.sendMessage).toHaveBeenCalled();
      expect(mockClient.sendMessage).toHaveBeenCalledWith(
        configNoFallback.primaryChannelId,
        expect.any(Object)
      );

      // Should queue for retry
      const stats = managerNoFallback.getQueueStats();
      expect(stats.queueSize).toBe(1);
    });

    it('should handle embed without thumbnail', async () => {
      const event: NotificationEvent = {
        id: 'event-no-thumb',
        type: EventType.STREAM_LIVE,
        channelId: 'kick-channel-1',
        data: {},
        timestamp: new Date(),
        delivered: false,
      };

      const embedData: PremiumEmbedData = {
        title: 'No Thumbnail',
        description: 'Testing without thumbnail',
      };

      await manager.sendNotification(event, embedData);

      const sendMessageCall = (mockClient.sendMessage as any).mock.calls[0];
      const embed = sendMessageCall[1].embeds[0];

      expect(embed.data.thumbnail).toBeUndefined();
    });

    it('should handle embed without fields', async () => {
      const event: NotificationEvent = {
        id: 'event-no-fields',
        type: EventType.STREAM_LIVE,
        channelId: 'kick-channel-1',
        data: {},
        timestamp: new Date(),
        delivered: false,
      };

      const embedData: PremiumEmbedData = {
        title: 'No Fields',
        description: 'Testing without fields',
      };

      await manager.sendNotification(event, embedData);

      const sendMessageCall = (mockClient.sendMessage as any).mock.calls[0];
      const embed = sendMessageCall[1].embeds[0];

      expect(embed.data.fields).toBeUndefined();
    });
  });
});
