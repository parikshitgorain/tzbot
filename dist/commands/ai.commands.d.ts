/**
 * @file ai.commands.ts
 * @description AI management commands
 * @module commands
 */
import type { CommandDefinition } from '../managers/command.manager.js';
/**
 * AI status command - Check AI system status
 */
export declare const aiStatusCommand: CommandDefinition;
/**
 * Clear AI history command - Clear conversation history for a channel
 */
export declare const aiClearHistoryCommand: CommandDefinition;
/**
 * AI toggle command - Enable or disable AI auto-reply
 */
export declare const aiToggleCommand: CommandDefinition;
/**
 * Export all AI commands
 */
export declare function createAICommands(): CommandDefinition[];
//# sourceMappingURL=ai.commands.d.ts.map