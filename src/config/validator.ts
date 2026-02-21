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

  // Role mappings (required)
  subscriberRoleId: z.string().trim().min(1, 'Subscriber role ID is required'),
  vipRoleId: z.string().trim().min(1, 'VIP role ID is required'),
  moderatorRoleId: z.string().trim().min(1, 'Moderator role ID is required'),

  // Notification settings (required)
  notificationChannelId: z.string().trim().min(1, 'Notification channel ID is required'),
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

  // Redis settings (required)
  redisUrl: z.string().trim().min(1, 'Redis URL is required'),
  redisPassword: z.string().optional(),

  // Moderation settings
  readOnlyChannels: z.array(z.string()).default([]),
  spamThreshold: spamThresholdSchema,
  linkScanningEnabled: z.boolean().default(true),
  googleSafeBrowsingApiKey: z.string().optional(),

  // AI settings
  aiEnabled: z.boolean().default(false),
  aiProvider: z.enum(['local', 'openai', 'anthropic']).default('openai'),
  aiApiKey: z.string().optional(),
  aiModelName: z.string().optional(),
  aiChannels: z.array(z.string()).default([]),

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

export type ConfigSchema = z.infer<typeof configSchema>;

export function validateConfig(config: unknown): ConfigSchema {
  try {
    return configSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((err) => {
        const path = err.path.join('.');
        return `  - ${path}: ${err.message}`;
      });

      throw new Error(
        `Configuration validation failed:\n${errorMessages.join('\n')}\n\n` +
          'Please check your .env file and ensure all required variables are set correctly.'
      );
    }
    throw error;
  }
}
