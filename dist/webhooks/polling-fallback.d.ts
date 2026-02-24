/**
 * @file polling-fallback.ts
 * @description Polling fallback system for Kick API when webhooks fail
 * @module webhooks
 *
 * Requirements:
 * - 8.3: Activate polling if webhooks fail for 3 consecutive events or 60 seconds
 * - 8.4: Check Kick API every 10 seconds while polling is active
 * - 8.5: Deactivate polling when webhooks resume functioning
 * - 8.6: Log all monitoring system transitions
 */
import type { KickAPIClient } from '../services/kick/client.js';
import type { NotificationManager } from '../managers/notification.manager.js';
import type { KickWebhookHandler } from './kick-webhook.js';
/**
 * Monitoring system state
 */
export type MonitoringState = 'webhook' | 'polling' | 'transitioning';
/**
 * Polling fallback configuration
 */
export interface PollingFallbackConfig {
    kickAPIClient: KickAPIClient;
    notificationManager: NotificationManager;
    webhookHandler: KickWebhookHandler;
    channelId: number;
    notificationChannelId: string;
    pollingIntervalMs?: number;
    healthCheckIntervalMs?: number;
    enabled?: boolean;
}
/**
 * System transition event
 */
interface SystemTransition {
    from: MonitoringState;
    to: MonitoringState;
    reason: string;
    timestamp: Date;
}
/**
 * Polling fallback system
 *
 * Monitors webhook health and automatically switches to polling when webhooks fail.
 * Automatically recovers to webhooks when they resume functioning.
 */
export declare class PollingFallbackSystem {
    private kickAPIClient;
    private notificationManager;
    private webhookHandler;
    private channelId;
    private notificationChannelId;
    private pollingIntervalMs;
    private healthCheckIntervalMs;
    private enabled;
    private currentState;
    private pollingTimer;
    private lastPolledEventTimestamp;
    private transitionHistory;
    private isPolling;
    constructor(config: PollingFallbackConfig);
    /**
     * Start monitoring webhook health and activate polling if needed
     */
    start(): void;
    /**
     * Stop the polling fallback system
     */
    stop(): void;
    /**
     * Check webhook health and activate polling if needed
     * Requirement 8.3: Activate polling if webhooks fail
     */
    private checkWebhookHealth;
    /**
     * Transition from webhook to polling mode
     * Requirement 8.3: Activate polling fallback
     * Requirement 8.6: Log system transitions
     */
    private transitionToPolling;
    /**
     * Transition from polling back to webhook mode
     * Requirement 8.5: Deactivate polling when webhooks resume
     * Requirement 8.6: Log system transitions
     */
    private transitionToWebhook;
    /**
     * Start polling the Kick API
     * Requirement 8.4: Check Kick API every 10 seconds
     */
    private startPolling;
    /**
     * Stop polling the Kick API
     */
    private stopPolling;
    /**
     * Poll the Kick API for new events
     */
    private pollKickAPI;
    /**
     * Process an event received from polling
     */
    private processPolledEvent;
    /**
     * Map Kick event type to internal event type
     */
    private mapEventType;
    /**
     * Generate embed data for polled event
     */
    private generateEmbedData;
    /**
     * Record a system transition
     * Requirement 8.6: Log all system transitions
     */
    private recordTransition;
    /**
     * Get current monitoring state
     */
    getCurrentState(): MonitoringState;
    /**
     * Get transition history
     */
    getTransitionHistory(): SystemTransition[];
    /**
     * Get system status
     */
    getStatus(): {
        currentState: MonitoringState;
        isPolling: boolean;
        lastPolledAt: Date | null;
        webhookHealth: ReturnType<KickWebhookHandler['getHealthStatus']>;
        transitionCount: number;
    };
    /**
     * Force transition to polling mode (for testing)
     */
    forcePollingMode(): void;
    /**
     * Force transition to webhook mode (for testing)
     */
    forceWebhookMode(): void;
}
export {};
//# sourceMappingURL=polling-fallback.d.ts.map