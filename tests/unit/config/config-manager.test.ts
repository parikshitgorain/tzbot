/**
 * @file config-manager.test.ts
 * @description Unit tests for ConfigManager
 * @module config
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { ConfigManager, ConfigChangeEvent } from '../../../src/config/config-manager.js';
import type { BotConfig } from '../../../src/config/types.js';

// Test config directory
const TEST_DIR = join(process.cwd(), 'tests', 'temp');
const TEST_CONFIG_PATH = join(TEST_DIR, 'test.env');

// Mock config
const createMockConfig = (): BotConfig => ({
  discordToken: 'test-token',
  guildId: 'test-guild',
  clientId: 'test-client',
  subscriberRoleId: 'sub-role',
  vipRoleId: 'vip-role',
  moderatorRoleId: 'mod-role',
  notificationChannelId: 'notif-channel',
  fallbackChannelId: 'fallback-channel',
  privateAnnouncementChannelId: 'private-channel',
  publicAnnouncementChannelIds: ['public-1', 'public-2'],
  kickApiKey: 'kick-key',
  kickChannelId: 'kick-channel',
  kickWebhookSecret: 'webhook-secret',
  kickOAuthClientId: 'oauth-client',
  kickOAuthClientSecret: 'oauth-secret',
  databaseUrl: 'postgresql://localhost/test',
  databaseMaxConnections: 20,
  redisUrl: 'redis://localhost:6379',
  redisPassword: 'redis-pass',
  readOnlyChannels: ['readonly-1'],
  spamThreshold: {
    identicalMessages: 5,
    identicalWindow: 10,
    rapidMessages: 10,
    rapidWindow: 5,
  },
  linkScanningEnabled: true,
  googleSafeBrowsingApiKey: 'gsb-key',
  aiEnabled: false,
  aiProvider: 'openai',
  aiApiKey: 'ai-key',
  aiModelName: 'gpt-3.5-turbo',
  aiChannels: ['ai-channel'],
  chatRainEnabled: false,
  chatRainMinDelay: 300,
  chatRainActiveWindow: 600,
  chatRainMinMessages: 3,
  webhookPort: 3000,
  webhookHost: '0.0.0.0',
  logLevel: 'info',
  logFile: 'logs/test.log',
  nodeEnv: 'test',
  maxMessagesPerSecond: 100,
  cacheEnabled: true,
});

// Create .env file content from config
const createEnvContent = (config: Partial<BotConfig>): string => {
  const lines: string[] = [];

  if (config.discordToken) lines.push(`DISCORD_TOKEN=${config.discordToken}`);
  if (config.guildId) lines.push(`DISCORD_GUILD_ID=${config.guildId}`);
  if (config.clientId) lines.push(`DISCORD_CLIENT_ID=${config.clientId}`);
  if (config.subscriberRoleId) lines.push(`SUBSCRIBER_ROLE_ID=${config.subscriberRoleId}`);
  if (config.vipRoleId) lines.push(`VIP_ROLE_ID=${config.vipRoleId}`);
  if (config.moderatorRoleId) lines.push(`MODERATOR_ROLE_ID=${config.moderatorRoleId}`);
  if (config.notificationChannelId) lines.push(`NOTIFICATION_CHANNEL_ID=${config.notificationChannelId}`);
  if (config.fallbackChannelId) lines.push(`FALLBACK_CHANNEL_ID=${config.fallbackChannelId}`);
  if (config.databaseUrl) lines.push(`DATABASE_URL=${config.databaseUrl}`);
  if (config.redisUrl) lines.push(`REDIS_URL=${config.redisUrl}`);
  if (config.linkScanningEnabled !== undefined) lines.push(`LINK_SCANNING_ENABLED=${config.linkScanningEnabled}`);
  if (config.chatRainEnabled !== undefined) lines.push(`CHAT_RAIN_ENABLED=${config.chatRainEnabled}`);
  if (config.chatRainMinDelay) lines.push(`CHAT_RAIN_MIN_DELAY=${config.chatRainMinDelay}`);
  if (config.webhookPort) lines.push(`WEBHOOK_PORT=${config.webhookPort}`);

  return lines.join('\n');
};

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let mockConfig: BotConfig;

  beforeEach(async () => {
    // Create test directory
    if (!existsSync(TEST_DIR)) {
      await mkdir(TEST_DIR, { recursive: true });
    }

    mockConfig = createMockConfig();

    // Create initial config file
    const envContent = createEnvContent(mockConfig);
    await writeFile(TEST_CONFIG_PATH, envContent);
  });

  afterEach(async () => {
    // Stop watching
    if (configManager) {
      configManager.stopWatching();
    }

    // Clean up test file
    try {
      await unlink(TEST_CONFIG_PATH);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  describe('constructor', () => {
    it('should create config manager with initial config', () => {
      configManager = new ConfigManager(mockConfig, {
        configPath: TEST_CONFIG_PATH,
      });

      const config = configManager.getConfig();
      expect(config).toEqual(mockConfig);
    });

    it('should use default options', () => {
      configManager = new ConfigManager(mockConfig);
      expect(configManager).toBeDefined();
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      configManager = new ConfigManager(mockConfig);
      const config = configManager.getConfig();
      expect(config).toEqual(mockConfig);
    });

    it('should return a copy of config', () => {
      configManager = new ConfigManager(mockConfig);
      const config1 = configManager.getConfig();
      const config2 = configManager.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different objects
    });
  });

  describe('startWatching and stopWatching', () => {
    it('should start watching config file', () => {
      configManager = new ConfigManager(mockConfig, {
        configPath: TEST_CONFIG_PATH,
      });

      expect(() => configManager.startWatching()).not.toThrow();
    });

    it('should not start watching twice', () => {
      configManager = new ConfigManager(mockConfig, {
        configPath: TEST_CONFIG_PATH,
      });

      configManager.startWatching();
      configManager.startWatching(); // Should log warning but not throw

      expect(true).toBe(true); // No error thrown
    });

    it('should stop watching config file', () => {
      configManager = new ConfigManager(mockConfig, {
        configPath: TEST_CONFIG_PATH,
      });

      configManager.startWatching();
      expect(() => configManager.stopWatching()).not.toThrow();
    });

    it('should handle stop watching when not started', () => {
      configManager = new ConfigManager(mockConfig);
      expect(() => configManager.stopWatching()).not.toThrow();
    });
  });

  describe('reloadConfig', () => {
    it('should reload configuration from file', async () => {
      configManager = new ConfigManager(mockConfig, {
        configPath: TEST_CONFIG_PATH,
        debounceMs: 0, // No debounce for testing
      });

      // Update config file
      const newConfig = { ...mockConfig, webhookPort: 4000 };
      await writeFile(TEST_CONFIG_PATH, createEnvContent(newConfig));

      // Reload
      await configManager.reloadConfig();

      const config = configManager.getConfig();
      expect(config.webhookPort).toBe(4000);
    });

    it('should emit config-changed event on successful reload', async () => {
      configManager = new ConfigManager(mockConfig, {
        configPath: TEST_CONFIG_PATH,
        debounceMs: 0,
      });

      const changePromise = new Promise<ConfigChangeEvent>((resolve) => {
        configManager.once('config-changed', resolve);
      });

      // Update config file
      const newConfig = { ...mockConfig, webhookPort: 4000 };
      await writeFile(TEST_CONFIG_PATH, createEnvContent(newConfig));

      // Reload
      await configManager.reloadConfig();

      const event = await changePromise;
      expect(event.changedKeys).toContain('webhookPort');
      expect(event.newConfig.webhookPort).toBe(4000);
    });

    it('should detect multiple changed keys', async () => {
      configManager = new ConfigManager(mockConfig, {
        configPath: TEST_CONFIG_PATH,
        debounceMs: 0,
      });

      const changePromise = new Promise<ConfigChangeEvent>((resolve) => {
        configManager.once('config-changed', resolve);
      });

      // Update multiple values
      const newConfig = {
        ...mockConfig,
        webhookPort: 4000,
        chatRainEnabled: true,
        linkScanningEnabled: false,
      };
      await writeFile(TEST_CONFIG_PATH, createEnvContent(newConfig));

      await configManager.reloadConfig();

      const event = await changePromise;
      expect(event.changedKeys).toContain('webhookPort');
      expect(event.changedKeys).toContain('chatRainEnabled');
      expect(event.changedKeys).toContain('linkScanningEnabled');
    });

    it('should not emit event if no changes detected', async () => {
      configManager = new ConfigManager(mockConfig, {
        configPath: TEST_CONFIG_PATH,
        debounceMs: 0,
      });

      // First reload to establish baseline
      await configManager.reloadConfig();

      let eventEmitted = false;
      configManager.once('config-changed', () => {
        eventEmitted = true;
      });

      // Write same config again (no changes)
      await configManager.reloadConfig();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(eventEmitted).toBe(false);
    });

    it('should keep current config on validation error', async () => {
      configManager = new ConfigManager(mockConfig, {
        configPath: TEST_CONFIG_PATH,
        debounceMs: 0,
      });

      const errorPromise = new Promise<Error>((resolve) => {
        configManager.once('validation-error', resolve);
      });

      // Write invalid config (missing required field)
      await writeFile(TEST_CONFIG_PATH, 'WEBHOOK_PORT=4000\n');

      await configManager.reloadConfig();

      const error = await errorPromise;
      expect(error).toBeDefined();

      // Config should remain unchanged
      const config = configManager.getConfig();
      expect(config).toEqual(mockConfig);
    });

    it('should not emit config-changed on validation error', async () => {
      configManager = new ConfigManager(mockConfig, {
        configPath: TEST_CONFIG_PATH,
        debounceMs: 0,
      });

      let changeEmitted = false;
      configManager.once('config-changed', () => {
        changeEmitted = true;
      });

      // Write invalid config
      await writeFile(TEST_CONFIG_PATH, 'INVALID=true\n');
      await configManager.reloadConfig();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(changeEmitted).toBe(false);
    });

    it('should handle concurrent reload attempts', async () => {
      configManager = new ConfigManager(mockConfig, {
        configPath: TEST_CONFIG_PATH,
        debounceMs: 0,
      });

      // Update config
      const newConfig = { ...mockConfig, webhookPort: 4000 };
      await writeFile(TEST_CONFIG_PATH, createEnvContent(newConfig));

      // Trigger multiple reloads concurrently
      const reloads = [
        configManager.reloadConfig(),
        configManager.reloadConfig(),
        configManager.reloadConfig(),
      ];

      await Promise.all(reloads);

      // Should complete without error
      const config = configManager.getConfig();
      expect(config.webhookPort).toBe(4000);
    });
  });

  describe('notifyAdmins', () => {
    it('should call notifyAdmins callback on config change', async () => {
      const notifyMock = vi.fn();

      configManager = new ConfigManager(mockConfig, {
        configPath: TEST_CONFIG_PATH,
        debounceMs: 0,
        notifyAdmins: notifyMock,
      });

      // Update config
      const newConfig = { ...mockConfig, webhookPort: 4000 };
      await writeFile(TEST_CONFIG_PATH, createEnvContent(newConfig));

      await configManager.reloadConfig();

      // Wait for async notification
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(notifyMock).toHaveBeenCalledOnce();
      expect(notifyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          changedKeys: expect.arrayContaining(['webhookPort']),
        })
      );
    });

    it('should handle notifyAdmins errors gracefully', async () => {
      const notifyMock = vi.fn().mockRejectedValue(new Error('Notification failed'));

      configManager = new ConfigManager(mockConfig, {
        configPath: TEST_CONFIG_PATH,
        debounceMs: 0,
        notifyAdmins: notifyMock,
      });

      // Update config
      const newConfig = { ...mockConfig, webhookPort: 4000 };
      await writeFile(TEST_CONFIG_PATH, createEnvContent(newConfig));

      // Should not throw
      await expect(configManager.reloadConfig()).resolves.not.toThrow();
    });
  });

  describe('triggerReload', () => {
    it('should manually trigger config reload', async () => {
      configManager = new ConfigManager(mockConfig, {
        configPath: TEST_CONFIG_PATH,
        debounceMs: 0,
      });

      const changePromise = new Promise<ConfigChangeEvent>((resolve) => {
        configManager.once('config-changed', resolve);
      });

      // Update config file
      const newConfig = { ...mockConfig, webhookPort: 4000 };
      await writeFile(TEST_CONFIG_PATH, createEnvContent(newConfig));

      // Trigger manual reload
      await configManager.triggerReload();

      const event = await changePromise;
      expect(event.changedKeys).toContain('webhookPort');
    });
  });

  describe('file watching integration', () => {
    it('should detect file changes automatically', async () => {
      configManager = new ConfigManager(mockConfig, {
        configPath: TEST_CONFIG_PATH,
        debounceMs: 100, // Short debounce for testing
      });

      const changePromise = new Promise<ConfigChangeEvent>((resolve) => {
        configManager.once('config-changed', resolve);
      });

      configManager.startWatching();

      // Wait for watcher to initialize
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Update config file
      const newConfig = { ...mockConfig, webhookPort: 5000 };
      await writeFile(TEST_CONFIG_PATH, createEnvContent(newConfig));

      // Wait for debounce + processing
      const event = await Promise.race([
        changePromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
      ]);

      expect(event).not.toBeNull();
      if (event) {
        expect(event.changedKeys).toContain('webhookPort');
        expect(event.newConfig.webhookPort).toBe(5000);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle missing config file', async () => {
      await unlink(TEST_CONFIG_PATH);

      configManager = new ConfigManager(mockConfig, {
        configPath: TEST_CONFIG_PATH,
        debounceMs: 0,
      });

      await expect(configManager.reloadConfig()).rejects.toThrow();
    });

    it('should handle malformed .env file', async () => {
      configManager = new ConfigManager(mockConfig, {
        configPath: TEST_CONFIG_PATH,
        debounceMs: 0,
      });

      const errorPromise = new Promise<Error>((resolve) => {
        configManager.once('validation-error', resolve);
      });

      // Write malformed content
      await writeFile(TEST_CONFIG_PATH, 'DISCORD_TOKEN=\nINVALID LINE WITHOUT EQUALS');

      await configManager.reloadConfig();

      const error = await errorPromise;
      expect(error).toBeDefined();
    });

    it('should handle empty config file', async () => {
      configManager = new ConfigManager(mockConfig, {
        configPath: TEST_CONFIG_PATH,
        debounceMs: 0,
      });

      const errorPromise = new Promise<Error>((resolve) => {
        configManager.once('validation-error', resolve);
      });

      await writeFile(TEST_CONFIG_PATH, '');

      await configManager.reloadConfig();

      const error = await errorPromise;
      expect(error).toBeDefined();
    });
  });
});
