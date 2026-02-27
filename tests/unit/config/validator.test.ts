import { describe, it, expect } from 'vitest';
import { validateConfig } from '../../../src/config/validator.js';

const validConfig = {
  discordToken: 'test_token',
  guildId: '123456789',
  clientId: '123456789',
  databaseUrl: 'postgresql://localhost/test',
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

    it('does not require redisUrl', () => {
      const cfg = { ...validConfig };
      expect(() => validateConfig(cfg)).not.toThrow();
    });

    it('does not require role IDs', () => {
      const cfg = { ...validConfig };
      expect(() => validateConfig(cfg)).not.toThrow();
    });

    it('does not require notificationChannelId', () => {
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

    it('accepts redisUrl when provided', () => {
      const cfg = { ...validConfig, redisUrl: 'redis://localhost:6379' };
      const result = validateConfig(cfg);
      expect(result.redisUrl).toBe('redis://localhost:6379');
    });

    it('accepts role IDs when provided', () => {
      const cfg = {
        ...validConfig,
        subscriberRoleId: '123456789',
        vipRoleId: '987654321',
        moderatorRoleId: '555555555',
      };
      const result = validateConfig(cfg);
      expect(result.subscriberRoleId).toBe('123456789');
      expect(result.vipRoleId).toBe('987654321');
      expect(result.moderatorRoleId).toBe('555555555');
    });
  });

  describe('error handling', () => {
    it('throws with formatted error message for multiple validation errors', () => {
      const cfg = {
        discordToken: '',
        guildId: '',
        clientId: '',
        databaseUrl: '',
      };
      expect(() => validateConfig(cfg)).toThrow(/Configuration validation failed/);
      expect(() => validateConfig(cfg)).toThrow(/discordToken/);
      expect(() => validateConfig(cfg)).toThrow(/guildId/);
    });

    it('re-throws non-Zod errors', () => {
      const cfg = null;
      expect(() => validateConfig(cfg)).toThrow();
    });

    it('includes helpful message about checking .env file', () => {
      const cfg = { discordToken: '' };
      expect(() => validateConfig(cfg)).toThrow(/check your \.env file/i);
    });
  });

  describe('numeric constraints', () => {
    it('enforces minimum value for databaseMaxConnections', () => {
      const cfg = { ...validConfig, databaseMaxConnections: 0 };
      expect(() => validateConfig(cfg)).toThrow();
    });

    it('enforces maximum value for databaseMaxConnections', () => {
      const cfg = { ...validConfig, databaseMaxConnections: 101 };
      expect(() => validateConfig(cfg)).toThrow();
    });

    it('enforces minimum value for webhookPort', () => {
      const cfg = { ...validConfig, webhookPort: 0 };
      expect(() => validateConfig(cfg)).toThrow();
    });

    it('enforces maximum value for webhookPort', () => {
      const cfg = { ...validConfig, webhookPort: 65536 };
      expect(() => validateConfig(cfg)).toThrow();
    });

    it('enforces minimum value for chatRainMinDelay', () => {
      const cfg = { ...validConfig, chatRainMinDelay: 59 };
      expect(() => validateConfig(cfg)).toThrow();
    });

    it('enforces minimum value for chatRainActiveWindow', () => {
      const cfg = { ...validConfig, chatRainActiveWindow: 59 };
      expect(() => validateConfig(cfg)).toThrow();
    });

    it('enforces minimum value for chatRainMinMessages', () => {
      const cfg = { ...validConfig, chatRainMinMessages: 0 };
      expect(() => validateConfig(cfg)).toThrow();
    });

    it('enforces minimum value for maxMessagesPerSecond', () => {
      const cfg = { ...validConfig, maxMessagesPerSecond: 0 };
      expect(() => validateConfig(cfg)).toThrow();
    });
  });

  describe('enum validations', () => {
    it('accepts valid aiProvider values', () => {
      const cfg1 = { ...validConfig, aiProvider: 'ollama' };
      const cfg2 = { ...validConfig, aiProvider: 'openai' };
      const cfg3 = { ...validConfig, aiProvider: 'anthropic' };
      
      expect(validateConfig(cfg1).aiProvider).toBe('ollama');
      expect(validateConfig(cfg2).aiProvider).toBe('openai');
      expect(validateConfig(cfg3).aiProvider).toBe('anthropic');
    });

    it('rejects invalid aiProvider values', () => {
      const cfg = { ...validConfig, aiProvider: 'invalid' };
      expect(() => validateConfig(cfg)).toThrow();
    });

    it('accepts valid nodeEnv values', () => {
      const cfg1 = { ...validConfig, nodeEnv: 'development' };
      const cfg2 = { ...validConfig, nodeEnv: 'production' };
      const cfg3 = { ...validConfig, nodeEnv: 'test' };
      
      expect(validateConfig(cfg1).nodeEnv).toBe('development');
      expect(validateConfig(cfg2).nodeEnv).toBe('production');
      expect(validateConfig(cfg3).nodeEnv).toBe('test');
    });

    it('rejects invalid nodeEnv values', () => {
      const cfg = { ...validConfig, nodeEnv: 'staging' };
      expect(() => validateConfig(cfg)).toThrow();
    });

    it('accepts valid logLevel values', () => {
      const cfg1 = { ...validConfig, logLevel: 'error' };
      const cfg2 = { ...validConfig, logLevel: 'warn' };
      const cfg3 = { ...validConfig, logLevel: 'info' };
      const cfg4 = { ...validConfig, logLevel: 'debug' };
      
      expect(validateConfig(cfg1).logLevel).toBe('error');
      expect(validateConfig(cfg2).logLevel).toBe('warn');
      expect(validateConfig(cfg3).logLevel).toBe('info');
      expect(validateConfig(cfg4).logLevel).toBe('debug');
    });
  });

  describe('boolean fields', () => {
    it('defaults boolean fields correctly', () => {
      const result = validateConfig(validConfig);
      expect(result.linkScanningEnabled).toBe(true);
      expect(result.aiEnabled).toBe(false);
      expect(result.chatRainEnabled).toBe(false);
      expect(result.cacheEnabled).toBe(true);
    });

    it('accepts boolean overrides', () => {
      const cfg = {
        ...validConfig,
        linkScanningEnabled: false,
        aiEnabled: true,
        chatRainEnabled: true,
        cacheEnabled: false,
      };
      const result = validateConfig(cfg);
      expect(result.linkScanningEnabled).toBe(false);
      expect(result.aiEnabled).toBe(true);
      expect(result.chatRainEnabled).toBe(true);
      expect(result.cacheEnabled).toBe(false);
    });
  });

  describe('array fields', () => {
    it('defaults array fields to empty arrays', () => {
      const result = validateConfig(validConfig);
      expect(result.readOnlyChannels).toEqual([]);
      expect(result.aiChannels).toEqual([]);
      expect(result.publicAnnouncementChannelIds).toEqual([]);
    });

    it('accepts array values when provided', () => {
      const cfg = {
        ...validConfig,
        readOnlyChannels: ['123', '456'],
        aiChannels: ['789', '012'],
        publicAnnouncementChannelIds: ['345', '678'],
      };
      const result = validateConfig(cfg);
      expect(result.readOnlyChannels).toEqual(['123', '456']);
      expect(result.aiChannels).toEqual(['789', '012']);
      expect(result.publicAnnouncementChannelIds).toEqual(['345', '678']);
    });
  });
});
