/**
 * @file announcement-relay.manager.ts
 * @description Announcement relay system for moderator messages
 *
 * Features:
 * - Relay messages from private moderator channel to public channels
 * - Preserve formatting, embeds, and attachments
 * - !embed command: Convert message content to Discord embeds
 * - Automatic failure notifications
 *
 * @module managers
 */
import type { IDiscordClient } from '../core/discord/client.js';
/**
 * Announcement relay configuration
 */
export interface AnnouncementRelayConfig {
    privateChannelId: string;
    publicChannelIds: string[];
    guildId: string;
    moderatorRoleId: string;
}
/**
 * Announcement relay manager
 *
 * Requirements:
 * - 6.1: Relay messages within 2 seconds
 * - 6.2: Preserve message formatting, embeds, and attachments
 * - 6.3: Attribute messages to TZBOT
 * - 6.4: Relay to all configured public channels
 * - 6.5: Notify moderator on relay failure
 */
export declare class AnnouncementRelayManager {
    private discordClient;
    private config;
    private enabled;
    private isListening;
    constructor(discordClient: IDiscordClient, config: AnnouncementRelayConfig);
    /**
     * Message handler bound to this instance
     */
    private boundMessageHandler?;
    /**
     * Start monitoring the private channel for announcements
     */
    start(): void;
    /**
     * Handle incoming messages from the private channel
     */
    private handleMessage;
    /**
     * Check if the message author is a moderator
     */
    private isUserModerator;
    /**
     * Relay a message to all configured public channels
     * Requirement 6.1: Relay within 2 seconds
     * Requirement 6.2: Preserve formatting, embeds, and attachments
     * Requirement 6.3: Attribute to TZBOT
     * Requirement 6.4: Relay to all configured channels
     * Requirement 6.5: Notify on failure
     */
    private relayMessage;
    /**
     * Prepare message content for relay
     * Requirement 6.2: Preserve message formatting, embeds, and attachments
     */
    private prepareMessageContent;
    /**
     * Prepare embed message from !embed command
     * Supports both plain text and JSON format
     *
     * Plain text: !embed Your message here
     * JSON (embed only): !embed {"title": "Title", "description": "Description", "color": 0xFF0000}
     * JSON (full message): !embed {"content": "@everyone", "embeds": [{"title": "Title", ...}]}
     */
    private prepareEmbedMessage;
    /**
     * Create EmbedBuilder from JSON data
     */
    private createEmbedFromJSON;
    /**
     * Process timestamps in text to Discord's dynamic timestamp format
     * Converts patterns like <t:UNIX_TIMESTAMP:R> or {{UNIX_TIMESTAMP}} to Discord timestamps
     */
    private processTimestamps;
    /**
     * Relay message to a specific channel
     */
    private relayToChannel;
    /**
     * Notify moderator of relay failures
     * Requirement 6.5: Notify moderator in private channel on failure
     */
    private notifyModeratorOfFailures;
    /**
     * Enable the announcement relay
     */
    enable(): void;
    /**
     * Disable the announcement relay
     */
    disable(): void;
    /**
     * Stop monitoring (remove event listener)
     */
    stop(): void;
    /**
     * Check if relay is enabled
     */
    isEnabled(): boolean;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<AnnouncementRelayConfig>): void;
}
//# sourceMappingURL=announcement-relay.manager.d.ts.map