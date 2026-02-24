/**
 * @file permissions.ts
 * @description Discord bot permissions verification utility
 * @module core/discord
 */
import { Guild } from 'discord.js';
/**
 * Required permissions for the bot to function properly
 */
export declare const REQUIRED_PERMISSIONS: readonly [bigint, bigint, bigint, bigint, bigint];
/**
 * Result of permissions verification
 */
export interface PermissionsCheckResult {
    hasAllPermissions: boolean;
    missingPermissions: string[];
    grantedPermissions: string[];
}
/**
 * Verifies that the bot has all required permissions in the guild
 * @param guild - The Discord guild to check permissions in
 * @returns PermissionsCheckResult with details about granted and missing permissions
 */
export declare function verifyBotPermissions(guild: Guild): PermissionsCheckResult;
/**
 * Generates a clear, actionable error message for missing permissions
 * @param result - The permissions check result
 * @param guild - The Discord guild
 * @returns A formatted error message with instructions
 */
export declare function formatPermissionsError(result: PermissionsCheckResult, guild: Guild): string;
/**
 * Generates an invite URL with all required permissions
 * @param clientId - The bot's client ID
 * @returns An invite URL with required permissions
 */
export declare function generateInviteUrl(clientId: string): string;
/**
 * Verifies bot permissions on startup and logs warnings if any are missing
 * This should be called during bot initialization
 * @param guild - The Discord guild to check permissions in
 * @throws Error if bot member is not found in guild
 */
export declare function verifyPermissionsOnStartup(guild: Guild): void;
//# sourceMappingURL=permissions.d.ts.map