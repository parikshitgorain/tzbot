/**
 * @file interaction-response.ts
 * @description Utility functions for safely responding to Discord interactions
 * @module utils
 */
import type { ChatInputCommandInteraction, ButtonInteraction, InteractionReplyOptions, InteractionEditReplyOptions, InteractionUpdateOptions } from 'discord.js';
/**
 * Safely reply to an interaction with proper error handling
 * Handles cases where interaction token has expired or interaction was already acknowledged
 */
export declare function safeReply(interaction: ChatInputCommandInteraction | ButtonInteraction, options: InteractionReplyOptions): Promise<boolean>;
/**
 * Safely edit a reply with proper error handling
 */
export declare function safeEditReply(interaction: ChatInputCommandInteraction | ButtonInteraction, options: InteractionEditReplyOptions): Promise<boolean>;
/**
 * Safely defer a reply with proper error handling
 */
export declare function safeDeferReply(interaction: ChatInputCommandInteraction | ButtonInteraction, options?: {
    ephemeral?: boolean;
}): Promise<boolean>;
/**
 * Safely update an interaction (for button interactions)
 */
export declare function safeUpdate(interaction: ButtonInteraction, options: InteractionUpdateOptions): Promise<boolean>;
//# sourceMappingURL=interaction-response.d.ts.map