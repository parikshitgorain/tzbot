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

import { logger } from '../../core/logger/logger.js';
import type {
  KickAPIConfig,
  OAuthTokenResponse,
  StoredTokens,
  KickChannel,
  KickSubscriber,
  KickVIP,
  KickStreamStatus,
  KickEvent,
  RequestOptions,
  KickAPIError,
  RetryConfig,
} from './types.js';

export class KickAPIClient {
  private config: KickAPIConfig;
  private tokens: StoredTokens | null = null;
  private readonly baseUrl: string;
  private readonly retryConfig: RetryConfig = {
    maxRetries: 5,
    initialDelay: 1000, // 1 second
    maxDelay: 60000, // 60 seconds
    backoffMultiplier: 2,
  };

  constructor(config: KickAPIConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://kick.com/api/v2';

    logger.info('Kick API client initialized', {
      baseUrl: this.baseUrl,
      clientId: config.clientId,
    });
  }

  /**
   * Generate OAuth 2.0 authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'channel:read chat:read chat:write subscriptions:read',
    });

    if (state) {
      params.append('state', state);
    }

    const authUrl = `https://kick.com/oauth/authorize?${params.toString()}`;
    logger.debug('Generated OAuth authorization URL', { authUrl });

    return authUrl;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<StoredTokens> {
    logger.info('Exchanging authorization code for access token');

    try {
      const response = await fetch('https://kick.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: this.config.redirectUri,
          code,
        }),
      });

      if (!response.ok) {
        const error = await response.json() as KickAPIError;
        throw new Error(`Token exchange failed: ${error.error} - ${error.error_description}`);
      }

      const tokenResponse = await response.json() as OAuthTokenResponse;
      this.tokens = this.storeTokens(tokenResponse);

      logger.info('Successfully obtained access token', {
        expiresAt: this.tokens.expiresAt,
        scope: this.tokens.scope,
      });

      return this.tokens;
    } catch (error) {
      logger.error('Failed to exchange authorization code', { error });
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<StoredTokens> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    logger.info('Refreshing access token');

    try {
      const response = await fetch('https://kick.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: this.tokens.refreshToken,
        }),
      });

      if (!response.ok) {
        const error = await response.json() as KickAPIError;
        throw new Error(`Token refresh failed: ${error.error} - ${error.error_description}`);
      }

      const tokenResponse = await response.json() as OAuthTokenResponse;
      this.tokens = this.storeTokens(tokenResponse);

      logger.info('Successfully refreshed access token', {
        expiresAt: this.tokens.expiresAt,
      });

      return this.tokens;
    } catch (error) {
      logger.error('Failed to refresh access token', { error });
      throw error;
    }
  }

  /**
   * Store OAuth tokens with expiration tracking
   */
  private storeTokens(tokenResponse: OAuthTokenResponse): StoredTokens {
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenResponse.expires_in);

    return {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt,
      scope: tokenResponse.scope,
    };
  }

  /**
   * Check if access token is expired or about to expire
   */
  private isTokenExpired(): boolean {
    if (!this.tokens) {
      return true;
    }

    // Consider token expired if it expires within 5 minutes
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    const now = new Date().getTime();
    const expiresAt = this.tokens.expiresAt.getTime();

    return now >= expiresAt - bufferTime;
  }

  /**
   * Ensure valid access token, refreshing if necessary
   */
  private async ensureValidToken(): Promise<void> {
    if (this.isTokenExpired()) {
      logger.debug('Access token expired or about to expire, refreshing');
      await this.refreshAccessToken();
    }
  }

  /**
   * Make authenticated API request with retry logic and exponential backoff
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<T> {
    await this.ensureValidToken();

    const url = `${this.baseUrl}${endpoint}`;
    const maxRetries = options.retries ?? this.retryConfig.maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        logger.debug('Making API request', {
          url,
          method: options.method || 'GET',
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
        });

        const response = await fetch(url, {
          method: options.method || 'GET',
          headers: {
            'Authorization': `Bearer ${this.tokens?.accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers,
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
        });

        // Handle token expiration
        if (response.status === 401) {
          logger.warn('Received 401, attempting token refresh');
          await this.refreshAccessToken();

          // Retry the request with new token
          if (attempt < maxRetries) {
            continue;
          }
        }

        if (!response.ok) {
          const error = await response.json().catch(() => ({
            error: 'Unknown error',
            status: response.status,
          })) as KickAPIError;

          throw new Error(
            `API request failed: ${error.error} (status: ${response.status})`,
          );
        }

        const data = await response.json() as T;

        logger.debug('API request successful', {
          url,
          attempt: attempt + 1,
        });

        return data;
      } catch (error) {
        lastError = error as Error;

        logger.warn('API request failed', {
          url,
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          error: lastError.message,
        });

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Calculate exponential backoff delay
        const delay = this.calculateBackoffDelay(attempt);

        logger.debug('Retrying after delay', {
          delayMs: delay,
          nextAttempt: attempt + 2,
        });

        await this.sleep(delay);
      }
    }

    // All retries exhausted
    logger.error('API request failed after all retries', {
      url,
      attempts: maxRetries + 1,
      error: lastError,
    });

    throw lastError || new Error('API request failed after all retries');
  }

  /**
   * Calculate exponential backoff delay
   * Implements: Property 58 - Exponential Backoff
   */
  private calculateBackoffDelay(attempt: number): number {
    const delay = Math.min(
      this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt),
      this.retryConfig.maxDelay,
    );

    return delay;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get channel information by slug
   */
  async getChannel(slug: string): Promise<KickChannel> {
    logger.info('Fetching channel information', { slug });
    return this.makeRequest<KickChannel>(`/channels/${slug}`);
  }

  /**
   * Get channel subscribers
   * Note: This endpoint may not be available in Kick API
   */
  async getSubscribers(channelId: number): Promise<KickSubscriber[]> {
    logger.info('Fetching channel subscribers', { channelId });

    try {
      return await this.makeRequest<KickSubscriber[]>(
        `/channels/${channelId}/subscribers`,
      );
    } catch (error) {
      logger.warn('Subscribers endpoint not available, returning empty array', {
        channelId,
        error,
      });
      return [];
    }
  }

  /**
   * Get channel VIPs
   * Note: This endpoint may not be available in Kick API
   */
  async getVIPs(channelId: number): Promise<KickVIP[]> {
    logger.info('Fetching channel VIPs', { channelId });

    try {
      return await this.makeRequest<KickVIP[]>(`/channels/${channelId}/vips`);
    } catch (error) {
      logger.warn('VIPs endpoint not available, returning empty array', {
        channelId,
        error,
      });
      return [];
    }
  }

  /**
   * Get stream status
   */
  async getStreamStatus(channelId: number): Promise<KickStreamStatus> {
    logger.info('Fetching stream status', { channelId });
    return this.makeRequest<KickStreamStatus>(`/channels/${channelId}/livestream`);
  }

  /**
   * Get live events since a specific date
   */
  async getLiveEvents(channelId: number, since: Date): Promise<KickEvent[]> {
    logger.info('Fetching live events', { channelId, since });

    const params = new URLSearchParams({
      since: since.toISOString(),
    });

    try {
      return await this.makeRequest<KickEvent[]>(
        `/channels/${channelId}/events?${params.toString()}`,
      );
    } catch (error) {
      logger.warn('Events endpoint not available, returning empty array', {
        channelId,
        error,
      });
      return [];
    }
  }

  /**
   * Set stored tokens (for loading from database)
   */
  setTokens(tokens: StoredTokens): void {
    this.tokens = tokens;
    logger.info('Tokens loaded', {
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
    });
  }

  /**
   * Get current tokens
   */
  getTokens(): StoredTokens | null {
    return this.tokens;
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated(): boolean {
    return this.tokens !== null && !this.isTokenExpired();
  }

  /**
   * Clear stored tokens
   */
  clearTokens(): void {
    this.tokens = null;
    logger.info('Tokens cleared');
  }

  /**
   * Health check - makes a lightweight API call to verify connectivity
   * Used by the health check system to monitor Kick API health
   */
  async healthCheck(): Promise<void> {
    // Make a simple API call to check connectivity
    // Using the base API endpoint which should be lightweight
    const response = await fetch(`${this.baseUrl}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Kick API health check failed: ${response.status} ${response.statusText}`);
    }
  }
}

// Export singleton instance (will be initialized with config from environment)
let kickAPIClient: KickAPIClient | null = null;

export function initializeKickAPIClient(config: KickAPIConfig): KickAPIClient {
  kickAPIClient = new KickAPIClient(config);
  return kickAPIClient;
}

export function getKickAPIClient(): KickAPIClient {
  if (!kickAPIClient) {
    throw new Error('Kick API client not initialized. Call initializeKickAPIClient first.');
  }
  return kickAPIClient;
}
