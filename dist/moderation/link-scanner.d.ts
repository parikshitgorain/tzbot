/**
 * @file link-scanner.ts
 * @description Link scanning and phishing detection system for TZBOT
 * @module moderation
 */
import type { LinkScanResult } from '../types/interfaces.js';
/**
 * LinkScanner class
 * Implements URL extraction, normalization, and phishing detection
 * Validates: Requirements 7.1-7.4, 7.7, 7.8
 */
export declare class LinkScanner {
    private blocklist;
    private readonly enableGoogleSafeBrowsing;
    constructor(customBlocklist?: Set<string>, enableGoogleSafeBrowsing?: boolean);
    /**
     * Scan a message for malicious links
     * @param messageContent - The message content to scan
     * @param userId - The user ID who sent the message
     * @param isModerator - Whether the user is a moderator (exempt from scanning)
     * @returns LinkScanResult with detection details
     */
    scanMessage(messageContent: string, userId: string, isModerator?: boolean): Promise<LinkScanResult>;
    /**
     * Extract URLs from message content
     * @param content - Message content
     * @returns Array of extracted URLs
     */
    extractUrls(content: string): string[];
    /**
     * Normalize URL by removing zero-width characters
     * Requirements 7.4: Remove U+200B, U+200C, U+200D, U+FEFF
     * @param url - URL to normalize
     * @returns Normalized URL
     */
    normalizeUrl(url: string): string;
    /**
     * Check if URL contains zero-width characters
     * Requirements 7.1: Detect zero-width character obfuscation
     * @param url - URL to check
     * @returns True if zero-width characters are present
     */
    hasZeroWidthChars(url: string): boolean;
    /**
     * Check URL against phishing blocklist
     * Requirements 7.2: Check against known phishing domains
     * @param normalizedUrl - Normalized URL to check
     * @returns LinkScanResult
     */
    checkBlocklist(normalizedUrl: string): LinkScanResult;
    /**
     * Check URL against Google Safe Browsing API
     * Requirements 7.8: External URL scanning
     * @param normalizedUrl - Normalized URL to check
     * @param userId - User ID for logging
     * @returns LinkScanResult
     */
    private checkGoogleSafeBrowsingApi;
    /**
     * Add domain to blocklist
     * @param domain - Domain to add
     */
    addToBlocklist(domain: string): void;
    /**
     * Remove domain from blocklist
     * @param domain - Domain to remove
     */
    removeFromBlocklist(domain: string): void;
    /**
     * Load blocklist from array
     * @param domains - Array of domains to add to blocklist
     */
    loadBlocklist(domains: string[]): void;
    /**
     * Get current blocklist
     * @returns Array of blocklisted domains
     */
    getBlocklist(): string[];
    /**
     * Get blocklist size
     * @returns Number of domains in blocklist
     */
    getBlocklistSize(): number;
}
//# sourceMappingURL=link-scanner.d.ts.map