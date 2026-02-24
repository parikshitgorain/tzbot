/**
 * @file config-manager.ts
 * @description Configuration hot-reload manager
 * @module config
 *
 * Implements Property 52: Configuration Hot-Reload
 * Validates: Requirements 12.4
 */
import { EventEmitter } from 'events';
import { watch } from 'fs';
import { readFile } from 'fs/promises';
import { parse as parseDotenv } from 'dotenv';
import { validateConfig } from './validator.js';
import { logger } from '../core/logger/logger.js';
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
    currentConfig;
    watcher = null;
    debounceTimer = null;
    configPath;
    debounceMs;
    notifyAdmins;
    isReloading = false;
    constructor(initialConfig, options = {}) {
        super();
        this.currentConfig = initialConfig;
        this.configPath = options.configPath || '.env';
        this.debounceMs = options.debounceMs || 1000;
        this.notifyAdmins = options.notifyAdmins;
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.currentConfig };
    }
    /**
     * Start watching configuration file for changes
     */
    startWatching() {
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
        }
        catch (error) {
            logger.error('Failed to start config watcher', { error, configPath: this.configPath });
            throw error;
        }
    }
    /**
     * Stop watching configuration file
     */
    stopWatching() {
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
    handleFileChange() {
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
    async reloadConfig() {
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
            let newConfig;
            try {
                newConfig = validateConfig(newRawConfig);
            }
            catch (error) {
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
            const changeEvent = {
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
                }
                catch (error) {
                    logger.error('Failed to notify administrators of config change', { error });
                }
            }
        }
        finally {
            this.isReloading = false;
        }
    }
    /**
     * Build config object from environment variables
     */
    buildConfigFromEnv(env) {
        const parseArray = (value) => {
            if (!value) {
                return [];
            }
            return value.split(',').map((item) => item.trim()).filter(Boolean);
        };
        const parseBoolean = (value, defaultValue) => {
            if (!value) {
                return defaultValue;
            }
            return value.toLowerCase() === 'true';
        };
        const parseNumber = (value, defaultValue) => {
            if (!value) {
                return defaultValue;
            }
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
            // Rate limiter settings
            rateLimiterRestrictedChannels: this.parseChannelMapping(env.RATE_LIMITER_RESTRICTED_CHANNELS),
            rateLimiterWindowMs: parseNumber(env.RATE_LIMITER_WINDOW_MS, 60000),
            rateLimiterViolationWindowMs: parseNumber(env.RATE_LIMITER_VIOLATION_WINDOW_MS, 300000),
            rateLimiterWarningDeleteDelayMs: parseNumber(env.RATE_LIMITER_WARNING_DELETE_DELAY_MS, 10000),
            rateLimiterCleanupIntervalMs: parseNumber(env.RATE_LIMITER_CLEANUP_INTERVAL_MS, 60000),
            // AI settings
            aiEnabled: parseBoolean(env.AI_ENABLED, false),
            aiProvider: env.AI_PROVIDER || 'openai',
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
            logLevel: env.LOG_LEVEL || 'info',
            logFile: env.LOG_FILE || 'logs/tzbot.log',
            // Environment
            nodeEnv: env.NODE_ENV || 'development',
            // Performance settings
            maxMessagesPerSecond: parseNumber(env.MAX_MESSAGES_PER_SECOND, 100),
            cacheEnabled: parseBoolean(env.CACHE_ENABLED, true),
        };
    }
    /**
     * Parse channel mapping from environment variable
     * Format: "channelId1:redirectId1,channelId2:redirectId2"
     */
    parseChannelMapping(value) {
        if (!value || value.trim() === '') {
            return undefined;
        }
        const mapping = {};
        const pairs = value.split(',').map((pair) => pair.trim()).filter(Boolean);
        for (const pair of pairs) {
            const [channelId, redirectId] = pair.split(':').map((id) => id.trim());
            if (channelId && redirectId) {
                mapping[channelId] = redirectId;
            }
        }
        return Object.keys(mapping).length > 0 ? mapping : undefined;
    }
    /**
     * Detect changes between old and new configuration
     */
    detectChanges(oldConfig, newConfig) {
        const changedKeys = [];
        const compareValues = (key, oldVal, newVal) => {
            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                changedKeys.push(key);
            }
        };
        // Compare all top-level keys
        for (const key of Object.keys(newConfig)) {
            compareValues(key, oldConfig[key], newConfig[key]);
        }
        return changedKeys;
    }
    /**
     * Manually trigger a configuration reload
     */
    async triggerReload() {
        await this.reloadConfig();
    }
}
//# sourceMappingURL=config-manager.js.map