/**
 * @file config-manager.ts
 * @description Configuration hot-reload manager
 * @module config
 * 
 * Implements Property 52: Configuration Hot-Reload
 * Validates: Requirements 12.4
 */

import { EventEmitter } from 'events';
import { watch, FSWatcher } from 'fs';
import { readFile } from 'fs/promises';
import { parse as parseDotenv } from 'dotenv';
import { validateConfig } from './validator.js';
import type { BotConfig } from './types.js';
import { logger } from '../core/logger/logger.js';

export interface ConfigChangeEvent {
  oldConfig: BotConfig;
  newConfig: BotConfig;
  changedKeys: string[];
  timestamp: Date;
}

export interface ConfigManagerOptions {
  configPath?: string;
  debounceMs?: number;
  notifyAdmins?: (event: ConfigChangeEvent) => Promise<void>;
}

/**
 * Configuration manager with hot-reload support
 * 
 * Features:
 * - Watches .env file for changes
 * - Validates new configuration before applying
 * - Emits events on configuration changes
 * - Notifies administrators of changes
 * - Debounces rapid file changes
 */
export class ConfigManager extends EventEmitter {
  private currentConfig: BotConfig;
  private watcher: FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly configPath: string;
  private readonly debounceMs: number;
  private readonly notifyAdmins?: (event: ConfigChangeEvent) => Promise<void>;
  private isReloading = false;

  constructor(initialConfig: BotConfig, options: ConfigManagerOptions = {}) {
    super();
    this.currentConfig = initialConfig;
    this.configPath = options.configPath || '.env';
    this.debounceMs = options.debounceMs || 1000;
    this.notifyAdmins = options.notifyAdmins;
  }

  /**
   * Get current configuration
   */
  getConfig(): BotConfig {
    return { ...this.currentConfig };
  }

  /**
   * Start watching configuration file for changes
   */
  startWatching(): void {
    if (this.watcher) {
      logger.warn('Config watcher already started');
      return;
    }

    try {
      this.watcher = watch(this.configPath, (eventType) => {
        if (eventType === 'change') {
          this.handleFileChange();
        }
      });

      logger.info('Configuration hot-reload enabled', {
        configPath: this.configPath,
        debounceMs: this.debounceMs,
      });
    } catch (error) {
      logger.error('Failed to start config watcher', { error, configPath: this.configPath });
      throw error;
    }
  }

  /**
   * Stop watching configuration file
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      logger.info('Configuration hot-reload disabled');
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Handle file change with debouncing
   */
  private handleFileChange(): void {
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new timer
    this.debounceTimer = setTimeout(() => {
      this.reloadConfig().catch((error) => {
        logger.error('Failed to reload configuration', { error });
      });
    }, this.debounceMs);
  }

  /**
   * Reload configuration from file
   */
  async reloadConfig(): Promise<void> {
    if (this.isReloading) {
      logger.debug('Config reload already in progress, skipping');
      return;
    }

    this.isReloading = true;

    try {
      logger.info('Reloading configuration', { configPath: this.configPath });

      // Read and parse .env file
      const fileContent = await readFile(this.configPath, 'utf-8');
      const parsed = parseDotenv(Buffer.from(fileContent));

      // Build new config object
      const newRawConfig = this.buildConfigFromEnv(parsed);

      // Validate new configuration
      let newConfig: BotConfig;
      try {
        newConfig = validateConfig(newRawConfig) as BotConfig;
      } catch (error) {
        logger.error('Configuration validation failed, keeping current config', {
          error: error instanceof Error ? error.message : String(error),
        });
        this.emit('validation-error', error);
        return;
      }

      // Detect changes
      const changedKeys = this.detectChanges(this.currentConfig, newConfig);

      if (changedKeys.length === 0) {
        logger.debug('No configuration changes detected');
        return;
      }

      // Create change event
      const changeEvent: ConfigChangeEvent = {
        oldConfig: this.currentConfig,
        newConfig,
        changedKeys,
        timestamp: new Date(),
      };

      // Apply new configuration
      this.currentConfig = newConfig;

      logger.info('Configuration reloaded successfully', {
        changedKeys,
        timestamp: changeEvent.timestamp,
      });

      // Emit change event
      this.emit('config-changed', changeEvent);

      // Notify administrators
      if (this.notifyAdmins) {
        try {
          await this.notifyAdmins(changeEvent);
        } catch (error) {
          logger.error('Failed to notify administrators of config change', { error });
        }
      }
    } finally {
      this.isReloading = false;
    }
  }

  /**
   * Build config object from environment variables
   */
  private buildConfigFromEnv(env: Record<string, string>): unknown {
    const parseArray = (value: string | undefined): string[] => {
      if (!value) return [];
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    };

    const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
      if (!value) return defaultValue;
      return value.toLowerCase() === 'true';
    };

    const parseNumber = (value: string | undefined, defaultValue: number): number => {
      if (!value) return defaultValue;
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? defaultValue : parsed;
    };

    return {
      // Discord settings
      discordToken: env.DISCORD_TOKEN,
      guildId: env.DISCORD_GUILD_ID,
      clientId: env.DISCORD_CLIENT_ID,

      // Role mappings
      subscriberRoleId: env.SUBSCRIBER_ROLE_ID,
      vipRoleId: env.VIP_ROLE_ID,
      moderatorRoleId: env.MODERATOR_ROLE_ID,

      // Notification settings
      notificationChannelId: env.NOTIFICATION_CHANNEL_ID,
      fallbackChannelId: env.FALLBACK_CHANNEL_ID,

      // Announcement relay
      privateAnnouncementChannelId: env.PRIVATE_ANNOUNCEMENT_CHANNEL_ID,
      publicAnnouncementChannelIds: parseArray(env.PUBLIC_ANNOUNCEMENT_CHANNEL_IDS),

      // Kick integration
      kickApiKey: env.KICK_API_KEY,
      kickChannelId: env.KICK_CHANNEL_ID,
      kickWebhookSecret: env.KICK_WEBHOOK_SECRET,
      kickOAuthClientId: env.KICK_OAUTH_CLIENT_ID,
      kickOAuthClientSecret: env.KICK_OAUTH_CLIENT_SECRET,

      // Database settings
      databaseUrl: env.DATABASE_URL,
      databaseMaxConnections: parseNumber(env.DATABASE_MAX_CONNECTIONS, 20),

      // Redis settings
      redisUrl: env.REDIS_URL,
      redisPassword: env.REDIS_PASSWORD,

      // Moderation settings
      readOnlyChannels: parseArray(env.READ_ONLY_CHANNELS),
      spamThreshold: {
        identicalMessages: parseNumber(env.SPAM_IDENTICAL_MESSAGES, 5),
        identicalWindow: parseNumber(env.SPAM_IDENTICAL_WINDOW, 10),
        rapidMessages: parseNumber(env.SPAM_RAPID_MESSAGES, 10),
        rapidWindow: parseNumber(env.SPAM_RAPID_WINDOW, 5),
      },
      linkScanningEnabled: parseBoolean(env.LINK_SCANNING_ENABLED, true),
      googleSafeBrowsingApiKey: env.GOOGLE_SAFE_BROWSING_API_KEY,

      // AI settings
      aiEnabled: parseBoolean(env.AI_ENABLED, false),
      aiProvider: (env.AI_PROVIDER as 'local' | 'openai' | 'anthropic') || 'openai',
      aiApiKey: env.AI_API_KEY,
      aiModelName: env.AI_MODEL_NAME,
      aiChannels: parseArray(env.AI_CHANNELS),

      // Chat rain settings
      chatRainEnabled: parseBoolean(env.CHAT_RAIN_ENABLED, false),
      chatRainMinDelay: parseNumber(env.CHAT_RAIN_MIN_DELAY, 300),
      chatRainActiveWindow: parseNumber(env.CHAT_RAIN_ACTIVE_WINDOW, 600),
      chatRainMinMessages: parseNumber(env.CHAT_RAIN_MIN_MESSAGES, 3),

      // Webhook server
      webhookPort: parseNumber(env.WEBHOOK_PORT, 3000),
      webhookHost: env.WEBHOOK_HOST || '0.0.0.0',

      // Logging
      logLevel: (env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
      logFile: env.LOG_FILE || 'logs/tzbot.log',

      // Environment
      nodeEnv: (env.NODE_ENV as 'development' | 'production' | 'test') || 'development',

      // Performance settings
      maxMessagesPerSecond: parseNumber(env.MAX_MESSAGES_PER_SECOND, 100),
      cacheEnabled: parseBoolean(env.CACHE_ENABLED, true),
    };
  }

  /**
   * Detect changes between old and new configuration
   */
  private detectChanges(oldConfig: BotConfig, newConfig: BotConfig): string[] {
    const changedKeys: string[] = [];

    const compareValues = (key: string, oldVal: unknown, newVal: unknown): void => {
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changedKeys.push(key);
      }
    };

    // Compare all top-level keys
    for (const key of Object.keys(newConfig) as Array<keyof BotConfig>) {
      compareValues(key, oldConfig[key], newConfig[key]);
    }

    return changedKeys;
  }

  /**
   * Manually trigger a configuration reload
   */
  async triggerReload(): Promise<void> {
    await this.reloadConfig();
  }
}
