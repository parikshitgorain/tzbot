/**
 * @file client.test.ts
 * @description Unit tests for Discord client wrapper
 * @module tests/unit/core/discord
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscordClient, MessageContent } from '@/core/discord/client.js';

// Mock logger
vi.mock('@/core/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  logError: vi.fn(),
}));

// Mock permissions
vi.mock('@/core/discord/permissions.js', () => ({
  verifyPermissionsOnStartup: vi.fn(),
}));

// Mock Discord.js - override the global mock for this test
vi.mock('discord.js', async () => {
  const actual = await vi.importActual('discord.js');
  
  class MockClient {
    login = vi.fn().mockResolvedValue('token');
    destroy = vi.fn().mockResolvedValue(undefined);
    on = vi.fn();
    once = vi.fn();
    off = vi.fn();
    isReady = vi.fn().mockReturnValue(true);
    user = { id: 'bot-123', username: 'TestBot' };
    guilds = {
      cache: new Map(),
      fetch: vi.fn(),
    };
    channels = {
      fetch: vi.fn(),
    };
  }
  
  return {
    ...actual,
    Client: MockClient,
    GatewayIntentBits: {
      Guilds: 1,
      GuildMessages: 2,
      GuildMembers: 4,
      GuildModeration: 8,
      MessageContent: 16,
      DirectMessages: 32,
    },
    Partials: {
      Channel: 1,
      Message: 2,
    },
    EmbedBuilder: vi.fn(),
  };
});

describe('DiscordClient', () => {
  let client: DiscordClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new DiscordClient();
  });

  describe('Connection Management', () => {
    it('should create a Discord client instance', () => {
      expect(client).toBeDefined();
    });

    it('should have connect method', () => {
      expect(typeof client.connect).toBe('function');
    });

    it('should have disconnect method', () => {
      expect(typeof client.disconnect).toBe('function');
    });

    it('should have isConnected method', () => {
      expect(typeof client.isConnected).toBe('function');
    });
  });

  describe('Event Subscription', () => {
    it('should have on method for event subscription', () => {
      expect(typeof client.on).toBe('function');
    });

    it('should have once method for one-time event subscription', () => {
      expect(typeof client.once).toBe('function');
    });

    it('should have off method for unsubscribing', () => {
      expect(typeof client.off).toBe('function');
    });
  });

  describe('Message Operations', () => {
    it('should have sendMessage method', () => {
      expect(typeof client.sendMessage).toBe('function');
    });

    it('should have deleteMessage method', () => {
      expect(typeof client.deleteMessage).toBe('function');
    });
  });

  describe('Moderation Operations', () => {
    it('should have banUser method', () => {
      expect(typeof client.banUser).toBe('function');
    });

    it('should have kickUser method', () => {
      expect(typeof client.kickUser).toBe('function');
    });

    it('should have timeoutUser method', () => {
      expect(typeof client.timeoutUser).toBe('function');
    });
  });

  describe('Role Operations', () => {
    it('should have addRole method', () => {
      expect(typeof client.addRole).toBe('function');
    });

    it('should have removeRole method', () => {
      expect(typeof client.removeRole).toBe('function');
    });
  });

  describe('Utility Methods', () => {
    it('should have getGuild method', () => {
      expect(typeof client.getGuild).toBe('function');
    });

    it('should have getMember method', () => {
      expect(typeof client.getMember).toBe('function');
    });
  });

  describe('Interface Compliance', () => {
    it('should implement all required IDiscordClient methods', () => {
      const requiredMethods = [
        'connect',
        'disconnect',
        'isConnected',
        'on',
        'once',
        'off',
        'sendMessage',
        'deleteMessage',
        'banUser',
        'kickUser',
        'timeoutUser',
        'addRole',
        'removeRole',
        'getGuild',
        'getMember',
      ];

      requiredMethods.forEach((method) => {
        expect(typeof (client as any)[method]).toBe('function');
      });
    });
  });
});

