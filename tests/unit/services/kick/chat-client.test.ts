/**
 * @file chat-client.test.ts
 * @description Unit tests for KickChatClient
 * @module tests/unit/services/kick
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KickChatClient } from '../../../../src/services/kick/chat-client.js';
import { pusherClient } from '../../../../src/services/pusher/client.js';
import type { KickChatMessage } from '../../../../src/services/pusher/types.js';

// Mock the pusher client
vi.mock('../../../../src/services/pusher/client.js', () => ({
  pusherClient: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn(),
    getConnectionState: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../../../src/core/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('KickChatClient', () => {
  let client: KickChatClient;

  beforeEach(() => {
    client = new KickChatClient();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      if (client.isConnected()) {
        await client.disconnect();
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('connect', () => {
    it('should connect to Pusher with correct channel ID', async () => {
      vi.mocked(pusherClient.connect).mockResolvedValue();

      await client.connect({
        channelId: '12345',
      });

      expect(pusherClient.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: '12345',
        })
      );
    });

    it('should pass message handler to Pusher client', async () => {
      vi.mocked(pusherClient.connect).mockResolvedValue();
      const onMessage = vi.fn();

      await client.connect({
        channelId: '12345',
        onMessage,
      });

      expect(pusherClient.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          onMessage: expect.any(Function),
        })
      );
    });

    it('should disconnect existing connection before reconnecting', async () => {
      vi.mocked(pusherClient.connect).mockResolvedValue();
      vi.mocked(pusherClient.disconnect).mockResolvedValue();
      vi.mocked(pusherClient.isConnected).mockReturnValue(true);

      // First connection
      await client.connect({ channelId: '12345' });

      // Second connection should disconnect first
      await client.connect({ channelId: '67890' });

      expect(pusherClient.disconnect).toHaveBeenCalled();
    });

    it('should throw error if Pusher connection fails', async () => {
      const error = new Error('Connection failed');
      vi.mocked(pusherClient.connect).mockRejectedValue(error);

      await expect(
        client.connect({ channelId: '12345' })
      ).rejects.toThrow('Connection failed');
    });
  });

  describe('disconnect', () => {
    it('should disconnect from Pusher', async () => {
      vi.mocked(pusherClient.connect).mockResolvedValue();
      vi.mocked(pusherClient.disconnect).mockResolvedValue();
      vi.mocked(pusherClient.isConnected).mockReturnValue(true);

      await client.connect({ channelId: '12345' });
      await client.disconnect();

      expect(pusherClient.disconnect).toHaveBeenCalled();
    });

    it('should not throw if already disconnected', async () => {
      vi.mocked(pusherClient.isConnected).mockReturnValue(false);

      await expect(client.disconnect()).resolves.not.toThrow();
    });

    it('should handle disconnect errors', async () => {
      vi.mocked(pusherClient.connect).mockResolvedValue();
      vi.mocked(pusherClient.isConnected).mockReturnValue(true);
      const disconnectError = new Error('Disconnect failed');
      vi.mocked(pusherClient.disconnect).mockRejectedValueOnce(disconnectError);

      await client.connect({ channelId: '12345' });

      await expect(client.disconnect()).rejects.toThrow('Disconnect failed');
      
      // Reset mock for cleanup
      vi.mocked(pusherClient.disconnect).mockResolvedValue();
    });
  });

  describe('isConnected', () => {
    it('should return true when connected', async () => {
      vi.mocked(pusherClient.connect).mockResolvedValue();
      vi.mocked(pusherClient.disconnect).mockResolvedValue();
      vi.mocked(pusherClient.isConnected).mockReturnValue(true);

      await client.connect({ channelId: '12345' });

      expect(client.isConnected()).toBe(true);
    });

    it('should return false when not connected', () => {
      vi.mocked(pusherClient.isConnected).mockReturnValue(false);

      expect(client.isConnected()).toBe(false);
    });
  });

  describe('getConnectionState', () => {
    it('should return current connection state', () => {
      vi.mocked(pusherClient.getConnectionState).mockReturnValue('connected');

      expect(client.getConnectionState()).toBe('connected');
    });
  });

  describe('extractBadges', () => {
    it('should extract subscriber badge', () => {
      const message: KickChatMessage = {
        id: '1',
        username: 'testuser',
        content: 'Hello',
        timestamp: new Date(),
        badges: [{ type: 'subscriber', months: 6 }],
      };

      const badgeInfo = client.extractBadges(message);

      expect(badgeInfo.username).toBe('testuser');
      expect(badgeInfo.isSubscriber).toBe(true);
      expect(badgeInfo.subscriberMonths).toBe(6);
      expect(badgeInfo.isVIP).toBe(false);
      expect(badgeInfo.isModerator).toBe(false);
      expect(badgeInfo.isBroadcaster).toBe(false);
    });

    it('should extract VIP badge', () => {
      const message: KickChatMessage = {
        id: '1',
        username: 'vipuser',
        content: 'Hello',
        timestamp: new Date(),
        badges: [{ type: 'vip' }],
      };

      const badgeInfo = client.extractBadges(message);

      expect(badgeInfo.username).toBe('vipuser');
      expect(badgeInfo.isVIP).toBe(true);
      expect(badgeInfo.isSubscriber).toBe(false);
    });

    it('should extract moderator badge', () => {
      const message: KickChatMessage = {
        id: '1',
        username: 'moduser',
        content: 'Hello',
        timestamp: new Date(),
        badges: [{ type: 'moderator' }],
      };

      const badgeInfo = client.extractBadges(message);

      expect(badgeInfo.isModerator).toBe(true);
    });

    it('should extract broadcaster badge', () => {
      const message: KickChatMessage = {
        id: '1',
        username: 'broadcaster',
        content: 'Hello',
        timestamp: new Date(),
        badges: [{ type: 'broadcaster' }],
      };

      const badgeInfo = client.extractBadges(message);

      expect(badgeInfo.isBroadcaster).toBe(true);
    });

    it('should extract multiple badges', () => {
      const message: KickChatMessage = {
        id: '1',
        username: 'poweruser',
        content: 'Hello',
        timestamp: new Date(),
        badges: [
          { type: 'subscriber', months: 12 },
          { type: 'vip' },
          { type: 'moderator' },
        ],
      };

      const badgeInfo = client.extractBadges(message);

      expect(badgeInfo.isSubscriber).toBe(true);
      expect(badgeInfo.subscriberMonths).toBe(12);
      expect(badgeInfo.isVIP).toBe(true);
      expect(badgeInfo.isModerator).toBe(true);
    });

    it('should handle messages with no badges', () => {
      const message: KickChatMessage = {
        id: '1',
        username: 'regularuser',
        content: 'Hello',
        timestamp: new Date(),
        badges: [],
      };

      const badgeInfo = client.extractBadges(message);

      expect(badgeInfo.username).toBe('regularuser');
      expect(badgeInfo.isSubscriber).toBe(false);
      expect(badgeInfo.isVIP).toBe(false);
      expect(badgeInfo.isModerator).toBe(false);
      expect(badgeInfo.isBroadcaster).toBe(false);
    });
  });

  describe('message handling', () => {
    it('should call onMessage handler when message received', async () => {
      const onMessage = vi.fn();
      let messageHandler: ((msg: KickChatMessage) => void) | undefined;

      vi.mocked(pusherClient.connect).mockImplementation(async (options) => {
        messageHandler = options.onMessage;
      });

      await client.connect({
        channelId: '12345',
        onMessage,
      });

      const message: KickChatMessage = {
        id: '1',
        username: 'testuser',
        content: 'Hello',
        timestamp: new Date(),
        badges: [],
      };

      messageHandler?.(message);

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(onMessage).toHaveBeenCalledWith(message);
    });

    it('should call onSubscriberDetected when subscriber badge found', async () => {
      const onSubscriberDetected = vi.fn();
      let messageHandler: ((msg: KickChatMessage) => void) | undefined;

      vi.mocked(pusherClient.connect).mockImplementation(async (options) => {
        messageHandler = options.onMessage;
      });

      await client.connect({
        channelId: '12345',
        onSubscriberDetected,
      });

      const message: KickChatMessage = {
        id: '1',
        username: 'subscriber',
        content: 'Hello',
        timestamp: new Date(),
        badges: [{ type: 'subscriber', months: 3 }],
      };

      messageHandler?.(message);

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(onSubscriberDetected).toHaveBeenCalledWith('subscriber', 3);
    });

    it('should call onVIPDetected when VIP badge found', async () => {
      const onVIPDetected = vi.fn();
      let messageHandler: ((msg: KickChatMessage) => void) | undefined;

      vi.mocked(pusherClient.connect).mockImplementation(async (options) => {
        messageHandler = options.onMessage;
      });

      await client.connect({
        channelId: '12345',
        onVIPDetected,
      });

      const message: KickChatMessage = {
        id: '1',
        username: 'vipuser',
        content: 'Hello',
        timestamp: new Date(),
        badges: [{ type: 'vip' }],
      };

      messageHandler?.(message);

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(onVIPDetected).toHaveBeenCalledWith('vipuser');
    });

    it('should call both subscriber and VIP handlers when both badges present', async () => {
      const onSubscriberDetected = vi.fn();
      const onVIPDetected = vi.fn();
      let messageHandler: ((msg: KickChatMessage) => void) | undefined;

      vi.mocked(pusherClient.connect).mockImplementation(async (options) => {
        messageHandler = options.onMessage;
      });

      await client.connect({
        channelId: '12345',
        onSubscriberDetected,
        onVIPDetected,
      });

      const message: KickChatMessage = {
        id: '1',
        username: 'poweruser',
        content: 'Hello',
        timestamp: new Date(),
        badges: [
          { type: 'subscriber', months: 6 },
          { type: 'vip' },
        ],
      };

      messageHandler?.(message);

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(onSubscriberDetected).toHaveBeenCalledWith('poweruser', 6);
      expect(onVIPDetected).toHaveBeenCalledWith('poweruser');
    });

    it('should not throw if message handler throws error', async () => {
      const onMessage = vi.fn().mockRejectedValue(new Error('Handler error'));
      let messageHandler: ((msg: KickChatMessage) => void) | undefined;

      vi.mocked(pusherClient.connect).mockImplementation(async (options) => {
        messageHandler = options.onMessage;
      });

      await client.connect({
        channelId: '12345',
        onMessage,
      });

      const message: KickChatMessage = {
        id: '1',
        username: 'testuser',
        content: 'Hello',
        timestamp: new Date(),
        badges: [],
      };

      // Should not throw
      expect(() => messageHandler?.(message)).not.toThrow();

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  describe('connection state handling', () => {
    it('should call onConnectionChange handler', async () => {
      const onConnectionChange = vi.fn();
      let stateHandler: ((state: any) => void) | undefined;

      vi.mocked(pusherClient.connect).mockImplementation(async (options) => {
        stateHandler = options.onConnectionChange;
      });

      await client.connect({
        channelId: '12345',
        onConnectionChange,
      });

      stateHandler?.('connected');

      expect(onConnectionChange).toHaveBeenCalledWith('connected');
    });

    it('should update monitoring flag when disconnected', async () => {
      let stateHandler: ((state: any) => void) | undefined;

      vi.mocked(pusherClient.connect).mockImplementation(async (options) => {
        stateHandler = options.onConnectionChange;
      });
      vi.mocked(pusherClient.isConnected).mockReturnValue(false);

      await client.connect({ channelId: '12345' });

      stateHandler?.('disconnected');

      expect(client.isConnected()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should call onError handler when error occurs', async () => {
      const onError = vi.fn();
      let errorHandler: ((error: Error) => void) | undefined;

      vi.mocked(pusherClient.connect).mockImplementation(async (options) => {
        errorHandler = options.onError;
      });

      await client.connect({
        channelId: '12345',
        onError,
      });

      const error = new Error('Test error');
      errorHandler?.(error);

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe('edge cases', () => {
    it('should handle subscriber badge without months', () => {
      const message: KickChatMessage = {
        id: '1',
        username: 'subscriber',
        content: 'Hello',
        timestamp: new Date(),
        badges: [{ type: 'subscriber' }],
      };

      const badgeInfo = client.extractBadges(message);

      expect(badgeInfo.isSubscriber).toBe(true);
      expect(badgeInfo.subscriberMonths).toBeUndefined();
    });

    it('should handle empty username', () => {
      const message: KickChatMessage = {
        id: '1',
        username: '',
        content: 'Hello',
        timestamp: new Date(),
        badges: [],
      };

      const badgeInfo = client.extractBadges(message);

      expect(badgeInfo.username).toBe('');
    });

    it('should handle very long subscriber months', () => {
      const message: KickChatMessage = {
        id: '1',
        username: 'longtimesub',
        content: 'Hello',
        timestamp: new Date(),
        badges: [{ type: 'subscriber', months: 999 }],
      };

      const badgeInfo = client.extractBadges(message);

      expect(badgeInfo.subscriberMonths).toBe(999);
    });
  });
});
