/**
 * @file types.ts
 * @description Configuration type definitions
 * @module config
 */
export interface SpamThreshold {
    identicalMessages: number;
    identicalWindow: number;
    rapidMessages: number;
    rapidWindow: number;
}
export interface BotConfig {
    discordToken: string;
    guildId: string;
    clientId: string;
    subscriberRoleId?: string;
    vipRoleId?: string;
    moderatorRoleId?: string;
    notificationChannelId?: string;
    fallbackChannelId?: string;
    privateAnnouncementChannelId?: string;
    publicAnnouncementChannelIds: string[];
    kickApiKey?: string;
    kickChannelId?: string;
    kickWebhookSecret?: string;
    kickOAuthClientId?: string;
    kickOAuthClientSecret?: string;
    databaseUrl: string;
    databaseMaxConnections: number;
    redisUrl?: string;
    redisPassword?: string;
    readOnlyChannels: string[];
    spamThreshold: SpamThreshold;
    linkScanningEnabled: boolean;
    googleSafeBrowsingApiKey?: string;
    rateLimiterRestrictedChannels?: Record<string, string>;
    rateLimiterWindowMs?: number;
    rateLimiterViolationWindowMs?: number;
    rateLimiterWarningDeleteDelayMs?: number;
    rateLimiterCleanupIntervalMs?: number;
    aiEnabled: boolean;
    aiProvider: 'local' | 'openai' | 'anthropic';
    aiApiKey?: string;
    aiModelName?: string;
    aiChannels: string[];
    chatRainEnabled: boolean;
    chatRainMinDelay: number;
    chatRainActiveWindow: number;
    chatRainMinMessages: number;
    webhookPort: number;
    webhookHost: string;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    logFile: string;
    nodeEnv: 'development' | 'production' | 'test';
    maxMessagesPerSecond: number;
    cacheEnabled: boolean;
}
//# sourceMappingURL=types.d.ts.map