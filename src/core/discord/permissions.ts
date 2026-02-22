/**
 * @file permissions.ts
 * @description Discord bot permissions verification utility
 * @module core/discord
 */

import { Guild, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { logger } from '@/core/logger/logger.js';

/**
 * Required permissions for the bot to function properly
 */
export const REQUIRED_PERMISSIONS = [
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ModerateMembers,
] as const;

/**
 * Human-readable permission names for error messages
 */
const PERMISSION_NAMES: Record<string, string> = {
  [PermissionFlagsBits.ManageRoles.toString()]: 'MANAGE_ROLES',
  [PermissionFlagsBits.ManageMessages.toString()]: 'MANAGE_MESSAGES',
  [PermissionFlagsBits.BanMembers.toString()]: 'BAN_MEMBERS',
  [PermissionFlagsBits.KickMembers.toString()]: 'KICK_MEMBERS',
  [PermissionFlagsBits.ModerateMembers.toString()]: 'MODERATE_MEMBERS',
};

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
export function verifyBotPermissions(guild: Guild): PermissionsCheckResult {
  const botMember = guild.members.me;

  if (!botMember) {
    logger.error('Bot member not found in guild', {
      guildId: guild.id,
      guildName: guild.name,
    });
    throw new Error('Bot member not found in guild');
  }

  const botPermissions = botMember.permissions;
  const missingPermissions: string[] = [];
  const grantedPermissions: string[] = [];

  // Check each required permission
  for (const permission of REQUIRED_PERMISSIONS) {
    const permissionName = PERMISSION_NAMES[permission.toString()];

    if (botPermissions.has(permission)) {
      grantedPermissions.push(permissionName);
    } else {
      missingPermissions.push(permissionName);
    }
  }

  const hasAllPermissions = missingPermissions.length === 0;

  return {
    hasAllPermissions,
    missingPermissions,
    grantedPermissions,
  };
}

/**
 * Generates a clear, actionable error message for missing permissions
 * @param result - The permissions check result
 * @param guild - The Discord guild
 * @returns A formatted error message with instructions
 */
export function formatPermissionsError(
  result: PermissionsCheckResult,
  guild: Guild,
): string {
  if (result.hasAllPermissions) {
    return '';
  }

  const missingList = result.missingPermissions.join(', ');
  const inviteUrl = generateInviteUrl(guild.client.user?.id || '');

  return [
    `⚠️ TZBOT is missing required permissions in ${guild.name}`,
    '',
    `Missing permissions: ${missingList}`,
    '',
    'The bot needs these permissions to perform moderation actions:',
    '• MANAGE_ROLES - Assign subscriber/VIP roles',
    '• MANAGE_MESSAGES - Delete spam and unauthorized messages',
    '• BAN_MEMBERS - Ban users who violate rules',
    '• KICK_MEMBERS - Kick users from the server',
    '• MODERATE_MEMBERS - Timeout users for spam violations',
    '',
    'To fix this:',
    '1. Go to Server Settings → Roles',
    '2. Find the TZBOT role',
    '3. Enable the missing permissions',
    '',
    'Or re-invite the bot with the correct permissions:',
    inviteUrl,
  ].join('\n');
}

/**
 * Generates an invite URL with all required permissions
 * @param clientId - The bot's client ID
 * @returns An invite URL with required permissions
 */
export function generateInviteUrl(clientId: string): string {
  const permissions = new PermissionsBitField(REQUIRED_PERMISSIONS);
  const permissionsValue = permissions.bitfield.toString();

  return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissionsValue}&scope=bot%20applications.commands`;
}

/**
 * Verifies bot permissions on startup and logs warnings if any are missing
 * This should be called during bot initialization
 * @param guild - The Discord guild to check permissions in
 * @throws Error if bot member is not found in guild
 */
export function verifyPermissionsOnStartup(guild: Guild): void {
  logger.info('Verifying bot permissions on startup', {
    guildId: guild.id,
    guildName: guild.name,
  });

  const result = verifyBotPermissions(guild);

  if (!result.hasAllPermissions) {
    const errorMessage = formatPermissionsError(result, guild);
    logger.warn('Bot started with missing permissions', {
      guildId: guild.id,
      guildName: guild.name,
      missingPermissions: result.missingPermissions,
      grantedPermissions: result.grantedPermissions,
    });

    // Log warning for visibility
    logger.warn('\n' + errorMessage + '\n');
  } else {
    logger.info('Bot has all required permissions', {
      guildId: guild.id,
      guildName: guild.name,
      permissions: result.grantedPermissions,
    });
  }
}
