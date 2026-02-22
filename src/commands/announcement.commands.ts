/**
 * @file announcement.commands.ts
 * @description Announcement relay configuration commands
 * @module commands
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import type { CommandDefinition } from '@/managers/command.manager.js';
import type { IDiscordClient } from '@/core/discord/client.js';
import type { Database } from '@/core/database/Database.js';
import type { AnnouncementRelayManager } from '@/managers/announcement-relay.manager.js';
import { logger } from '@/core/logger/logger.js';

/**
 * Create announcement relay commands
 */
export function createAnnouncementCommands(
  discordClient: IDiscordClient,
  database: Database,
  announcementRelay: AnnouncementRelayManager | null,
): CommandDefinition[] {
  return [
    createAnnouncementSetupCommand(database, announcementRelay, discordClient),
    createAnnouncementAddChannelCommand(database, announcementRelay),
    createAnnouncementRemoveChannelCommand(database, announcementRelay),
    createAnnouncementStatusCommand(database, announcementRelay),
    createAnnouncementToggleCommand(announcementRelay),
  ];
}

/**
 * /announcement-setup command
 */
function createAnnouncementSetupCommand(
  database: Database,
  announcementRelay: AnnouncementRelayManager | null,
  discordClient: IDiscordClient,
): CommandDefinition {
  const builder = new SlashCommandBuilder()
    .setName('announcement-setup')
    .setDescription('Configure announcement relay system')
    .addChannelOption((option) =>
      option
        .setName('private_channel')
        .setDescription('Private channel where moderators post announcements')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    )
    .addChannelOption((option) =>
      option
        .setName('public_channel_1')
        .setDescription('Public channel 1 to relay to')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    )
    .addChannelOption((option) =>
      option
        .setName('public_channel_2')
        .setDescription('Public channel 2 to relay to (optional)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false),
    )
    .addChannelOption((option) =>
      option
        .setName('public_channel_3')
        .setDescription('Public channel 3 to relay to (optional)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false),
    )
    .addChannelOption((option) =>
      option
        .setName('public_channel_4')
        .setDescription('Public channel 4 to relay to (optional)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false),
    )
    .addChannelOption((option) =>
      option
        .setName('public_channel_5')
        .setDescription('Public channel 5 to relay to (optional)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false);

  return {
    name: 'announcement-setup',
    description: 'Configure announcement relay system',
    builder: builder as SlashCommandBuilder,
    handler: async (interaction: ChatInputCommandInteraction) => {
      try {
        // Defer reply immediately to prevent token expiration
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ ephemeral: true });
          logger.debug('Interaction deferred', {
            interactionId: interaction.id,
            commandName: 'announcement-setup',
          });
        } else {
          logger.warn('Interaction already acknowledged before defer', {
            interactionId: interaction.id,
            deferred: interaction.deferred,
            replied: interaction.replied,
          });
        }

        const privateChannel = interaction.options.getChannel('private_channel', true);

        // Collect all public channels (up to 5)
        const publicChannelIds: string[] = [];
        for (let i = 1; i <= 5; i++) {
          const channel = interaction.options.getChannel(`public_channel_${i}`, false);
          if (channel) {
            // Check if it's a text channel
            if (channel.type !== ChannelType.GuildText) {
              await interaction.editReply({
                content: `❌ Channel <#${channel.id}> is not a text channel.`,
              });
              return;
            }

            // Check for duplicates
            if (publicChannelIds.includes(channel.id)) {
              await interaction.editReply({
                content: `❌ You selected <#${channel.id}> multiple times. Each channel must be unique.`,
              });
              return;
            }

            publicChannelIds.push(channel.id);
          }
        }

        // Validate at least one public channel
        if (publicChannelIds.length === 0) {
          await interaction.editReply({
            content: '❌ You must specify at least one public channel.',
          });
          return;
        }

        // Save to database
        logger.info('Saving announcement configuration', {
          privateChannelId: privateChannel.id,
          privateChannelIdType: typeof privateChannel.id,
          publicChannelIds: publicChannelIds,
          publicChannelIdsJoined: publicChannelIds.join(','),
        });

        await database.setConfig('privateAnnouncementChannelId', privateChannel.id);
        await database.setConfig('publicAnnouncementChannelIds', publicChannelIds.join(','));

        // Verify what was saved
        const savedPrivate = await database.getConfig('privateAnnouncementChannelId');
        const savedPublic = await database.getConfig('publicAnnouncementChannelIds');

        logger.info('Verified saved configuration', {
          savedPrivate,
          savedPublic,
          match: savedPrivate === privateChannel.id,
        });

        // Initialize or update announcement relay manager
        try {
          if (!announcementRelay) {
            // Create new instance if it doesn't exist
            const { AnnouncementRelayManager } = await import('@/managers/announcement-relay.manager.js');
            const { config } = await import('@/config/index.js');

            announcementRelay = new AnnouncementRelayManager(discordClient, {
              privateChannelId: privateChannel.id,
              publicChannelIds: publicChannelIds,
              guildId: interaction.guildId!,
              moderatorRoleId: config.moderatorRoleId,
            });

            announcementRelay.start();

            logger.info('Announcement relay initialized and started', {
              privateChannel: privateChannel.id,
              publicChannels: publicChannelIds,
              createdBy: interaction.user.id,
            });
          } else {
            // Stop old instance before updating to prevent duplicate listeners
            announcementRelay.stop();

            // Update existing instance
            announcementRelay.updateConfig({
              privateChannelId: privateChannel.id,
              publicChannelIds: publicChannelIds,
            });

            // Restart with new config
            announcementRelay.start();

            logger.info('Announcement relay configuration updated and restarted', {
              privateChannel: privateChannel.id,
              publicChannels: publicChannelIds,
              updatedBy: interaction.user.id,
            });
          }
        } catch (relayError) {
          logger.error('Failed to initialize/update announcement relay manager', {
            error: relayError,
          });
          // Continue anyway - config is saved, relay can be restarted later
        }

        // Build response
        const publicChannelMentions = publicChannelIds.map((id) => `<#${id}>`).join(', ');

        await interaction.editReply({
          content:
            '✅ **Announcement Relay Configured & Active**\n\n' +
            `**Private Channel:** <#${privateChannel.id}>\n` +
            `**Public Channels (${publicChannelIds.length}/5):** ${publicChannelMentions}\n\n` +
            `✨ The relay is now active! Messages from moderators in <#${privateChannel.id}> will be automatically relayed to all public channels.`,
        });
      } catch (error) {
        logger.error('Failed to configure announcement relay', { error });

        try {
          // Check if we can still respond to the interaction
          if (interaction.deferred && !interaction.replied) {
            await interaction.editReply({
              content: '❌ Failed to configure announcement relay. Check logs for details.',
            });
          } else if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: '❌ Failed to configure announcement relay. Check logs for details.',
              ephemeral: true,
            });
          }
          // If interaction already replied or token expired, log it
          else {
            logger.warn('Cannot respond to interaction - already replied or token expired', {
              replied: interaction.replied,
              deferred: interaction.deferred,
            });
          }
        } catch (replyError) {
          // If we can't respond at all (token expired), just log it
          logger.error('Failed to send error response to user', {
            error: replyError,
            originalError: error,
          });
        }
      }
    },
  };
}

/**
 * /announcement-add-channel command
 */
function createAnnouncementAddChannelCommand(
  database: Database,
  announcementRelay: AnnouncementRelayManager | null,
): CommandDefinition {
  const builder = new SlashCommandBuilder()
    .setName('announcement-add-channel')
    .setDescription('Add a public channel to announcement relay')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Public channel to add')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false);

  return {
    name: 'announcement-add-channel',
    description: 'Add a public channel to announcement relay',
    builder: builder as SlashCommandBuilder,
    handler: async (interaction: ChatInputCommandInteraction) => {
      try {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.options.getChannel('channel', true);

        // Get current configuration
        const currentChannelsStr = await database.getConfig('publicAnnouncementChannelIds');
        const currentChannels = currentChannelsStr
          ? String(currentChannelsStr).split(',').filter((id) => id.length > 0)
          : [];

        // Check if already added
        if (currentChannels.includes(channel.id)) {
          await interaction.editReply({
            content: `❌ Channel <#${channel.id}> is already in the relay list.`,
          });
          return;
        }

        // Check max limit
        if (currentChannels.length >= 5) {
          await interaction.editReply({
            content: '❌ Maximum of 5 public channels reached. Remove a channel first.',
          });
          return;
        }

        // Add channel
        const updatedChannels = [...currentChannels, channel.id];
        await database.setConfig('publicAnnouncementChannelIds', updatedChannels.join(','));

        // Update announcement relay manager if it exists
        if (announcementRelay) {
          announcementRelay.updateConfig({
            publicChannelIds: updatedChannels,
          });

          logger.info('Public channel added to announcement relay', {
            channelId: channel.id,
            addedBy: interaction.user.id,
          });
        }

        await interaction.editReply({
          content:
            '✅ **Channel Added**\n\n' +
            `<#${channel.id}> has been added to the announcement relay.\n\n` +
            `**Current public channels (${updatedChannels.length}/5):**\n` +
            updatedChannels.map((id) => `• <#${id}>`).join('\n'),
        });
      } catch (error) {
        logger.error('Failed to add channel to announcement relay', { error });

        if (interaction.deferred) {
          await interaction.editReply({
            content: '❌ Failed to add channel. Check logs for details.',
          });
        }
      }
    },
  };
}

/**
 * /announcement-remove-channel command
 */
function createAnnouncementRemoveChannelCommand(
  database: Database,
  announcementRelay: AnnouncementRelayManager | null,
): CommandDefinition {
  const builder = new SlashCommandBuilder()
    .setName('announcement-remove-channel')
    .setDescription('Remove a public channel from announcement relay')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Public channel to remove')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false);

  return {
    name: 'announcement-remove-channel',
    description: 'Remove a public channel from announcement relay',
    builder: builder as SlashCommandBuilder,
    handler: async (interaction: ChatInputCommandInteraction) => {
      try {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.options.getChannel('channel', true);

        // Get current configuration
        const currentChannelsStr = await database.getConfig('publicAnnouncementChannelIds');
        const currentChannels = currentChannelsStr
          ? String(currentChannelsStr).split(',').filter((id) => id.length > 0)
          : [];

        // Check if channel exists in list
        if (!currentChannels.includes(channel.id)) {
          await interaction.editReply({
            content: `❌ Channel <#${channel.id}> is not in the relay list.`,
          });
          return;
        }

        // Remove channel
        const updatedChannels = currentChannels.filter((id) => id !== channel.id);
        await database.setConfig('publicAnnouncementChannelIds', updatedChannels.join(','));

        // Update announcement relay manager if it exists
        if (announcementRelay) {
          announcementRelay.updateConfig({
            publicChannelIds: updatedChannels,
          });

          logger.info('Public channel removed from announcement relay', {
            channelId: channel.id,
            removedBy: interaction.user.id,
          });
        }

        await interaction.editReply({
          content:
            '✅ **Channel Removed**\n\n' +
            `<#${channel.id}> has been removed from the announcement relay.\n\n` +
            (updatedChannels.length > 0
              ? `**Current public channels (${updatedChannels.length}/5):**\n` +
                updatedChannels.map((id) => `• <#${id}>`).join('\n')
              : '**No public channels configured.**'),
        });
      } catch (error) {
        logger.error('Failed to remove channel from announcement relay', { error });

        if (interaction.deferred) {
          await interaction.editReply({
            content: '❌ Failed to remove channel. Check logs for details.',
          });
        }
      }
    },
  };
}

/**
 * /announcement-status command
 */
function createAnnouncementStatusCommand(
  database: Database,
  announcementRelay: AnnouncementRelayManager | null,
): CommandDefinition {
  const builder = new SlashCommandBuilder()
    .setName('announcement-status')
    .setDescription('View announcement relay configuration')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false);

  return {
    name: 'announcement-status',
    description: 'View announcement relay configuration',
    builder: builder as SlashCommandBuilder,
    handler: async (interaction: ChatInputCommandInteraction) => {
      try {
        await interaction.deferReply({ ephemeral: true });

        // Get current configuration
        const privateChannelId = await database.getConfig('privateAnnouncementChannelId');
        const publicChannelsStr = await database.getConfig('publicAnnouncementChannelIds');
        const publicChannels = publicChannelsStr
          ? String(publicChannelsStr).split(',').filter((id) => id.length > 0)
          : [];

        if (!privateChannelId || publicChannels.length === 0) {
          await interaction.editReply({
            content:
              '⚠️ **Announcement Relay Not Configured**\n\n' +
              'Use `/announcement-setup` to configure the announcement relay system.',
          });
          return;
        }

        const status = announcementRelay?.isEnabled() ? '🟢 Active' : '🔴 Inactive';

        // Try to fetch and validate channels
        const guild = interaction.guild;
        let privateChannelDisplay = `<#${privateChannelId}>`;

        if (guild) {
          try {
            const privateChannel = await guild.channels.fetch(String(privateChannelId));
            if (privateChannel) {
              privateChannelDisplay = `<#${privateChannelId}> ✅`;
            }
          } catch {
            privateChannelDisplay = `❌ Invalid (ID: ${privateChannelId}) - Channel not found or bot lacks access`;
          }
        }

        // Validate public channels
        const publicChannelList: string[] = [];
        for (const channelId of publicChannels) {
          let channelDisplay = `• <#${channelId}>`;

          if (guild) {
            try {
              const channel = await guild.channels.fetch(String(channelId));
              if (channel) {
                channelDisplay = `• <#${channelId}> ✅`;
              }
            } catch {
              channelDisplay = `• ❌ Invalid (ID: ${channelId}) - Channel not found or bot lacks access`;
            }
          }

          publicChannelList.push(channelDisplay);
        }

        await interaction.editReply({
          content:
            '📢 **Announcement Relay Status**\n\n' +
            `**Status:** ${status}\n` +
            `**Private Channel:** ${privateChannelDisplay}\n\n` +
            `**Public Channels (${publicChannels.length}/5):**\n${publicChannelList.join('\n')}\n\n` +
            '**How it works:**\n' +
            'Messages from moderators in the private channel are automatically relayed to all public channels listed above.\n\n' +
            '**Note:** If channels show as "Invalid", they may have been deleted or the bot lacks permission to see them. Use `/announcement-setup` to reconfigure.',
        });
      } catch (error) {
        logger.error('Failed to get announcement relay status', { error });

        if (interaction.deferred) {
          await interaction.editReply({
            content: '❌ Failed to get status. Check logs for details.',
          });
        }
      }
    },
  };
}

/**
 * /announcement-toggle command
 */
function createAnnouncementToggleCommand(
  announcementRelay: AnnouncementRelayManager | null,
): CommandDefinition {
  const builder = new SlashCommandBuilder()
    .setName('announcement-toggle')
    .setDescription('Enable or disable announcement relay')
    .addBooleanOption((option) =>
      option
        .setName('enabled')
        .setDescription('Enable or disable the relay')
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false);

  return {
    name: 'announcement-toggle',
    description: 'Enable or disable announcement relay',
    builder: builder as SlashCommandBuilder,
    handler: async (interaction: ChatInputCommandInteraction) => {
      try {
        await interaction.deferReply({ ephemeral: true });

        if (!announcementRelay) {
          await interaction.editReply({
            content:
              '❌ **Announcement Relay Not Available**\n\n' +
              'The announcement relay system is not currently initialized. Restart the bot after configuring it.',
          });
          return;
        }

        const enabled = interaction.options.getBoolean('enabled', true);

        if (enabled) {
          announcementRelay.enable();
          logger.info('Announcement relay enabled', { enabledBy: interaction.user.id });

          await interaction.editReply({
            content: '✅ Announcement relay has been **enabled**.',
          });
        } else {
          announcementRelay.disable();
          logger.info('Announcement relay disabled', { disabledBy: interaction.user.id });

          await interaction.editReply({
            content: '⚠️ Announcement relay has been **disabled**.',
          });
        }
      } catch (error) {
        logger.error('Failed to toggle announcement relay', { error });

        if (interaction.deferred) {
          await interaction.editReply({
            content: '❌ Failed to toggle relay. Check logs for details.',
          });
        }
      }
    },
  };
}
