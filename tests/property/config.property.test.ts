/**
 * @file config.property.test.ts
 * @description Property-based tests for configuration validation
 * Feature: tzbot-discord-bot, Property 51: Configuration Validation
 * @module tests/property
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateConfig } from '@/config/validator.js';

describe('Configuration Validation Properties', () => {
  /**
   * Property 51: Configuration Validation
   * For any configuration loaded at startup, all values should be validated
   * and invalid configurations should be rejected with specific error messages.
   * Validates: Requirements 12.2, 12.3
   */
  it('Property 51: should reject invalid configurations with specific error messages', () => {
    fc.assert(
      fc.property(
        fc.record({
          discordToken: fc.option(fc.string(), { nil: undefined }),
          guildId: fc.option(fc.string(), { nil: undefined }),
          clientId: fc.option(fc.string(), { nil: undefined }),
          subscriberRoleId: fc.option(fc.string(), { nil: undefined }),
          vipRoleId: fc.option(fc.string(), { nil: undefined }),
          moderatorRoleId: fc.option(fc.string(), { nil: undefined }),
          notificationChannelId: fc.option(fc.string(), { nil: undefined }),
          databaseUrl: fc.option(fc.string(), { nil: undefined }),
          redisUrl: fc.option(fc.string(), { nil: undefined }),
        }),
        (config) => {
          // If any required field is missing or empty, validation should fail
          const hasAllRequired =
            config.discordToken &&
            config.discordToken.length > 0 &&
            config.guildId &&
            config.guildId.length > 0 &&
            config.clientId &&
            config.clientId.length > 0 &&
            config.subscriberRoleId &&
            config.subscriberRoleId.length > 0 &&
            config.vipRoleId &&
            config.vipRoleId.length > 0 &&
            config.moderatorRoleId &&
            config.moderatorRoleId.length > 0 &&
            config.notificationChannelId &&
            config.notificationChannelId.length > 0 &&
            config.databaseUrl &&
            config.databaseUrl.length > 0 &&
            config.redisUrl &&
            config.redisUrl.length > 0;

          if (!hasAllRequired) {
            // Should throw an error with specific field information
            expect(() => validateConfig(config)).toThrow();
            try {
              validateConfig(config);
            } catch (error) {
              // Error message should contain information about which field failed
              expect(error).toBeInstanceOf(Error);
              expect((error as Error).message).toContain('Configuration validation failed');
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 51: should accept valid configurations', () => {
    fc.assert(
      fc.property(
        fc.record({
          discordToken: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          guildId: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          clientId: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          subscriberRoleId: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          vipRoleId: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          moderatorRoleId: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          notificationChannelId: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          databaseUrl: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          redisUrl: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        }),
        (config) => {
          // Add required spamThreshold
          const fullConfig = {
            ...config,
            spamThreshold: {
              identicalMessages: 5,
              identicalWindow: 10,
              rapidMessages: 10,
              rapidWindow: 5,
            },
          };

          // Valid configuration should not throw
          expect(() => validateConfig(fullConfig)).not.toThrow();

          // Should return a valid config object
          const result = validateConfig(fullConfig);
          expect(result).toBeDefined();
          expect(result.discordToken).toBe(config.discordToken.trim());
          expect(result.guildId).toBe(config.guildId.trim());
          expect(result.clientId).toBe(config.clientId.trim());
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 51: should apply default values for optional fields', () => {
    const minimalConfig = {
      discordToken: 'test_token',
      guildId: 'test_guild',
      clientId: 'test_client',
      subscriberRoleId: 'sub_role',
      vipRoleId: 'vip_role',
      moderatorRoleId: 'mod_role',
      notificationChannelId: 'notif_channel',
      databaseUrl: 'postgresql://localhost/test',
      redisUrl: 'redis://localhost',
      spamThreshold: {
        identicalMessages: 5,
        identicalWindow: 10,
        rapidMessages: 10,
        rapidWindow: 5,
      },
    };

    const result = validateConfig(minimalConfig);

    // Should have default values
    expect(result.databaseMaxConnections).toBe(20);
    expect(result.webhookPort).toBe(3000);
    expect(result.logLevel).toBe('info');
    expect(result.nodeEnv).toBe('development');
    expect(result.maxMessagesPerSecond).toBe(100);
    expect(result.cacheEnabled).toBe(true);
    expect(result.aiEnabled).toBe(false);
    expect(result.chatRainEnabled).toBe(false);
    expect(result.linkScanningEnabled).toBe(true);
  });

  it('Property 51: should validate numeric constraints', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 1000 }),
        fc.integer({ min: -1000, max: 1000 }),
        (maxConnections, webhookPort) => {
          const config = {
            discordToken: 'test_token',
            guildId: 'test_guild',
            clientId: 'test_client',
            subscriberRoleId: 'sub_role',
            vipRoleId: 'vip_role',
            moderatorRoleId: 'mod_role',
            notificationChannelId: 'notif_channel',
            databaseUrl: 'postgresql://localhost/test',
            redisUrl: 'redis://localhost',
            databaseMaxConnections: maxConnections,
            webhookPort: webhookPort,
            spamThreshold: {
              identicalMessages: 5,
              identicalWindow: 10,
              rapidMessages: 10,
              rapidWindow: 5,
            },
          };

          // Invalid numeric values should be rejected
          if (maxConnections < 1 || maxConnections > 100) {
            expect(() => validateConfig(config)).toThrow();
          }

          if (webhookPort < 1 || webhookPort > 65535) {
            expect(() => validateConfig(config)).toThrow();
          }

          // Valid numeric values should be accepted
          if (
            maxConnections >= 1 &&
            maxConnections <= 100 &&
            webhookPort >= 1 &&
            webhookPort <= 65535
          ) {
            expect(() => validateConfig(config)).not.toThrow();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
