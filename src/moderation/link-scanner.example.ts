/**
 * @file link-scanner.example.ts
 * @description Example usage of LinkScanner
 * @module moderation
 */

import { LinkScanner } from './link-scanner.js';

/**
 * Example 1: Basic link scanning with default blocklist
 */
async function basicLinkScanning() {
  const scanner = new LinkScanner();

  // Scan a message from a regular user
  const result1 = await scanner.scanMessage(
    'Check out this cool site: http://example.com',
    'user123',
    false // not a moderator
  );

  console.log('Result 1:', result1);
  // { isMalicious: false }

  // Scan a message with a blocklisted domain
  const result2 = await scanner.scanMessage(
    'Free nitro at http://discord-nitro.ru',
    'user456',
    false
  );

  console.log('Result 2:', result2);
  // { isMalicious: true, reason: 'URL is on the phishing blocklist', detectedUrl: 'discord-nitro.ru' }
}

/**
 * Example 2: Detecting zero-width character obfuscation
 */
async function detectZeroWidthChars() {
  const scanner = new LinkScanner();

  // URL with zero-width space (U+200B)
  const result = await scanner.scanMessage(
    'Visit http://exam\u200Bple.com',
    'user789',
    false
  );

  console.log('Result:', result);
  // { isMalicious: true, reason: 'URL contains zero-width characters (obfuscation attempt)', detectedUrl: 'http://exam\u200Bple.com' }
}

/**
 * Example 3: Moderator exemption
 */
async function moderatorExemption() {
  const scanner = new LinkScanner();

  // Same URL, but from a moderator
  const result = await scanner.scanMessage(
    'Free nitro at http://discord-nitro.ru',
    'mod123',
    true // is a moderator
  );

  console.log('Result:', result);
  // { isMalicious: false } - moderators are exempt
}

/**
 * Example 4: Custom blocklist
 */
async function customBlocklist() {
  const customBlocklist = new Set([
    'malicious.com',
    'phishing.net',
    'scam.org',
  ]);

  const scanner = new LinkScanner(customBlocklist, false);

  const result = await scanner.scanMessage(
    'Visit http://malicious.com',
    'user123',
    false
  );

  console.log('Result:', result);
  // { isMalicious: true, reason: 'URL is on the phishing blocklist', detectedUrl: 'malicious.com' }
}

/**
 * Example 5: Managing blocklist dynamically
 */
async function manageBlocklist() {
  const scanner = new LinkScanner(new Set(), false);

  // Add domains to blocklist
  scanner.addToBlocklist('newmalicious.com');
  scanner.addToBlocklist('anotherbad.com');

  console.log('Blocklist size:', scanner.getBlocklistSize());
  // 2

  // Load blocklist from array
  scanner.loadBlocklist(['bad1.com', 'bad2.com', 'bad3.com']);

  console.log('Blocklist:', scanner.getBlocklist());
  // ['bad1.com', 'bad2.com', 'bad3.com']

  // Remove a domain
  scanner.removeFromBlocklist('bad2.com');

  console.log('Blocklist size:', scanner.getBlocklistSize());
  // 2
}

/**
 * Example 6: Google Safe Browsing integration
 */
async function googleSafeBrowsing() {
  // Enable Google Safe Browsing (requires API key in config)
  const scanner = new LinkScanner(undefined, true);

  const result = await scanner.scanMessage(
    'Visit http://example.com',
    'user123',
    false
  );

  console.log('Result:', result);
  // Will check against Google Safe Browsing API
  // { isMalicious: false } or { isMalicious: true, reason: 'URL flagged by Google Safe Browsing: MALWARE', ... }
}

/**
 * Example 7: URL normalization
 */
function urlNormalization() {
  const scanner = new LinkScanner();

  // Normalize URLs with zero-width characters
  const url1 = 'HTTPS://WWW.EX\u200BAM\u200CPLE.COM/path';
  const normalized1 = scanner.normalizeUrl(url1);
  console.log('Normalized:', normalized1);
  // 'example.com/path'

  // Check if URL has zero-width characters
  const hasZeroWidth = scanner.hasZeroWidthChars(url1);
  console.log('Has zero-width chars:', hasZeroWidth);
  // true
}

/**
 * Example 8: Extract URLs from message
 */
function extractUrls() {
  const scanner = new LinkScanner();

  const message = 'Check out http://example.com and https://another.com for more info';
  const urls = scanner.extractUrls(message);

  console.log('Extracted URLs:', urls);
  // ['http://example.com', 'https://another.com']
}

// Run examples
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Link Scanner Examples ===\n');

  console.log('Example 1: Basic link scanning');
  await basicLinkScanning();

  console.log('\nExample 2: Detecting zero-width characters');
  await detectZeroWidthChars();

  console.log('\nExample 3: Moderator exemption');
  await moderatorExemption();

  console.log('\nExample 4: Custom blocklist');
  await customBlocklist();

  console.log('\nExample 5: Managing blocklist');
  await manageBlocklist();

  console.log('\nExample 6: Google Safe Browsing');
  await googleSafeBrowsing();

  console.log('\nExample 7: URL normalization');
  urlNormalization();

  console.log('\nExample 8: Extract URLs');
  extractUrls();
}
