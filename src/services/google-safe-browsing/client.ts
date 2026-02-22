/**
 * @file client.ts
 * @description Google Safe Browsing API v4 client for URL threat detection
 * @module services/google-safe-browsing
 */

import { config } from '@/config/index.js';
import { logger, logError } from '@/core/logger/logger.js';
import { redisClient } from '@/core/cache/redis.client.js';

/**
 * Threat types to check for
 */
export enum ThreatType {
  MALWARE = 'MALWARE',
  SOCIAL_ENGINEERING = 'SOCIAL_ENGINEERING',
  UNWANTED_SOFTWARE = 'UNWANTED_SOFTWARE',
  POTENTIALLY_HARMFUL_APPLICATION = 'POTENTIALLY_HARMFUL_APPLICATION',
}

/**
 * Platform types
 */
export enum PlatformType {
  ANY_PLATFORM = 'ANY_PLATFORM',
  WINDOWS = 'WINDOWS',
  LINUX = 'LINUX',
  ANDROID = 'ANDROID',
  OSX = 'OSX',
  IOS = 'IOS',
  CHROME = 'CHROME',
}

/**
 * Threat entry types
 */
export enum ThreatEntryType {
  URL = 'URL',
  EXECUTABLE = 'EXECUTABLE',
}

/**
 * Safe Browsing API request structure
 */
interface SafeBrowsingRequest {
  client: {
    clientId: string;
    clientVersion: string;
  };
  threatInfo: {
    threatTypes: ThreatType[];
    platformTypes: PlatformType[];
    threatEntryTypes: ThreatEntryType[];
    threatEntries: Array<{ url: string }>;
  };
}

/**
 * Safe Browsing API response structure
 */
interface SafeBrowsingResponse {
  matches?: Array<{
    threatType: ThreatType;
    platformType: PlatformType;
    threat: { url: string };
    cacheDuration: string;
    threatEntryType: ThreatEntryType;
  }>;
}

/**
 * URL check result
 */
export interface UrlCheckResult {
  url: string;
  isSafe: boolean;
  threats: ThreatType[];
  cached: boolean;
  checkedAt: Date;
}

/**
 * Rate limiter state
 */
interface RateLimitState {
  count: number;
  resetAt: number;
}

/**
 * Google Safe Browsing API client
 */
export class GoogleSafeBrowsingClient {
  private readonly apiKey: string;
  private readonly apiEndpoint = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';
  private readonly cachePrefix = 'gsb:url:';
  private readonly cacheTTL = 1800; // 30 minutes in seconds
  private readonly rateLimitKey = 'gsb:ratelimit';
  private readonly dailyLimit = 10000; // Free tier limit
  private readonly clientId = 'tzbot-discord-bot';
  private readonly clientVersion = '1.0.0';

  constructor(apiKey?: string) {
    // If apiKey is explicitly provided (even if empty), use it
    // Otherwise, fall back to config
    this.apiKey = apiKey !== undefined ? apiKey : (config.googleSafeBrowsingApiKey || '');

    if (!this.apiKey) {
      logger.warn('Google Safe Browsing API key not configured - URL scanning will be disabled');
    }
  }

  /**
   * Check if the client is configured and ready
   */
  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * Check a single URL for threats
   */
  async checkUrl(url: string): Promise<UrlCheckResult> {
    const startTime = Date.now();

    try {
      // Check if API is configured
      if (!this.isConfigured()) {
        logger.warn('Google Safe Browsing API not configured', { url });
        return {
          url,
          isSafe: true, // Assume safe if not configured
          threats: [],
          cached: false,
          checkedAt: new Date(),
        };
      }

      // Check cache first
      const cachedResult = await this.getCachedResult(url);
      if (cachedResult) {
        logger.debug('URL check result from cache', {
          url,
          isSafe: cachedResult.isSafe,
          latencyMs: Date.now() - startTime,
        });
        return cachedResult;
      }

      // Check rate limit
      const canProceed = await this.checkRateLimit();
      if (!canProceed) {
        logger.warn('Google Safe Browsing API rate limit exceeded', { url });
        // Return safe result when rate limited to avoid blocking legitimate URLs
        return {
          url,
          isSafe: true,
          threats: [],
          cached: false,
          checkedAt: new Date(),
        };
      }

      // Make API request
      const result = await this.makeApiRequest([url]);
      const urlResult = result[0];

      // Cache the result
      await this.cacheResult(urlResult);

      logger.info('URL checked via Google Safe Browsing API', {
        url,
        isSafe: urlResult.isSafe,
        threats: urlResult.threats,
        latencyMs: Date.now() - startTime,
      });

      return urlResult;
    } catch (error) {
      logError('Failed to check URL with Google Safe Browsing', error as Error, {
        additionalContext: { url },
      });

      // Return safe result on error to avoid blocking legitimate URLs
      return {
        url,
        isSafe: true,
        threats: [],
        cached: false,
        checkedAt: new Date(),
      };
    }
  }

  /**
   * Check multiple URLs for threats (batch operation)
   */
  async checkUrls(urls: string[]): Promise<UrlCheckResult[]> {
    if (urls.length === 0) {
      return [];
    }

    // Check if API is configured
    if (!this.isConfigured()) {
      return urls.map((url) => ({
        url,
        isSafe: true,
        threats: [],
        cached: false,
        checkedAt: new Date(),
      }));
    }

    // Separate cached and uncached URLs
    const results: UrlCheckResult[] = [];
    const uncachedUrls: string[] = [];

    for (const url of urls) {
      const cachedResult = await this.getCachedResult(url);
      if (cachedResult) {
        results.push(cachedResult);
      } else {
        uncachedUrls.push(url);
      }
    }

    // Check uncached URLs
    if (uncachedUrls.length > 0) {
      // Check rate limit
      const canProceed = await this.checkRateLimit();
      if (!canProceed) {
        logger.warn('Google Safe Browsing API rate limit exceeded for batch check');
        // Add safe results for uncached URLs
        uncachedUrls.forEach((url) => {
          results.push({
            url,
            isSafe: true,
            threats: [],
            cached: false,
            checkedAt: new Date(),
          });
        });
      } else {
        // Make API request for uncached URLs
        const apiResults = await this.makeApiRequest(uncachedUrls);

        // Cache results
        for (const result of apiResults) {
          await this.cacheResult(result);
          results.push(result);
        }
      }
    }

    return results;
  }

  /**
   * Make API request to Google Safe Browsing
   */
  private async makeApiRequest(urls: string[]): Promise<UrlCheckResult[]> {
    const request: SafeBrowsingRequest = {
      client: {
        clientId: this.clientId,
        clientVersion: this.clientVersion,
      },
      threatInfo: {
        threatTypes: [
          ThreatType.MALWARE,
          ThreatType.SOCIAL_ENGINEERING,
          ThreatType.UNWANTED_SOFTWARE,
          ThreatType.POTENTIALLY_HARMFUL_APPLICATION,
        ],
        platformTypes: [PlatformType.ANY_PLATFORM],
        threatEntryTypes: [ThreatEntryType.URL],
        threatEntries: urls.map((url) => ({ url })),
      },
    };

    const response = await fetch(`${this.apiEndpoint}?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Safe Browsing API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as SafeBrowsingResponse;

    // Increment rate limit counter
    await this.incrementRateLimit();

    // Process results
    return urls.map((url) => {
      const matches = data.matches?.filter((match) => match.threat.url === url) || [];
      const threats = matches.map((match) => match.threatType);

      return {
        url,
        isSafe: threats.length === 0,
        threats,
        cached: false,
        checkedAt: new Date(),
      };
    });
  }

  /**
   * Get cached result for a URL
   */
  private async getCachedResult(url: string): Promise<UrlCheckResult | null> {
    try {
      const cacheKey = this.getCacheKey(url);
      const cached = await redisClient.get(cacheKey);

      if (cached) {
        const result = JSON.parse(cached) as UrlCheckResult;
        result.cached = true;
        result.checkedAt = new Date(result.checkedAt);
        return result;
      }

      return null;
    } catch (error) {
      logError('Failed to get cached URL result', error as Error, {
        additionalContext: { url },
      });
      return null;
    }
  }

  /**
   * Cache a URL check result
   */
  private async cacheResult(result: UrlCheckResult): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(result.url);
      await redisClient.set(cacheKey, JSON.stringify(result), this.cacheTTL);
    } catch (error) {
      logError('Failed to cache URL result', error as Error, {
        additionalContext: { url: result.url },
      });
    }
  }

  /**
   * Get cache key for a URL
   */
  private getCacheKey(url: string): string {
    return `${this.cachePrefix}${url}`;
  }

  /**
   * Check if we're within rate limits
   */
  private async checkRateLimit(): Promise<boolean> {
    try {
      const stateJson = await redisClient.get(this.rateLimitKey);

      if (!stateJson) {
        return true; // No rate limit state, allow request
      }

      const state: RateLimitState = JSON.parse(stateJson);
      const now = Date.now();

      // Check if reset time has passed
      if (now >= state.resetAt) {
        return true; // Rate limit window has reset
      }

      // Check if we're under the limit
      return state.count < this.dailyLimit;
    } catch (error) {
      logError('Failed to check rate limit', error as Error);
      return true; // Allow request on error
    }
  }

  /**
   * Increment rate limit counter
   */
  private async incrementRateLimit(): Promise<void> {
    try {
      const stateJson = await redisClient.get(this.rateLimitKey);
      const now = Date.now();
      const resetAt = this.getNextResetTime();

      let state: RateLimitState;

      if (!stateJson) {
        // Initialize rate limit state
        state = { count: 1, resetAt };
      } else {
        state = JSON.parse(stateJson);

        // Check if reset time has passed
        if (now >= state.resetAt) {
          // Reset counter
          state = { count: 1, resetAt };
        } else {
          // Increment counter
          state.count++;
        }
      }

      // Save state with TTL until reset
      const ttlSeconds = Math.ceil((state.resetAt - now) / 1000);
      await redisClient.set(this.rateLimitKey, JSON.stringify(state), ttlSeconds);

      // Log warning if approaching limit
      if (state.count >= this.dailyLimit * 0.9) {
        logger.warn('Approaching Google Safe Browsing API rate limit', {
          count: state.count,
          limit: this.dailyLimit,
          resetAt: new Date(state.resetAt),
        });
      }
    } catch (error) {
      logError('Failed to increment rate limit', error as Error);
    }
  }

  /**
   * Get next rate limit reset time (midnight UTC)
   */
  private getNextResetTime(): number {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }

  /**
   * Get current rate limit status
   */
  async getRateLimitStatus(): Promise<{ count: number; limit: number; resetAt: Date }> {
    try {
      const stateJson = await redisClient.get(this.rateLimitKey);

      if (!stateJson) {
        return {
          count: 0,
          limit: this.dailyLimit,
          resetAt: new Date(this.getNextResetTime()),
        };
      }

      const state: RateLimitState = JSON.parse(stateJson);
      const now = Date.now();

      // Check if reset time has passed
      if (now >= state.resetAt) {
        return {
          count: 0,
          limit: this.dailyLimit,
          resetAt: new Date(this.getNextResetTime()),
        };
      }

      return {
        count: state.count,
        limit: this.dailyLimit,
        resetAt: new Date(state.resetAt),
      };
    } catch (error) {
      logError('Failed to get rate limit status', error as Error);
      return {
        count: 0,
        limit: this.dailyLimit,
        resetAt: new Date(this.getNextResetTime()),
      };
    }
  }

  /**
   * Clear cache for a specific URL
   */
  async clearCache(url: string): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(url);
      await redisClient.del(cacheKey);
      logger.debug('Cleared cache for URL', { url });
    } catch (error) {
      logError('Failed to clear cache for URL', error as Error, {
        additionalContext: { url },
      });
    }
  }
}

// Export singleton instance
export const googleSafeBrowsingClient = new GoogleSafeBrowsingClient();
