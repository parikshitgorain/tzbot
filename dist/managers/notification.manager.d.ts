/**
 * @file notification.manager.ts
 * @description Notification manager for delivering Premium_Embeds to Discord channels
 * @module managers
 */
import type { IDiscordClient } from '../core/discord/client.js';
import type { NotificationEvent } from '../types/models.js';
import type { Punishment } from '../moderation/punishment-calculator.js';
import type { NotificationResult } from '../moderation/offense-manager.js';
/**
 * Premium embed data structure
 */
export interface PremiumEmbedData {
    title: string;
    description: string;
    thumbnail?: string;
    color?: number;
    fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
    }>;
}
/**
 * Notification manager configuration
 */
export interface NotificationManagerConfig {
    primaryChannelId: string;
    fallbackChannelId?: string;
    maxRetries?: number;
    retryDelayMs?: number;
    getChannelId?: () => string;
    getFallbackChannelId?: () => string | undefined;
    modLogChannelId?: string;
    getModLogChannelId?: () => string | undefined;
}
/**
 * Notification manager for delivering Premium_Embeds
 *
 * Requirements:
 * - 1.1: Deliver Premium_Embed within 1 second
 * - 1.2: Format embeds with title, description, thumbnail, timestamp, color
 * - 1.3: Deliver multiple events in chronological order
 * - 1.4: Only send to designated channel
 * - 1.5: Fallback channel delivery on error
 */
export declare class NotificationManager {
    private discordClient;
    private config;
    private notificationQueue;
    private processingQueue;
    private maxRetries;
    private retryDelayMs;
    constructor(discordClient: IDiscordClient, config: NotificationManagerConfig);
    /**
     * Get the current primary channel ID (supports dynamic updates)
     */
    private getPrimaryChannelId;
    /**
     * Get the current fallback channel ID (supports dynamic updates)
     */
    private getFallbackChannelId;
    /**
     * Get the mod-log channel ID for punishment notifications
     */
    private getModLogChannelId;
    /**
     * Send a notification event as a Premium_Embed
     * Requirement 1.1: Deliver within 1 second
     * Requirement 1.4: Only send to designated channel
     */
    sendNotification(event: NotificationEvent, embedData: PremiumEmbedData): Promise<void>;
    /**
     * Format a Premium_Embed with all required fields
     * Requirement 1.2: Include title, description, thumbnail, timestamp, color
     */
    private formatPremiumEmbed;
    /**
     * Handle delivery failure with fallback channel
     * Requirement 1.5: Log error and attempt delivery to fallback channel
     */
    private handleDeliveryFailure;
    /**
     * Queue a notification for retry
     */
    private queueForRetry;
    /**
     * Process the notification retry queue
     */
    private processQueue;
    /**
     * Send multiple notifications in chronological order
     * Requirement 1.3: Deliver all Premium_Embeds in chronological order
     */
    sendNotifications(events: Array<{
        event: NotificationEvent;
        embedData: PremiumEmbedData;
    }>): Promise<void>;
    /**
     * Get queue statistics
     */
    getQueueStats(): {
        queueSize: number;
        processing: boolean;
        oldestQueuedAt?: Date;
    };
    /**
     * Clear the notification queue
     */
    clearQueue(): void;
    /**
     * Validate and clean queue on startup
     * Removes notifications with invalid channel IDs (placeholder values)
     */
    validateAndCleanQueue(): void;
    /**
     * Send punishment notification through triple notification system
     * Requirement 3.1-3.4: DM, ephemeral message, and mod-log notification
     *
     * @param userId - Discord user ID
     * @param channelId - Channel where offense occurred
     * @param punishment - Calculated punishment
     * @param reason - Reason for the offense
     * @param offenseCount - Current offense count
     * @returns NotificationResult with success flags and failures
     */
    sendPunishmentNotification(userId: string, channelId: string, punishment: Punishment, reason: string, offenseCount: number): Promise<NotificationResult>;
    /**
     * Format punishment description for display
     */
    private formatPunishmentDescription;
    /**
     * Get color for punishment type
     */
    private getPunishmentColor;
}
//# sourceMappingURL=notification.manager.d.ts.map