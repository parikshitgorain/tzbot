/**
 * @file giveaway.commands.ts
 * @description Giveaway slash commands (/giveaway create, /giveaway cancel, /giveaway list)
 * @module commands
 */
import type { CommandDefinition } from '../managers/command.manager.js';
import type { IDiscordClient } from '../core/discord/client.js';
import type { GiveawayManager } from '../managers/giveaway.manager.js';
/**
 * Create giveaway commands
 */
export declare function createGiveawayCommands(_client: IDiscordClient, giveawayManager: GiveawayManager): CommandDefinition[];
//# sourceMappingURL=giveaway.commands.d.ts.map