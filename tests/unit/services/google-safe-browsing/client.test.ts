/**
 * @file client.test.ts
 * @description Unit tests for Google Safe Browsing API client
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GoogleSafeBrowsingClient, ThreatType } from '@/services/google-safe-browsing/client.js';
import { redisClient } from '@/core/cache/redis.client.js';

// Mock Redis client
vi.mock('@/core/cache/redis.client.js', () => ({
  redisClient: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

// Mock logger
vi.mock('@/core/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
  logError: vi.fn(),
}));

// Mock config
vi.mock('@/config/index.js', () => ({
  config: {
    googleSafeBrowsingApiKey: 'test-api-key',
  },
}));

describe('GoogleSafeBrowsingClient', () => {
  let client: GoogleSafeBrowsingClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new GoogleSafeBrowsingClient('test-api-key');
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isConfigured', () => {
    it('should return true when API key is provided', () => {
      expect(client.isConfigured()).toBe(true);
    });

    it('should return false when API key is empty', () => {
      const unconfiguredClient = new GoogleSafeBrowsingClient('');
      expect(unconfiguredClient.isConfigured()).toBe(false);
    });
  });

  describe('checkUrl', () => {
    it('should return safe result for safe URL', async () => {
      // Mock cache miss
      vi.mocked(redisClient.get).mockResolvedValue(null);

      // Mock API response (no threats)
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const result = await client.checkUrl('https://example.com');

      expect(result.url).toBe('https://example.com');
      expect(result.isSafe).toBe(true);
      expect(result.threats).toEqual([]);
      expect(result.cached).toBe(false);
    });

    it('should return unsafe result for malicious URL', async () => {
      // Mock cache miss
      vi.mocked(redisClient.get).mockResolvedValue(null);

      // Mock API response (threats detected)
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          matches: [
            {
              threatType: ThreatType.MALWARE,
              platformType: 'ANY_PLATFORM',
              threat: { url: 'https://malicious.com' },
              cacheDuration: '300s',
              threatEntryType: 'URL',
            },
          ],
        }),
      });

      const result = await client.checkUrl('https://malicious.com');

      expect(result.url).toBe('https://malicious.com');
      expect(result.isSafe).toBe(false);
      expect(result.threats).toContain(ThreatType.MALWARE);
      expect(result.cached).toBe(false);
    });

    it('should return cached result when available', async () => {
      const cachedResult = {
        url: 'https://cached.com',
        isSafe: true,
        threats: [],
        cached: false,
        checkedAt: new Date().toISOString(),
      };

      // Mock cache hit
      vi.mocked(redisClient.get).mockResolvedValue(JSON.stringify(cachedResult));

      const result = await client.checkUrl('https://cached.com');

      expect(result.url).toBe('https://cached.com');
      expect(result.cached).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should cache API results', async () => {
      // Mock cache miss
      vi.mocked(redisClient.get).mockResolvedValue(null);

      // Mock API response
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await client.checkUrl('https://example.com');

      expect(redisClient.set).toHaveBeenCalledWith(
        expect.stringContaining('gsb:url:'),
        expect.any(String),
        1800 // 30 minutes TTL
      );
    });

    it('should return safe result when API is not configured', async () => {
      const unconfiguredClient = new GoogleSafeBrowsingClient('');

      const result = await unconfiguredClient.checkUrl('https://example.com');

      expect(result.isSafe).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should return safe result on API error', async () => {
      // Mock cache miss
      vi.mocked(redisClient.get).mockResolvedValue(null);

      // Mock API error
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const result = await client.checkUrl('https://example.com');

      expect(result.isSafe).toBe(true); // Fail open
    });

    it('should detect multiple threat types', async () => {
      // Mock cache miss
      vi.mocked(redisClient.get).mockResolvedValue(null);

      // Mock API response with multiple threats
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          matches: [
            {
              threatType: ThreatType.MALWARE,
              platformType: 'ANY_PLATFORM',
              threat: { url: 'https://malicious.com' },
              cacheDuration: '300s',
              threatEntryType: 'URL',
            },
            {
              threatType: ThreatType.SOCIAL_ENGINEERING,
              platformType: 'ANY_PLATFORM',
              threat: { url: 'https://malicious.com' },
              cacheDuration: '300s',
              threatEntryType: 'URL',
            },
          ],
        }),
      });

      const result = await client.checkUrl('https://malicious.com');

      expect(result.isSafe).toBe(false);
      expect(result.threats).toContain(ThreatType.MALWARE);
      expect(result.threats).toContain(ThreatType.SOCIAL_ENGINEERING);
      expect(result.threats).toHaveLength(2);
    });
  });

  describe('checkUrls', () => {
    it('should check multiple URLs', async () => {
      // Mock cache miss for all URLs
      vi.mocked(redisClient.get).mockResolvedValue(null);

      // Mock API response
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          matches: [
            {
              threatType: ThreatType.MALWARE,
              platformType: 'ANY_PLATFORM',
              threat: { url: 'https://malicious.com' },
              cacheDuration: '300s',
              threatEntryType: 'URL',
            },
          ],
        }),
      });

      const urls = ['https://safe.com', 'https://malicious.com'];
      const results = await client.checkUrls(urls);

      expect(results).toHaveLength(2);
      expect(results[0].url).toBe('https://safe.com');
      expect(results[0].isSafe).toBe(true);
      expect(results[1].url).toBe('https://malicious.com');
      expect(results[1].isSafe).toBe(false);
    });

    it('should return empty array for empty input', async () => {
      const results = await client.checkUrls([]);
      expect(results).toEqual([]);
    });

    it('should use cached results when available', async () => {
      const cachedResult = {
        url: 'https://cached.com',
        isSafe: true,
        threats: [],
        cached: false,
        checkedAt: new Date().toISOString(),
      };

      // Mock cache hit for first URL, miss for second
      vi.mocked(redisClient.get)
        .mockResolvedValueOnce(JSON.stringify(cachedResult))
        .mockResolvedValueOnce(null);

      // Mock API response for uncached URL
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const urls = ['https://cached.com', 'https://uncached.com'];
      const results = await client.checkUrls(urls);

      expect(results).toHaveLength(2);
      expect(results[0].cached).toBe(true);
      expect(results[1].cached).toBe(false);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return initial status when no state exists', async () => {
      vi.mocked(redisClient.get).mockResolvedValue(null);

      const status = await client.getRateLimitStatus();

      expect(status.count).toBe(0);
      expect(status.limit).toBe(10000);
      expect(status.resetAt).toBeInstanceOf(Date);
    });

    it('should return current status from Redis', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const state = {
        count: 500,
        resetAt: tomorrow.getTime(),
      };

      vi.mocked(redisClient.get).mockResolvedValue(JSON.stringify(state));

      const status = await client.getRateLimitStatus();

      expect(status.count).toBe(500);
      expect(status.limit).toBe(10000);
    });

    it('should reset count when reset time has passed', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const state = {
        count: 9999,
        resetAt: yesterday.getTime(),
      };

      vi.mocked(redisClient.get).mockResolvedValue(JSON.stringify(state));

      const status = await client.getRateLimitStatus();

      expect(status.count).toBe(0); // Should reset
    });
  });

  describe('clearCache', () => {
    it('should clear cache for a URL', async () => {
      await client.clearCache('https://example.com');

      expect(redisClient.del).toHaveBeenCalledWith(
        expect.stringContaining('gsb:url:https://example.com')
      );
    });
  });

  describe('rate limiting', () => {
    it('should return safe result when rate limited', async () => {
      // Mock cache miss
      vi.mocked(redisClient.get).mockResolvedValueOnce(null);

      // Mock rate limit exceeded
      const state = {
        count: 10000,
        resetAt: Date.now() + 86400000, // Tomorrow
      };
      vi.mocked(redisClient.get).mockResolvedValueOnce(JSON.stringify(state));

      const result = await client.checkUrl('https://example.com');

      expect(result.isSafe).toBe(true); // Fail open when rate limited
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('API request structure', () => {
    it('should send correct request format', async () => {
      // Mock cache miss
      vi.mocked(redisClient.get).mockResolvedValue(null);

      // Mock API response
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await client.checkUrl('https://example.com');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('safebrowsing.googleapis.com'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('threatTypes'),
        })
      );

      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(requestBody.client.clientId).toBe('tzbot-discord-bot');
      expect(requestBody.threatInfo.threatTypes).toContain('MALWARE');
      expect(requestBody.threatInfo.threatTypes).toContain('SOCIAL_ENGINEERING');
      expect(requestBody.threatInfo.threatEntries[0].url).toBe('https://example.com');
    });
  });
});
