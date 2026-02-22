/**
 * @file link-scanner.test.ts
 * @description Unit tests for LinkScanner
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock logger before importing LinkScanner
vi.mock('@/core/logger/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  logError: vi.fn(),
}));

// Mock the Google Safe Browsing client
vi.mock('@/services/google-safe-browsing/client.js', () => ({
  googleSafeBrowsingClient: {
    isConfigured: vi.fn(() => true),
    checkUrl: vi.fn(),
  },
}));

import { LinkScanner } from '@/moderation/link-scanner.js';
import { googleSafeBrowsingClient } from '@/services/google-safe-browsing/client.js';

describe('LinkScanner', () => {
  let scanner: LinkScanner;

  beforeEach(() => {
    scanner = new LinkScanner(undefined, false); // Disable Google Safe Browsing for most tests
    vi.clearAllMocks();
  });

  describe('extractUrls', () => {
    it('should extract HTTP URLs', () => {
      const content = 'Check out http://example.com for more info';
      const urls = scanner.extractUrls(content);
      expect(urls).toHaveLength(1);
      expect(urls[0]).toBe('http://example.com');
    });

    it('should extract HTTPS URLs', () => {
      const content = 'Visit https://secure.example.com';
      const urls = scanner.extractUrls(content);
      expect(urls).toHaveLength(1);
      expect(urls[0]).toBe('https://secure.example.com');
    });

    it('should extract URLs without protocol', () => {
      const content = 'Go to example.com or www.example.com';
      const urls = scanner.extractUrls(content);
      expect(urls.length).toBeGreaterThan(0);
    });

    it('should extract multiple URLs', () => {
      const content = 'Visit http://example.com and https://another.com';
      const urls = scanner.extractUrls(content);
      expect(urls).toHaveLength(2);
    });

    it('should return empty array when no URLs present', () => {
      const content = 'This message has no links';
      const urls = scanner.extractUrls(content);
      expect(urls).toHaveLength(0);
    });

    it('should extract URLs with paths and query parameters', () => {
      const content = 'Check https://example.com/path?param=value&other=123';
      const urls = scanner.extractUrls(content);
      expect(urls).toHaveLength(1);
      expect(urls[0]).toContain('/path');
      expect(urls[0]).toContain('param=value');
    });
  });

  describe('normalizeUrl', () => {
    it('should remove zero-width space (U+200B)', () => {
      const url = 'exam\u200Bple.com';
      const normalized = scanner.normalizeUrl(url);
      expect(normalized).toBe('example.com');
      expect(normalized).not.toContain('\u200B');
    });

    it('should remove zero-width non-joiner (U+200C)', () => {
      const url = 'exam\u200Cple.com';
      const normalized = scanner.normalizeUrl(url);
      expect(normalized).toBe('example.com');
      expect(normalized).not.toContain('\u200C');
    });

    it('should remove zero-width joiner (U+200D)', () => {
      const url = 'exam\u200Dple.com';
      const normalized = scanner.normalizeUrl(url);
      expect(normalized).toBe('example.com');
      expect(normalized).not.toContain('\u200D');
    });

    it('should remove zero-width no-break space (U+FEFF)', () => {
      const url = 'exam\uFEFFple.com';
      const normalized = scanner.normalizeUrl(url);
      expect(normalized).toBe('example.com');
      expect(normalized).not.toContain('\uFEFF');
    });

    it('should remove multiple zero-width characters', () => {
      const url = 'ex\u200Bam\u200Cpl\u200De\uFEFF.com';
      const normalized = scanner.normalizeUrl(url);
      expect(normalized).toBe('example.com');
    });

    it('should convert to lowercase', () => {
      const url = 'EXAMPLE.COM';
      const normalized = scanner.normalizeUrl(url);
      expect(normalized).toBe('example.com');
    });

    it('should remove http:// protocol', () => {
      const url = 'http://example.com';
      const normalized = scanner.normalizeUrl(url);
      expect(normalized).toBe('example.com');
    });

    it('should remove https:// protocol', () => {
      const url = 'https://example.com';
      const normalized = scanner.normalizeUrl(url);
      expect(normalized).toBe('example.com');
    });

    it('should remove www. prefix', () => {
      const url = 'www.example.com';
      const normalized = scanner.normalizeUrl(url);
      expect(normalized).toBe('example.com');
    });

    it('should handle complex URLs with all normalizations', () => {
      const url = 'HTTPS://WWW.EX\u200BAM\u200CPLE.COM/path';
      const normalized = scanner.normalizeUrl(url);
      expect(normalized).toBe('example.com/path');
    });
  });

  describe('hasZeroWidthChars', () => {
    it('should detect zero-width space', () => {
      const url = 'exam\u200Bple.com';
      expect(scanner.hasZeroWidthChars(url)).toBe(true);
    });

    it('should detect zero-width non-joiner', () => {
      const url = 'exam\u200Cple.com';
      expect(scanner.hasZeroWidthChars(url)).toBe(true);
    });

    it('should detect zero-width joiner', () => {
      const url = 'exam\u200Dple.com';
      expect(scanner.hasZeroWidthChars(url)).toBe(true);
    });

    it('should detect zero-width no-break space', () => {
      const url = 'exam\uFEFFple.com';
      expect(scanner.hasZeroWidthChars(url)).toBe(true);
    });

    it('should return false for clean URLs', () => {
      const url = 'example.com';
      expect(scanner.hasZeroWidthChars(url)).toBe(false);
    });

    it('should detect multiple zero-width characters', () => {
      const url = 'ex\u200Bam\u200Cple.com';
      expect(scanner.hasZeroWidthChars(url)).toBe(true);
    });
  });

  describe('checkBlocklist', () => {
    beforeEach(() => {
      scanner = new LinkScanner(
        new Set(['malicious.com', 'phishing.net', 'scam.org']),
        false
      );
    });

    it('should detect exact blocklist match', () => {
      const result = scanner.checkBlocklist('malicious.com');
      expect(result.isMalicious).toBe(true);
      expect(result.reason).toContain('blocklist');
    });

    it('should detect partial blocklist match', () => {
      const result = scanner.checkBlocklist('subdomain.malicious.com');
      expect(result.isMalicious).toBe(true);
    });

    it('should return safe for non-blocklisted URLs', () => {
      const result = scanner.checkBlocklist('legitimate.com');
      expect(result.isMalicious).toBe(false);
    });

    it('should be case-insensitive', () => {
      const result = scanner.checkBlocklist('MALICIOUS.COM');
      expect(result.isMalicious).toBe(true);
    });
  });

  describe('scanMessage - moderator exemption', () => {
    it('should skip scanning for moderators', async () => {
      const content = 'Check out http://malicious.com';
      const result = await scanner.scanMessage(content, 'mod123', true);
      expect(result.isMalicious).toBe(false);
    });

    it('should scan messages from non-moderators', async () => {
      scanner = new LinkScanner(new Set(['malicious.com']), false);
      const content = 'Check out http://malicious.com';
      const result = await scanner.scanMessage(content, 'user123', false);
      expect(result.isMalicious).toBe(true);
    });
  });

  describe('scanMessage - zero-width detection', () => {
    it('should detect zero-width characters in URLs', async () => {
      const content = 'Visit http://exam\u200Bple.com';
      const result = await scanner.scanMessage(content, 'user123', false);
      expect(result.isMalicious).toBe(true);
      expect(result.reason).toContain('zero-width');
    });

    it('should detect multiple zero-width characters', async () => {
      const content = 'Visit http://ex\u200Bam\u200Cple.com';
      const result = await scanner.scanMessage(content, 'user123', false);
      expect(result.isMalicious).toBe(true);
    });
  });

  describe('scanMessage - blocklist detection', () => {
    beforeEach(() => {
      scanner = new LinkScanner(new Set(['phishing.com']), false);
    });

    it('should detect blocklisted URLs', async () => {
      const content = 'Free nitro at http://phishing.com';
      const result = await scanner.scanMessage(content, 'user123', false);
      expect(result.isMalicious).toBe(true);
      expect(result.reason).toContain('blocklist');
    });

    it('should detect blocklisted URLs with zero-width chars', async () => {
      const content = 'Visit http://phis\u200Bhing.com';
      const result = await scanner.scanMessage(content, 'user123', false);
      expect(result.isMalicious).toBe(true);
    });
  });

  describe('scanMessage - no URLs', () => {
    it('should return safe when no URLs present', async () => {
      const content = 'This is a normal message without links';
      const result = await scanner.scanMessage(content, 'user123', false);
      expect(result.isMalicious).toBe(false);
    });
  });

  describe('scanMessage - Google Safe Browsing integration', () => {
    beforeEach(() => {
      scanner = new LinkScanner(undefined, true); // Enable Google Safe Browsing
    });

    it('should check URLs with Google Safe Browsing', async () => {
      vi.mocked(googleSafeBrowsingClient.checkUrl).mockResolvedValue({
        url: 'https://example.com',
        isSafe: true,
        threats: [],
        cached: false,
        checkedAt: new Date(),
      });

      const content = 'Visit http://example.com';
      const result = await scanner.scanMessage(content, 'user123', false);
      
      expect(googleSafeBrowsingClient.checkUrl).toHaveBeenCalled();
      expect(result.isMalicious).toBe(false);
    });

    it('should detect threats from Google Safe Browsing', async () => {
      vi.mocked(googleSafeBrowsingClient.checkUrl).mockResolvedValue({
        url: 'https://malware.com',
        isSafe: false,
        threats: ['MALWARE'],
        cached: false,
        checkedAt: new Date(),
      });

      const content = 'Visit http://malware.com';
      const result = await scanner.scanMessage(content, 'user123', false);
      
      expect(result.isMalicious).toBe(true);
      expect(result.reason).toContain('Google Safe Browsing');
    });

    it('should handle Google Safe Browsing errors gracefully', async () => {
      vi.mocked(googleSafeBrowsingClient.checkUrl).mockRejectedValue(
        new Error('API error')
      );

      const content = 'Visit http://example.com';
      const result = await scanner.scanMessage(content, 'user123', false);
      
      // Should return safe on error to avoid blocking legitimate URLs
      expect(result.isMalicious).toBe(false);
    });
  });

  describe('blocklist management', () => {
    it('should add domain to blocklist', () => {
      scanner.addToBlocklist('newmalicious.com');
      const result = scanner.checkBlocklist('newmalicious.com');
      expect(result.isMalicious).toBe(true);
    });

    it('should remove domain from blocklist', () => {
      scanner.addToBlocklist('temporary.com');
      scanner.removeFromBlocklist('temporary.com');
      const result = scanner.checkBlocklist('temporary.com');
      expect(result.isMalicious).toBe(false);
    });

    it('should load blocklist from array', () => {
      scanner.loadBlocklist(['bad1.com', 'bad2.com', 'bad3.com']);
      expect(scanner.getBlocklistSize()).toBe(3);
      expect(scanner.checkBlocklist('bad1.com').isMalicious).toBe(true);
      expect(scanner.checkBlocklist('bad2.com').isMalicious).toBe(true);
    });

    it('should get blocklist as array', () => {
      scanner.loadBlocklist(['domain1.com', 'domain2.com']);
      const blocklist = scanner.getBlocklist();
      expect(blocklist).toHaveLength(2);
      expect(blocklist).toContain('domain1.com');
      expect(blocklist).toContain('domain2.com');
    });

    it('should normalize domains when adding to blocklist', () => {
      scanner.addToBlocklist('HTTPS://WWW.EXAMPLE.COM');
      const result = scanner.checkBlocklist('example.com');
      expect(result.isMalicious).toBe(true);
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      // Use empty blocklist for edge case tests
      scanner = new LinkScanner(new Set(), false);
    });

    it('should handle empty message', async () => {
      const result = await scanner.scanMessage('', 'user123', false);
      expect(result.isMalicious).toBe(false);
    });

    it('should handle message with only whitespace', async () => {
      const result = await scanner.scanMessage('   \n\t  ', 'user123', false);
      expect(result.isMalicious).toBe(false);
    });

    it('should handle URLs with special characters', async () => {
      const content = 'Visit http://example.com/path?param=value&other=123#anchor';
      const result = await scanner.scanMessage(content, 'user123', false);
      expect(result.isMalicious).toBe(false);
    });

    it('should handle malformed URLs gracefully', async () => {
      const content = 'Visit http:// or https://';
      const result = await scanner.scanMessage(content, 'user123', false);
      expect(result.isMalicious).toBe(false);
    });
  });
});
