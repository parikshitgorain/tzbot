/**
 * @file webhook-server.ts
 * @description Express server for receiving Kick webhooks with HTTPS support
 * @module webhooks
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import type { Server } from 'http';
import { logger, logError } from '@/core/logger/logger.js';
import type { KickWebhookHandler } from './kick-webhook.js';

/**
 * Webhook server configuration
 */
export interface WebhookServerConfig {
  port: number;
  host: string;
  webhookPath?: string;
  requestSizeLimit?: string;
  enableRequestLogging?: boolean;
}

/**
 * Request with raw body for signature verification
 */
interface RequestWithRawBody extends Request {
  rawBody?: string;
}

/**
 * Webhook server for receiving Kick events
 * 
 * Requirements:
 * - 8.1: Receive webhook callbacks as primary mechanism
 * - Implement HTTPS setup (via reverse proxy recommended)
 * - Implement webhook signature verification
 * - Validate webhook payload structure
 * - Route events to notification manager
 * - Implement request logging
 */
export class WebhookServer {
  private app: express.Application;
  private server: Server | null = null;
  private config: WebhookServerConfig;
  private webhookHandler: KickWebhookHandler;
  private requestCount: number = 0;
  private errorCount: number = 0;

  constructor(config: WebhookServerConfig, webhookHandler: KickWebhookHandler) {
    this.config = {
      webhookPath: '/webhooks/kick',
      requestSizeLimit: '1mb',
      enableRequestLogging: true,
      ...config,
    };
    this.webhookHandler = webhookHandler;
    this.app = express();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();

    logger.info('WebhookServer initialized', {
      port: this.config.port,
      host: this.config.host,
      webhookPath: this.config.webhookPath,
    });
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Parse JSON with raw body for signature verification
    this.app.use(
      express.json({
        limit: this.config.requestSizeLimit,
        verify: (req: RequestWithRawBody, _res, buf) => {
          // Store raw body for signature verification
          req.rawBody = buf.toString('utf8');
        },
      })
    );

    // Request logging middleware
    if (this.config.enableRequestLogging) {
      this.app.use((req: Request, res: Response, next: NextFunction) => {
        const startTime = Date.now();

        // Log request
        logger.debug('Incoming request', {
          method: req.method,
          path: req.path,
          ip: req.ip,
          userAgent: req.get('user-agent'),
        });

        // Log response
        res.on('finish', () => {
          const duration = Date.now() - startTime;
          logger.info('Request completed', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs: duration,
          });
        });

        next();
      });
    }

    // CORS headers (if needed for webhook testing)
    this.app.use((_req: Request, res: Response, next: NextFunction) => {
      res.setHeader('X-Powered-By', 'TZBOT-Webhook-Server');
      next();
    });
  }

  /**
   * Setup webhook routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      const health = {
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        requests: {
          total: this.requestCount,
          errors: this.errorCount,
        },
        webhook: this.webhookHandler.getHealthStatus(),
      };

      res.status(200).json(health);
    });

    // Kick webhook endpoint
    this.app.post(
      this.config.webhookPath!,
      async (req: RequestWithRawBody, res: Response) => {
        this.requestCount++;

        try {
          // Get signature from header
          const signature = req.get('x-kick-signature') || '';

          // Verify signature using raw body
          const rawBody = req.rawBody || JSON.stringify(req.body);
          const verification = this.webhookHandler.verifySignature(
            rawBody,
            signature
          );

          if (!verification.valid) {
            logger.warn('Webhook signature verification failed', {
              error: verification.error,
              ip: req.ip,
            });

            this.errorCount++;
            res.status(401).json({
              error: 'Invalid signature',
              message: verification.error,
            });
            return;
          }

          // Validate payload structure
          if (!this.webhookHandler.validatePayload(req.body)) {
            logger.warn('Invalid webhook payload structure', {
              body: req.body,
              ip: req.ip,
            });

            this.errorCount++;
            res.status(400).json({
              error: 'Invalid payload',
              message: 'Payload structure validation failed',
            });
            return;
          }

          // Handle webhook event
          await this.webhookHandler.handleWebhook(req.body);

          // Return success response
          res.status(200).json({
            success: true,
            message: 'Webhook processed successfully',
            event: req.body.event,
          });
        } catch (error) {
          logError('Error processing webhook', error as Error, {
            path: req.path,
            ip: req.ip,
          });

          this.errorCount++;

          res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to process webhook',
          });
        }
      }
    );

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      logger.warn('Route not found', {
        method: req.method,
        path: req.path,
        ip: req.ip,
      });

      res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.path} not found`,
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.app.use(
      (err: Error, _req: Request, res: Response, _next: NextFunction) => {
        logError('Express error handler', err);

        this.errorCount++;

        res.status(500).json({
          error: 'Internal server error',
          message: err.message,
        });
      }
    );
  }

  /**
   * Start the webhook server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(
          this.config.port,
          this.config.host,
          () => {
            logger.info('Webhook server started', {
              host: this.config.host,
              port: this.config.port,
              webhookPath: this.config.webhookPath,
              url: `http://${this.config.host}:${this.config.port}${this.config.webhookPath}`,
            });
            resolve();
          }
        );

        this.server.on('error', (error: Error) => {
          logError('Webhook server error', error);
          reject(error);
        });
      } catch (error) {
        logError('Failed to start webhook server', error as Error);
        reject(error);
      }
    });
  }

  /**
   * Stop the webhook server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error) => {
        if (error) {
          logError('Error stopping webhook server', error);
          reject(error);
        } else {
          logger.info('Webhook server stopped');
          this.server = null;
          resolve();
        }
      });
    });
  }

  /**
   * Get server statistics
   */
  getStats(): {
    requestCount: number;
    errorCount: number;
    isRunning: boolean;
  } {
    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      isRunning: this.server !== null,
    };
  }

  /**
   * Get Express app instance (for testing)
   */
  getApp(): express.Application {
    return this.app;
  }
}
