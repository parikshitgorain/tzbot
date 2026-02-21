/**
 * @file index.ts
 * @description Moderation module exports
 * @module moderation
 */

export { SpamDetector, DEFAULT_SPAM_THRESHOLDS } from './spam-detector.js';
export type { SpamThresholds } from './spam-detector.js';

export { LinkScanner } from './link-scanner.js';

export { ViolationTracker } from './violation-tracker.js';
