/**
 * @file utility.commands.ts
 * @description Utility slash commands (/config, /link, /unlink, /checklink, /deletemydata)
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
import type { BotConfig } from '@/config/types.js';
import { logger, logError } from '@/core/logger/logger.js';

/**
 * Create utility commands
 */
export function createUtilityCommands(
  client: IDiscordClient,
  database: Database,
  config: BotConfig
): CommandDefinition[] {
  return [
    createConfigCommand(config),
    createLinkCommand(database),
    createUnlinkCommand(database),
    createCheckLinkCommand(database),
    createDeleteMyDataCommand(database),
  ];
}

/**
 * /config command - Display current bot configuration
 */
function createConfigCommand(config: BotConfig): CommandDefinition {
  const builder = new SlashCommandBuilder()
    .setName('config')
    .setDescription('Display current bot configuration')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

  const handler = async (interaction: ChatInputCommandInteraction) => {
    try {
      // Create configuration embed
      const embed = new EmbedBuilder()
        .setTitle('🔧 Bot Configuration')
        .setColor(0x5865f2)
        .setTimestamp()
        .addFields(
          {
            name: 'Guild ID',
            value: config.guildId || 'Not set',
            inline: true,
          },
          {
            name: 'Client ID',
            value: config.clientId || 'Not set',
            inline: true,
          },
          {
            name: 'Notification Channel',
            value: `<#${config.notificationChannelId}>`,
            inline: true,
          },
          {
            name: 'Fallback Channel',
            value: config.fallbackChannelId
              ? `<#${config.fallbackChannelId}>`
              : 'Not set',
            inline: true,
          },
          {
            name: 'Subscriber Role',
            value: `<@&${config.subscriberRoleId}>`,
            inline: true,
          },
          {
            name: 'VIP Role',
            value: `<@&${config.vipRoleId}>`,
            inline: true,
          },
          {
            name: 'Moderator Role',
            value: `<@&${config.moderatorRoleId}>`,
            inline: true,
          },
          {
            name: 'Read-Only Channels',
            value:
              config.readOnlyChannels && config.readOnlyChannels.length > 0
                ? config.readOnlyChannels.map((id) => `<#${id}>`).join(', ')
                : 'None',
            inline: false,
          },
          {
            name: 'Link Scanning',
            value: config.linkScanningEnabled ? '✅ Enabled' : '❌ Disabled',
            inline: true,
          },
          {
            name: 'AI Responder',
            value: config.aiEnabled ? '✅ Enabled' : '❌ Disabled',
            inline: true,
          },
          {
            name: 'Chat Rain',
            value: config.chatRainEnabled ? '✅ Enabled' : '❌ Disabled',
            inline: true,
          },
          {
            name: 'Spam Threshold',
            value: `${config.spamThreshold.identicalMessages} identical messages in ${config.spamThreshold.identicalWindow}s\n${config.spamThreshold.rapidMessages} rapid messages in ${config.spamThreshold.rapidWindow}s`,
            inline: false,
          }
        );

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });

      logger.info('Config command executed', {
        userId: interaction.user.id,
        username: interaction.user.username,
      });
    } catch (error) {
      logError('Failed to execute config command', error as Error);

      await interaction.reply({
        content: '❌ Failed to display configuration.',
        ephemeral: true,
      });
    }
  };

  return {
    name: 'config',
    description: 'Display current bot configuration',
    builder,
    handler,
    permissions: [PermissionFlagsBits.Administrator],
    moderatorOnly: true,
  };
}

/**
 * /link command - Start account linking process
 */
function createLinkCommand(database: Database): CommandDefinition {
  const builder = new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Discord account with your Kick account')
    .addStringOption((option) =>
      option
        .setName('kick_username')
        .setDescription('Your Kick username')
        .setRequired(true)
    );

  const handler = async (interaction: ChatInputCommandInteraction) => {
    const kickUsername = interaction.options.getString('kick_username', true);

    try {
      await interaction.deferReply({ ephemeral: true });

      // Check if user already has a linked account
      const existingUser = await database.getUser(interaction.user.id);
      if (existingUser && existingUser.kickUsername) {
        await interaction.editReply({
          content: `❌ Your Discord account is already linked to Kick username: **${existingUser.kickUsername}**\n\nUse \`/unlink\` to remove the current link first.`,
        });
        return;
      }

      // Check if Kick username is already linked to another Discord account
      const existingKickUser = await database.getUserByKickUsername(kickUsername);
      if (existingKickUser) {
        await interaction.editReply({
          content: `❌ This Kick username is already linked to another Discord account.`,
        });
        return;
      }

      // Save user with Kick username
      await database.saveUser({
        discordId: interaction.user.id,
        kickUsername,
        roles: [],
        violations: [],
        createdAt: existingUser?.createdAt || new Date(),
        updatedAt: new Date(),
      });

      logger.info('Account linked', {
        discordId: interaction.user.id,
        discordUsername: interaction.user.username,
        kickUsername,
      });

      await interaction.editReply({
        content: `✅ Successfully linked your Discord account to Kick username: **${kickUsername}**\n\nYou will now receive role updates based on your Kick status.`,
      });
    } catch (error) {
      logError('Failed to execute link command', error as Error, {
        userId: interaction.user.id,
        kickUsername,
      });

      await interaction.editReply({
        content: '❌ Failed to link accounts. Please try again later.',
      });
    }
  };

  return {
    name: 'link',
    description: 'Link your Discord account with your Kick account',
    builder,
    handler,
  };
}

/**
 * /unlink command - Remove account link
 */
function createUnlinkCommand(database: Database): CommandDefinition {
  const builder = new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink your Discord account from your Kick account');

  const handler = async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply({ ephemeral: true });

      // Check if user has a linked account
      const existingUser = await database.getUser(interaction.user.id);
      if (!existingUser || !existingUser.kickUsername) {
        await interaction.editReply({
          content: '❌ Your Discord account is not linked to any Kick account.',
        });
        return;
      }

      const kickUsername = existingUser.kickUsername;

      // Remove Kick username from user
      await database.saveUser({
        ...existingUser,
        kickUsername: undefined,
        updatedAt: new Date(),
      });

      logger.info('Account unlinked', {
        discordId: interaction.user.id,
        discordUsername: interaction.user.username,
        kickUsername,
      });

      await interaction.editReply({
        content: `✅ Successfully unlinked your Discord account from Kick username: **${kickUsername}**`,
      });
    } catch (error) {
      logError('Failed to execute unlink command', error as Error, {
        userId: interaction.user.id,
      });

      await interaction.editReply({
        content: '❌ Failed to unlink accounts. Please try again later.',
      });
    }
  };

  return {
    name: 'unlink',
    description: 'Unlink your Discord account from your Kick account',
    builder,
    handler,
  };
}

/**
 * /checklink command - Check account link status
 */
function createCheckLinkCommand(database: Database): CommandDefinition {
  const builder = new SlashCommandBuilder()
    .setName('checklink')
    .setDescription('Check if your Discord account is linked to a Kick account');

  const handler = async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply({ ephemeral: true });

      // Check if user has a linked account
      const existingUser = await database.getUser(interaction.user.id);

      if (!existingUser || !existingUser.kickUsername) {
        await interaction.editReply({
          content: '❌ Your Discord account is not linked to any Kick account.\n\nUse `/link` to link your accounts.',
        });
        return;
      }

      await interaction.editReply({
        content: `✅ Your Discord account is linked to Kick username: **${existingUser.kickUsername}**`,
      });
    } catch (error) {
      logError('Failed to execute checklink command', error as Error, {
        userId: interaction.user.id,
      });

      await interaction.editReply({
        content: '❌ Failed to check link status. Please try again later.',
      });
    }
  };

  return {
    name: 'checklink',
    description: 'Check if your Discord account is linked to a Kick account',
    builder,
    handler,
  };
}

/**
 * /deletemydata command - Delete all user data (GDPR compliance)
 */
function createDeleteMyDataCommand(database: Database): CommandDefinition {
  const builder = new SlashCommandBuilder()
    .setName('deletemydata')
    .setDescription('Delete all your data from the bot (GDPR compliance)');

  const handler = async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply({ ephemeral: true });

      // Check if user has any data
      const existingUser = await database.getUser(interaction.user.id);

      if (!existingUser) {
        await interaction.editReply({
          content: '✅ No data found for your account.',
        });
        return;
      }

      // Delete all user data using the comprehensive deletion method
      await database.deleteAllUserData(interaction.user.id);

      logger.info('User data deleted', {
        discordId: interaction.user.id,
        discordUsername: interaction.user.username,
      });

      await interaction.editReply({
        content: '✅ All your data has been permanently deleted from the bot.\n\n**Deleted data includes:**\n- Account links\n- Violation history\n- Chat activity records\n- Giveaway entries\n- Message content\n- Chat rain winner records\n- Moderation logs (where you are the target)',
      });
    } catch (error) {
      logError('Failed to execute deletemydata command', error as Error, {
        userId: interaction.user.id,
      });

      await interaction.editReply({
        content: '❌ Failed to delete your data. Please try again later.',
      });
    }
  };

  return {
    name: 'deletemydata',
    description: 'Delete all your data from the bot (GDPR compliance)',
    builder,
    handler,
  };
}
