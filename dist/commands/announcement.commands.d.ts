/**
 * @file announcement.commands.ts
 * @description Announcement relay configuration commands
 *
 * Features:
 * - Configure private and public announcement channels
 * - Relay messages from private to public channels
 * - !embed command: Prefix messages with !embed to format as Discord embeds
 *
 * @module commands
 */
import type { CommandDefinition } from '../managers/command.manager.js';
import type { IDiscordClient } from '../core/discord/client.js';
import type { Database } from '../core/database/Database.js';
import type { AnnouncementRelayManager } from '../managers/announcement-relay.manager.js';
/**
 * Create announcement relay commands
 */
export declare function createAnnouncementCommands(discordClient: IDiscordClient, database: Database, announcementRelay: AnnouncementRelayManager | null): CommandDefinition[];
//# sourceMappingURL=announcement.commands.d.ts.map