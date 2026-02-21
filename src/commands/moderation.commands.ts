/**
 * @file moderation.commands.ts
 * @description Moderation slash commands (/ban, /timeout, /warn, /kick)
 * @module commands
 */

import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import type { CommandDefinition } from '@/managers/command.manager.js';
import type { IDiscordClient } from '@/core/discord/client.js';
import type { Database } from '@/types/interfaces.js';
import { ViolationType, PunishmentLevel } from '@/types/models.js';
import { logger, logError } from '@/core/logger/logger.js';
import { randomUUID } from 'crypto';
import { OffenseManager } from '@/moderation/offense-manager.js';
import { PunishmentCalculator, PunishmentType } from '@/moderation/punishment-calculator.js';
import { NotificationManager } from '@/managers/notification.manager.js';
import { OffenseRepository } from '@/core/database/repositories/OffenseRepository.js';
import { getPool } from '@/core/database/pool.js';

/**
 * Helper function to initialize offense manager
 */
function initializeOffenseManager(
  client: IDiscordClient,
  channelId: string
): OffenseManager {
  const pool = getPool();
  const offenseRepo = new OffenseRepository(pool);
  const punishmentCalc = new PunishmentCalculator();
  const notificationManager = new NotificationManager(client, {
    primaryChannelId: channelId,
    fallbackChannelId: undefined,
  });
  return new OffenseManager(
    pool,
    offenseRepo,
    punishmentCalc,
    notificationManager
  );
}

/**
 * Create moderation commands
 */
export function createModerationCommands(
  _client: IDiscordClient,
  database: Database
): CommandDefinition[] {
  return [
    createBanCommand(_client, database),
    createTimeoutCommand(_client, database),
    createWarnCommand(_client, database),
    createKickCommand(_client, database),
    createWarnListCommand(_client, database),
    createWarnAllCommand(_client, database),
    createClearWarnCommand(_client, database),
    createResetOffensesCommand(_client, database),
    createModLogCommand(_client, database),
  ];
}

/**
 * /ban command - Ban a user from the server
 */
function createBanCommand(
  _client: IDiscordClient,
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
      await _client.banUser(guildId, user.id, reason);

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
          `<@${user.id}> You have been banned from ${interaction.guild?.name}.\nReason: ${reason}`
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
    builder: builder as SlashCommandBuilder,
    handler,
    permissions: [PermissionFlagsBits.BanMembers],
    moderatorOnly: true,
  };
}

/**
 * /timeout command - Timeout a user for a specified duration
 */
function createTimeoutCommand(
  _client: IDiscordClient,
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
      await _client.timeoutUser(guildId, user.id, durationMs, reason);

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
          `<@${user.id}> You have been timed out in ${interaction.guild?.name} for ${durationMinutes} minutes.\nReason: ${reason}`
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
    builder: builder as SlashCommandBuilder,
    handler,
    permissions: [PermissionFlagsBits.ModerateMembers],
    moderatorOnly: true,
  };
}

/**
 * /warn command - Issue a warning to a user using progressive punishment system
 */
function createWarnCommand(
  _client: IDiscordClient,
  _database: Database
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

      // Initialize offense management system
      const offenseManager = initializeOffenseManager(_client, interaction.channelId);

      // Process offense and get punishment
      const punishment = await offenseManager.processOffense(
        user.id,
        reason,
        interaction.user.id,
        interaction.channelId
      );

      // Apply punishment based on type
      const member = await interaction.guild?.members.fetch(user.id);
      if (!member) {
        await interaction.editReply({
          content: `❌ Could not find member ${user.username} in this server.`,
        });
        return;
      }

      if (punishment.type === PunishmentType.TIMEOUT && punishment.duration) {
        // Apply timeout
        const durationMs = punishment.duration * 60 * 60 * 1000; // Convert hours to ms
        await member.timeout(durationMs, reason);
        
        logger.info('User timed out via /warn command', {
          guildId,
          userId: user.id,
          username: user.username,
          moderator: interaction.user.username,
          moderatorId: interaction.user.id,
          duration: punishment.duration,
          reason,
        });
      } else if (punishment.type === PunishmentType.PERMANENT_BAN) {
        // Apply ban
        await member.ban({ reason });
        
        logger.info('User banned via /warn command', {
          guildId,
          userId: user.id,
          username: user.username,
          moderator: interaction.user.username,
          moderatorId: interaction.user.id,
          reason,
        });
      } else {
        // Warning only
        logger.info('User warned via /warn command', {
          guildId,
          userId: user.id,
          username: user.username,
          moderator: interaction.user.username,
          moderatorId: interaction.user.id,
          reason,
        });
      }

      // Get offense history for confirmation message
      const offenseRecord = await offenseManager.getOffenseHistory(user.id);
      const offenseCount = offenseRecord?.total_offenses || 0;

      // Format punishment description
      let punishmentDesc = '';
      if (punishment.type === PunishmentType.WARNING) {
        punishmentDesc = 'Warning issued';
      } else if (punishment.type === PunishmentType.TIMEOUT) {
        punishmentDesc = `${punishment.duration} hour timeout applied`;
      } else if (punishment.type === PunishmentType.PERMANENT_BAN) {
        punishmentDesc = 'Permanent ban applied';
      }

      // Send confirmation
      await interaction.editReply({
        content: `✅ ${punishmentDesc} for ${user.username} (${user.id}).\n**Reason:** ${reason}\n**Offense Count:** ${offenseCount}\n**Next Offense:** ${punishment.nextPunishment}`,
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
    builder: builder as SlashCommandBuilder,
    handler,
    permissions: [PermissionFlagsBits.ModerateMembers],
    moderatorOnly: true,
  };
}

/**
 * /kick command - Kick a user from the server
 */
function createKickCommand(
  _client: IDiscordClient,
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
      await _client.kickUser(guildId, user.id, reason);

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
          `<@${user.id}> You have been kicked from ${interaction.guild?.name}.\nReason: ${reason}`
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
    builder: builder as SlashCommandBuilder,
    handler,
    permissions: [PermissionFlagsBits.KickMembers],
    moderatorOnly: true,
  };
}

/**
 * /warnlist command - Display offense history for a user
 */
function createWarnListCommand(
  _client: IDiscordClient,
  _database: Database
): CommandDefinition {
  const builder = new SlashCommandBuilder()
    .setName('warnlist')
    .setDescription('Display offense history for a user')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user to check')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

  const handler = async (interaction: ChatInputCommandInteraction) => {
    const user = interaction.options.getUser('user', true);

    try {
      await interaction.deferReply({ ephemeral: true });

      // Initialize offense repository
      const pool = getPool();
      const offenseRepo = new OffenseRepository(pool);
      const punishmentCalc = new PunishmentCalculator();
      const notificationManager = new NotificationManager(_client, {
        primaryChannelId: interaction.channelId,
        fallbackChannelId: undefined,
      });
      const offenseManager = new OffenseManager(
        pool,
        offenseRepo,
        punishmentCalc,
        notificationManager
      );

      // Get offense history
      const record = await offenseManager.getOffenseHistory(user.id);

      if (!record || record.total_offenses === 0) {
        await interaction.editReply({
          content: `${user.username} has no offense history.`,
        });
        return;
      }

      // Build embed with offense history
      const embed = new EmbedBuilder()
        .setTitle(`📋 Offense History: ${user.username}`)
        .setThumbnail(user.displayAvatarURL())
        .setColor(record.is_banned ? 0x8b0000 : 0xffa500)
        .addFields(
          { name: 'Total Offenses', value: record.total_offenses.toString(), inline: true },
          { name: 'Current Timeout', value: `${record.current_timeout_duration}h`, inline: true },
          { name: 'Status', value: record.is_banned ? '🚫 Banned' : '✅ Active', inline: true }
        );

      if (record.last_offense_timestamp) {
        embed.addFields({
          name: 'Last Offense',
          value: `<t:${Math.floor(record.last_offense_timestamp.getTime() / 1000)}:R>`,
          inline: false,
        });
      }

      // Add offense entries
      if (record.warning_history && record.warning_history.length > 0) {
        const historyText = record.warning_history
          .slice(-5) // Show last 5 offenses
          .map((entry, idx) => {
            const timestamp = `<t:${Math.floor(entry.timestamp.getTime() / 1000)}:f>`;
            return `**${idx + 1}.** ${entry.punishment_applied} - ${entry.reason}\n${timestamp}`;
          })
          .join('\n\n');

        embed.addFields({
          name: `Recent Offenses (${Math.min(5, record.warning_history.length)} of ${record.warning_history.length})`,
          value: historyText || 'No offense details available',
          inline: false,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logError('Failed to execute warnlist command', error as Error, {
        userId: user.id,
      });

      await interaction.editReply({
        content: `❌ Failed to retrieve offense history. Error: ${(error as Error).message}`,
      });
    }
  };

  return {
    name: 'warnlist',
    description: 'Display offense history for a user',
    builder: builder as SlashCommandBuilder,
    handler,
    permissions: [PermissionFlagsBits.ModerateMembers],
    moderatorOnly: true,
  };
}

/**
 * /warnall command - Display offense summaries for all users with active warnings
 */
function createWarnAllCommand(
  _client: IDiscordClient,
  _database: Database
): CommandDefinition {
  const builder = new SlashCommandBuilder()
    .setName('warnall')
    .setDescription('Display offense summaries for all users with active warnings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

  const handler = async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply({ ephemeral: true });

      // Initialize offense repository
      const pool = getPool();
      const offenseRepo = new OffenseRepository(pool);

      // Get all active offenses
      const records = await offenseRepo.getAllActiveOffenses();

      if (records.length === 0) {
        await interaction.editReply({
          content: 'No users with active offense records.',
        });
        return;
      }

      // Build embed with summary
      const embed = new EmbedBuilder()
        .setTitle('📊 All Active Offense Records')
        .setColor(0xff6b6b)
        .setDescription(`Total users with offenses: ${records.length}`);

      // Sort by offense count (highest first)
      const sortedRecords = records.sort((a, b) => b.total_offenses - a.total_offenses);

      // Add fields for each user (limit to 25 fields)
      const displayRecords = sortedRecords.slice(0, 25);
      for (const record of displayRecords) {
        const status = record.is_banned ? '🚫 Banned' : '⚠️ Active';
        const lastOffense = record.last_offense_timestamp
          ? `<t:${Math.floor(record.last_offense_timestamp.getTime() / 1000)}:R>`
          : 'Unknown';

        embed.addFields({
          name: `<@${record.user_id}>`,
          value: `${status} | Offenses: ${record.total_offenses} | Timeout: ${record.current_timeout_duration}h\nLast: ${lastOffense}`,
          inline: false,
        });
      }

      if (sortedRecords.length > 25) {
        embed.setFooter({
          text: `Showing 25 of ${sortedRecords.length} users. Use /warnlist for individual details.`,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logError('Failed to execute warnall command', error as Error);

      await interaction.editReply({
        content: `❌ Failed to retrieve offense records. Error: ${(error as Error).message}`,
      });
    }
  };

  return {
    name: 'warnall',
    description: 'Display offense summaries for all users with active warnings',
    builder: builder as SlashCommandBuilder,
    handler,
    permissions: [PermissionFlagsBits.ModerateMembers],
    moderatorOnly: true,
  };
}

/**
 * /clearwarn command - Remove the most recent offense from a user's history
 */
function createClearWarnCommand(
  _client: IDiscordClient,
  _database: Database
): CommandDefinition {
  const builder = new SlashCommandBuilder()
    .setName('clearwarn')
    .setDescription('Remove the most recent offense from a user\'s history')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user to clear warning for')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

  const handler = async (interaction: ChatInputCommandInteraction) => {
    const user = interaction.options.getUser('user', true);

    try {
      await interaction.deferReply({ ephemeral: true });

      // Initialize offense manager
      const pool = getPool();
      const offenseRepo = new OffenseRepository(pool);
      const punishmentCalc = new PunishmentCalculator();
      const notificationManager = new NotificationManager(_client, {
        primaryChannelId: interaction.channelId,
        fallbackChannelId: undefined,
      });
      const offenseManager = new OffenseManager(
        pool,
        offenseRepo,
        punishmentCalc,
        notificationManager
      );

      // Get current offense count
      const beforeRecord = await offenseManager.getOffenseHistory(user.id);
      
      if (!beforeRecord || beforeRecord.total_offenses === 0) {
        await interaction.editReply({
          content: `${user.username} has no offenses to clear.`,
        });
        return;
      }

      const beforeCount = beforeRecord.total_offenses;

      // Clear last offense
      await offenseManager.clearLastOffense(user.id);

      // Get updated record
      const afterRecord = await offenseManager.getOffenseHistory(user.id);
      const afterCount = afterRecord?.total_offenses || 0;

      logger.info('Last offense cleared via command', {
        userId: user.id,
        username: user.username,
        moderator: interaction.user.username,
        moderatorId: interaction.user.id,
        beforeCount,
        afterCount,
      });

      await interaction.editReply({
        content: `✅ Cleared last offense for ${user.username}.\n**Previous offense count:** ${beforeCount}\n**New offense count:** ${afterCount}`,
      });
    } catch (error) {
      logError('Failed to execute clearwarn command', error as Error, {
        userId: user.id,
      });

      await interaction.editReply({
        content: `❌ Failed to clear warning. Error: ${(error as Error).message}`,
      });
    }
  };

  return {
    name: 'clearwarn',
    description: 'Remove the most recent offense from a user\'s history',
    builder: builder as SlashCommandBuilder,
    handler,
    permissions: [PermissionFlagsBits.ModerateMembers],
    moderatorOnly: true,
  };
}

/**
 * /resetoffenses command - Clear all offenses for a user
 */
function createResetOffensesCommand(
  _client: IDiscordClient,
  _database: Database
): CommandDefinition {
  const builder = new SlashCommandBuilder()
    .setName('resetoffenses')
    .setDescription('Clear all offenses for a user')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user to reset offenses for')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

  const handler = async (interaction: ChatInputCommandInteraction) => {
    const user = interaction.options.getUser('user', true);

    try {
      await interaction.deferReply({ ephemeral: true });

      // Initialize offense manager
      const pool = getPool();
      const offenseRepo = new OffenseRepository(pool);
      const punishmentCalc = new PunishmentCalculator();
      const notificationManager = new NotificationManager(_client, {
        primaryChannelId: interaction.channelId,
        fallbackChannelId: undefined,
      });
      const offenseManager = new OffenseManager(
        pool,
        offenseRepo,
        punishmentCalc,
        notificationManager
      );

      // Get current offense count
      const beforeRecord = await offenseManager.getOffenseHistory(user.id);
      const beforeCount = beforeRecord?.total_offenses || 0;

      if (beforeCount === 0) {
        await interaction.editReply({
          content: `${user.username} has no offenses to reset.`,
        });
        return;
      }

      // Reset all offenses
      await offenseManager.resetAllOffenses(user.id);

      // Remove timeout if user is currently timed out
      const member = interaction.guild?.members.cache.get(user.id);
      if (member && member.communicationDisabledUntil) {
        try {
          await member.timeout(null, 'Offenses cleared by moderator');
          logger.info('Timeout removed after offense reset', {
            userId: user.id,
            username: user.username,
            moderator: interaction.user.username,
          });
        } catch (timeoutError) {
          logger.warn('Failed to remove timeout after offense reset', {
            userId: user.id,
            error: timeoutError,
          });
        }
      }

      // Send DM to user notifying them of offense reset
      try {
        await user.send(
          `<@${user.id}> ✅ **Your offenses have been cleared!**\n\n` +
          `All your previous offenses have been reset by a moderator.\n` +
          `You now have a clean record. Please continue to follow the server rules.`
        );
        logger.debug('Offense reset notification DM sent', {
          userId: user.id,
          username: user.username,
        });
      } catch (dmError) {
        logger.warn('Failed to send offense reset DM to user', {
          userId: user.id,
          error: dmError,
        });
      }

      logger.info('All offenses reset via command', {
        userId: user.id,
        username: user.username,
        moderator: interaction.user.username,
        moderatorId: interaction.user.id,
        clearedCount: beforeCount,
        timeoutRemoved: member?.communicationDisabledUntil ? true : false,
      });

      const timeoutMessage = member?.communicationDisabledUntil 
        ? '\n**Timeout removed:** Yes' 
        : '';

      await interaction.editReply({
        content: `✅ Reset all offenses for ${user.username}.\n**Cleared offense count:** ${beforeCount}\n**New offense count:** 0${timeoutMessage}`,
      });
    } catch (error) {
      logError('Failed to execute resetoffenses command', error as Error, {
        userId: user.id,
      });

      await interaction.editReply({
        content: `❌ Failed to reset offenses. Error: ${(error as Error).message}`,
      });
    }
  };

  return {
    name: 'resetoffenses',
    description: 'Clear all offenses for a user',
    builder: builder as SlashCommandBuilder,
    handler,
    permissions: [PermissionFlagsBits.ModerateMembers],
    moderatorOnly: true,
  };
}

/**
 * /modlog command - Display all moderation actions taken against a user
 */
function createModLogCommand(
  _client: IDiscordClient,
  _database: Database
): CommandDefinition {
  const builder = new SlashCommandBuilder()
    .setName('modlog')
    .setDescription('Display all moderation actions taken against a user')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user to check')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

  const handler = async (interaction: ChatInputCommandInteraction) => {
    const user = interaction.options.getUser('user', true);

    try {
      await interaction.deferReply({ ephemeral: true });

      // Initialize offense repository
      const pool = getPool();
      const offenseRepo = new OffenseRepository(pool);
      const punishmentCalc = new PunishmentCalculator();
      const notificationManager = new NotificationManager(_client, {
        primaryChannelId: interaction.channelId,
        fallbackChannelId: undefined,
      });
      const offenseManager = new OffenseManager(
        pool,
        offenseRepo,
        punishmentCalc,
        notificationManager
      );

      // Get offense history
      const record = await offenseManager.getOffenseHistory(user.id);

      if (!record || !record.warning_history || record.warning_history.length === 0) {
        await interaction.editReply({
          content: `${user.username} has no moderation history.`,
        });
        return;
      }

      // Build embed with full moderation log
      const embed = new EmbedBuilder()
        .setTitle(`📜 Moderation Log: ${user.username}`)
        .setThumbnail(user.displayAvatarURL())
        .setColor(0x5865f2)
        .setDescription(`Total actions: ${record.warning_history.length}`);

      // Show all entries (or last 10 if too many)
      const displayEntries = record.warning_history.slice(-10);
      
      for (let i = 0; i < displayEntries.length; i++) {
        const entry = displayEntries[i];
        const timestamp = `<t:${Math.floor(entry.timestamp.getTime() / 1000)}:f>`;
        const moderator = entry.moderator_id ? `<@${entry.moderator_id}>` : 'System';
        const duration = entry.timeout_duration ? ` (${entry.timeout_duration}h)` : '';

        embed.addFields({
          name: `${i + 1}. ${entry.punishment_applied}${duration}`,
          value: `**Reason:** ${entry.reason}\n**Moderator:** ${moderator}\n**Time:** ${timestamp}`,
          inline: false,
        });
      }

      if (record.warning_history.length > 10) {
        embed.setFooter({
          text: `Showing last 10 of ${record.warning_history.length} actions`,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logError('Failed to execute modlog command', error as Error, {
        userId: user.id,
      });

      await interaction.editReply({
        content: `❌ Failed to retrieve moderation log. Error: ${(error as Error).message}`,
      });
    }
  };

  return {
    name: 'modlog',
    description: 'Display all moderation actions taken against a user',
    builder: builder as SlashCommandBuilder,
    handler,
    permissions: [PermissionFlagsBits.ModerateMembers],
    moderatorOnly: true,
  };
}

