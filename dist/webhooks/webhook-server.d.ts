/**
 * @file webhook-server.ts
 * @description Express server for receiving Kick webhooks with HTTPS support
 * @module webhooks
 */
import express from 'express';
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
export declare class WebhookServer {
    private app;
    private server;
    private config;
    private webhookHandler;
    private requestCount;
    private errorCount;
    constructor(config: WebhookServerConfig, webhookHandler: KickWebhookHandler);
    /**
     * Setup Express middleware
     */
    private setupMiddleware;
    /**
     * Setup webhook routes
     */
    private setupRoutes;
    /**
     * Setup error handling
     */
    private setupErrorHandling;
    /**
     * Start the webhook server
     */
    start(): Promise<void>;
    /**
     * Stop the webhook server
     */
    stop(): Promise<void>;
    /**
     * Get server statistics
     */
    getStats(): {
        requestCount: number;
        errorCount: number;
        isRunning: boolean;
    };
    /**
     * Get Express app instance (for testing)
     */
    getApp(): express.Application;
}
//# sourceMappingURL=webhook-server.d.ts.map