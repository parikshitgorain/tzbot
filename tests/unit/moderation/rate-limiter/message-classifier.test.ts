import { describe, it, expect } from 'vitest';
import { MessageClassifier } from '../../../../src/moderation/rate-limiter/message-classifier.js';
import type { RateLimiterConfig } from '../../../../src/moderation/rate-limiter/types.js';

// ---------------------------------------------------------------------------
// Minimal Discord Message mock helpers (no discord.js import needed)
// ---------------------------------------------------------------------------

function makeMessage(overrides: {
  isBot?: boolean;
  attachmentSize?: number;
  embeds?: Array<{ image?: object; video?: object; thumbnail?: object }>;
  channelId?: string;
} = {}) {
  const {
    isBot = false,
    attachmentSize = 0,
    embeds = [],
    channelId = 'ch1',
  } = overrides;

  return {
    channelId,
    author: { bot: isBot },
    attachments: { size: attachmentSize },
    embeds,
  } as any;
}

const config: RateLimiterConfig = {
  restrictedChannels: new Map([['ch1', 'redirect1']]),
  rateLimitWindowMs: 1000,
  violationWindowMs: 5000,
  warningDeleteDelayMs: 3000,
  cleanupIntervalMs: 60_000,
};

describe('MessageClassifier', () => {
  const classifier = new MessageClassifier();

  // -------------------------------------------------------------------------
  // isBotMessage()
  // -------------------------------------------------------------------------

  describe('isBotMessage()', () => {
    it('returns true when author.bot is true', () => {
      expect(classifier.isBotMessage(makeMessage({ isBot: true }))).toBe(true);
    });

    it('returns false when author.bot is false', () => {
      expect(classifier.isBotMessage(makeMessage({ isBot: false }))).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // isMediaMessage()
  // -------------------------------------------------------------------------

  describe('isMediaMessage()', () => {
    it('returns true when message has attachments', () => {
      expect(classifier.isMediaMessage(makeMessage({ attachmentSize: 1 }))).toBe(true);
    });

    it('returns true when message has an embed with an image', () => {
      const msg = makeMessage({ embeds: [{ image: { url: 'https://example.com/img.png' } }] });
      expect(classifier.isMediaMessage(msg)).toBe(true);
    });

    it('returns true when message has an embed with a video', () => {
      const msg = makeMessage({ embeds: [{ video: { url: 'https://example.com/vid.mp4' } }] });
      expect(classifier.isMediaMessage(msg)).toBe(true);
    });

    it('returns true when message has an embed with a thumbnail', () => {
      const msg = makeMessage({ embeds: [{ thumbnail: { url: 'https://example.com/thumb.png' } }] });
      expect(classifier.isMediaMessage(msg)).toBe(true);
    });

    it('returns false when embeds are empty and no attachments', () => {
      expect(classifier.isMediaMessage(makeMessage())).toBe(false);
    });

    it('returns false when embeds have no image/video/thumbnail', () => {
      const msg = makeMessage({ embeds: [{ description: 'just a description' } as any] });
      expect(classifier.isMediaMessage(msg)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // isRestrictedChannel()
  // -------------------------------------------------------------------------

  describe('isRestrictedChannel()', () => {
    it('returns true for a channel in restrictedChannels map', () => {
      expect(classifier.isRestrictedChannel('ch1', config)).toBe(true);
    });

    it('returns false for a channel not in the map', () => {
      expect(classifier.isRestrictedChannel('unknown-ch', config)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // getRedirectChannel()
  // -------------------------------------------------------------------------

  describe('getRedirectChannel()', () => {
    it('returns the redirect channel for a restricted channel', () => {
      expect(classifier.getRedirectChannel('ch1', config)).toBe('redirect1');
    });

    it('returns null for a non-restricted channel', () => {
      expect(classifier.getRedirectChannel('unknown-ch', config)).toBeNull();
    });
  });
});
