/**
 * @file kick-webhook.test.ts
 * @description Unit tests for Kick webhook handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import { KickWebhookHandler } from '@/webhooks/kick-webhook.js';
import type { NotificationManager } from '@/managers/notification.manager.js';
import type { KickWebhookPayload } from '@/webhooks/kick-webhook.js';

// Mock logger to avoid config validation
vi.mock('@/core/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  logError: vi.fn(),
}));

// Mock notification manager
const createMockNotificationManager = (): NotificationManager => {
  return {
    sendNotification: vi.fn().mockResolvedValue(undefined),
  } as any;
};

describe('KickWebhookHandler', () => {
  let handler: KickWebhookHandler;
  let mockNotificationManager: NotificationManager;
  const webhookSecret = 'test-secret-key';
  const notificationChannelId = '123456789';

  beforeEach(() => {
    mockNotificationManager = createMockNotificationManager();
    handler = new KickWebhookHandler({
      webhookSecret,
      notificationManager: mockNotificationManager,
      notificationChannelId,
    });
  });

  describe('verifySignature', () => {
    it('should verify valid signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const hmac = crypto.createHmac('sha256', webhookSecret);
      hmac.update(payload);
      const signature = hmac.digest('hex');

      const result = handler.verifySignature(payload, signature);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const invalidSignature = 'invalid-signature';

      const result = handler.verifySignature(payload, invalidSignature);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject missing signature', () => {
      const payload = JSON.stringify({ test: 'data' });

      const result = handler.verifySignature(payload, '');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing signature header');
    });

    it('should reject signature with wrong length', () => {
      const payload = JSON.stringify({ test: 'data' });
      const shortSignature = 'abc123';

      const result = handler.verifySignature(payload, shortSignature);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Signature length mismatch');
    });

    it('should use constant-time comparison', () => {
      const payload = JSON.stringify({ test: 'data' });
      const hmac = crypto.createHmac('sha256', webhookSecret);
      hmac.update(payload);
      const validSignature = hmac.digest('hex');

      // Create signature that differs by one character
      const almostValidSignature =
        validSignature.substring(0, validSignature.length - 1) + 'x';

      const result = handler.verifySignature(payload, almostValidSignature);

      expect(result.valid).toBe(false);
    });
  });

  describe('validatePayload', () => {
    it('should validate correct payload structure', () => {
      const payload: KickWebhookPayload = {
        event: 'livestream.started',
        timestamp: new Date().toISOString(),
        data: { streamer_name: 'Test' },
        channel_id: '12345',
      };

      const result = handler.validatePayload(payload);

      expect(result).toBe(true);
    });

    it('should reject payload without event field', () => {
      const payload = {
        timestamp: new Date().toISOString(),
        data: {},
      };

      const result = handler.validatePayload(payload);

      expect(result).toBe(false);
    });

    it('should reject payload without timestamp field', () => {
      const payload = {
        event: 'livestream.started',
        data: {},
      };

      const result = handler.validatePayload(payload);

      expect(result).toBe(false);
    });

    it('should reject payload without data field', () => {
      const payload = {
        event: 'livestream.started',
        timestamp: new Date().toISOString(),
      };

      const result = handler.validatePayload(payload);

      expect(result).toBe(false);
    });

    it('should reject payload with invalid event type', () => {
      const payload = {
        event: 'invalid.event.type',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const result = handler.validatePayload(payload);

      expect(result).toBe(false);
    });

    it('should accept all valid event types', () => {
      const validEvents = [
        'livestream.started',
        'livestream.ended',
        'livestream.metadata',
        'kicks.gifted',
        'moderation.banned',
        'chat.message.sent',
      ];

      for (const event of validEvents) {
        const payload = {
          event,
          timestamp: new Date().toISOString(),
          data: {},
        };

        const result = handler.validatePayload(payload);

        expect(result).toBe(true);
      }
    });

    it('should reject non-object payload', () => {
      const result = handler.validatePayload('not an object');

      expect(result).toBe(false);
    });

    it('should reject null payload', () => {
      const result = handler.validatePayload(null);

      expect(result).toBe(false);
    });
  });

  describe('handleWebhook', () => {
    it('should process valid webhook event', async () => {
      const payload: KickWebhookPayload = {
        event: 'livestream.started',
        timestamp: new Date().toISOString(),
        data: {
          streamer_name: 'TestStreamer',
          title: 'Test Stream',
        },
      };

      await handler.handleWebhook(payload);

      expect(mockNotificationManager.sendNotification).toHaveBeenCalledTimes(1);
      expect(mockNotificationManager.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'stream_live',
          channelId: notificationChannelId,
        }),
        expect.objectContaining({
          title: '🔴 Stream Started!',
          color: 0x00ff00,
        })
      );
    });

    it('should record success after processing webhook', async () => {
      const payload: KickWebhookPayload = {
        event: 'livestream.started',
        timestamp: new Date().toISOString(),
        data: {},
      };

      await handler.handleWebhook(payload);

      const health = handler.getHealthStatus();
      expect(health.failureCount).toBe(0);
      expect(health.lastSuccess).toBeDefined();
    });

    it('should record failure when processing fails', async () => {
      const payload: KickWebhookPayload = {
        event: 'livestream.started',
        timestamp: new Date().toISOString(),
        data: {},
      };

      // Make notification manager throw error
      vi.mocked(mockNotificationManager.sendNotification).mockRejectedValueOnce(
        new Error('Test error')
      );

      await expect(handler.handleWebhook(payload)).rejects.toThrow('Test error');

      const health = handler.getHealthStatus();
      expect(health.failureCount).toBe(1);
    });

    it('should generate correct embed for livestream.started', async () => {
      const payload: KickWebhookPayload = {
        event: 'livestream.started',
        timestamp: new Date().toISOString(),
        data: {
          streamer_name: 'TestStreamer',
          title: 'Test Stream',
          category: 'Gaming',
          thumbnail_url: 'https://example.com/thumb.jpg',
        },
      };

      await handler.handleWebhook(payload);

      expect(mockNotificationManager.sendNotification).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          title: '🔴 Stream Started!',
          description: 'TestStreamer is now live!',
          thumbnail: 'https://example.com/thumb.jpg',
          color: 0x00ff00,
          fields: expect.arrayContaining([
            expect.objectContaining({ name: 'Title', value: 'Test Stream' }),
            expect.objectContaining({ name: 'Category', value: 'Gaming' }),
          ]),
        })
      );
    });

    it('should generate correct embed for livestream.ended', async () => {
      const payload: KickWebhookPayload = {
        event: 'livestream.ended',
        timestamp: new Date().toISOString(),
        data: {
          streamer_name: 'TestStreamer',
          duration: '2h 30m',
          peak_viewers: 1500,
        },
      };

      await handler.handleWebhook(payload);

      expect(mockNotificationManager.sendNotification).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          title: '⚫ Stream Ended',
          description: 'TestStreamer has gone offline',
          color: 0xff0000,
        })
      );
    });

    it('should generate correct embed for kicks.gifted', async () => {
      const payload: KickWebhookPayload = {
        event: 'kicks.gifted',
        timestamp: new Date().toISOString(),
        data: {
          gifter_name: 'Gifter123',
          recipient_name: 'Recipient456',
        },
      };

      await handler.handleWebhook(payload);

      expect(mockNotificationManager.sendNotification).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          title: '🎁 Subscription Gifted!',
          description: 'Gifter123 gifted a subscription to Recipient456!',
          color: 0xffd700,
        })
      );
    });
  });

  describe('shouldActivatePollingFallback', () => {
    it('should return false initially', () => {
      expect(handler.shouldActivatePollingFallback()).toBe(false);
    });

    it('should return true after 3 consecutive failures', async () => {
      const payload: KickWebhookPayload = {
        event: 'livestream.started',
        timestamp: new Date().toISOString(),
        data: {},
      };

      // Cause 3 failures
      vi.mocked(mockNotificationManager.sendNotification).mockRejectedValue(
        new Error('Test error')
      );

      for (let i = 0; i < 3; i++) {
        await expect(handler.handleWebhook(payload)).rejects.toThrow();
      }

      expect(handler.shouldActivatePollingFallback()).toBe(true);
    });

    it('should reset failure count after successful webhook', async () => {
      const payload: KickWebhookPayload = {
        event: 'livestream.started',
        timestamp: new Date().toISOString(),
        data: {},
      };

      // Cause 2 failures
      vi.mocked(mockNotificationManager.sendNotification)
        .mockRejectedValueOnce(new Error('Test error'))
        .mockRejectedValueOnce(new Error('Test error'))
        .mockResolvedValueOnce(undefined);

      await expect(handler.handleWebhook(payload)).rejects.toThrow();
      await expect(handler.handleWebhook(payload)).rejects.toThrow();
      await handler.handleWebhook(payload);

      const health = handler.getHealthStatus();
      expect(health.failureCount).toBe(0);
      expect(handler.shouldActivatePollingFallback()).toBe(false);
    });
  });

  describe('getHealthStatus', () => {
    it('should return correct health status', () => {
      const health = handler.getHealthStatus();

      expect(health).toEqual({
        failureCount: 0,
        lastSuccess: null,
        shouldFallback: false,
      });
    });

    it('should update health status after webhook processing', async () => {
      const payload: KickWebhookPayload = {
        event: 'livestream.started',
        timestamp: new Date().toISOString(),
        data: {},
      };

      await handler.handleWebhook(payload);

      const health = handler.getHealthStatus();
      expect(health.failureCount).toBe(0);
      expect(health.lastSuccess).toBeInstanceOf(Date);
      expect(health.shouldFallback).toBe(false);
    });
  });

  describe('resetFailureCount', () => {
    it('should reset failure count', async () => {
      const payload: KickWebhookPayload = {
        event: 'livestream.started',
        timestamp: new Date().toISOString(),
        data: {},
      };

      // Cause failures
      vi.mocked(mockNotificationManager.sendNotification).mockRejectedValue(
        new Error('Test error')
      );

      await expect(handler.handleWebhook(payload)).rejects.toThrow();
      await expect(handler.handleWebhook(payload)).rejects.toThrow();

      expect(handler.getHealthStatus().failureCount).toBe(2);

      // Reset
      handler.resetFailureCount();

      const health = handler.getHealthStatus();
      expect(health.failureCount).toBe(0);
      expect(health.lastSuccess).toBeInstanceOf(Date);
    });
  });
});
