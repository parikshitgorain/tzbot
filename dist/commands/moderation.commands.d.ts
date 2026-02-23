/**
 * @file moderation.commands.ts
 * @description Moderation slash commands (/ban, /timeout, /warn, /kick)
 * @module commands
 */
import type { CommandDefinition } from '../managers/command.manager.js';
import type { IDiscordClient } from '../core/discord/client.js';
import type { Database } from '../types/interfaces.js';
/**
 * Create moderation commands
 */
export declare function createModerationCommands(_client: IDiscordClient, database: Database, rateLimiter?: import('../moderation/rate-limiter/channel-text-rate-limiter.js').ChannelTextRateLimiter): CommandDefinition[];
//# sourceMappingURL=moderation.commands.d.ts.map