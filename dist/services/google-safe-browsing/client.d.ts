/**
 * @file client.ts
 * @description Google Safe Browsing API v4 client for URL threat detection
 * @module services/google-safe-browsing
 */
/**
 * Threat types to check for
 */
export declare enum ThreatType {
    MALWARE = "MALWARE",
    SOCIAL_ENGINEERING = "SOCIAL_ENGINEERING",
    UNWANTED_SOFTWARE = "UNWANTED_SOFTWARE",
    POTENTIALLY_HARMFUL_APPLICATION = "POTENTIALLY_HARMFUL_APPLICATION"
}
/**
 * Platform types
 */
export declare enum PlatformType {
    ANY_PLATFORM = "ANY_PLATFORM",
    WINDOWS = "WINDOWS",
    LINUX = "LINUX",
    ANDROID = "ANDROID",
    OSX = "OSX",
    IOS = "IOS",
    CHROME = "CHROME"
}
/**
 * Threat entry types
 */
export declare enum ThreatEntryType {
    URL = "URL",
    EXECUTABLE = "EXECUTABLE"
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
 * Google Safe Browsing API client
 */
export declare class GoogleSafeBrowsingClient {
    private readonly apiKey;
    private readonly apiEndpoint;
    private readonly cachePrefix;
    private readonly cacheTTL;
    private readonly rateLimitKey;
    private readonly dailyLimit;
    private readonly clientId;
    private readonly clientVersion;
    constructor(apiKey?: string);
    /**
     * Check if the client is configured and ready
     */
    isConfigured(): boolean;
    /**
     * Check a single URL for threats
     */
    checkUrl(url: string): Promise<UrlCheckResult>;
    /**
     * Check multiple URLs for threats (batch operation)
     */
    checkUrls(urls: string[]): Promise<UrlCheckResult[]>;
    /**
     * Make API request to Google Safe Browsing
     */
    private makeApiRequest;
    /**
     * Get cached result for a URL
     */
    private getCachedResult;
    /**
     * Cache a URL check result
     */
    private cacheResult;
    /**
     * Get cache key for a URL
     */
    private getCacheKey;
    /**
     * Check if we're within rate limits
     */
    private checkRateLimit;
    /**
     * Increment rate limit counter
     */
    private incrementRateLimit;
    /**
     * Get next rate limit reset time (midnight UTC)
     */
    private getNextResetTime;
    /**
     * Get current rate limit status
     */
    getRateLimitStatus(): Promise<{
        count: number;
        limit: number;
        resetAt: Date;
    }>;
    /**
     * Clear cache for a specific URL
     */
    clearCache(url: string): Promise<void>;
}
export declare const googleSafeBrowsingClient: GoogleSafeBrowsingClient;
//# sourceMappingURL=client.d.ts.map