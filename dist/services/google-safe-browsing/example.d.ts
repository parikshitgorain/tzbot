/**
 * @file example.ts
 * @description Example usage of Google Safe Browsing API client
 * @module services/google-safe-browsing
 */
/**
 * Example: Check a single URL
 */
declare function checkSingleUrl(): Promise<void>;
/**
 * Example: Check multiple URLs in batch
 */
declare function checkMultipleUrls(): Promise<void>;
/**
 * Example: Check rate limit status
 */
declare function checkRateLimitStatus(): Promise<void>;
/**
 * Example: Integration with message scanning
 */
declare function scanMessageForMaliciousLinks(messageContent: string): Promise<{
    hasMaliciousLinks: boolean;
    maliciousUrls: string[];
}>;
/**
 * Example: Clear cache for a URL
 */
declare function clearUrlCache(): Promise<void>;
/**
 * Example: Check if client is configured
 */
declare function checkConfiguration(): boolean;
/**
 * Run all examples
 */
declare function runExamples(): Promise<void>;
export { checkSingleUrl, checkMultipleUrls, checkRateLimitStatus, scanMessageForMaliciousLinks, clearUrlCache, checkConfiguration, runExamples, };
//# sourceMappingURL=example.d.ts.map