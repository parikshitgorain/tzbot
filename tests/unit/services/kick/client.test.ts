/**
 * @file client.test.ts
 * @description Unit tests for Kick API client
 * @module tests/unit/services/kick
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock logger before importing client
vi.mock('../../../../src/core/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { KickAPIClient } from '../../../../src/services/kick/client.js';
import type { KickAPIConfig, StoredTokens, OAuthTokenResponse } from '../../../../src/services/kick/types.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('KickAPIClient', () => {
  let client: KickAPIClient;
  let config: KickAPIConfig;

  beforeEach(() => {
    config = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/callback',
    };
    client = new KickAPIClient(config);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('OAuth 2.0 Flow', () => {
    it('should generate correct authorization URL', () => {
      const authUrl = client.getAuthorizationUrl('test-state');
      
      expect(authUrl).toContain('https://kick.com/oauth/authorize');
      expect(authUrl).toContain('client_id=test-client-id');
      expect(authUrl).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback');
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain('state=test-state');
      expect(authUrl).toContain('scope=channel%3Aread+chat%3Aread+chat%3Awrite+subscriptions%3Aread');
    });

    it('should generate authorization URL without state parameter', () => {
      const authUrl = client.getAuthorizationUrl();
      
      expect(authUrl).toContain('https://kick.com/oauth/authorize');
      expect(authUrl).not.toContain('state=');
    });

    it('should exchange authorization code for access token', async () => {
      const mockTokenResponse: OAuthTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'test-refresh-token',
        scope: 'channel:read chat:read',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      const tokens = await client.exchangeCodeForToken('test-code');

      expect(tokens.accessToken).toBe('test-access-token');
      expect(tokens.refreshToken).toBe('test-refresh-token');
      expect(tokens.scope).toBe('channel:read chat:read');
      expect(tokens.expiresAt).toBeInstanceOf(Date);
      expect(client.isAuthenticated()).toBe(true);

      // Verify fetch was called correctly
      expect(global.fetch).toHaveBeenCalledWith(
        'https://kick.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('authorization_code'),
        })
      );
    });

    it('should handle token exchange failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Invalid authorization code',
        }),
      });

      await expect(client.exchangeCodeForToken('invalid-code')).rejects.toThrow(
        'Token exchange failed: invalid_grant - Invalid authorization code'
      );
    });

    it('should refresh access token', async () => {
      // Set initial tokens
      const initialTokens: StoredTokens = {
        accessToken: 'old-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() - 1000), // Expired
        scope: 'channel:read',
      };
      client.setTokens(initialTokens);

      const mockTokenResponse: OAuthTokenResponse = {
        access_token: 'new-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'new-refresh-token',
        scope: 'channel:read chat:read',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      const newTokens = await client.refreshAccessToken();

      expect(newTokens.accessToken).toBe('new-access-token');
      expect(newTokens.refreshToken).toBe('new-refresh-token');
      expect(client.isAuthenticated()).toBe(true);

      // Verify fetch was called correctly
      expect(global.fetch).toHaveBeenCalledWith(
        'https://kick.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('refresh_token'),
        })
      );
    });

    it('should handle refresh token failure', async () => {
      const tokens: StoredTokens = {
        accessToken: 'old-access-token',
        refreshToken: 'invalid-refresh-token',
        expiresAt: new Date(Date.now() - 1000),
        scope: 'channel:read',
      };
      client.setTokens(tokens);

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Invalid refresh token',
        }),
      });

      await expect(client.refreshAccessToken()).rejects.toThrow(
        'Token refresh failed: invalid_grant - Invalid refresh token'
      );
    });

    it('should throw error when refreshing without refresh token', async () => {
      await expect(client.refreshAccessToken()).rejects.toThrow(
        'No refresh token available'
      );
    });
  });

  describe('Token Management', () => {
    it('should set and get tokens', () => {
      const tokens: StoredTokens = {
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: new Date(Date.now() + 3600000),
        scope: 'channel:read',
      };

      client.setTokens(tokens);
      const retrievedTokens = client.getTokens();

      expect(retrievedTokens).toEqual(tokens);
      expect(client.isAuthenticated()).toBe(true);
    });

    it('should detect expired tokens', () => {
      const expiredTokens: StoredTokens = {
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        scope: 'channel:read',
      };

      client.setTokens(expiredTokens);
      expect(client.isAuthenticated()).toBe(false);
    });

    it('should detect tokens about to expire (within 5 minutes)', () => {
      const soonToExpireTokens: StoredTokens = {
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: new Date(Date.now() + 4 * 60 * 1000), // Expires in 4 minutes
        scope: 'channel:read',
      };

      client.setTokens(soonToExpireTokens);
      expect(client.isAuthenticated()).toBe(false);
    });

    it('should clear tokens', () => {
      const tokens: StoredTokens = {
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: new Date(Date.now() + 3600000),
        scope: 'channel:read',
      };

      client.setTokens(tokens);
      expect(client.isAuthenticated()).toBe(true);

      client.clearTokens();
      expect(client.getTokens()).toBeNull();
      expect(client.isAuthenticated()).toBe(false);
    });
  });

  describe('API Requests', () => {
    beforeEach(() => {
      // Set valid tokens for API requests
      const tokens: StoredTokens = {
        accessToken: 'valid-access-token',
        refreshToken: 'valid-refresh-token',
        expiresAt: new Date(Date.now() + 3600000), // Expires in 1 hour
        scope: 'channel:read',
      };
      client.setTokens(tokens);
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should get channel information', async () => {
      const mockChannel = {
        id: 12345,
        slug: 'test-channel',
        user_id: 67890,
        username: 'TestUser',
        is_live: true,
        subscriber_count: 100,
        follower_count: 1000,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockChannel,
      });

      const channel = await client.getChannel('test-channel');

      expect(channel).toEqual(mockChannel);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://kick.com/api/v2/channels/test-channel',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer valid-access-token',
          }),
        })
      );
    });

    it('should get stream status', async () => {
      const mockStream = {
        id: 54321,
        channel_id: 12345,
        is_live: true,
        started_at: new Date(),
        title: 'Test Stream',
        viewer_count: 500,
        category: 'Gaming',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStream,
      });

      const stream = await client.getStreamStatus(12345);

      expect(stream).toEqual(mockStream);
    });

    it('should handle unavailable subscribers endpoint gracefully', async () => {
      // Mock all retries to fail immediately
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not Found', status: 404 }),
      });

      const promise = client.getSubscribers(12345);
      await vi.runAllTimersAsync();
      const subscribers = await promise;

      expect(subscribers).toEqual([]);
    });

    it('should handle unavailable VIPs endpoint gracefully', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not Found', status: 404 }),
      });

      const promise = client.getVIPs(12345);
      await vi.runAllTimersAsync();
      const vips = await promise;

      expect(vips).toEqual([]);
    });

    it('should handle unavailable events endpoint gracefully', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not Found', status: 404 }),
      });

      const promise = client.getLiveEvents(12345, new Date());
      await vi.runAllTimersAsync();
      const events = await promise;

      expect(events).toEqual([]);
    });
  });

  describe('Retry Logic and Exponential Backoff', () => {
    beforeEach(() => {
      const tokens: StoredTokens = {
        accessToken: 'valid-access-token',
        refreshToken: 'valid-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
        scope: 'channel:read',
      };
      client.setTokens(tokens);
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should retry failed requests with exponential backoff', async () => {
      // Mock 2 failures, then success
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 12345, slug: 'test' }),
        });

      const promise = client.getChannel('test');
      
      // Fast-forward through all timers
      await vi.runAllTimersAsync();
      
      const channel = await promise;

      expect(channel.id).toBe(12345);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      // Mock all requests to fail
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const promise = client.getChannel('test');
      
      // Run all timers and wait for the promise to settle
      await Promise.all([
        vi.runAllTimersAsync(),
        expect(promise).rejects.toThrow('Network error'),
      ]);

      // Should try 6 times (initial + 5 retries)
      expect(global.fetch).toHaveBeenCalledTimes(6);
    });

    it('should calculate exponential backoff correctly', async () => {
      // Access private method through type assertion
      const calculateBackoff = (client as any).calculateBackoffDelay.bind(client);

      // Test exponential backoff: 1s, 2s, 4s, 8s, 16s, capped at 60s
      expect(calculateBackoff(0)).toBe(1000); // 1 second
      expect(calculateBackoff(1)).toBe(2000); // 2 seconds
      expect(calculateBackoff(2)).toBe(4000); // 4 seconds
      expect(calculateBackoff(3)).toBe(8000); // 8 seconds
      expect(calculateBackoff(4)).toBe(16000); // 16 seconds
      expect(calculateBackoff(5)).toBe(32000); // 32 seconds
      expect(calculateBackoff(6)).toBe(60000); // Capped at 60 seconds
      expect(calculateBackoff(10)).toBe(60000); // Still capped at 60 seconds
    });

    it('should automatically refresh token on 401 response', async () => {
      const mockTokenResponse: OAuthTokenResponse = {
        access_token: 'new-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'new-refresh-token',
        scope: 'channel:read',
      };

      // First request returns 401, then token refresh succeeds, then retry succeeds
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ error: 'Unauthorized' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 12345, slug: 'test' }),
        });

      const channel = await client.getChannel('test');

      expect(channel.id).toBe(12345);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Token Expiration Handling', () => {
    it('should automatically refresh expired token before request', async () => {
      // Set expired token
      const expiredTokens: StoredTokens = {
        accessToken: 'expired-token',
        refreshToken: 'valid-refresh-token',
        expiresAt: new Date(Date.now() - 1000), // Expired
        scope: 'channel:read',
      };
      client.setTokens(expiredTokens);

      const mockTokenResponse: OAuthTokenResponse = {
        access_token: 'new-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'new-refresh-token',
        scope: 'channel:read',
      };

      // Mock token refresh, then API request
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 12345, slug: 'test' }),
        });

      const channel = await client.getChannel('test');

      expect(channel.id).toBe(12345);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      
      // Verify token was refreshed
      const tokens = client.getTokens();
      expect(tokens?.accessToken).toBe('new-access-token');
    });

    it('should refresh token about to expire (within 5 minutes)', async () => {
      // Set token expiring in 4 minutes
      const soonToExpireTokens: StoredTokens = {
        accessToken: 'soon-to-expire-token',
        refreshToken: 'valid-refresh-token',
        expiresAt: new Date(Date.now() + 4 * 60 * 1000),
        scope: 'channel:read',
      };
      client.setTokens(soonToExpireTokens);

      const mockTokenResponse: OAuthTokenResponse = {
        access_token: 'new-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'new-refresh-token',
        scope: 'channel:read',
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 12345, slug: 'test' }),
        });

      await client.getChannel('test');

      // Verify token was refreshed
      const tokens = client.getTokens();
      expect(tokens?.accessToken).toBe('new-access-token');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      const tokens: StoredTokens = {
        accessToken: 'valid-access-token',
        refreshToken: 'valid-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
        scope: 'channel:read',
      };
      client.setTokens(tokens);
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle API errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not Found' }),
      });

      const promise = client.getChannel('nonexistent');
      
      // Run all timers and wait for the promise to settle
      await Promise.all([
        vi.runAllTimersAsync(),
        expect(promise).rejects.toThrow('API request failed: Not Found (status: 404)'),
      ]);
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const promise = client.getChannel('test');
      
      // Run all timers and wait for the promise to settle
      await Promise.all([
        vi.runAllTimersAsync(),
        expect(promise).rejects.toThrow('Network error'),
      ]);
    });

    it('should handle malformed JSON responses', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const promise = client.getChannel('test');
      
      // Run all timers and wait for the promise to settle
      await Promise.all([
        vi.runAllTimersAsync(),
        expect(promise).rejects.toThrow(),
      ]);
    });
  });
});
