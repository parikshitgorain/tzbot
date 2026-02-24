/**
 * @file client.ts
 * @description Pusher client for Kick chat monitoring
 * @module services/pusher
 *
 * This client connects to Kick's chat system via Pusher WebSocket.
 * It handles connection management, automatic reconnection, and message parsing.
 *
 * Requirements: 2.1-2.4
 */
import type { ConnectionState, PusherConnectionOptions } from './types.js';
export declare class PusherClient {
    private pusher;
    private channel;
    private connectionState;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectDelay;
    private maxReconnectDelay;
    private reconnectTimer;
    private readonly config;
    /**
     * Connect to Pusher and subscribe to Kick chat channel
     */
    connect(options: PusherConnectionOptions): Promise<void>;
    /**
     * Disconnect from Pusher
     */
    disconnect(): Promise<void>;
    /**
     * Get current connection state
     */
    getConnectionState(): ConnectionState;
    /**
     * Check if currently connected
     */
    isConnected(): boolean;
    /**
     * Set up Pusher connection state handlers
     */
    private setupConnectionHandlers;
    /**
     * Set up message event handlers
     */
    private setupMessageHandlers;
    /**
     * Parse raw Kick chat message data
     */
    private parseChatMessage;
    /**
     * Test Pusher connectivity
     */
    private testConnectivity;
    /**
     * Schedule automatic reconnection with exponential backoff
     */
    private scheduleReconnect;
    /**
     * Update connection state and notify listeners
     */
    private updateConnectionState;
}
export declare const pusherClient: PusherClient;
//# sourceMappingURL=client.d.ts.map