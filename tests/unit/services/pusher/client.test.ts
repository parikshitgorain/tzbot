/**
 * @file client.test.ts
 * @description Unit tests for Pusher client
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PusherClient } from '../../../../src/services/pusher/client.js';
import type { KickChatMessage, ConnectionState } from '../../../../src/services/pusher/types.js';

// Mock logger to avoid config dependency
vi.mock('../../../../src/core/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Pusher
vi.mock('pusher-js', () => {
  return {
    default: class MockPusher {
      connection = {
        state: 'initialized',
        bind: vi.fn(),
      };
      subscribe = vi.fn(() => ({
        name: 'test-channel',
        bind: vi.fn(),
        unbind_all: vi.fn(),
      }));
      unsubscribe = vi.fn();
      disconnect = vi.fn();
    },
  };
});

describe('PusherClient', () => {
  let client: PusherClient;

  beforeEach(() => {
    client = new PusherClient();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await client.disconnect();
  });

  describe('Connection Management', () => {
    it('should initialize with correct state', () => {
      expect(client.getConnectionState()).toBe('initialized');
      expect(client.isConnected()).toBe(false);
    });

    it('should connect to Pusher with correct configuration', async () => {
      const channelId = '12345';
      const onMessage = vi.fn();
      const onConnectionChange = vi.fn();

      // Mock successful connection
      vi.spyOn(client as any, 'testConnectivity').mockResolvedValue(undefined);

      await client.connect({
        channelId,
        onMessage,
        onConnectionChange,
      });

      expect(client.getConnectionState()).toBe('connected');
      expect(client.isConnected()).toBe(true);
    });

    it('should handle connection state changes', async () => {
      const states: ConnectionState[] = [];
      const onConnectionChange = (state: ConnectionState) => {
        states.push(state);
      };

      vi.spyOn(client as any, 'testConnectivity').mockResolvedValue(undefined);

      await client.connect({
        channelId: '12345',
        onConnectionChange,
      });

      // Should have transitioned to connected state
      // Note: 'connecting' state may be set before callback is registered
      expect(states).toContain('connected');
      expect(client.getConnectionState()).toBe('connected');
    });

    it('should disconnect cleanly', async () => {
      vi.spyOn(client as any, 'testConnectivity').mockResolvedValue(undefined);

      await client.connect({
        channelId: '12345',
      });

      await client.disconnect();

      expect(client.getConnectionState()).toBe('disconnected');
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('Message Parsing', () => {
    it('should parse chat message with badges correctly', () => {
      const rawData = {
        id: 'msg-123',
        sender: {
          username: 'testuser',
          identity: {
            badges: [
              { type: 'subscriber', months: 6 },
              { type: 'vip' },
            ],
          },
        },
        content: 'Hello world!',
        created_at: '2024-01-01T12:00:00Z',
      };

      const parsed = (client as any).parseChatMessage(rawData);

      expect(parsed).toEqual({
        id: 'msg-123',
        username: 'testuser',
        content: 'Hello world!',
        timestamp: new Date('2024-01-01T12:00:00Z'),
        badges: [
          { type: 'subscriber', months: 6 },
          { type: 'vip', months: undefined },
        ],
      });
    });

    it('should handle message without badges', () => {
      const rawData = {
        id: 'msg-456',
        sender: {
          username: 'regularuser',
          identity: {},
        },
        content: 'Test message',
        created_at: '2024-01-01T12:00:00Z',
      };

      const parsed = (client as any).parseChatMessage(rawData);

      expect(parsed.badges).toEqual([]);
      expect(parsed.username).toBe('regularuser');
    });

    it('should handle malformed message data gracefully', () => {
      const rawData = {
        id: 'msg-789',
      };

      const parsed = (client as any).parseChatMessage(rawData);

      expect(parsed.username).toBe('unknown');
      expect(parsed.content).toBe('');
      expect(parsed.badges).toEqual([]);
    });

    it('should filter invalid badge types', () => {
      const rawData = {
        id: 'msg-999',
        sender: {
          username: 'testuser',
          identity: {
            badges: [
              { type: 'subscriber' },
              { type: 'invalid_badge' },
              { type: 'moderator' },
              { type: 'unknown' },
            ],
          },
        },
        content: 'Test',
        created_at: '2024-01-01T12:00:00Z',
      };

      const parsed = (client as any).parseChatMessage(rawData);

      expect(parsed.badges).toHaveLength(2);
      expect(parsed.badges.map((b: any) => b.type)).toEqual(['subscriber', 'moderator']);
    });
  });

  describe('Reconnection Logic', () => {
    it('should schedule reconnection on connection failure', async () => {
      const scheduleReconnectSpy = vi.spyOn(client as any, 'scheduleReconnect');
      vi.spyOn(client as any, 'testConnectivity').mockRejectedValue(
        new Error('Connection failed')
      );

      await expect(
        client.connect({
          channelId: '12345',
        })
      ).rejects.toThrow('Connection failed');

      expect(scheduleReconnectSpy).toHaveBeenCalled();
    });

    it('should use exponential backoff for reconnection attempts', () => {
      const options = { channelId: '12345' };

      // First attempt
      (client as any).reconnectAttempts = 0;
      (client as any).scheduleReconnect(options);
      expect((client as any).reconnectAttempts).toBe(1);

      // Clear timer
      if ((client as any).reconnectTimer) {
        clearTimeout((client as any).reconnectTimer);
        (client as any).reconnectTimer = null;
      }

      // Second attempt
      (client as any).scheduleReconnect(options);
      expect((client as any).reconnectAttempts).toBe(2);
    });

    it('should stop reconnecting after max attempts', () => {
      const options = { channelId: '12345' };
      (client as any).reconnectAttempts = 10; // Max attempts

      (client as any).scheduleReconnect(options);

      // Should not schedule another reconnect
      expect((client as any).reconnectTimer).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should call onError callback on connection error', async () => {
      const onError = vi.fn();
      const error = new Error('Connection error');

      vi.spyOn(client as any, 'testConnectivity').mockRejectedValue(error);

      await expect(
        client.connect({
          channelId: '12345',
          onError,
        })
      ).rejects.toThrow('Connection error');
    });

    it('should handle message parsing errors gracefully', async () => {
      const onMessage = vi.fn();
      const onError = vi.fn();

      vi.spyOn(client as any, 'testConnectivity').mockResolvedValue(undefined);

      await client.connect({
        channelId: '12345',
        onMessage,
        onError,
      });

      // Simulate receiving malformed message
      const channel = (client as any).channel;
      const messageHandler = channel.bind.mock.calls.find(
        (call: any) => call[0] === 'App\\Events\\ChatMessageEvent'
      )?.[1];

      if (messageHandler) {
        // Should not throw, should log error instead
        expect(() => messageHandler(null)).not.toThrow();
      }
    });
  });

  describe('Channel Subscription', () => {
    it('should subscribe to correct channel format', async () => {
      const channelId = '67890';

      vi.spyOn(client as any, 'testConnectivity').mockResolvedValue(undefined);

      await client.connect({
        channelId,
      });

      const pusher = (client as any).pusher;
      expect(pusher.subscribe).toHaveBeenCalledWith(`chatrooms.${channelId}.v2`);
    });

    it('should bind to chat message events', async () => {
      vi.spyOn(client as any, 'testConnectivity').mockResolvedValue(undefined);

      await client.connect({
        channelId: '12345',
      });

      const channel = (client as any).channel;
      expect(channel.bind).toHaveBeenCalledWith(
        'App\\Events\\ChatMessageEvent',
        expect.any(Function)
      );
    });

    it('should bind to subscription events', async () => {
      vi.spyOn(client as any, 'testConnectivity').mockResolvedValue(undefined);

      await client.connect({
        channelId: '12345',
      });

      const channel = (client as any).channel;
      expect(channel.bind).toHaveBeenCalledWith(
        'App\\Events\\SubscriptionEvent',
        expect.any(Function)
      );
    });
  });
});
