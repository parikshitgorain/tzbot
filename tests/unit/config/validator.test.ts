import { describe, it, expect } from 'vitest';
import { validateConfig } from '../../../src/config/validator.js';

const validConfig = {
  discordToken: 'test_token',
  guildId: '123456789',
  clientId: '123456789',
  subscriberRoleId: '123456789',
  vipRoleId: '123456789',
  moderatorRoleId: '123456789',
  notificationChannelId: '123456789',
  databaseUrl: 'postgresql://localhost/test',
  redisUrl: 'redis://localhost:6379',
  spamThreshold: {
    identicalMessages: 5,
    identicalWindow: 10,
    rapidMessages: 10,
    rapidWindow: 5,
  },
};

describe('validateConfig()', () => {
  describe('valid config', () => {
    it('passes validation and returns the config object', () => {
      const result = validateConfig(validConfig);
      expect(result).toBeDefined();
      expect(result.discordToken).toBe('test_token');
    });
  });

  describe('missing required fields', () => {
    it('throws when discordToken is missing', () => {
      const cfg = { ...validConfig, discordToken: undefined };
      expect(() => validateConfig(cfg)).toThrow(/discordToken|Discord token/i);
    });

    it('throws when guildId is missing', () => {
      const cfg = { ...validConfig, guildId: undefined };
      expect(() => validateConfig(cfg)).toThrow(/guildId|Guild ID/i);
    });

    it('throws when databaseUrl is missing', () => {
      const cfg = { ...validConfig, databaseUrl: undefined };
      expect(() => validateConfig(cfg)).toThrow(/databaseUrl|Database URL/i);
    });

    it('throws when redisUrl is missing', () => {
      const cfg = { ...validConfig, redisUrl: undefined };
      expect(() => validateConfig(cfg)).toThrow(/redisUrl|Redis URL/i);
    });
  });

  describe('invalid field values', () => {
    it('throws for an invalid logLevel', () => {
      const cfg = { ...validConfig, logLevel: 'invalid' };
      expect(() => validateConfig(cfg)).toThrow();
    });
  });

  describe('default values', () => {
    it('defaults logLevel to "info" when not provided', () => {
      const result = validateConfig(validConfig);
      expect(result.logLevel).toBe('info');
    });

    it('defaults webhookPort to 3000 when not provided', () => {
      const result = validateConfig(validConfig);
      expect(result.webhookPort).toBe(3000);
    });

    it('defaults nodeEnv to "development" when not provided', () => {
      const result = validateConfig(validConfig);
      expect(result.nodeEnv).toBe('development');
    });

    it('defaults publicAnnouncementChannelIds to an empty array', () => {
      const result = validateConfig(validConfig);
      expect(result.publicAnnouncementChannelIds).toEqual([]);
    });
  });

  describe('optional fields', () => {
    it('does not require kickApiKey', () => {
      const cfg = { ...validConfig };
      expect(() => validateConfig(cfg)).not.toThrow();
    });

    it('does not require fallbackChannelId', () => {
      const cfg = { ...validConfig };
      expect(() => validateConfig(cfg)).not.toThrow();
    });

    it('accepts kickApiKey when provided', () => {
      const cfg = { ...validConfig, kickApiKey: 'some-kick-key' };
      const result = validateConfig(cfg);
      expect(result.kickApiKey).toBe('some-kick-key');
    });

    it('accepts fallbackChannelId when provided', () => {
      const cfg = { ...validConfig, fallbackChannelId: '987654321' };
      const result = validateConfig(cfg);
      expect(result.fallbackChannelId).toBe('987654321');
    });
  });
});
