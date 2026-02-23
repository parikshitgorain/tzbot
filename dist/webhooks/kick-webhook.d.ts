/**
 * @file kick-webhook.ts
 * @description Webhook receiver for Kick.com events with signature verification
 * @module webhooks
 */
import type { NotificationManager } from '../managers/notification.manager.js';
/**
 * Kick webhook event types
 */
export type KickWebhookEventType = 'livestream.started' | 'livestream.ended' | 'livestream.metadata' | 'kicks.gifted' | 'moderation.banned' | 'chat.message.sent';
/**
 * Kick webhook payload structure
 */
export interface KickWebhookPayload {
    event: KickWebhookEventType;
    timestamp: string;
    data: Record<string, any>;
    channel_id?: string;
    channel_slug?: string;
}
/**
 * Webhook verification result
 */
export interface WebhookVerificationResult {
    valid: boolean;
    error?: string;
}
/**
 * Webhook handler configuration
 */
export interface KickWebhookHandlerConfig {
    webhookSecret: string;
    notificationManager: NotificationManager;
    notificationChannelId: string;
}
/**
 * Kick webhook handler with signature verification
 *
 * Requirements:
 * - 8.1: Use webhooks as primary mechanism for receiving Kick events
 * - 8.2: Disable polling while webhooks are functioning
 * - 8.3: Activate polling fallback if webhooks fail
 */
export declare class KickWebhookHandler {
    private webhookSecret;
    private notificationManager;
    private notificationChannelId;
    private webhookFailureCount;
    private lastWebhookSuccess;
    private readonly MAX_FAILURES;
    private readonly FAILURE_WINDOW_MS;
    constructor(config: KickWebhookHandlerConfig);
    /**
     * Verify webhook signature using HMAC-SHA256
     *
     * @param payload - Raw request body as string
     * @param signature - Signature from x-kick-signature header
     * @returns Verification result
     */
    verifySignature(payload: string, signature: string): WebhookVerificationResult;
    /**
     * Validate webhook payload structure
     *
     * @param payload - Parsed webhook payload
     * @returns True if payload is valid
     */
    validatePayload(payload: any): payload is KickWebhookPayload;
    /**
     * Handle incoming webhook event
     *
     * @param payload - Validated webhook payload
     */
    handleWebhook(payload: KickWebhookPayload): Promise<void>;
    /**
     * Convert Kick webhook payload to NotificationEvent
     */
    private convertToNotificationEvent;
    /**
     * Map Kick webhook event type to internal event type
     */
    private mapEventType;
    /**
     * Generate embed data based on webhook event type
     */
    private generateEmbedData;
    /**
     * Record successful webhook delivery
     */
    private recordWebhookSuccess;
    /**
     * Record webhook failure and check if fallback should be activated
     */
    private recordWebhookFailure;
    /**
     * Check if polling fallback should be activated
     * Requirement 8.3: Activate polling if webhooks fail for 3 consecutive events or 60 seconds
     */
    shouldActivatePollingFallback(): boolean;
    /**
     * Get webhook health status
     */
    getHealthStatus(): {
        failureCount: number;
        lastSuccess: Date | null;
        shouldFallback: boolean;
    };
    /**
     * Reset webhook failure count (called when polling detects webhooks are working again)
     */
    resetFailureCount(): void;
}
//# sourceMappingURL=kick-webhook.d.ts.map