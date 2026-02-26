/**
 * @file utility.commands.ts
 * @description Utility slash commands (/config, /link, /unlink, /checklink, /deletemydata)
 * @module commands
 */
import type { CommandDefinition } from '../managers/command.manager.js';
import type { IDiscordClient } from '../core/discord/client.js';
import type { Database } from '../types/interfaces.js';
import type { BotConfig } from '../config/types.js';
import type { AnnouncementRelayManager } from '../managers/announcement-relay.manager.js';
/**
 * Create utility commands
 */
export declare function createUtilityCommands(_client: IDiscordClient, database: Database, config: BotConfig, announcementRelay?: AnnouncementRelayManager | null): CommandDefinition[];
//# sourceMappingURL=utility.commands.d.ts.map