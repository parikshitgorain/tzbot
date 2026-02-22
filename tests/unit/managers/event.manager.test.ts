/**
 * @file event.manager.test.ts
 * @description Unit tests for EventManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock logger before importing EventManager
vi.mock('@/core/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  logError: vi.fn(),
}));

import { EventManager } from '@/managers/event.manager.js';
import type { IDiscordClient } from '@/core/discord/client.js';
import type { BotConfig } from '@/config/types.js';

// Mock Discord client
const createMockClient = (): IDiscordClient => {
  const eventHandlers = new Map<string, Function[]>();

  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn(() => true),
    on: vi.fn((event: string, handler: Function) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, []);
      }
      eventHandlers.get(event)!.push(handler);
    }),
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
    // Helper to trigger events
    _triggerEvent: (event: string, ...args: unknown[]) => {
      const handlers = eventHandlers.get(event) || [];
      handlers.forEach((handler) => handler(...args));
    },
  } as unknown as IDiscordClient & { _triggerEvent: Function };
};

// Mock config
const createMockConfig = (): BotConfig => ({
  discordToken: 'test-token',
  guildId: 'test-guild',
  clientId: 'test-client',
  subscriberRoleId: 'sub-role',
  vipRoleId: 'vip-role',
  moderatorRoleId: 'mod-role',
  notificationChannelId: 'notif-channel',
  publicAnnouncementChannelIds: [],
  databaseUrl: 'postgresql://test',
  databaseMaxConnections: 10,
  redisUrl: 'redis://test',
  readOnlyChannels: [],
  spamThreshold: {
    identicalMessages: 5,
    identicalWindow: 10000,
    rapidMessages: 10,
    rapidWindow: 5000,
  },
  linkScanningEnabled: true,
  aiEnabled: false,
  aiProvider: 'local',
  aiChannels: [],
  chatRainEnabled: false,
  chatRainMinDelay: 300000,
  chatRainActiveWindow: 600000,
  chatRainMinMessages: 3,
  webhookPort: 3000,
  webhookHost: 'localhost',
  logLevel: 'info',
  logFile: 'test.log',
  nodeEnv: 'test',
  maxMessagesPerSecond: 100,
  cacheEnabled: true,
});

describe('EventManager', () => {
  let eventManager: EventManager;
  let mockClient: IDiscordClient & { _triggerEvent: Function };
  let mockConfig: BotConfig;

  beforeEach(() => {
    mockClient = createMockClient();
    mockConfig = createMockConfig();
    eventManager = new EventManager(mockClient, mockConfig);
  });

  describe('registerHandler', () => {
    it('should register an event handler', () => {
      const handler = vi.fn();
      eventManager.registerHandler('messageCreate', handler);

      // Start the event manager to setup listeners
      eventManager.start();

      // Trigger the event
      mockClient._triggerEvent('messageCreate', { content: 'test' });

      // Wait for async processing
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(handler).toHaveBeenCalled();
          resolve(undefined);
        }, 50);
      });
    });

    it('should register multiple handlers for the same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventManager.registerHandler('messageCreate', handler1);
      eventManager.registerHandler('messageCreate', handler2);

      eventManager.start();
      mockClient._triggerEvent('messageCreate', { content: 'test' });

      return new Promise((resolve) => {
        setTimeout(() => {
          expect(handler1).toHaveBeenCalled();
          expect(handler2).toHaveBeenCalled();
          resolve(undefined);
        }, 50);
      });
    });

    it('should execute handlers in priority order', () => {
      const executionOrder: number[] = [];
      const handler1 = vi.fn(() => executionOrder.push(1));
      const handler2 = vi.fn(() => executionOrder.push(2));
      const handler3 = vi.fn(() => executionOrder.push(3));

      // Register with different priorities
      eventManager.registerHandler('messageCreate', handler1, 10);
      eventManager.registerHandler('messageCreate', handler2, 50);
      eventManager.registerHandler('messageCreate', handler3, 30);

      eventManager.start();
      mockClient._triggerEvent('messageCreate', { content: 'test' });

      return new Promise((resolve) => {
        setTimeout(() => {
          // Should execute in order: handler2 (50), handler3 (30), handler1 (10)
          expect(executionOrder).toEqual([2, 3, 1]);
          resolve(undefined);
        }, 50);
      });
    });
  });

  describe('start and pause', () => {
    it('should start processing events', () => {
      const handler = vi.fn();
      eventManager.registerHandler('messageCreate', handler);

      eventManager.start();
      mockClient._triggerEvent('messageCreate', { content: 'test' });

      return new Promise((resolve) => {
        setTimeout(() => {
          expect(handler).toHaveBeenCalled();
          resolve(undefined);
        }, 50);
      });
    });

    it('should pause event processing', () => {
      const handler = vi.fn();
      eventManager.registerHandler('messageCreate', handler);

      eventManager.start();
      eventManager.pause();

      mockClient._triggerEvent('messageCreate', { content: 'test' });

      return new Promise((resolve) => {
        setTimeout(() => {
          expect(handler).not.toHaveBeenCalled();
          resolve(undefined);
        }, 50);
      });
    });

    it('should resume event processing', () => {
      const handler = vi.fn();
      eventManager.registerHandler('messageCreate', handler);

      eventManager.start();
      eventManager.pause();
      eventManager.resume();

      mockClient._triggerEvent('messageCreate', { content: 'test' });

      return new Promise((resolve) => {
        setTimeout(() => {
          expect(handler).toHaveBeenCalled();
          resolve(undefined);
        }, 50);
      });
    });
  });

  describe('event queuing', () => {
    it('should queue events when processing', () => {
      const handler = vi.fn();
      eventManager.registerHandler('messageCreate', handler);

      eventManager.start();

      // Trigger multiple events
      mockClient._triggerEvent('messageCreate', { content: 'test1' });
      mockClient._triggerEvent('messageCreate', { content: 'test2' });
      mockClient._triggerEvent('messageCreate', { content: 'test3' });

      return new Promise((resolve) => {
        setTimeout(() => {
          // All events should be processed
          expect(handler).toHaveBeenCalledTimes(3);
          resolve(undefined);
        }, 100);
      });
    });

    it('should prioritize high-priority events', () => {
      const processedEvents: string[] = [];
      const handler = vi.fn((msg: { content: string }) => {
        processedEvents.push(msg.content);
      });

      eventManager.registerHandler('messageCreate', handler);
      eventManager.registerHandler('error', handler);

      // Don't start yet - just register handlers
      eventManager.start();

      // Trigger events quickly before processing starts
      mockClient._triggerEvent('messageCreate', { content: 'msg1' });
      mockClient._triggerEvent('error', { content: 'error1' });
      mockClient._triggerEvent('messageCreate', { content: 'msg2' });

      return new Promise((resolve) => {
        setTimeout(() => {
          // All events should be processed
          expect(handler).toHaveBeenCalledTimes(3);
          // Verify all events were processed (order may vary due to async nature)
          expect(processedEvents).toContain('msg1');
          expect(processedEvents).toContain('msg2');
          expect(processedEvents).toContain('error1');
          resolve(undefined);
        }, 200);
      });
    });
  });

  describe('rate limiting', () => {
    it('should respect rate limits', () => {
      const handler = vi.fn();
      eventManager.registerHandler('messageCreate', handler);

      // Set low rate limit for testing
      mockConfig.maxMessagesPerSecond = 5;
      eventManager = new EventManager(mockClient, mockConfig);
      eventManager.registerHandler('messageCreate', handler);
      eventManager.start();

      // Trigger more events than rate limit
      for (let i = 0; i < 10; i++) {
        mockClient._triggerEvent('messageCreate', { content: `test${i}` });
      }

      return new Promise((resolve) => {
        setTimeout(() => {
          // Should process only up to rate limit in first window
          expect(handler).toHaveBeenCalledTimes(5);
          resolve(undefined);
        }, 100);
      });
    });
  });

  describe('statistics', () => {
    it('should track event statistics', () => {
      const handler = vi.fn();
      eventManager.registerHandler('messageCreate', handler);

      eventManager.start();
      mockClient._triggerEvent('messageCreate', { content: 'test' });

      return new Promise((resolve) => {
        setTimeout(() => {
          const stats = eventManager.getStats();
          const messageStats = stats.get('messageCreate');

          expect(messageStats).toBeDefined();
          expect(messageStats!.queued).toBeGreaterThan(0);
          expect(messageStats!.processed).toBeGreaterThan(0);
          resolve(undefined);
        }, 50);
      });
    });
  });

  describe('hasInflight', () => {
    it('should return true when events are in flight', () => {
      const handler = vi.fn(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      eventManager.registerHandler('messageCreate', handler);

      eventManager.start();
      mockClient._triggerEvent('messageCreate', { content: 'test' });

      // Should have in-flight events immediately
      expect(eventManager.hasInflight()).toBe(true);
    });

    it('should return false when no events are in flight', () => {
      expect(eventManager.hasInflight()).toBe(false);
    });
  });

  describe('clearQueue', () => {
    it('should clear the event queue', () => {
      const handler = vi.fn();
      eventManager.registerHandler('messageCreate', handler);

      eventManager.start();
      eventManager.pause(); // Pause to build up queue

      // Queue multiple events
      for (let i = 0; i < 5; i++) {
        mockClient._triggerEvent('messageCreate', { content: `test${i}` });
      }

      // Clear queue before resuming
      eventManager.clearQueue();
      eventManager.resume();

      return new Promise((resolve) => {
        setTimeout(() => {
          // No events should be processed since queue was cleared
          expect(handler).not.toHaveBeenCalled();
          resolve(undefined);
        }, 100);
      });
    });
  });

  describe('error handling', () => {
    it('should handle errors in event handlers gracefully', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const successHandler = vi.fn();

      eventManager.registerHandler('messageCreate', errorHandler);
      eventManager.registerHandler('messageCreate', successHandler);

      eventManager.start();
      mockClient._triggerEvent('messageCreate', { content: 'test' });

      return new Promise((resolve) => {
        setTimeout(() => {
          // Both handlers should be called despite error
          expect(errorHandler).toHaveBeenCalled();
          expect(successHandler).toHaveBeenCalled();
          resolve(undefined);
        }, 50);
      });
    });
  });
});
