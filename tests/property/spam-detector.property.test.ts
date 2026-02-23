import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import {
  SpamDetector,
  DEFAULT_SPAM_THRESHOLDS,
  type SpamThresholds,
} from '../../src/moderation/spam-detector.js';

describe('SpamDetector – property-based tests', () => {
  // -------------------------------------------------------------------------
  // Property 1: A single message is never spam
  // -------------------------------------------------------------------------

  it('single message never spam', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        fc.string({ minLength: 1, maxLength: 20 }), // messageId
        fc.string({ maxLength: 200 }),               // content
        (userId, messageId, content) => {
          const detector = new SpamDetector();
          const result = detector.checkSpam(userId, messageId, content);
          return result.isSpam === false;
        },
      ),
    );
  });

  // -------------------------------------------------------------------------
  // Property 2: Sending n+1 identical messages within window triggers spam
  // -------------------------------------------------------------------------

  it('identical message spam is detected when threshold exceeded', () => {
    // Use low thresholds so the test runs quickly
    const thresholds: SpamThresholds = {
      identicalMessages: 3,
      identicalWindow: 10,
      rapidMessages: 1000, // disable rapid spam check
      rapidWindow: 5,
    };

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        fc.string({ minLength: 1, maxLength: 200 }), // content
        (userId, content) => {
          const detector = new SpamDetector(thresholds);
          const now = new Date();

          // Send exactly threshold messages (not yet spam)
          for (let i = 0; i < thresholds.identicalMessages - 1; i++) {
            detector.checkSpam(userId, `msg-${i}`, content, now);
          }

          // The (n+1)-th identical message should trigger spam
          const result = detector.checkSpam(
            userId,
            `msg-trigger`,
            content,
            now,
          );

          return result.isSpam === true;
        },
      ),
    );
  });

  // -------------------------------------------------------------------------
  // Property 3: Different messages never trigger identical-message spam
  // -------------------------------------------------------------------------

  it('different messages never trigger identical spam', () => {
    const thresholds: SpamThresholds = {
      identicalMessages: 3,
      identicalWindow: 10,
      rapidMessages: 1000, // disable rapid check
      rapidWindow: 5,
    };

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),    // userId
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 5, maxLength: 5 }),
        (userId, messages) => {
          const detector = new SpamDetector(thresholds);
          const now = new Date();

          let lastResult = { isSpam: false };
          for (let i = 0; i < messages.length; i++) {
            lastResult = detector.checkSpam(userId, `msg-${i}`, messages[i], now);
          }

          // None of the results from unique messages should trigger identical spam
          // Re-run and check all results
          const freshDetector = new SpamDetector(thresholds);
          let anySpam = false;
          for (let i = 0; i < messages.length; i++) {
            const r = freshDetector.checkSpam(userId, `msg-${i}`, messages[i], now);
            if (r.isSpam) anySpam = true;
          }
          return anySpam === false;
        },
      ),
    );
  });

  // -------------------------------------------------------------------------
  // Property 4: Clearing history prevents spam detection
  // -------------------------------------------------------------------------

  it('clearing history prevents spam detection', () => {
    const thresholds: SpamThresholds = {
      identicalMessages: 3,
      identicalWindow: 10,
      rapidMessages: 1000,
      rapidWindow: 5,
    };

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        fc.string({ minLength: 1, maxLength: 100 }), // content
        (userId, content) => {
          const detector = new SpamDetector(thresholds);
          const now = new Date();

          // Build up enough identical messages to trigger spam
          for (let i = 0; i < thresholds.identicalMessages + 1; i++) {
            detector.checkSpam(userId, `msg-${i}`, content, now);
          }

          // Clear history
          detector.clearUserHistory(userId);

          // After clearing, a single message should NOT be spam
          const result = detector.checkSpam(userId, 'msg-after-clear', content, now);
          return result.isSpam === false;
        },
      ),
    );
  });

  // -------------------------------------------------------------------------
  // Property 5: getUserMessageCount returns correct count (≤ n sent)
  // -------------------------------------------------------------------------

  it('getUserMessageCount returns count ≤ n messages sent', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),   // userId
        fc.integer({ min: 1, max: 20 }),               // n messages
        (userId, n) => {
          const detector = new SpamDetector(DEFAULT_SPAM_THRESHOLDS);
          const now = new Date();

          for (let i = 0; i < n; i++) {
            detector.checkSpam(userId, `msg-${i}`, `content-${i}`, now);
          }

          const count = detector.getUserMessageCount(
            userId,
            DEFAULT_SPAM_THRESHOLDS.identicalWindow,
            now,
          );

          return count <= n;
        },
      ),
    );
  });
});
