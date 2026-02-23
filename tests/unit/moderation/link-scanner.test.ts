import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LinkScanner } from '../../../src/moderation/link-scanner.js';

// Mock the Google Safe Browsing client module-level singleton
vi.mock('@/services/google-safe-browsing/client.js', () => ({
  googleSafeBrowsingClient: {
    isConfigured: vi.fn().mockReturnValue(false),
    checkUrl: vi.fn(),
  },
}));

import { googleSafeBrowsingClient } from '@/services/google-safe-browsing/client.js';

describe('LinkScanner', () => {
  let scanner: LinkScanner;

  beforeEach(() => {
    // Disable Google Safe Browsing for unit tests
    scanner = new LinkScanner(undefined, false);
  });

  describe('extractUrls()', () => {
    it('returns empty array when no URLs in plain text', () => {
      expect(scanner.extractUrls('hello world, no links here')).toEqual([]);
    });

    it('extracts a URL with https protocol', () => {
      const urls = scanner.extractUrls('check https://example.com out');
      expect(urls.length).toBeGreaterThan(0);
      // At least one extracted token should be the full URL or contain the domain
      expect(urls.find((u) => u === 'https://example.com' || u === 'example.com')).toBeTruthy();
    });

    it('extracts a URL with http protocol', () => {
      const urls = scanner.extractUrls('visit http://example.com please');
      expect(urls.find((u) => u === 'http://example.com' || u === 'example.com')).toBeTruthy();
    });

    it('extracts a URL starting with www', () => {
      const urls = scanner.extractUrls('go to www.example.com now');
      expect(urls.find((u) => u === 'www.example.com' || u === 'example.com')).toBeTruthy();
    });

    it('extracts multiple URLs from a message', () => {
      const urls = scanner.extractUrls('https://foo.com and https://bar.com');
      expect(urls.length).toBeGreaterThanOrEqual(2);
    });

    it('returns empty array for a message with only whitespace', () => {
      expect(scanner.extractUrls('   ')).toEqual([]);
    });
  });

  describe('normalizeUrl()', () => {
    it('removes https:// prefix', () => {
      expect(scanner.normalizeUrl('https://example.com')).not.toContain('https://');
    });

    it('removes http:// prefix', () => {
      expect(scanner.normalizeUrl('http://example.com')).not.toContain('http://');
    });

    it('removes www. prefix', () => {
      expect(scanner.normalizeUrl('www.example.com')).not.toContain('www.');
    });

    it('converts URL to lowercase', () => {
      expect(scanner.normalizeUrl('HTTPS://EXAMPLE.COM')).toBe('example.com');
    });

    it('removes zero-width characters', () => {
      const urlWithZeroWidth = 'example\u200B.com';
      const normalized = scanner.normalizeUrl(urlWithZeroWidth);
      expect(normalized).not.toContain('\u200B');
      expect(normalized).toBe('example.com');
    });

    it('removes U+200C, U+200D, U+FEFF', () => {
      const url = 'ex\u200Cam\u200Dple\uFEFF.com';
      const normalized = scanner.normalizeUrl(url);
      expect(normalized).toBe('example.com');
    });
  });

  describe('hasZeroWidthChars()', () => {
    it('returns true for string with U+200B', () => {
      expect(scanner.hasZeroWidthChars('hello\u200Bworld')).toBe(true);
    });

    it('returns true for string with U+200C', () => {
      expect(scanner.hasZeroWidthChars('hello\u200Cworld')).toBe(true);
    });

    it('returns true for string with U+200D', () => {
      expect(scanner.hasZeroWidthChars('hello\u200Dworld')).toBe(true);
    });

    it('returns true for string with U+FEFF', () => {
      expect(scanner.hasZeroWidthChars('hello\uFEFFworld')).toBe(true);
    });

    it('returns false for a clean string', () => {
      expect(scanner.hasZeroWidthChars('clean string no tricks')).toBe(false);
    });

    it('returns false for an empty string', () => {
      expect(scanner.hasZeroWidthChars('')).toBe(false);
    });
  });

  describe('checkBlocklist()', () => {
    it('returns isMalicious=false for an unknown domain', () => {
      const result = scanner.checkBlocklist('legitimate-site.com');
      expect(result.isMalicious).toBe(false);
    });

    it('returns isMalicious=true for a domain in the default blocklist', () => {
      const result = scanner.checkBlocklist('discord-nitro.ru');
      expect(result.isMalicious).toBe(true);
      expect(result.reason).toBeTruthy();
      expect(result.detectedUrl).toBe('discord-nitro.ru');
    });

    it('matches partial blocklist patterns (subdomain)', () => {
      const result = scanner.checkBlocklist('sub.discord-nitro.ru/path');
      expect(result.isMalicious).toBe(true);
    });

    it('returns isMalicious=true for steamcommunity-login.com', () => {
      expect(scanner.checkBlocklist('steamcommunity-login.com').isMalicious).toBe(true);
    });
  });

  describe('addToBlocklist() / removeFromBlocklist()', () => {
    it('addToBlocklist allows subsequent checkBlocklist to detect the domain', () => {
      const customScanner = new LinkScanner(new Set(), false);
      customScanner.addToBlocklist('evil-phishing.example');
      expect(customScanner.checkBlocklist('evil-phishing.example').isMalicious).toBe(true);
    });

    it('removeFromBlocklist makes domain no longer detected', () => {
      const customScanner = new LinkScanner(new Set(['bad-domain.example']), false);
      expect(customScanner.checkBlocklist('bad-domain.example').isMalicious).toBe(true);
      customScanner.removeFromBlocklist('bad-domain.example');
      expect(customScanner.checkBlocklist('bad-domain.example').isMalicious).toBe(false);
    });

    it('normalizes the domain when adding to blocklist', () => {
      const customScanner = new LinkScanner(new Set(), false);
      customScanner.addToBlocklist('https://WWW.Evil-Site.com');
      // normalizeUrl strips protocol, www, and lowercases
      expect(customScanner.checkBlocklist('evil-site.com').isMalicious).toBe(true);
    });
  });

  describe('loadBlocklist() / getBlocklist() / getBlocklistSize()', () => {
    it('loadBlocklist replaces existing blocklist entries', () => {
      const customScanner = new LinkScanner(new Set(['old-entry.com']), false);
      customScanner.loadBlocklist(['new-entry.com', 'another-entry.com']);
      expect(customScanner.getBlocklistSize()).toBe(2);
      expect(customScanner.checkBlocklist('old-entry.com').isMalicious).toBe(false);
      expect(customScanner.checkBlocklist('new-entry.com').isMalicious).toBe(true);
    });

    it('getBlocklist returns an array of current blocklist entries', () => {
      const customScanner = new LinkScanner(new Set(), false);
      customScanner.loadBlocklist(['alpha.com', 'beta.com']);
      const list = customScanner.getBlocklist();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBe(2);
    });

    it('getBlocklistSize returns the correct count', () => {
      const customScanner = new LinkScanner(new Set(), false);
      expect(customScanner.getBlocklistSize()).toBe(0);
      customScanner.addToBlocklist('one.com');
      expect(customScanner.getBlocklistSize()).toBe(1);
    });
  });

  describe('scanMessage() async', () => {
    it('returns isMalicious=false for moderators (exempt)', async () => {
      const result = await scanner.scanMessage('http://discord-nitro.ru', 'mod-user', true);
      expect(result.isMalicious).toBe(false);
    });

    it('returns isMalicious=false for clean message with no URLs', async () => {
      const result = await scanner.scanMessage('just a normal chat message', 'user1');
      expect(result.isMalicious).toBe(false);
    });

    it('detects zero-width characters in a URL', async () => {
      const obfuscated = 'http://discord\u200Bnitro.ru';
      const result = await scanner.scanMessage(obfuscated, 'user1');
      expect(result.isMalicious).toBe(true);
      expect(result.reason).toMatch(/zero-width/i);
    });

    it('detects a blocklisted URL in a message', async () => {
      const customScanner = new LinkScanner(new Set(['evil-phish.test']), false);
      const result = await customScanner.scanMessage(
        'click here https://evil-phish.test/login',
        'user1',
      );
      expect(result.isMalicious).toBe(true);
    });

    it('returns isMalicious=false for a legitimate URL', async () => {
      const customScanner = new LinkScanner(new Set(), false);
      const result = await customScanner.scanMessage(
        'check out https://github.com',
        'user1',
      );
      expect(result.isMalicious).toBe(false);
    });
  });

  describe('scanMessage() with Google Safe Browsing enabled', () => {
    it('returns malicious when GSB flags a URL', async () => {
      (googleSafeBrowsingClient.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (googleSafeBrowsingClient.checkUrl as ReturnType<typeof vi.fn>).mockResolvedValue({
        isSafe: false,
        threats: ['MALWARE'],
        url: 'https://evil.com',
        cached: false,
        checkedAt: new Date(),
      });

      const gsbScanner = new LinkScanner(new Set(), true);
      const result = await gsbScanner.scanMessage('visit https://evil.com', 'user1');
      expect(result.isMalicious).toBe(true);
      expect(result.reason).toContain('MALWARE');
    });

    it('returns isMalicious=false when GSB reports URL as safe', async () => {
      (googleSafeBrowsingClient.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (googleSafeBrowsingClient.checkUrl as ReturnType<typeof vi.fn>).mockResolvedValue({
        isSafe: true,
        threats: [],
        url: 'https://safe.com',
        cached: false,
        checkedAt: new Date(),
      });

      const gsbScanner = new LinkScanner(new Set(), true);
      const result = await gsbScanner.scanMessage('visit https://safe.com', 'user1');
      expect(result.isMalicious).toBe(false);
    });

    it('returns isMalicious=false when GSB throws (fail-safe)', async () => {
      (googleSafeBrowsingClient.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (googleSafeBrowsingClient.checkUrl as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API error'));

      const gsbScanner = new LinkScanner(new Set(), true);
      const result = await gsbScanner.scanMessage('visit https://example.com', 'user1');
      expect(result.isMalicious).toBe(false);
    });

    it('adds https:// prefix for URL without protocol before calling GSB', async () => {
      (googleSafeBrowsingClient.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (googleSafeBrowsingClient.checkUrl as ReturnType<typeof vi.fn>).mockResolvedValue({
        isSafe: true, threats: [], url: '', cached: false, checkedAt: new Date(),
      });

      const gsbScanner = new LinkScanner(new Set(), true);
      await gsbScanner.scanMessage('visit www.example.com', 'user1');
      expect(googleSafeBrowsingClient.checkUrl).toHaveBeenCalledWith(
        expect.stringContaining('https://'),
      );
    });
  });
});
