/**
 * @file polling-fallback.test.ts
 * @description Unit tests for polling fallback system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PollingFallbackSystem } from '@/webhooks/polling-fallback.js';
import type { KickAPIClient } from '@/services/kick/client.js';
import type { NotificationManager } from '@/managers/notification.manager.js';
import type { KickWebhookHandler } from '@/webhooks/kick-webhook.js';
import type { KickEvent } from '@/services/kick/types.js';

describe('PollingFallbackSystem', () => {
  let pollingSystem: PollingFallbackSystem;
  let mockKickAPIClient: KickAPIClient;
  let mockNotificationManager: NotificationManager;
  let mockWebhookHandler: KickWebhookHandler;

  beforeEach(() => {
    // Mock KickAPIClient
    mockKickAPIClient = {
      getLiveEvents: vi.fn().mockResolvedValue([]),
    } as any;

    // Mock NotificationManager
    mockNotificationManager = {
      sendNotification: vi.fn().mockResolvedValue(undefined),
    } as any;

    // Mock KickWebhookHandler
    mockWebhookHandler = {
      shouldActivatePollingFallback: vi.fn().mockReturnValue(false),
      resetFailureCount: vi.fn(),
      getHealthStatus: vi.fn().mockReturnValue({
        failureCount: 0,
        lastSuccess: new Date(),
        shouldFallback: false,
      }),
    } as any;

    pollingSystem = new PollingFallbackSystem({
      kickAPIClient: mockKickAPIClient,
      notificationManager: mockNotificationManager,
      webhookHandler: mockWebhookHandler,
      channelId: 12345,
      notificationChannelId: '987654321',
      pollingIntervalMs: 100, // Short interval for testing
      healthCheckIntervalMs: 200, // Short health check interval for testing
      enabled: true,
    });
  });

  afterEach(() => {
    pollingSystem.stop();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with webhook mode', () => {
      expect(pollingSystem.getCurrentState()).toBe('webhook');
    });

    it('should not be polling initially', () => {
      const status = pollingSystem.getStatus();
      expect(status.isPolling).toBe(false);
    });
  });

  describe('Webhook to Polling Transition', () => {
    it('should transition to polling when webhooks fail', async () => {
      // Simulate webhook failure
      vi.mocked(mockWebhookHandler.shouldActivatePollingFallback).mockReturnValue(true);

      // Start the system
      pollingSystem.start();

      // Wait for health check
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should transition to polling
      expect(pollingSystem.getCurrentState()).toBe('polling');
      expect(pollingSystem.getStatus().isPolling).toBe(true);
    });

    it('should log transition when switching to polling', async () => {
      vi.mocked(mockWebhookHandler.shouldActivatePollingFallback).mockReturnValue(true);

      pollingSystem.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      const history = pollingSystem.getTransitionHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].from).toBe('webhook');
      expect(history[0].to).toBe('polling');
      expect(history[0].reason).toContain('Webhook failure');
    });

    it('should start polling Kick API when transitioning', async () => {
      vi.mocked(mockWebhookHandler.shouldActivatePollingFallback).mockReturnValue(true);

      pollingSystem.start();
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should have called getLiveEvents at least once
      expect(mockKickAPIClient.getLiveEvents).toHaveBeenCalled();
    });
  });

  describe('Polling to Webhook Transition', () => {
    it('should transition back to webhook when webhooks recover', async () => {
      // Start in polling mode
      vi.mocked(mockWebhookHandler.shouldActivatePollingFallback).mockReturnValue(true);
      pollingSystem.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(pollingSystem.getCurrentState()).toBe('polling');

      // Simulate webhook recovery
      vi.mocked(mockWebhookHandler.shouldActivatePollingFallback).mockReturnValue(false);

      // Wait for health check
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should transition back to webhook
      expect(pollingSystem.getCurrentState()).toBe('webhook');
      expect(pollingSystem.getStatus().isPolling).toBe(false);
    });

    it('should reset webhook failure count when recovering', async () => {
      // Start in polling mode
      vi.mocked(mockWebhookHandler.shouldActivatePollingFallback).mockReturnValue(true);
      pollingSystem.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Simulate recovery
      vi.mocked(mockWebhookHandler.shouldActivatePollingFallback).mockReturnValue(false);
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should have reset failure count
      expect(mockWebhookHandler.resetFailureCount).toHaveBeenCalled();
    });

    it('should log transition when switching back to webhook', async () => {
      // Start in polling mode
      vi.mocked(mockWebhookHandler.shouldActivatePollingFallback).mockReturnValue(true);
      pollingSystem.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Simulate recovery
      vi.mocked(mockWebhookHandler.shouldActivatePollingFallback).mockReturnValue(false);
      await new Promise(resolve => setTimeout(resolve, 300));

      const history = pollingSystem.getTransitionHistory();
      const lastTransition = history[history.length - 1];
      expect(lastTransition.from).toBe('polling');
      expect(lastTransition.to).toBe('webhook');
      expect(lastTransition.reason).toContain('resumed');
    });
  });

  describe('Polling Behavior', () => {
    it('should poll Kick API at configured interval', async () => {
      vi.mocked(mockWebhookHandler.shouldActivatePollingFallback).mockReturnValue(true);

      pollingSystem.start();
      await new Promise(resolve => setTimeout(resolve, 350));

      // Should have polled multiple times (100ms interval)
      // Allow for timing variations (at least 3 calls)
      expect(mockKickAPIClient.getLiveEvents).toHaveBeenCalled();
      expect(mockKickAPIClient.getLiveEvents.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('should process events received from polling', async () => {
      const mockEvent: KickEvent = {
        id: 'event-1',
        type: 'stream_live',
        channel_id: 12345,
        timestamp: new Date(),
        data: {
          streamer_name: 'TestStreamer',
          title: 'Test Stream',
          category: 'Gaming',
          thumbnail_url: 'https://example.com/thumb.jpg',
        },
      };

      vi.mocked(mockKickAPIClient.getLiveEvents).mockResolvedValue([mockEvent]);
      vi.mocked(mockWebhookHandler.shouldActivatePollingFallback).mockReturnValue(true);

      pollingSystem.start();
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should have sent notification
      expect(mockNotificationManager.sendNotification).toHaveBeenCalled();
      const call = vi.mocked(mockNotificationManager.sendNotification).mock.calls[0];
      expect(call[0].type).toBe('stream_live');
      expect(call[1].title).toContain('Stream Started');
    });

    it('should handle multiple events in chronological order', async () => {
      const event1: KickEvent = {
        id: 'event-1',
        type: 'stream_live',
        channel_id: 12345,
        timestamp: new Date('2024-01-01T10:00:00Z'),
        data: { streamer_name: 'TestStreamer' },
      };

      const event2: KickEvent = {
        id: 'event-2',
        type: 'stream_offline',
        channel_id: 12345,
        timestamp: new Date('2024-01-01T11:00:00Z'),
        data: { streamer_name: 'TestStreamer' },
      };

      // Return events only on first call, then empty array
      let callCount = 0;
      vi.mocked(mockKickAPIClient.getLiveEvents).mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? [event1, event2] : [];
      });
      
      vi.mocked(mockWebhookHandler.shouldActivatePollingFallback).mockReturnValue(true);

      pollingSystem.start();
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should have processed both events
      expect(mockNotificationManager.sendNotification).toHaveBeenCalledTimes(2);
    });

    it('should update last polled timestamp after processing events', async () => {
      const eventTimestamp = new Date('2024-01-01T12:00:00Z');
      const mockEvent: KickEvent = {
        id: 'event-1',
        type: 'stream_live',
        channel_id: 12345,
        timestamp: eventTimestamp,
        data: {},
      };

      vi.mocked(mockKickAPIClient.getLiveEvents).mockResolvedValue([mockEvent]);
      vi.mocked(mockWebhookHandler.shouldActivatePollingFallback).mockReturnValue(true);

      pollingSystem.start();
      await new Promise(resolve => setTimeout(resolve, 150));

      const status = pollingSystem.getStatus();
      expect(status.lastPolledAt).toEqual(eventTimestamp);
    });

    it('should handle polling errors gracefully', async () => {
      vi.mocked(mockKickAPIClient.getLiveEvents).mockRejectedValue(
        new Error('API Error')
      );
      vi.mocked(mockWebhookHandler.shouldActivatePollingFallback).mockReturnValue(true);

      pollingSystem.start();
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should not crash, should continue polling
      expect(pollingSystem.getCurrentState()).toBe('polling');
    });
  });

  describe('Event Type Mapping', () => {
    it('should map stream_live to stream_live', async () => {
      const mockEvent: KickEvent = {
        id: 'event-1',
        type: 'stream_live',
        channel_id: 12345,
        timestamp: new Date(),
        data: {},
      };

      vi.mocked(mockKickAPIClient.getLiveEvents).mockResolvedValue([mockEvent]);
      vi.mocked(mockWebhookHandler.shouldActivatePollingFallback).mockReturnValue(true);

      pollingSystem.start();
      await new Promise(resolve => setTimeout(resolve, 150));

      const call = vi.mocked(mockNotificationManager.sendNotification).mock.calls[0];
      expect(call[0].type).toBe('stream_live');
    });

    it('should map stream_offline to stream_offline', async () => {
      const mockEvent: KickEvent = {
        id: 'event-1',
        type: 'stream_offline',
        channel_id: 12345,
        timestamp: new Date(),
        data: {},
      };

      vi.mocked(mockKickAPIClient.getLiveEvents).mockResolvedValue([mockEvent]);
      vi.mocked(mockWebhookHandler.shouldActivatePollingFallback).mockReturnValue(true);

      pollingSystem.start();
      await new Promise(resolve => setTimeout(resolve, 150));

      const call = vi.mocked(mockNotificationManager.sendNotification).mock.calls[0];
      expect(call[0].type).toBe('stream_offline');
    });

    it('should map new_subscriber to new_subscriber', async () => {
      const mockEvent: KickEvent = {
        id: 'event-1',
        type: 'new_subscriber',
        channel_id: 12345,
        timestamp: new Date(),
        data: {
          gifter_name: 'Gifter',
          recipient_name: 'Recipient',
        },
      };

      vi.mocked(mockKickAPIClient.getLiveEvents).mockResolvedValue([mockEvent]);
      vi.mocked(mockWebhookHandler.shouldActivatePollingFallback).mockReturnValue(true);

      pollingSystem.start();
      await new Promise(resolve => setTimeout(resolve, 150));

      const call = vi.mocked(mockNotificationManager.sendNotification).mock.calls[0];
      expect(call[0].type).toBe('new_subscriber');
    });
  });

  describe('Embed Generation', () => {
    it('should generate correct embed for stream_live event', async () => {
      const mockEvent: KickEvent = {
        id: 'event-1',
        type: 'stream_live',
        channel_id: 12345,
        timestamp: new Date(),
        data: {
          streamer_name: 'TestStreamer',
          title: 'Epic Gaming Session',
          category: 'Gaming',
          thumbnail_url: 'https://example.com/thumb.jpg',
        },
      };

      vi.mocked(mockKickAPIClient.getLiveEvents).mockResolvedValue([mockEvent]);
      vi.mocked(mockWebhookHandler.shouldActivatePollingFallback).mockReturnValue(true);

      pollingSystem.start();
      await new Promise(resolve => setTimeout(resolve, 150));

      const call = vi.mocked(mockNotificationManager.sendNotification).mock.calls[0];
      const embedData = call[1];
      expect(embedData.title).toContain('Stream Started');
      expect(embedData.description).toContain('TestStreamer');
      expect(embedData.thumbnail).toBe('https://example.com/thumb.jpg');
      expect(embedData.color).toBe(0x00ff00); // Green
    });

    it('should generate correct embed for stream_offline event', async () => {
      const mockEvent: KickEvent = {
        id: 'event-1',
        type: 'stream_offline',
        channel_id: 12345,
        timestamp: new Date(),
        data: {
          streamer_name: 'TestStreamer',
          duration: '2h 30m',
          peak_viewers: 1500,
        },
      };

      vi.mocked(mockKickAPIClient.getLiveEvents).mockResolvedValue([mockEvent]);
      vi.mocked(mockWebhookHandler.shouldActivatePollingFallback).mockReturnValue(true);

      pollingSystem.start();
      await new Promise(resolve => setTimeout(resolve, 150));

      const call = vi.mocked(mockNotificationManager.sendNotification).mock.calls[0];
      const embedData = call[1];
      expect(embedData.title).toContain('Stream Ended');
      expect(embedData.color).toBe(0xff0000); // Red
      expect(embedData.fields).toBeDefined();
    });

    it('should generate correct embed for new_subscriber event', async () => {
      const mockEvent: KickEvent = {
        id: 'event-1',
        type: 'new_subscriber',
        channel_id: 12345,
        timestamp: new Date(),
        data: {
          gifter_name: 'GenerousUser',
          recipient_name: 'LuckyUser',
        },
      };

      vi.mocked(mockKickAPIClient.getLiveEvents).mockResolvedValue([mockEvent]);
      vi.mocked(mockWebhookHandler.shouldActivatePollingFallback).mockReturnValue(true);

      pollingSystem.start();
      await new Promise(resolve => setTimeout(resolve, 150));

      const call = vi.mocked(mockNotificationManager.sendNotification).mock.calls[0];
      const embedData = call[1];
      expect(embedData.title).toContain('Subscription Gifted');
      expect(embedData.description).toContain('GenerousUser');
      expect(embedData.description).toContain('LuckyUser');
      expect(embedData.color).toBe(0xffd700); // Gold
    });
  });

  describe('System Control', () => {
    it('should stop polling when stop() is called', async () => {
      vi.mocked(mockWebhookHandler.shouldActivatePollingFallback).mockReturnValue(true);

      pollingSystem.start();
      await new Promise(resolve => setTimeout(resolve, 150));

      const callsBefore = vi.mocked(mockKickAPIClient.getLiveEvents).mock.calls.length;

      pollingSystem.stop();
      await new Promise(resolve => setTimeout(resolve, 150));

      const callsAfter = vi.mocked(mockKickAPIClient.getLiveEvents).mock.calls.length;

      // Should not have made additional calls after stop
      expect(callsAfter).toBe(callsBefore);
    });

    it('should allow forcing polling mode', () => {
      pollingSystem.forcePollingMode();
      expect(pollingSystem.getCurrentState()).toBe('polling');
    });

    it('should allow forcing webhook mode', async () => {
      pollingSystem.forcePollingMode();
      await new Promise(resolve => setTimeout(resolve, 50));

      pollingSystem.forceWebhookMode();
      expect(pollingSystem.getCurrentState()).toBe('webhook');
    });
  });

  describe('Status Reporting', () => {
    it('should provide accurate status information', () => {
      const status = pollingSystem.getStatus();

      expect(status).toHaveProperty('currentState');
      expect(status).toHaveProperty('isPolling');
      expect(status).toHaveProperty('lastPolledAt');
      expect(status).toHaveProperty('webhookHealth');
      expect(status).toHaveProperty('transitionCount');
    });

    it('should track transition history', async () => {
      vi.mocked(mockWebhookHandler.shouldActivatePollingFallback).mockReturnValue(true);
      pollingSystem.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      const history = pollingSystem.getTransitionHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty('from');
      expect(history[0]).toHaveProperty('to');
      expect(history[0]).toHaveProperty('reason');
      expect(history[0]).toHaveProperty('timestamp');
    });

    it('should limit transition history to 100 entries', async () => {
      // Force many transitions
      for (let i = 0; i < 150; i++) {
        pollingSystem.forcePollingMode();
        pollingSystem.forceWebhookMode();
      }

      const history = pollingSystem.getTransitionHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Disabled Mode', () => {
    it('should not start polling when disabled', () => {
      const disabledSystem = new PollingFallbackSystem({
        kickAPIClient: mockKickAPIClient,
        notificationManager: mockNotificationManager,
        webhookHandler: mockWebhookHandler,
        channelId: 12345,
        notificationChannelId: '987654321',
        enabled: false,
      });

      disabledSystem.start();

      // Should remain in webhook mode
      expect(disabledSystem.getCurrentState()).toBe('webhook');
      expect(disabledSystem.getStatus().isPolling).toBe(false);
    });
  });
});
