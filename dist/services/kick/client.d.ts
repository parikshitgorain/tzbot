/**
 * @file client.ts
 * @description Kick API client with OAuth 2.0 authentication
 * @module services/kick
 *
 * This client handles OAuth 2.0 authentication, token management,
 * and API requests with automatic retry logic and exponential backoff.
 *
 * Requirements: 2.1-2.4, 8.1-8.7, 14.6
 */
import type { KickAPIConfig, StoredTokens, KickChannel, KickSubscriber, KickVIP, KickStreamStatus, KickEvent } from './types.js';
export declare class KickAPIClient {
    private config;
    private tokens;
    private readonly baseUrl;
    private readonly retryConfig;
    constructor(config: KickAPIConfig);
    /**
     * Generate OAuth 2.0 authorization URL
     */
    getAuthorizationUrl(state?: string): string;
    /**
     * Exchange authorization code for access token
     */
    exchangeCodeForToken(code: string): Promise<StoredTokens>;
    /**
     * Refresh access token using refresh token
     */
    refreshAccessToken(): Promise<StoredTokens>;
    /**
     * Store OAuth tokens with expiration tracking
     */
    private storeTokens;
    /**
     * Check if access token is expired or about to expire
     */
    private isTokenExpired;
    /**
     * Ensure valid access token, refreshing if necessary
     */
    private ensureValidToken;
    /**
     * Make authenticated API request with retry logic and exponential backoff
     */
    private makeRequest;
    /**
     * Calculate exponential backoff delay
     * Implements: Property 58 - Exponential Backoff
     */
    private calculateBackoffDelay;
    /**
     * Sleep for specified milliseconds
     */
    private sleep;
    /**
     * Get channel information by slug
     */
    getChannel(slug: string): Promise<KickChannel>;
    /**
     * Get channel subscribers
     * Note: This endpoint may not be available in Kick API
     */
    getSubscribers(channelId: number): Promise<KickSubscriber[]>;
    /**
     * Get channel VIPs
     * Note: This endpoint may not be available in Kick API
     */
    getVIPs(channelId: number): Promise<KickVIP[]>;
    /**
     * Get stream status
     */
    getStreamStatus(channelId: number): Promise<KickStreamStatus>;
    /**
     * Get live events since a specific date
     */
    getLiveEvents(channelId: number, since: Date): Promise<KickEvent[]>;
    /**
     * Set stored tokens (for loading from database)
     */
    setTokens(tokens: StoredTokens): void;
    /**
     * Get current tokens
     */
    getTokens(): StoredTokens | null;
    /**
     * Check if client is authenticated
     */
    isAuthenticated(): boolean;
    /**
     * Clear stored tokens
     */
    clearTokens(): void;
    /**
     * Health check - makes a lightweight API call to verify connectivity
     * Used by the health check system to monitor Kick API health
     */
    healthCheck(): Promise<void>;
}
export declare function initializeKickAPIClient(config: KickAPIConfig): KickAPIClient;
export declare function getKickAPIClient(): KickAPIClient;
//# sourceMappingURL=client.d.ts.map