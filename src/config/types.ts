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
  // Discord settings
  discordToken: string;
  guildId: string;
  clientId: string;

  // Role mappings
  subscriberRoleId: string;
  vipRoleId: string;
  moderatorRoleId: string;

  // Notification settings
  notificationChannelId: string;
  fallbackChannelId?: string;

  // Announcement relay
  privateAnnouncementChannelId?: string;
  publicAnnouncementChannelIds: string[];

  // Kick integration
  kickApiKey?: string;
  kickChannelId?: string;
  kickWebhookSecret?: string;
  kickOAuthClientId?: string;
  kickOAuthClientSecret?: string;

  // Database settings
  databaseUrl: string;
  databaseMaxConnections: number;

  // Redis settings
  redisUrl: string;
  redisPassword?: string;

  // Moderation settings
  readOnlyChannels: string[];
  spamThreshold: SpamThreshold;
  linkScanningEnabled: boolean;
  googleSafeBrowsingApiKey?: string;

  // AI settings
  aiEnabled: boolean;
  aiProvider: 'local' | 'openai' | 'anthropic';
  aiApiKey?: string;
  aiModelName?: string;
  aiChannels: string[];

  // Chat rain settings
  chatRainEnabled: boolean;
  chatRainMinDelay: number;
  chatRainActiveWindow: number;
  chatRainMinMessages: number;

  // Webhook server
  webhookPort: number;
  webhookHost: string;

  // Logging
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  logFile: string;

  // Environment
  nodeEnv: 'development' | 'production' | 'test';

  // Performance settings
  maxMessagesPerSecond: number;
  cacheEnabled: boolean;
}
