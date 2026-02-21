/**
 * @file giveaway.commands.ts
 * @description Giveaway slash commands (/giveaway create, /giveaway cancel, /giveaway list)
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
import type { GiveawayManager } from '@/managers/giveaway.manager.js';
import { logger, logError } from '@/core/logger/logger.js';

/**
 * Create giveaway commands
 */
export function createGiveawayCommands(
  _client: IDiscordClient,
  giveawayManager: GiveawayManager
): CommandDefinition[] {
  return [
    createGiveawayCommand(_client, giveawayManager),
  ];
}

/**
 * /giveaway command - Manage giveaways with subcommands
 */
function createGiveawayCommand(
  _client: IDiscordClient,
  giveawayManager: GiveawayManager
): CommandDefinition {
  const builder = new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Create a new giveaway')
        .addStringOption((option) =>
          option
            .setName('title')
            .setDescription('Title of the giveaway')
            .setRequired(true)
            .setMaxLength(256)
        )
        .addStringOption((option) =>
          option
            .setName('description')
            .setDescription('Description of the giveaway')
            .setRequired(true)
            .setMaxLength(1024)
        )
        .addIntegerOption((option) =>
          option
            .setName('duration')
            .setDescription('Duration in minutes (1-10080 = 7 days max)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10080)
        )
        .addIntegerOption((option) =>
          option
            .setName('winners')
            .setDescription('Number of winners (1-10)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10)
        )
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel to post the giveaway (defaults to current channel)')
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName('condition')
            .setDescription('Optional condition/requirement for winners (e.g., "DM me your email")')
            .setRequired(false)
            .setMaxLength(512)
        )
        .addRoleOption((option) =>
          option
            .setName('role1')
            .setDescription('Required role 1 (optional - leave empty for no role requirement)')
            .setRequired(false)
        )
        .addRoleOption((option) =>
          option
            .setName('role2')
            .setDescription('Required role 2 (optional)')
            .setRequired(false)
        )
        .addRoleOption((option) =>
          option
            .setName('role3')
            .setDescription('Required role 3 (optional)')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('cancel')
        .setDescription('Cancel an active giveaway')
        .addStringOption((option) =>
          option
            .setName('giveaway_id')
            .setDescription('ID of the giveaway to cancel')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('List all active giveaways')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('reroll')
        .setDescription('Reroll a specific winner from a giveaway')
        .addStringOption((option) =>
          option
            .setName('giveaway_id')
            .setDescription('ID of the giveaway')
            .setRequired(true)
        )
        .addUserOption((option) =>
          option
            .setName('winner')
            .setDescription('The winner to reroll/replace')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('config')
        .setDescription('Configure giveaway command permissions')
        .addBooleanOption((option) =>
          option
            .setName('show')
            .setDescription('Show current configuration (leave empty to show)')
            .setRequired(false)
        )
        .addRoleOption((option) =>
          option
            .setName('add_role')
            .setDescription('Add a role that can use giveaway commands')
            .setRequired(false)
        )
        .addRoleOption((option) =>
          option
            .setName('remove_role')
            .setDescription('Remove a role from giveaway command permissions')
            .setRequired(false)
        )
        .addUserOption((option) =>
          option
            .setName('add_user')
            .setDescription('Add a user that can use giveaway commands')
            .setRequired(false)
        )
        .addUserOption((option) =>
          option
            .setName('remove_user')
            .setDescription('Remove a user from giveaway command permissions')
            .setRequired(false)
        )
    );

  const handler = async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'create') {
      await handleCreateGiveaway(interaction, giveawayManager);
    } else if (subcommand === 'cancel') {
      await handleCancelGiveaway(interaction, giveawayManager);
    } else if (subcommand === 'list') {
      await handleListGiveaways(interaction, giveawayManager);
    } else if (subcommand === 'reroll') {
      await handleRerollWinner(interaction, giveawayManager);
    } else if (subcommand === 'config') {
      await handleConfigGiveaway(interaction, giveawayManager);
    }
  };

  return {
    name: 'giveaway',
    description: 'Manage giveaways',
    builder: builder as SlashCommandBuilder,
    handler,
    permissions: [PermissionFlagsBits.ManageEvents],
    moderatorOnly: true,
  };
}

/**
 * Handle /giveaway create subcommand
 */
async function handleCreateGiveaway(
  interaction: ChatInputCommandInteraction,
  giveawayManager: GiveawayManager
): Promise<void> {
  const title = interaction.options.getString('title', true);
  const description = interaction.options.getString('description', true);
  const durationMinutes = interaction.options.getInteger('duration', true);
  const winnerCount = interaction.options.getInteger('winners', true);
  const channel = interaction.options.getChannel('channel') || interaction.channel;
  const condition = interaction.options.getString('condition');
  const role1 = interaction.options.getRole('role1');
  const role2 = interaction.options.getRole('role2');
  const role3 = interaction.options.getRole('role3');

  if (!channel || !('send' in channel)) {
    await interaction.reply({
      content: '❌ Invalid channel selected. Please select a text channel.',
      ephemeral: true,
    });
    return;
  }

  if (!interaction.guildId) {
    await interaction.reply({
      content: '❌ This command can only be used in a server.',
      ephemeral: true,
    });
    return;
  }

  try {
    await interaction.deferReply({ ephemeral: true });

    // Collect required roles
    const requiredRoles: string[] = [];
    if (role1) requiredRoles.push(role1.id);
    if (role2) requiredRoles.push(role2.id);
    if (role3) requiredRoles.push(role3.id);

    // Convert minutes to milliseconds
    const durationMs = durationMinutes * 60 * 1000;

    // Create giveaway
    const giveaway = await giveawayManager.createGiveaway({
      title,
      description,
      channelId: channel.id,
      guildId: interaction.guildId,
      requiredRoles,
      winnerCount,
      durationMs,
      condition: condition || undefined,
    });

    logger.info('Giveaway created via command', {
      giveawayId: giveaway.id,
      title,
      channelId: channel.id,
      moderator: interaction.user.username,
      moderatorId: interaction.user.id,
      durationMinutes,
      winnerCount,
      requiredRoles,
    });

    // Build response
    let response = `✅ Giveaway created successfully!\n\n`;
    response += `**ID:** ${giveaway.id}\n`;
    response += `**Title:** ${title}\n`;
    response += `**Channel:** <#${channel.id}>\n`;
    response += `**Duration:** ${durationMinutes} minutes\n`;
    response += `**Winners:** ${winnerCount}\n`;
    
    if (requiredRoles.length > 0) {
      response += `**Required Roles:** ${requiredRoles.map(id => `<@&${id}>`).join(', ')}\n`;
    } else {
      response += `**Required Roles:** None (open to everyone)\n`;
    }
    
    response += `\nThe giveaway has been posted in <#${channel.id}>. Users can enter by clicking the button!`;

    await interaction.editReply({ content: response });
  } catch (error) {
    logError('Failed to create giveaway', error as Error, {
      title,
      channelId: channel.id,
      moderator: interaction.user.username,
    });

    const errorMessage = '❌ Failed to create giveaway. Please try again.';
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

/**
 * Handle /giveaway cancel subcommand
 */
async function handleCancelGiveaway(
  interaction: ChatInputCommandInteraction,
  giveawayManager: GiveawayManager
): Promise<void> {
  const giveawayId = interaction.options.getString('giveaway_id', true);

  try {
    await interaction.deferReply({ ephemeral: true });

    // Cancel the giveaway
    await giveawayManager.cancelGiveaway(giveawayId);

    logger.info('Giveaway cancelled via command', {
      giveawayId,
      moderator: interaction.user.username,
      moderatorId: interaction.user.id,
    });

    await interaction.editReply({
      content: `✅ Giveaway **${giveawayId}** has been cancelled.`,
    });
  } catch (error) {
    logError('Failed to cancel giveaway', error as Error, {
      giveawayId,
      moderator: interaction.user.username,
    });

    const errorMessage = `❌ Failed to cancel giveaway. ${(error as Error).message}`;
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

/**
 * Handle /giveaway list subcommand
 */
async function handleListGiveaways(
  interaction: ChatInputCommandInteraction,
  giveawayManager: GiveawayManager
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: '❌ This command can only be used in a server.',
      ephemeral: true,
    });
    return;
  }

  try {
    await interaction.deferReply({ ephemeral: true });

    // Get active giveaways
    const giveaways = await giveawayManager.getActiveGiveaways(interaction.guildId);

    if (giveaways.length === 0) {
      await interaction.editReply({
        content: 'No active giveaways at the moment.',
      });
      return;
    }

    // Build embed
    const embed = new EmbedBuilder()
      .setTitle('🎉 Active Giveaways')
      .setColor(0x00ff00)
      .setDescription(`Total active giveaways: ${giveaways.length}`)
      .setTimestamp();

    for (const giveaway of giveaways) {
      const endsAt = Math.floor(giveaway.endsAt.getTime() / 1000);
      const entryCount = giveaway.entries.length;
      
      let fieldValue = `**Channel:** <#${giveaway.channelId}>\n`;
      fieldValue += `**Entries:** ${entryCount}\n`;
      fieldValue += `**Winners:** ${giveaway.winnerCount}\n`;
      fieldValue += `**Ends:** <t:${endsAt}:R>\n`;
      fieldValue += `**ID:** \`${giveaway.id}\``;

      embed.addFields({
        name: giveaway.title,
        value: fieldValue,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logError('Failed to list giveaways', error as Error, {
      guildId: interaction.guildId,
    });

    const errorMessage = '❌ Failed to retrieve giveaway list. Please try again.';
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

/**
 * Handle /giveaway reroll subcommand
 */
async function handleRerollWinner(
  interaction: ChatInputCommandInteraction,
  giveawayManager: GiveawayManager
): Promise<void> {
  const giveawayId = interaction.options.getString('giveaway_id', true);
  const winner = interaction.options.getUser('winner', true);

  if (!interaction.guildId) {
    await interaction.reply({
      content: '❌ This command can only be used in a server.',
      ephemeral: true,
    });
    return;
  }

  try {
    await interaction.deferReply({ ephemeral: true });

    // Reroll the winner
    await giveawayManager.rerollWinner(giveawayId, winner.id, interaction.guildId);

    logger.info('Giveaway winner rerolled via command', {
      giveawayId,
      oldWinnerId: winner.id,
      moderator: interaction.user.username,
      moderatorId: interaction.user.id,
    });

    await interaction.editReply({
      content: `✅ Winner rerolled successfully! Check the giveaway channel for the announcement.`,
    });
  } catch (error) {
    logError('Failed to reroll winner', error as Error, {
      giveawayId,
      winnerId: winner.id,
      moderator: interaction.user.username,
    });

    const errorMessage = `❌ Failed to reroll winner. ${(error as Error).message}`;
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

/**
 * Handle /giveaway config subcommand
 */
async function handleConfigGiveaway(
  interaction: ChatInputCommandInteraction,
  giveawayManager: GiveawayManager
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: '❌ This command can only be used in a server.',
      ephemeral: true,
    });
    return;
  }

  const addRole = interaction.options.getRole('add_role');
  const removeRole = interaction.options.getRole('remove_role');
  const addUser = interaction.options.getUser('add_user');
  const removeUser = interaction.options.getUser('remove_user');
  const show = interaction.options.getBoolean('show');

  try {
    await interaction.deferReply({ ephemeral: true });

    // Get config manager from giveaway manager
    const configManager = giveawayManager.getConfigManager();

    // Show current configuration
    if (show || (!addRole && !removeRole && !addUser && !removeUser)) {
      const config = await configManager.getGiveawayPermissions(interaction.guildId);

      const embed = new EmbedBuilder()
        .setTitle('🎉 Giveaway Command Permissions')
        .setColor(0x00ff00)
        .setDescription('Users and roles that can use giveaway commands')
        .setTimestamp();

      const roleList = config.allowedRoles.length > 0
        ? config.allowedRoles.map(id => `<@&${id}>`).join(', ')
        : 'None (administrators only)';

      const userList = config.allowedUsers.length > 0
        ? config.allowedUsers.map(id => `<@${id}>`).join(', ')
        : 'None';

      embed.addFields(
        { name: 'Allowed Roles', value: roleList, inline: false },
        { name: 'Allowed Users', value: userList, inline: false }
      );

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Update configuration
    const config = await configManager.getGiveawayPermissions(interaction.guildId);

    if (addRole) {
      if (!config.allowedRoles.includes(addRole.id)) {
        config.allowedRoles.push(addRole.id);
      }
    }

    if (removeRole) {
      config.allowedRoles = config.allowedRoles.filter(id => id !== removeRole.id);
    }

    if (addUser) {
      if (!config.allowedUsers.includes(addUser.id)) {
        config.allowedUsers.push(addUser.id);
      }
    }

    if (removeUser) {
      config.allowedUsers = config.allowedUsers.filter(id => id !== removeUser.id);
    }

    await configManager.updateGiveawayPermissions(
      interaction.guildId,
      config.allowedRoles,
      config.allowedUsers
    );

    logger.info('Giveaway config updated', {
      guildId: interaction.guildId,
      moderator: interaction.user.username,
      moderatorId: interaction.user.id,
      addRole: addRole?.id,
      removeRole: removeRole?.id,
      addUser: addUser?.id,
      removeUser: removeUser?.id,
    });

    await interaction.editReply({
      content: '✅ Giveaway command permissions updated successfully!',
    });
  } catch (error) {
    logError('Failed to update giveaway config', error as Error, {
      guildId: interaction.guildId,
    });

    const errorMessage = `❌ Failed to update configuration. ${(error as Error).message}`;
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
