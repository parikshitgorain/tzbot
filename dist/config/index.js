/**
 * @file index.ts
 * @description Configuration loader and exporter
 * @module config
 */
import dotenv from 'dotenv';
import { validateConfig } from './validator.js';
// Load environment variables
dotenv.config();
/**
 * Parse comma-separated string into array
 */
function parseArray(value) {
    if (!value) {
        return [];
    }
    return value.split(',').map((item) => item.trim()).filter(Boolean);
}
/**
 * Parse boolean from string
 */
function parseBoolean(value, defaultValue) {
    if (!value) {
        return defaultValue;
    }
    return value.toLowerCase() === 'true';
}
/**
 * Parse number from string
 */
function parseNumber(value, defaultValue) {
    if (!value) {
        return defaultValue;
    }
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}
/**
 * Load and validate configuration from environment variables
 */
function loadConfig() {
    const rawConfig = {
        // Discord settings
        discordToken: process.env.DISCORD_TOKEN,
        guildId: process.env.DISCORD_GUILD_ID,
        clientId: process.env.DISCORD_CLIENT_ID,
        discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL, // For critical error notifications
        // Role mappings
        subscriberRoleId: process.env.SUBSCRIBER_ROLE_ID,
        vipRoleId: process.env.VIP_ROLE_ID,
        moderatorRoleId: process.env.MODERATOR_ROLE_ID,
        // Notification settings
        notificationChannelId: process.env.NOTIFICATION_CHANNEL_ID,
        fallbackChannelId: process.env.FALLBACK_CHANNEL_ID,
        // Announcement relay
        privateAnnouncementChannelId: process.env.PRIVATE_ANNOUNCEMENT_CHANNEL_ID,
        publicAnnouncementChannelIds: parseArray(process.env.PUBLIC_ANNOUNCEMENT_CHANNEL_IDS),
        // Kick integration
        kickApiKey: process.env.KICK_API_KEY,
        kickChannelId: process.env.KICK_CHANNEL_ID,
        kickWebhookSecret: process.env.KICK_WEBHOOK_SECRET,
        kickOAuthClientId: process.env.KICK_OAUTH_CLIENT_ID,
        kickOAuthClientSecret: process.env.KICK_OAUTH_CLIENT_SECRET,
        // Database settings
        databaseUrl: process.env.DATABASE_URL,
        databaseMaxConnections: parseNumber(process.env.DATABASE_MAX_CONNECTIONS, 20),
        // Redis settings
        redisUrl: process.env.REDIS_URL,
        redisPassword: process.env.REDIS_PASSWORD,
        // Moderation settings
        readOnlyChannels: parseArray(process.env.READ_ONLY_CHANNELS),
        spamThreshold: {
            identicalMessages: parseNumber(process.env.SPAM_IDENTICAL_MESSAGES, 5),
            identicalWindow: parseNumber(process.env.SPAM_IDENTICAL_WINDOW, 10),
            rapidMessages: parseNumber(process.env.SPAM_RAPID_MESSAGES, 10),
            rapidWindow: parseNumber(process.env.SPAM_RAPID_WINDOW, 5),
        },
        linkScanningEnabled: parseBoolean(process.env.LINK_SCANNING_ENABLED, true),
        googleSafeBrowsingApiKey: process.env.GOOGLE_SAFE_BROWSING_API_KEY,
        // AI settings
        aiEnabled: parseBoolean(process.env.AI_ENABLED, false),
        aiProvider: process.env.AI_PROVIDER || 'openai',
        aiApiKey: process.env.AI_API_KEY,
        aiModelName: process.env.AI_MODEL_NAME,
        aiChannels: parseArray(process.env.AI_CHANNELS),
        // Chat rain settings
        chatRainEnabled: parseBoolean(process.env.CHAT_RAIN_ENABLED, false),
        chatRainMinDelay: parseNumber(process.env.CHAT_RAIN_MIN_DELAY, 300),
        chatRainActiveWindow: parseNumber(process.env.CHAT_RAIN_ACTIVE_WINDOW, 600),
        chatRainMinMessages: parseNumber(process.env.CHAT_RAIN_MIN_MESSAGES, 3),
        // Webhook server
        webhookPort: parseNumber(process.env.WEBHOOK_PORT, 3000),
        webhookHost: process.env.WEBHOOK_HOST || '0.0.0.0',
        // Logging
        logLevel: process.env.LOG_LEVEL || 'info',
        logFile: process.env.LOG_FILE || 'logs/tzbot.log',
        // Environment
        nodeEnv: process.env.NODE_ENV || 'development',
        // Performance settings
        maxMessagesPerSecond: parseNumber(process.env.MAX_MESSAGES_PER_SECOND, 100),
        cacheEnabled: parseBoolean(process.env.CACHE_ENABLED, true),
    };
    // Validate configuration
    return validateConfig(rawConfig);
}
// Export validated configuration
export const config = loadConfig();
//# sourceMappingURL=index.js.map