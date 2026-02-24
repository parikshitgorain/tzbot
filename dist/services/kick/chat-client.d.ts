/**
 * @file chat-client.ts
 * @description Kick chat monitoring client using Pusher
 * @module services/kick
 *
 * This client provides a high-level interface for monitoring Kick chat,
 * extracting user badges, and handling chat events for role synchronization.
 *
 * Requirements: 2.1-2.4
 */
import type { KickChatMessage, ConnectionState } from '../pusher/types.js';
export interface KickChatClientOptions {
    channelId: string;
    onMessage?: (message: KickChatMessage) => void | Promise<void>;
    onSubscriberDetected?: (username: string, months?: number) => void | Promise<void>;
    onVIPDetected?: (username: string) => void | Promise<void>;
    onConnectionChange?: (state: ConnectionState) => void;
    onError?: (error: Error) => void;
}
export interface UserBadgeInfo {
    username: string;
    isSubscriber: boolean;
    isVIP: boolean;
    isModerator: boolean;
    isBroadcaster: boolean;
    subscriberMonths?: number;
}
/**
 * High-level client for monitoring Kick chat and extracting badge information
 */
export declare class KickChatClient {
    private options;
    private isMonitoring;
    /**
     * Start monitoring Kick chat for the specified channel
     */
    connect(options: KickChatClientOptions): Promise<void>;
    /**
     * Stop monitoring Kick chat
     */
    disconnect(): Promise<void>;
    /**
     * Check if currently monitoring
     */
    isConnected(): boolean;
    /**
     * Get current connection state
     */
    getConnectionState(): ConnectionState;
    /**
     * Extract badge information from a chat message
     */
    extractBadges(message: KickChatMessage): UserBadgeInfo;
    /**
     * Handle incoming chat messages
     */
    private handleMessage;
    /**
     * Handle connection state changes
     */
    private handleConnectionChange;
    /**
     * Handle connection errors
     */
    private handleError;
}
export declare const kickChatClient: KickChatClient;
//# sourceMappingURL=chat-client.d.ts.map