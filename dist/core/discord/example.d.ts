/**
 * @file example.ts
 * @description Example usage of the Discord client wrapper
 * @module core/discord
 */
import { DiscordClient } from './client.js';
/**
 * Example: Basic Discord client usage
 */
declare function basicExample(): Promise<void>;
/**
 * Example: Sending messages with embeds
 */
declare function sendEmbedExample(client: DiscordClient, channelId: string): Promise<void>;
/**
 * Example: Moderation actions
 */
declare function moderationExample(client: DiscordClient, guildId: string, userId: string): Promise<void>;
/**
 * Example: Role management
 */
declare function roleManagementExample(client: DiscordClient, guildId: string, userId: string, roleId: string): Promise<void>;
/**
 * Example: Auto-reconnect handling
 */
declare function reconnectExample(): Promise<void>;
/**
 * Example: Event-driven moderation
 */
declare function eventDrivenModerationExample(): Promise<void>;
/**
 * Example: Complete bot setup
 */
declare function completeBotExample(): Promise<void>;
export { basicExample, sendEmbedExample, moderationExample, roleManagementExample, reconnectExample, eventDrivenModerationExample, completeBotExample, };
//# sourceMappingURL=example.d.ts.map