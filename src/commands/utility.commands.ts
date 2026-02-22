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
  _client: IDiscordClient,
  database: Database,
  config: BotConfig
): CommandDefinition[] {
  return [
    createConfigCommand(config),
    createSetupCommand(database, config),
    createUserInfoCommand(database),
    createLinkCommand(database),
    createUnlinkCommand(database),
    createCheckLinkCommand(database),
    createDeleteMyDataCommand(database),
  ];
}

/**
 * /setup command - Configure bot settings through Discord
 */
function createSetupCommand(database: Database, config: BotConfig): CommandDefinition {
  const builder = new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure bot settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommandGroup((group) =>
      group
        .setName('channel')
        .setDescription('Configure channel settings')
        .addSubcommand((subcommand) =>
          subcommand
            .setName('notification')
            .setDescription('Set the notification channel')
            .addChannelOption((option) =>
              option
                .setName('channel')
                .setDescription('The channel for notifications')
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('fallback')
            .setDescription('Set the fallback notification channel')
            .addChannelOption((option) =>
              option
                .setName('channel')
                .setDescription('The fallback channel for notifications')
                .setRequired(true)
            )
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName('role')
        .setDescription('Configure role settings')
        .addSubcommand((subcommand) =>
          subcommand
            .setName('subscriber')
            .setDescription('Set the subscriber role')
            .addRoleOption((option) =>
              option
                .setName('role')
                .setDescription('The role for subscribers')
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('vip')
            .setDescription('Set the VIP role')
            .addRoleOption((option) =>
              option
                .setName('role')
                .setDescription('The role for VIPs')
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('moderator')
            .setDescription('Set the moderator role')
            .addRoleOption((option) =>
              option
                .setName('role')
                .setDescription('The role for moderators')
                .setRequired(true)
            )
        )
    );

  const handler = async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply({ ephemeral: true });

      const subcommandGroup = interaction.options.getSubcommandGroup();
      const subcommand = interaction.options.getSubcommand();

      if (subcommandGroup === 'channel') {
        const channel = interaction.options.getChannel('channel', true);

        if (subcommand === 'notification') {
          await database.setConfig('notificationChannelId', channel.id);
          config.notificationChannelId = channel.id;

          await interaction.editReply({
            content: `✅ Notification channel set to <#${channel.id}>`,
          });

          logger.info('Notification channel configured', {
            channelId: channel.id,
            userId: interaction.user.id,
          });
        } else if (subcommand === 'fallback') {
          await database.setConfig('fallbackChannelId', channel.id);
          config.fallbackChannelId = channel.id;

          await interaction.editReply({
            content: `✅ Fallback channel set to <#${channel.id}>`,
          });

          logger.info('Fallback channel configured', {
            channelId: channel.id,
            userId: interaction.user.id,
          });
        }
      } else if (subcommandGroup === 'role') {
        const role = interaction.options.getRole('role', true);

        if (subcommand === 'subscriber') {
          await database.setConfig('subscriberRoleId', role.id);
          config.subscriberRoleId = role.id;

          await interaction.editReply({
            content: `✅ Subscriber role set to <@&${role.id}>`,
          });

          logger.info('Subscriber role configured', {
            roleId: role.id,
            userId: interaction.user.id,
          });
        } else if (subcommand === 'vip') {
          await database.setConfig('vipRoleId', role.id);
          config.vipRoleId = role.id;

          await interaction.editReply({
            content: `✅ VIP role set to <@&${role.id}>`,
          });

          logger.info('VIP role configured', {
            roleId: role.id,
            userId: interaction.user.id,
          });
        } else if (subcommand === 'moderator') {
          await database.setConfig('moderatorRoleId', role.id);
          config.moderatorRoleId = role.id;

          await interaction.editReply({
            content: `✅ Moderator role set to <@&${role.id}>`,
          });

          logger.info('Moderator role configured', {
            roleId: role.id,
            userId: interaction.user.id,
          });
        }
      }
    } catch (_error) {
      logError('Failed to execute setup command', _error as Error);

      const errorMessage = '❌ Failed to update configuration. Please try again.';
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  };

  return {
    name: 'setup',
    description: 'Configure bot settings',
    builder: builder as SlashCommandBuilder,
    handler,
    permissions: [PermissionFlagsBits.Administrator],
    moderatorOnly: true,
  };
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
 * /userinfo command - Display information about a user
 */
function createUserInfoCommand(database: Database): CommandDefinition {
  const builder = new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Display information about a user')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user to get information about (leave empty for yourself)')
        .setRequired(false)
    );

  const handler = async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply({ ephemeral: true });

      // Get the target user (or the command user if not specified)
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const member = interaction.guild?.members.cache.get(targetUser.id);

      // Get user data from database
      const userData = await database.getUser(targetUser.id);

      // Create user info embed
      const embed = new EmbedBuilder()
        .setTitle(`👤 User Information`)
        .setColor(0x5865f2)
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp()
        .addFields(
          {
            name: 'Discord User',
            value: `${targetUser.tag} (${targetUser.id})`,
            inline: false,
          },
          {
            name: 'Account Created',
            value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`,
            inline: true,
          },
          {
            name: 'Joined Server',
            value: member?.joinedAt
              ? `<t:${Math.floor(member.joinedTimestamp! / 1000)}:R>`
              : 'Unknown',
            inline: true,
          }
        );

      // Add Kick account info if linked
      if (userData?.kickUsername) {
        embed.addFields({
          name: 'Kick Account',
          value: `✅ Linked to: **${userData.kickUsername}**`,
          inline: false,
        });
      } else {
        embed.addFields({
          name: 'Kick Account',
          value: '❌ Not linked',
          inline: false,
        });
      }

      // Add roles
      if (member) {
        const roles = member.roles.cache
          .filter((role) => role.id !== interaction.guildId)
          .sort((a, b) => b.position - a.position)
          .map((role) => role.toString())
          .slice(0, 10);

        embed.addFields({
          name: `Roles (${member.roles.cache.size - 1})`,
          value: roles.length > 0 ? roles.join(', ') : 'No roles',
          inline: false,
        });
      }

      // Add violation count if any
      if (userData?.violations && userData.violations.length > 0) {
        embed.addFields({
          name: 'Violations',
          value: `⚠️ ${userData.violations.length} violation(s) on record`,
          inline: true,
        });
      } else {
        embed.addFields({
          name: 'Violations',
          value: '✅ No violations',
          inline: true,
        });
      }

      // Add account age in database
      if (userData?.createdAt) {
        embed.addFields({
          name: 'First Seen',
          value: `<t:${Math.floor(new Date(userData.createdAt).getTime() / 1000)}:R>`,
          inline: true,
        });
      }

      await interaction.editReply({
        embeds: [embed],
      });

      logger.info('Userinfo command executed', {
        userId: interaction.user.id,
        targetUserId: targetUser.id,
      });
    } catch (error) {
      logError('Failed to execute userinfo command', error as Error, {
        userId: interaction.user.id,
      });

      const errorMessage = '❌ Failed to retrieve user information.';
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  };

  return {
    name: 'userinfo',
    description: 'Display information about a user',
    builder: builder as SlashCommandBuilder,
    handler,
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
        additionalContext: {
          userId: interaction.user.id,
          kickUsername,
        },
      });

      await interaction.editReply({
        content: '❌ Failed to link accounts. Please try again later.',
      });
    }
  };

  return {
    name: 'link',
    description: 'Link your Discord account with your Kick account',
    builder: builder as SlashCommandBuilder,
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
    builder: builder as SlashCommandBuilder,
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
    builder: builder as SlashCommandBuilder,
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
    builder: builder as SlashCommandBuilder,
    handler,
  };
}
