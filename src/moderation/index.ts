/**
 * @file index.ts
 * @description Moderation module exports
 * @module moderation
 */

export { SpamDetector, DEFAULT_SPAM_THRESHOLDS } from './spam-detector.js';
export type { SpamThresholds } from './spam-detector.js';

export { LinkScanner } from './link-scanner.js';

export { OffenseManager } from './offense-manager.js';
export type { NotificationService, NotificationResult } from './offense-manager.js';

export { PunishmentCalculator, PunishmentType } from './punishment-calculator.js';
export type { Punishment } from './punishment-calculator.js';
