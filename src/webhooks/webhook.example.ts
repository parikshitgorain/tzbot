/**
 * @file webhook.example.ts
 * @description Example usage of the Kick webhook receiver
 * @module webhooks
 */

import { KickWebhookHandler } from './kick-webhook.js';
import { WebhookServer } from './webhook-server.js';
import { NotificationManager } from '@/managers/notification.manager.js';
import type { IDiscordClient } from '@/core/discord/client.js';

/**
 * Example: Setting up the webhook receiver
 */
async function setupWebhookReceiver(
  discordClient: IDiscordClient,
  config: {
    webhookSecret: string;
    webhookPort: number;
    webhookHost: string;
    notificationChannelId: string;
    fallbackChannelId?: string;
  }
): Promise<{ server: WebhookServer; handler: KickWebhookHandler }> {
  // Initialize notification manager
  const notificationManager = new NotificationManager(discordClient, {
    primaryChannelId: config.notificationChannelId,
    fallbackChannelId: config.fallbackChannelId,
    maxRetries: 3,
    retryDelayMs: 5000,
  });

  // Initialize webhook handler
  const webhookHandler = new KickWebhookHandler({
    webhookSecret: config.webhookSecret,
    notificationManager,
    notificationChannelId: config.notificationChannelId,
  });

  // Initialize webhook server
  const webhookServer = new WebhookServer(
    {
      port: config.webhookPort,
      host: config.webhookHost,
      webhookPath: '/webhooks/kick',
      requestSizeLimit: '1mb',
      enableRequestLogging: true,
    },
    webhookHandler
  );

  // Start the server
  await webhookServer.start();

  console.log('Webhook receiver setup complete');
  console.log(`Webhook URL: http://${config.webhookHost}:${config.webhookPort}/webhooks/kick`);
  console.log('Health check: http://${config.webhookHost}:${config.webhookPort}/health');

  return { server: webhookServer, handler: webhookHandler };
}

/**
 * Example: Monitoring webhook health
 */
function monitorWebhookHealth(
  webhookHandler: KickWebhookHandler,
  onFallbackNeeded: () => void
): NodeJS.Timeout {
  // Check webhook health every 30 seconds
  const interval = setInterval(() => {
    const health = webhookHandler.getHealthStatus();

    console.log('Webhook health:', {
      failureCount: health.failureCount,
      lastSuccess: health.lastSuccess,
      shouldFallback: health.shouldFallback,
    });

    // Activate polling fallback if needed
    if (health.shouldFallback) {
      console.log('⚠️ Webhook failures detected, activating polling fallback');
      onFallbackNeeded();
    }
  }, 30000);

  return interval;
}

/**
 * Example: Graceful shutdown
 */
async function shutdownWebhookReceiver(
  server: WebhookServer,
  healthMonitor: NodeJS.Timeout
): Promise<void> {
  console.log('Shutting down webhook receiver...');

  // Stop health monitoring
  clearInterval(healthMonitor);

  // Stop webhook server
  await server.stop();

  console.log('Webhook receiver shutdown complete');
}

/**
 * Example: Complete setup with monitoring
 */
export async function exampleWebhookSetup(
  discordClient: IDiscordClient
): Promise<void> {
  const config = {
    webhookSecret: process.env.KICK_WEBHOOK_SECRET || '',
    webhookPort: parseInt(process.env.WEBHOOK_PORT || '3000'),
    webhookHost: process.env.WEBHOOK_HOST || '0.0.0.0',
    notificationChannelId: process.env.NOTIFICATION_CHANNEL_ID || '',
    fallbackChannelId: process.env.FALLBACK_CHANNEL_ID,
  };

  // Setup webhook receiver
  const { server, handler } = await setupWebhookReceiver(discordClient, config);

  // Monitor webhook health
  const healthMonitor = monitorWebhookHealth(handler, () => {
    // Callback when polling fallback should be activated
    console.log('Activating polling fallback...');
    // TODO: Activate polling system here
  });

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    await shutdownWebhookReceiver(server, healthMonitor);
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await shutdownWebhookReceiver(server, healthMonitor);
    process.exit(0);
  });

  console.log('Webhook receiver is running');
}

/**
 * Example: Testing webhook signature verification
 */
export function exampleSignatureVerification(): void {
  const webhookSecret = 'your-webhook-secret';
  const payload = JSON.stringify({
    event: 'livestream.started',
    timestamp: new Date().toISOString(),
    data: {
      streamer_name: 'TestStreamer',
      title: 'Test Stream',
    },
  });

  // Create signature (this is what Kick would do)
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', webhookSecret);
  hmac.update(payload);
  const signature = hmac.digest('hex');

  console.log('Payload:', payload);
  console.log('Signature:', signature);
  console.log('\nTo test webhook, send POST request to /webhooks/kick with:');
  console.log('Header: x-kick-signature:', signature);
  console.log('Body:', payload);
}

/**
 * Example: HTTPS setup notes
 * 
 * For production, you should use HTTPS for webhook endpoints.
 * There are several approaches:
 * 
 * 1. Reverse Proxy (Recommended):
 *    - Use Nginx or Caddy as reverse proxy
 *    - Let's Encrypt for free SSL certificates
 *    - Proxy HTTPS traffic to HTTP webhook server
 * 
 * 2. Direct HTTPS in Express:
 *    - Use https.createServer() instead of http
 *    - Provide SSL certificate and key
 *    - More complex to manage certificates
 * 
 * Example Nginx configuration:
 * 
 * server {
 *   listen 443 ssl;
 *   server_name webhooks.yourdomain.com;
 * 
 *   ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
 *   ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
 * 
 *   location /webhooks/kick {
 *     proxy_pass http://localhost:3000/webhooks/kick;
 *     proxy_set_header Host $host;
 *     proxy_set_header X-Real-IP $remote_addr;
 *     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
 *     proxy_set_header X-Forwarded-Proto $scheme;
 *   }
 * }
 * 
 * Example Caddy configuration (even simpler):
 * 
 * webhooks.yourdomain.com {
 *   reverse_proxy /webhooks/kick localhost:3000
 * }
 */
