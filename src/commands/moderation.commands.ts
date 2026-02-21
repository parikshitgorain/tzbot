/**
 * @file moderation.commands.ts
 * @description Moderation slash commands (/ban, /timeout, /warn, /kick)
 * @module commands
 */

import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
} from 'discord.js';
import type { CommandDefinition } from '@/managers/command.manager.js';
import type { IDiscordClient } from '@/core/discord/client.js';
import type { Database } from '@/types/interfaces.js';
import { ViolationType, PunishmentLevel } from '@/types/models.js';
import { logger, logError } from '@/core/logger/logger.js';
import { randomUUID } from 'crypto';

/**
 * Create moderation commands
 */
export function createModerationCommands(
  client: IDiscordClient,
  database: Database
): CommandDefinition[] {
  return [
    createBanCommand(client, database),
    createTimeoutCommand(client, database),
    createWarnCommand(client, database),
    createKickCommand(client, database),
  ];
}

/**
 * /ban command - Ban a user from the server
 */
function createBanCommand(
  client: IDiscordClient,
  database: Database
): CommandDefinition {
  const builder = new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user to ban')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

  const handler = async (interaction: ChatInputCommandInteraction) => {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    try {
      // Defer reply as moderation actions may take time
      await interaction.deferReply({ ephemeral: true });

      // Ban the user
      await client.banUser(guildId, user.id, reason);

      // Record violation in database
      await database.saveViolation({
        id: randomUUID(),
        userId: user.id,
        type: ViolationType.OTHER,
        severity: 4,
        timestamp: new Date(),
        details: `Banned by ${interaction.user.username}: ${reason}`,
        punishmentApplied: PunishmentLevel.BAN,
      });

      // Send DM to user
      try {
        await user.send(
          `You have been banned from ${interaction.guild?.name}.\nReason: ${reason}`
        );
      } catch (dmError) {
        logger.debug('Failed to send ban DM to user', {
          userId: user.id,
          error: (dmError as Error).message,
        });
      }

      // Log the action
      logger.info('User banned via command', {
        guildId,
        userId: user.id,
        username: user.username,
        moderator: interaction.user.username,
        moderatorId: interaction.user.id,
        reason,
      });

      // Send confirmation
      await interaction.editReply({
        content: `✅ Successfully banned ${user.username} (${user.id}).\nReason: ${reason}`,
      });
    } catch (error) {
      logError('Failed to execute ban command', error as Error, {
        guildId,
        userId: user.id,
        reason,
      });

      await interaction.editReply({
        content: `❌ Failed to ban ${user.username}. Error: ${(error as Error).message}`,
      });
    }
  };

  return {
    name: 'ban',
    description: 'Ban a user from the server',
    builder,
    handler,
    permissions: [PermissionFlagsBits.BanMembers],
    moderatorOnly: true,
  };
}

/**
 * /timeout command - Timeout a user for a specified duration
 */
function createTimeoutCommand(
  client: IDiscordClient,
  database: Database
): CommandDefinition {
  const builder = new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a user for a specified duration')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user to timeout')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('duration')
        .setDescription('Duration in minutes (1-40320 = 28 days max)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for the timeout')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

  const handler = async (interaction: ChatInputCommandInteraction) => {
    const user = interaction.options.getUser('user', true);
    const durationMinutes = interaction.options.getInteger('duration', true);
    const reason = interaction.options.getString('reason', true);
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    try {
      // Defer reply
      await interaction.deferReply({ ephemeral: true });

      // Convert minutes to milliseconds
      const durationMs = durationMinutes * 60 * 1000;

      // Timeout the user
      await client.timeoutUser(guildId, user.id, durationMs, reason);

      // Determine punishment level based on duration
      let punishmentLevel: PunishmentLevel;
      if (durationMinutes <= 60) {
        punishmentLevel = PunishmentLevel.TIMEOUT_1H;
      } else {
        punishmentLevel = PunishmentLevel.TIMEOUT_24H;
      }

      // Record violation in database
      await database.saveViolation({
        id: randomUUID(),
        userId: user.id,
        type: ViolationType.OTHER,
        severity: durationMinutes <= 60 ? 2 : 3,
        timestamp: new Date(),
        details: `Timed out for ${durationMinutes} minutes by ${interaction.user.username}: ${reason}`,
        punishmentApplied: punishmentLevel,
      });

      // Send DM to user
      try {
        await user.send(
          `You have been timed out in ${interaction.guild?.name} for ${durationMinutes} minutes.\nReason: ${reason}`
        );
      } catch (dmError) {
        logger.debug('Failed to send timeout DM to user', {
          userId: user.id,
          error: (dmError as Error).message,
        });
      }

      // Log the action
      logger.info('User timed out via command', {
        guildId,
        userId: user.id,
        username: user.username,
        moderator: interaction.user.username,
        moderatorId: interaction.user.id,
        durationMinutes,
        reason,
      });

      // Send confirmation
      await interaction.editReply({
        content: `✅ Successfully timed out ${user.username} (${user.id}) for ${durationMinutes} minutes.\nReason: ${reason}`,
      });
    } catch (error) {
      logError('Failed to execute timeout command', error as Error, {
        guildId,
        userId: user.id,
        durationMinutes,
        reason,
      });

      await interaction.editReply({
        content: `❌ Failed to timeout ${user.username}. Error: ${(error as Error).message}`,
      });
    }
  };

  return {
    name: 'timeout',
    description: 'Timeout a user for a specified duration',
    builder,
    handler,
    permissions: [PermissionFlagsBits.ModerateMembers],
    moderatorOnly: true,
  };
}

/**
 * /warn command - Issue a warning to a user
 */
function createWarnCommand(
  client: IDiscordClient,
  database: Database
): CommandDefinition {
  const builder = new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a warning to a user')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user to warn')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for the warning')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

  const handler = async (interaction: ChatInputCommandInteraction) => {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    try {
      // Defer reply
      await interaction.deferReply({ ephemeral: true });

      // Record violation in database
      await database.saveViolation({
        id: randomUUID(),
        userId: user.id,
        type: ViolationType.OTHER,
        severity: 1,
        timestamp: new Date(),
        details: `Warned by ${interaction.user.username}: ${reason}`,
        punishmentApplied: PunishmentLevel.WARNING,
      });

      // Send DM to user
      try {
        await user.send(
          `You have received a warning in ${interaction.guild?.name}.\nReason: ${reason}\n\nPlease review the server rules to avoid further action.`
        );
      } catch (dmError) {
        logger.debug('Failed to send warning DM to user', {
          userId: user.id,
          error: (dmError as Error).message,
        });
      }

      // Log the action
      logger.info('User warned via command', {
        guildId,
        userId: user.id,
        username: user.username,
        moderator: interaction.user.username,
        moderatorId: interaction.user.id,
        reason,
      });

      // Send confirmation
      await interaction.editReply({
        content: `✅ Successfully warned ${user.username} (${user.id}).\nReason: ${reason}`,
      });
    } catch (error) {
      logError('Failed to execute warn command', error as Error, {
        guildId,
        userId: user.id,
        reason,
      });

      await interaction.editReply({
        content: `❌ Failed to warn ${user.username}. Error: ${(error as Error).message}`,
      });
    }
  };

  return {
    name: 'warn',
    description: 'Issue a warning to a user',
    builder,
    handler,
    permissions: [PermissionFlagsBits.ModerateMembers],
    moderatorOnly: true,
  };
}

/**
 * /kick command - Kick a user from the server
 */
function createKickCommand(
  client: IDiscordClient,
  database: Database
): CommandDefinition {
  const builder = new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user to kick')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for the kick')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers);

  const handler = async (interaction: ChatInputCommandInteraction) => {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    try {
      // Defer reply
      await interaction.deferReply({ ephemeral: true });

      // Kick the user
      await client.kickUser(guildId, user.id, reason);

      // Record violation in database
      await database.saveViolation({
        id: randomUUID(),
        userId: user.id,
        type: ViolationType.OTHER,
        severity: 3,
        timestamp: new Date(),
        details: `Kicked by ${interaction.user.username}: ${reason}`,
        punishmentApplied: PunishmentLevel.TIMEOUT_24H, // Using timeout level as proxy
      });

      // Send DM to user
      try {
        await user.send(
          `You have been kicked from ${interaction.guild?.name}.\nReason: ${reason}`
        );
      } catch (dmError) {
        logger.debug('Failed to send kick DM to user', {
          userId: user.id,
          error: (dmError as Error).message,
        });
      }

      // Log the action
      logger.info('User kicked via command', {
        guildId,
        userId: user.id,
        username: user.username,
        moderator: interaction.user.username,
        moderatorId: interaction.user.id,
        reason,
      });

      // Send confirmation
      await interaction.editReply({
        content: `✅ Successfully kicked ${user.username} (${user.id}).\nReason: ${reason}`,
      });
    } catch (error) {
      logError('Failed to execute kick command', error as Error, {
        guildId,
        userId: user.id,
        reason,
      });

      await interaction.editReply({
        content: `❌ Failed to kick ${user.username}. Error: ${(error as Error).message}`,
      });
    }
  };

  return {
    name: 'kick',
    description: 'Kick a user from the server',
    builder,
    handler,
    permissions: [PermissionFlagsBits.KickMembers],
    moderatorOnly: true,
  };
}
