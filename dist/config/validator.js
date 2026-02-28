/**
 * @file validator.ts
 * @description Configuration validation using Zod
 * @module config
 */
import { z } from 'zod';
const spamThresholdSchema = z.object({
    identicalMessages: z.number().min(1).default(5),
    identicalWindow: z.number().min(1).default(10),
    rapidMessages: z.number().min(1).default(10),
    rapidWindow: z.number().min(1).default(5),
});
const configSchema = z.object({
    // Discord settings (required)
    discordToken: z.string().trim().min(1, 'Discord token is required'),
    guildId: z.string().trim().min(1, 'Guild ID is required'),
    clientId: z.string().trim().min(1, 'Client ID is required'),
    discordWebhookUrl: z.string().trim().optional(), // For critical error notifications
    // Role mappings (optional - features disabled if not set)
    subscriberRoleId: z.string().trim().optional(),
    vipRoleId: z.string().trim().optional(),
    moderatorRoleId: z.string().trim().optional(),
    // Notification settings (optional - logging disabled if not set)
    notificationChannelId: z.string().trim().optional(),
    fallbackChannelId: z.string().optional(),
    // Announcement relay (optional)
    privateAnnouncementChannelId: z.string().optional(),
    publicAnnouncementChannelIds: z.array(z.string()).default([]),
    // Kick integration (optional)
    kickApiKey: z.string().optional(),
    kickChannelId: z.string().optional(),
    kickWebhookSecret: z.string().optional(),
    kickOAuthClientId: z.string().optional(),
    kickOAuthClientSecret: z.string().optional(),
    // Database settings (required)
    databaseUrl: z.string().trim().min(1, 'Database URL is required'),
    databaseMaxConnections: z.number().min(1).max(100).default(20),
    // Redis settings (optional - caching disabled if not set)
    redisUrl: z.string().trim().optional(),
    redisPassword: z.string().optional(),
    // Moderation settings
    readOnlyChannels: z.array(z.string()).default([]),
    spamThreshold: spamThresholdSchema,
    linkScanningEnabled: z.boolean().default(true),
    googleSafeBrowsingApiKey: z.string().optional(),
    // AI settings (optional - AI disabled if not configured)
    aiEnabled: z.boolean().default(false),
    aiProvider: z.enum(['ollama', 'openai', 'anthropic', 'groq']).default('ollama'),
    aiApiKey: z.string().optional(), // Not needed for Ollama
    aiModelName: z.string().optional(), // e.g., 'llama3.2:1b', 'phi3:mini', 'gemma2:2b'
    aiBaseUrl: z.string().optional(), // Ollama base URL (default: http://localhost:11434)
    aiChannels: z.array(z.string()).default([]), // Empty array = all channels
    // AI Search settings (optional - web search disabled if not configured)
    aiSearchEnabled: z.boolean().default(false),
    aiSearchProvider: z.enum(['duckduckgo', 'searxng', 'google']).default('duckduckgo'),
    aiSearchSearxngUrl: z.string().default('https://searx.be'),
    aiSearchGoogleApiKey: z.string().optional(), // Google Custom Search API key
    aiSearchGoogleEngineId: z.string().optional(), // Google Custom Search Engine ID
    // Unsplash image search (optional)
    unsplashAccessKey: z.string().optional(),
    // Chat rain settings
    chatRainEnabled: z.boolean().default(false),
    chatRainMinDelay: z.number().min(60).default(300),
    chatRainActiveWindow: z.number().min(60).default(600),
    chatRainMinMessages: z.number().min(1).default(3),
    // Webhook server
    webhookPort: z.number().min(1).max(65535).default(3000),
    webhookHost: z.string().default('0.0.0.0'),
    // Logging
    logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    logFile: z.string().default('logs/tzbot.log'),
    // Environment
    nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
    // Performance settings
    maxMessagesPerSecond: z.number().min(1).default(100),
    cacheEnabled: z.boolean().default(true),
});
export function validateConfig(config) {
    try {
        return configSchema.parse(config);
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors.map((err) => {
                const path = err.path.join('.');
                return `  - ${path}: ${err.message}`;
            });
            throw new Error(`Configuration validation failed:\n${errorMessages.join('\n')}\n\n` +
                'Please check your .env file and ensure all required variables are set correctly.');
        }
        throw error;
    }
}
//# sourceMappingURL=validator.js.map