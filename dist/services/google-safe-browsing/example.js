/**
 * @file example.ts
 * @description Example usage of Google Safe Browsing API client
 * @module services/google-safe-browsing
 */
import { googleSafeBrowsingClient } from './client.js';
import { logger } from '../../core/logger/logger.js';
/**
 * Example: Check a single URL
 */
async function checkSingleUrl() {
    logger.info('=== Checking Single URL ===');
    const url = 'https://example.com';
    const result = await googleSafeBrowsingClient.checkUrl(url);
    logger.info('URL Check Result:', {
        url: result.url,
        isSafe: result.isSafe,
        threats: result.threats,
        cached: result.cached,
    });
    if (!result.isSafe) {
        logger.warn('⚠️ Malicious URL detected!', {
            url: result.url,
            threats: result.threats,
        });
    }
}
/**
 * Example: Check multiple URLs in batch
 */
async function checkMultipleUrls() {
    logger.info('=== Checking Multiple URLs ===');
    const urls = [
        'https://google.com',
        'https://github.com',
        'https://example.com',
    ];
    const results = await googleSafeBrowsingClient.checkUrls(urls);
    results.forEach((result) => {
        logger.info('URL Check Result:', {
            url: result.url,
            isSafe: result.isSafe,
            threats: result.threats,
            cached: result.cached,
        });
    });
    const maliciousUrls = results.filter((r) => !r.isSafe);
    if (maliciousUrls.length > 0) {
        logger.warn(`Found ${maliciousUrls.length} malicious URLs`);
    }
}
/**
 * Example: Check rate limit status
 */
async function checkRateLimitStatus() {
    logger.info('=== Rate Limit Status ===');
    const status = await googleSafeBrowsingClient.getRateLimitStatus();
    logger.info('Rate Limit Status:', {
        used: status.count,
        limit: status.limit,
        remaining: status.limit - status.count,
        resetAt: status.resetAt,
    });
    const percentUsed = (status.count / status.limit) * 100;
    if (percentUsed > 90) {
        logger.warn('⚠️ Approaching rate limit!', {
            percentUsed: percentUsed.toFixed(2) + '%',
        });
    }
}
/**
 * Example: Integration with message scanning
 */
async function scanMessageForMaliciousLinks(messageContent) {
    logger.info('=== Scanning Message for Malicious Links ===');
    // Extract URLs from message (simple regex)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = messageContent.match(urlRegex) || [];
    if (urls.length === 0) {
        logger.info('No URLs found in message');
        return { hasMaliciousLinks: false, maliciousUrls: [] };
    }
    logger.info(`Found ${urls.length} URLs in message`);
    // Check all URLs
    const results = await googleSafeBrowsingClient.checkUrls(urls);
    // Find malicious URLs
    const maliciousUrls = results.filter((r) => !r.isSafe);
    if (maliciousUrls.length > 0) {
        logger.warn('⚠️ Malicious links detected in message!', {
            count: maliciousUrls.length,
            urls: maliciousUrls.map((r) => ({
                url: r.url,
                threats: r.threats,
            })),
        });
        return {
            hasMaliciousLinks: true,
            maliciousUrls: maliciousUrls.map((r) => r.url),
        };
    }
    logger.info('✓ All URLs are safe');
    return { hasMaliciousLinks: false, maliciousUrls: [] };
}
/**
 * Example: Clear cache for a URL
 */
async function clearUrlCache() {
    logger.info('=== Clearing URL Cache ===');
    const url = 'https://example.com';
    await googleSafeBrowsingClient.clearCache(url);
    logger.info('Cache cleared for URL:', { url });
}
/**
 * Example: Check if client is configured
 */
function checkConfiguration() {
    logger.info('=== Checking Configuration ===');
    const isConfigured = googleSafeBrowsingClient.isConfigured();
    if (isConfigured) {
        logger.info('✓ Google Safe Browsing API is configured');
    }
    else {
        logger.warn('⚠️ Google Safe Browsing API is not configured');
        logger.info('Set GOOGLE_SAFE_BROWSING_API_KEY in your .env file');
    }
    return isConfigured;
}
/**
 * Run all examples
 */
async function runExamples() {
    try {
        // Check configuration first
        const isConfigured = checkConfiguration();
        if (!isConfigured) {
            logger.warn('Skipping examples - API not configured');
            return;
        }
        // Run examples
        await checkSingleUrl();
        await checkMultipleUrls();
        await checkRateLimitStatus();
        // Example message with URLs
        const exampleMessage = `
      Check out these links:
      https://google.com
      https://github.com
      https://example.com
    `;
        await scanMessageForMaliciousLinks(exampleMessage);
        await clearUrlCache();
        logger.info('=== All Examples Completed ===');
    }
    catch (error) {
        logger.error('Error running examples:', error);
    }
}
// Export examples
export { checkSingleUrl, checkMultipleUrls, checkRateLimitStatus, scanMessageForMaliciousLinks, clearUrlCache, checkConfiguration, runExamples, };
// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runExamples().catch((error) => {
        logger.error('Fatal error:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=example.js.map