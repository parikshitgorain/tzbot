/**
 * @file link-scanner.ts
 * @description Link scanning and phishing detection system for TZBOT
 * @module moderation
 */

import { googleSafeBrowsingClient } from '@/services/google-safe-browsing/client.js';
import { logger, logError } from '@/core/logger/logger.js';
import type { LinkScanResult } from '@/types/interfaces.js';

/**
 * Zero-width Unicode characters that can be used to obfuscate URLs
 * Requirements 7.4: U+200B, U+200C, U+200D, U+FEFF
 */
const ZERO_WIDTH_CHARS = [
  '\u200B', // Zero Width Space
  '\u200C', // Zero Width Non-Joiner
  '\u200D', // Zero Width Joiner
  '\uFEFF', // Zero Width No-Break Space (BOM)
];

/**
 * Regular expression to match URLs in messages
 * Matches http://, https://, and common domain patterns
 * Includes zero-width characters to catch obfuscated URLs
 */
const URL_REGEX = /(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._+~#=\u200B\u200C\u200D\uFEFF]{1,256}\.[a-zA-Z0-9()\u200B\u200C\u200D\uFEFF]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=\u200B\u200C\u200D\uFEFF]*)/gi;

/**
 * Phishing blocklist - domains known to be malicious
 * In production, this should be loaded from a file or external source
 * and updated regularly
 */
const DEFAULT_BLOCKLIST = new Set<string>([
  // Common phishing domains (examples - normalized format)
  'discord-nitro.ru',
  'discord-gift.com',
  'steamcommunity-login.com',
  'steampowered-login.com',
  // Add more known phishing domains here
]);

/**
 * LinkScanner class
 * Implements URL extraction, normalization, and phishing detection
 * Validates: Requirements 7.1-7.4, 7.7, 7.8
 */
export class LinkScanner {
  private blocklist: Set<string>;
  private readonly enableGoogleSafeBrowsing: boolean;

  constructor(
    customBlocklist?: Set<string>,
    enableGoogleSafeBrowsing: boolean = true,
  ) {
    this.blocklist = customBlocklist || DEFAULT_BLOCKLIST;
    this.enableGoogleSafeBrowsing = enableGoogleSafeBrowsing;
  }

  /**
   * Scan a message for malicious links
   * @param messageContent - The message content to scan
   * @param userId - The user ID who sent the message
   * @param isModerator - Whether the user is a moderator (exempt from scanning)
   * @returns LinkScanResult with detection details
   */
  async scanMessage(
    messageContent: string,
    userId: string,
    isModerator: boolean = false,
  ): Promise<LinkScanResult> {
    // Requirements 7.7: Moderators are exempt from link scanning
    if (isModerator) {
      logger.debug('Link scanning skipped for moderator', { userId });
      return { isMalicious: false };
    }

    // Requirements 7.1: Check for zero-width characters in the entire message first
    // This catches obfuscated URLs before extraction
    if (this.hasZeroWidthChars(messageContent)) {
      // Extract URLs to find which one has the zero-width chars
      const urls = this.extractUrls(messageContent);
      for (const url of urls) {
        if (this.hasZeroWidthChars(url)) {
          logger.warn('Zero-width character detected in URL', {
            userId,
            originalUrl: url,
          });
          return {
            isMalicious: true,
            reason: 'URL contains zero-width characters (obfuscation attempt)',
            detectedUrl: url,
          };
        }
      }
    }

    // Extract URLs from message
    const urls = this.extractUrls(messageContent);

    if (urls.length === 0) {
      return { isMalicious: false };
    }

    logger.debug('Extracted URLs from message', { userId, urlCount: urls.length });

    // Check each URL
    for (const url of urls) {
      // Requirements 7.4: Normalize URL by removing zero-width characters
      const normalizedUrl = this.normalizeUrl(url);

      // Requirements 7.2: Check against phishing blocklist
      const blocklistResult = this.checkBlocklist(normalizedUrl);
      if (blocklistResult.isMalicious) {
        logger.warn('Blocklisted URL detected', {
          userId,
          url: normalizedUrl,
        });
        return blocklistResult;
      }

      // Requirements 7.8: Check against Google Safe Browsing API
      if (this.enableGoogleSafeBrowsing && googleSafeBrowsingClient.isConfigured()) {
        const safeBrowsingResult = await this.checkGoogleSafeBrowsingApi(normalizedUrl, userId);
        if (safeBrowsingResult.isMalicious) {
          return safeBrowsingResult;
        }
      }
    }

    return { isMalicious: false };
  }

  /**
   * Extract URLs from message content
   * @param content - Message content
   * @returns Array of extracted URLs
   */
  extractUrls(content: string): string[] {
    const matches = content.match(URL_REGEX);
    return matches || [];
  }

  /**
   * Normalize URL by removing zero-width characters
   * Requirements 7.4: Remove U+200B, U+200C, U+200D, U+FEFF
   * @param url - URL to normalize
   * @returns Normalized URL
   */
  normalizeUrl(url: string): string {
    let normalized = url;

    // Remove all zero-width characters
    for (const char of ZERO_WIDTH_CHARS) {
      normalized = normalized.split(char).join('');
    }

    // Convert to lowercase for consistent comparison
    normalized = normalized.toLowerCase();

    // Remove protocol for blocklist comparison
    normalized = normalized.replace(/^https?:\/\//, '');
    normalized = normalized.replace(/^www\./, '');

    return normalized;
  }

  /**
   * Check if URL contains zero-width characters
   * Requirements 7.1: Detect zero-width character obfuscation
   * @param url - URL to check
   * @returns True if zero-width characters are present
   */
  hasZeroWidthChars(url: string): boolean {
    return ZERO_WIDTH_CHARS.some((char) => url.includes(char));
  }

  /**
   * Check URL against phishing blocklist
   * Requirements 7.2: Check against known phishing domains
   * @param normalizedUrl - Normalized URL to check
   * @returns LinkScanResult
   */
  checkBlocklist(normalizedUrl: string): LinkScanResult {
    // Normalize the URL for comparison (already lowercase from normalizeUrl)
    const urlToCheck = normalizedUrl.toLowerCase();

    // Check exact match
    if (this.blocklist.has(urlToCheck)) {
      return {
        isMalicious: true,
        reason: 'URL is on the phishing blocklist',
        detectedUrl: normalizedUrl,
      };
    }

    // Check if any blocklist entry is a substring (for partial matches)
    for (const blockedDomain of this.blocklist) {
      if (urlToCheck.includes(blockedDomain.toLowerCase())) {
        return {
          isMalicious: true,
          reason: 'URL matches blocklisted domain pattern',
          detectedUrl: normalizedUrl,
        };
      }
    }

    return { isMalicious: false };
  }

  /**
   * Check URL against Google Safe Browsing API
   * Requirements 7.8: External URL scanning
   * @param normalizedUrl - Normalized URL to check
   * @param userId - User ID for logging
   * @returns LinkScanResult
   */
  private async checkGoogleSafeBrowsingApi(
    normalizedUrl: string,
    userId: string,
  ): Promise<LinkScanResult> {
    try {
      // Add protocol back for Google Safe Browsing API
      const urlWithProtocol = normalizedUrl.startsWith('http')
        ? normalizedUrl
        : `https://${normalizedUrl}`;

      const result = await googleSafeBrowsingClient.checkUrl(urlWithProtocol);

      if (!result.isSafe) {
        logger.warn('Google Safe Browsing detected threat', {
          userId,
          url: normalizedUrl,
          threats: result.threats,
        });

        return {
          isMalicious: true,
          reason: `URL flagged by Google Safe Browsing: ${result.threats.join(', ')}`,
          detectedUrl: normalizedUrl,
        };
      }

      return { isMalicious: false };
    } catch (error) {
      logError('Failed to check URL with Google Safe Browsing', error as Error, {
        userId,
        url: normalizedUrl,
      });

      // Return safe result on error to avoid blocking legitimate URLs
      return { isMalicious: false };
    }
  }

  /**
   * Add domain to blocklist
   * @param domain - Domain to add
   */
  addToBlocklist(domain: string): void {
    const normalized = this.normalizeUrl(domain);
    this.blocklist.add(normalized);
    logger.info('Added domain to blocklist', { domain: normalized });
  }

  /**
   * Remove domain from blocklist
   * @param domain - Domain to remove
   */
  removeFromBlocklist(domain: string): void {
    const normalized = this.normalizeUrl(domain);
    this.blocklist.delete(normalized);
    logger.info('Removed domain from blocklist', { domain: normalized });
  }

  /**
   * Load blocklist from array
   * @param domains - Array of domains to add to blocklist
   */
  loadBlocklist(domains: string[]): void {
    this.blocklist.clear();
    for (const domain of domains) {
      const normalized = this.normalizeUrl(domain);
      this.blocklist.add(normalized);
    }
    logger.info('Loaded blocklist', { count: this.blocklist.size });
  }

  /**
   * Get current blocklist
   * @returns Array of blocklisted domains
   */
  getBlocklist(): string[] {
    return Array.from(this.blocklist);
  }

  /**
   * Get blocklist size
   * @returns Number of domains in blocklist
   */
  getBlocklistSize(): number {
    return this.blocklist.size;
  }
}
