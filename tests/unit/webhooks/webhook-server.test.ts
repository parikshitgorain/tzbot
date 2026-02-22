/**
 * @file webhook-server.test.ts
 * @description Unit tests for webhook server
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { WebhookServer } from '@/webhooks/webhook-server.js';
import { KickWebhookHandler } from '@/webhooks/kick-webhook.js';
import type { NotificationManager } from '@/managers/notification.manager.js';

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

describe('WebhookServer', () => {
  let server: WebhookServer;
  let handler: KickWebhookHandler;
  const webhookSecret = 'test-secret-key';

  const createSignature = (payload: string): string => {
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(payload);
    return hmac.digest('hex');
  };

  beforeEach(() => {
    const mockNotificationManager = createMockNotificationManager();
    handler = new KickWebhookHandler({
      webhookSecret,
      notificationManager: mockNotificationManager,
      notificationChannelId: '123456789',
    });

    server = new WebhookServer(
      {
        port: 3001,
        host: 'localhost',
        webhookPath: '/webhooks/kick',
        enableRequestLogging: false, // Disable for tests
      },
      handler
    );
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('Health endpoint', () => {
    it('should return health status', async () => {
      const response = await request(server.getApp()).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        uptime: expect.any(Number),
        timestamp: expect.any(String),
        requests: {
          total: expect.any(Number),
          errors: expect.any(Number),
        },
        webhook: {
          failureCount: expect.any(Number),
          shouldFallback: expect.any(Boolean),
        },
      });
    });
  });

  describe('Webhook endpoint', () => {
    it('should accept valid webhook with correct signature', async () => {
      const payload = {
        event: 'livestream.started',
        timestamp: new Date().toISOString(),
        data: {
          streamer_name: 'TestStreamer',
        },
      };

      const payloadString = JSON.stringify(payload);
      const signature = createSignature(payloadString);

      const response = await request(server.getApp())
        .post('/webhooks/kick')
        .set('x-kick-signature', signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Webhook processed successfully',
        event: 'livestream.started',
      });
    });

    it('should reject webhook with invalid signature', async () => {
      const payload = {
        event: 'livestream.started',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const response = await request(server.getApp())
        .post('/webhooks/kick')
        .set('x-kick-signature', 'invalid-signature')
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: 'Invalid signature',
      });
    });

    it('should reject webhook without signature', async () => {
      const payload = {
        event: 'livestream.started',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const response = await request(server.getApp())
        .post('/webhooks/kick')
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: 'Invalid signature',
      });
    });

    it('should reject webhook with invalid payload structure', async () => {
      const payload = {
        // Missing required fields
        invalid: 'payload',
      };

      const payloadString = JSON.stringify(payload);
      const signature = createSignature(payloadString);

      const response = await request(server.getApp())
        .post('/webhooks/kick')
        .set('x-kick-signature', signature)
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Invalid payload',
      });
    });

    it('should reject webhook with invalid event type', async () => {
      const payload = {
        event: 'invalid.event',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const payloadString = JSON.stringify(payload);
      const signature = createSignature(payloadString);

      const response = await request(server.getApp())
        .post('/webhooks/kick')
        .set('x-kick-signature', signature)
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Invalid payload',
      });
    });

    it('should handle all valid event types', async () => {
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

        const payloadString = JSON.stringify(payload);
        const signature = createSignature(payloadString);

        const response = await request(server.getApp())
          .post('/webhooks/kick')
          .set('x-kick-signature', signature)
          .send(payload);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should track request statistics', async () => {
      const payload = {
        event: 'livestream.started',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const payloadString = JSON.stringify(payload);
      const signature = createSignature(payloadString);

      // Send multiple requests
      await request(server.getApp())
        .post('/webhooks/kick')
        .set('x-kick-signature', signature)
        .send(payload);

      await request(server.getApp())
        .post('/webhooks/kick')
        .set('x-kick-signature', signature)
        .send(payload);

      const stats = server.getStats();
      expect(stats.requestCount).toBeGreaterThanOrEqual(2);
      expect(stats.isRunning).toBe(false); // Not started in tests
    });

    it('should track error statistics', async () => {
      const payload = {
        event: 'invalid.event',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const payloadString = JSON.stringify(payload);
      const signature = createSignature(payloadString);

      await request(server.getApp())
        .post('/webhooks/kick')
        .set('x-kick-signature', signature)
        .send(payload);

      const stats = server.getStats();
      expect(stats.errorCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('404 handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(server.getApp()).get('/unknown-route');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        error: 'Not found',
      });
    });

    it('should return 404 for wrong HTTP method', async () => {
      const response = await request(server.getApp()).get('/webhooks/kick');

      expect(response.status).toBe(404);
    });
  });

  describe('Server lifecycle', () => {
    it('should start and stop server', async () => {
      await server.start();
      expect(server.getStats().isRunning).toBe(true);

      await server.stop();
      expect(server.getStats().isRunning).toBe(false);
    });

    it('should handle multiple stop calls', async () => {
      await server.stop();
      await server.stop(); // Should not throw
    });
  });

  describe('Request size limit', () => {
    it('should handle large payloads within limit', async () => {
      const payload = {
        event: 'livestream.started',
        timestamp: new Date().toISOString(),
        data: {
          // Create moderately sized data object (within 1MB limit)
          description: 'x'.repeat(100000), // 100KB
        },
      };

      const payloadString = JSON.stringify(payload);
      const signature = createSignature(payloadString);

      const response = await request(server.getApp())
        .post('/webhooks/kick')
        .set('x-kick-signature', signature)
        .send(payload);

      // Should succeed if within limit
      expect(response.status).toBe(200);
    });
  });

  describe('Security headers', () => {
    it('should include security headers', async () => {
      const response = await request(server.getApp()).get('/health');

      expect(response.headers['x-powered-by']).toBe('TZBOT-Webhook-Server');
    });
  });
});
