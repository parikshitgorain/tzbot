/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file kick-webhook.ts
 * @description Webhook receiver for Kick.com events with signature verification
 * @module webhooks
 */
import crypto from 'crypto';
import { logger, logError } from '../core/logger/logger.js';
import { EventType } from '../types/models.js';
import { v4 as uuidv4 } from 'uuid';
/**
 * Kick webhook handler with signature verification
 *
 * Requirements:
 * - 8.1: Use webhooks as primary mechanism for receiving Kick events
 * - 8.2: Disable polling while webhooks are functioning
 * - 8.3: Activate polling fallback if webhooks fail
 */
export class KickWebhookHandler {
    webhookSecret;
    notificationManager;
    notificationChannelId;
    webhookFailureCount = 0;
    lastWebhookSuccess = null;
    MAX_FAILURES = 3;
    FAILURE_WINDOW_MS = 60000; // 60 seconds
    constructor(config) {
        this.webhookSecret = config.webhookSecret;
        this.notificationManager = config.notificationManager;
        this.notificationChannelId = config.notificationChannelId;
        logger.info('KickWebhookHandler initialized', {
            hasSecret: !!this.webhookSecret,
            notificationChannelId: this.notificationChannelId,
        });
    }
    /**
     * Verify webhook signature using HMAC-SHA256
     *
     * @param payload - Raw request body as string
     * @param signature - Signature from x-kick-signature header
     * @returns Verification result
     */
    verifySignature(payload, signature) {
        if (!signature) {
            return {
                valid: false,
                error: 'Missing signature header',
            };
        }
        if (!this.webhookSecret) {
            logger.warn('Webhook secret not configured, skipping verification');
            return {
                valid: true,
            };
        }
        try {
            // Create HMAC with SHA256
            const hmac = crypto.createHmac('sha256', this.webhookSecret);
            hmac.update(payload);
            const expectedSignature = hmac.digest('hex');
            // Constant-time comparison to prevent timing attacks
            const signatureBuffer = Buffer.from(signature);
            const expectedBuffer = Buffer.from(expectedSignature);
            if (signatureBuffer.length !== expectedBuffer.length) {
                return {
                    valid: false,
                    error: 'Signature length mismatch',
                };
            }
            const isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
            if (!isValid) {
                logger.warn('Webhook signature verification failed', {
                    receivedSignature: signature.substring(0, 10) + '...',
                    expectedSignature: expectedSignature.substring(0, 10) + '...',
                });
            }
            return {
                valid: isValid,
                error: isValid ? undefined : 'Invalid signature',
            };
        }
        catch (error) {
            logError('Error verifying webhook signature', error);
            return {
                valid: false,
                error: 'Signature verification error',
            };
        }
    }
    /**
     * Validate webhook payload structure
     *
     * @param payload - Parsed webhook payload
     * @returns True if payload is valid
     */
    validatePayload(payload) {
        if (!payload || typeof payload !== 'object') {
            logger.warn('Invalid payload: not an object');
            return false;
        }
        if (!payload.event || typeof payload.event !== 'string') {
            logger.warn('Invalid payload: missing or invalid event field');
            return false;
        }
        if (!payload.timestamp || typeof payload.timestamp !== 'string') {
            logger.warn('Invalid payload: missing or invalid timestamp field');
            return false;
        }
        if (!payload.data || typeof payload.data !== 'object') {
            logger.warn('Invalid payload: missing or invalid data field');
            return false;
        }
        // Validate event type
        const validEvents = [
            'livestream.started',
            'livestream.ended',
            'livestream.metadata',
            'kicks.gifted',
            'moderation.banned',
            'chat.message.sent',
        ];
        if (!validEvents.includes(payload.event)) {
            logger.warn('Invalid payload: unknown event type', {
                event: payload.event,
            });
            return false;
        }
        return true;
    }
    /**
     * Handle incoming webhook event
     *
     * @param payload - Validated webhook payload
     */
    async handleWebhook(payload) {
        try {
            logger.info('Processing webhook event', {
                event: payload.event,
                timestamp: payload.timestamp,
                channelId: payload.channel_id,
            });
            // Convert to NotificationEvent
            const notificationEvent = this.convertToNotificationEvent(payload);
            // Generate embed data based on event type
            const embedData = this.generateEmbedData(payload);
            // Send notification
            await this.notificationManager.sendNotification(notificationEvent, embedData);
            // Record successful webhook
            this.recordWebhookSuccess();
            logger.info('Webhook event processed successfully', {
                event: payload.event,
                eventId: notificationEvent.id,
            });
        }
        catch (error) {
            logError('Error handling webhook event', error, {
                additionalContext: {
                    event: payload.event,
                    timestamp: payload.timestamp,
                },
            });
            // Record webhook failure
            this.recordWebhookFailure();
            throw error;
        }
    }
    /**
     * Convert Kick webhook payload to NotificationEvent
     */
    convertToNotificationEvent(payload) {
        return {
            id: uuidv4(),
            type: this.mapEventType(payload.event),
            channelId: this.notificationChannelId,
            data: payload.data,
            timestamp: new Date(payload.timestamp),
            delivered: false,
        };
    }
    /**
     * Map Kick webhook event type to internal event type
     */
    mapEventType(kickEvent) {
        const eventMap = {
            'livestream.started': EventType.STREAM_LIVE,
            'livestream.ended': EventType.STREAM_OFFLINE,
            'livestream.metadata': EventType.STREAM_LIVE, // Treat metadata updates as stream live
            'kicks.gifted': EventType.NEW_SUBSCRIBER,
            'moderation.banned': EventType.STREAM_LIVE, // Default to stream live for unmapped events
            'chat.message.sent': EventType.STREAM_LIVE, // Default to stream live for unmapped events
        };
        return eventMap[kickEvent] || EventType.STREAM_LIVE;
    }
    /**
     * Generate embed data based on webhook event type
     */
    generateEmbedData(payload) {
        switch (payload.event) {
            case 'livestream.started':
                return {
                    title: '🔴 Stream Started!',
                    description: `${payload.data.streamer_name || 'Streamer'} is now live!`,
                    thumbnail: payload.data.thumbnail_url,
                    color: 0x00ff00, // Green
                    fields: [
                        {
                            name: 'Title',
                            value: payload.data.title || 'No title',
                            inline: false,
                        },
                        {
                            name: 'Category',
                            value: payload.data.category || 'Unknown',
                            inline: true,
                        },
                    ],
                };
            case 'livestream.ended':
                return {
                    title: '⚫ Stream Ended',
                    description: `${payload.data.streamer_name || 'Streamer'} has gone offline`,
                    color: 0xff0000, // Red
                    fields: [
                        {
                            name: 'Duration',
                            value: payload.data.duration || 'Unknown',
                            inline: true,
                        },
                        {
                            name: 'Peak Viewers',
                            value: payload.data.peak_viewers?.toString() || 'Unknown',
                            inline: true,
                        },
                    ],
                };
            case 'kicks.gifted':
                return {
                    title: '🎁 Subscription Gifted!',
                    description: `${payload.data.gifter_name} gifted a subscription to ${payload.data.recipient_name}!`,
                    color: 0xffd700, // Gold
                    fields: [
                        {
                            name: 'Gifter',
                            value: payload.data.gifter_name || 'Anonymous',
                            inline: true,
                        },
                        {
                            name: 'Recipient',
                            value: payload.data.recipient_name || 'Unknown',
                            inline: true,
                        },
                    ],
                };
            case 'moderation.banned':
                return {
                    title: '🔨 User Banned',
                    description: `${payload.data.username} has been banned from the channel`,
                    color: 0xff0000, // Red
                    fields: [
                        {
                            name: 'Reason',
                            value: payload.data.reason || 'No reason provided',
                            inline: false,
                        },
                        {
                            name: 'Moderator',
                            value: payload.data.moderator || 'System',
                            inline: true,
                        },
                    ],
                };
            default:
                return {
                    title: '📢 Kick Event',
                    description: `Event: ${payload.event}`,
                    color: 0x5865f2, // Discord blurple
                };
        }
    }
    /**
     * Record successful webhook delivery
     */
    recordWebhookSuccess() {
        this.lastWebhookSuccess = new Date();
        this.webhookFailureCount = 0;
    }
    /**
     * Record webhook failure and check if fallback should be activated
     */
    recordWebhookFailure() {
        this.webhookFailureCount++;
        logger.warn('Webhook failure recorded', {
            failureCount: this.webhookFailureCount,
            maxFailures: this.MAX_FAILURES,
        });
        // Check if we should activate polling fallback (Requirement 8.3)
        if (this.shouldActivatePollingFallback()) {
            logger.error('Webhook failure threshold exceeded, polling fallback should be activated', {
                failureCount: this.webhookFailureCount,
                maxFailures: this.MAX_FAILURES,
            });
        }
    }
    /**
     * Check if polling fallback should be activated
     * Requirement 8.3: Activate polling if webhooks fail for 3 consecutive events or 60 seconds
     */
    shouldActivatePollingFallback() {
        // Check consecutive failures
        if (this.webhookFailureCount >= this.MAX_FAILURES) {
            return true;
        }
        // Check time-based failure (60 seconds without success)
        if (this.lastWebhookSuccess) {
            const timeSinceSuccess = Date.now() - this.lastWebhookSuccess.getTime();
            if (timeSinceSuccess >= this.FAILURE_WINDOW_MS) {
                return true;
            }
        }
        return false;
    }
    /**
     * Get webhook health status
     */
    getHealthStatus() {
        return {
            failureCount: this.webhookFailureCount,
            lastSuccess: this.lastWebhookSuccess,
            shouldFallback: this.shouldActivatePollingFallback(),
        };
    }
    /**
     * Reset webhook failure count (called when polling detects webhooks are working again)
     */
    resetFailureCount() {
        logger.info('Resetting webhook failure count');
        this.webhookFailureCount = 0;
        this.lastWebhookSuccess = new Date();
    }
}
//# sourceMappingURL=kick-webhook.js.map