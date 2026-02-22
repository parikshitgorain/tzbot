/**
 * @file command.example.ts
 * @description Example usage of CommandManager
 * @module managers
 */

import { CommandManager, type CommandDefinition } from './command.manager.js';
import { DiscordClient } from '@/core/discord/client.js';
import { config } from '@/config/index.js';
import { logger } from '@/core/logger/logger.js';
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

/**
 * Example: Basic command registration
 */
async function basicCommandExample() {
  const client = new DiscordClient();
  const commandManager = new CommandManager(client, config);

  // Define a simple ping command
  const pingCommand: CommandDefinition = {
    name: 'ping',
    description: 'Check bot latency',
    builder: new SlashCommandBuilder()
      .setName('ping')
      .setDescription('Check bot latency'),
    handler: async (interaction) => {
      const latency = Date.now() - interaction.createdTimestamp;
      await interaction.reply({
        content: `Pong! Latency: ${latency}ms`,
        ephemeral: true,
      });
    },
  };

  // Register and deploy command
  commandManager.registerCommand(pingCommand);
  await commandManager.deployCommands(config.discordToken, config.clientId);

  // Handle interactions
  client.on('interactionCreate', async (interaction) => {
    if (interaction.isCommand()) {
      await commandManager.handleInteraction(interaction);
    }
  });

  await client.connect(config.discordToken);
  logger.info('Bot running with basic command');
}

/**
 * Example: Moderator-only command with permissions
 */
async function moderatorCommandExample() {
  const client = new DiscordClient();
  const commandManager = new CommandManager(client, config);

  // Define a ban command
  const banCommand: CommandDefinition = {
    name: 'ban',
    description: 'Ban a user from the server',
    builder: new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Ban a user from the server')
      .addUserOption((option) =>
        option.setName('user').setDescription('User to ban').setRequired(true)
      )
      .addStringOption((option) =>
        option.setName('reason').setDescription('Reason for ban').setRequired(false)
      ),
    handler: async (interaction) => {
      const user = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason') || 'No reason provided';

      await client.banUser(interaction.guildId!, user.id, reason);

      await interaction.reply({
        content: `✅ Banned ${user.tag} for: ${reason}`,
        ephemeral: true,
      });

      logger.info('User banned via command', {
        moderatorId: interaction.user.id,
        targetUserId: user.id,
        reason,
      });
    },
    permissions: [PermissionFlagsBits.BanMembers],
    moderatorOnly: true,
  };

  commandManager.registerCommand(banCommand);
  await commandManager.deployCommands(config.discordToken, config.clientId);

  client.on('interactionCreate', async (interaction) => {
    if (interaction.isCommand()) {
      await commandManager.handleInteraction(interaction);
    }
  });

  await client.connect(config.discordToken);
}

/**
 * Example: Command with cooldown
 */
async function cooldownCommandExample() {
  const client = new DiscordClient();
  const commandManager = new CommandManager(client, config);

  // Define a command with per-user cooldown
  const dailyCommand: CommandDefinition = {
    name: 'daily',
    description: 'Claim your daily reward',
    builder: new SlashCommandBuilder()
      .setName('daily')
      .setDescription('Claim your daily reward'),
    handler: async (interaction) => {
      await interaction.reply({
        content: '🎁 You claimed your daily reward!',
        ephemeral: true,
      });

      logger.info('Daily reward claimed', {
        userId: interaction.user.id,
      });
    },
    cooldown: {
      duration: 86400000, // 24 hours
      perUser: true,
    },
  };

  commandManager.registerCommand(dailyCommand);
  await commandManager.deployCommands(config.discordToken, config.clientId);

  client.on('interactionCreate', async (interaction) => {
    if (interaction.isCommand()) {
      await commandManager.handleInteraction(interaction);
    }
  });

  await client.connect(config.discordToken);
}

/**
 * Example: Multiple commands with different configurations
 */
async function multipleCommandsExample() {
  const client = new DiscordClient();
  const commandManager = new CommandManager(client, config);

  const commands: CommandDefinition[] = [
    // Public command
    {
      name: 'help',
      description: 'Show available commands',
      builder: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show available commands'),
      handler: async (interaction) => {
        const allCommands = commandManager.getAllCommands();
        const commandList = allCommands
          .map((cmd) => `\`/${cmd.name}\` - ${cmd.description}`)
          .join('\n');

        await interaction.reply({
          content: `**Available Commands:**\n${commandList}`,
          ephemeral: true,
        });
      },
    },

    // Moderator command with cooldown
    {
      name: 'warn',
      description: 'Warn a user',
      builder: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a user')
        .addUserOption((option) =>
          option.setName('user').setDescription('User to warn').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('reason').setDescription('Reason for warning').setRequired(true)
        ),
      handler: async (interaction) => {
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason', true);

        // Send warning DM to user
        try {
          await user.send(`⚠️ You have been warned: ${reason}`);
        } catch {
          logger.warn('Could not DM user', { userId: user.id });
        }

        await interaction.reply({
          content: `✅ Warned ${user.tag} for: ${reason}`,
          ephemeral: true,
        });
      },
      moderatorOnly: true,
      cooldown: {
        duration: 3000, // 3 seconds
        perUser: true,
      },
    },

    // Config command
    {
      name: 'config',
      description: 'Display current bot configuration',
      builder: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Display current bot configuration'),
      handler: async (interaction) => {
        const configInfo = `
**Bot Configuration**
Guild ID: ${config.guildId}
Max Messages/Second: ${config.maxMessagesPerSecond}
Log Level: ${config.logLevel}
        `.trim();

        await interaction.reply({
          content: configInfo,
          ephemeral: true,
        });
      },
      moderatorOnly: true,
    },
  ];

  commandManager.registerCommands(commands);
  await commandManager.deployCommands(config.discordToken, config.clientId);

  client.on('interactionCreate', async (interaction) => {
    if (interaction.isCommand()) {
      await commandManager.handleInteraction(interaction);
    }
  });

  await client.connect(config.discordToken);
  logger.info('Bot running with multiple commands', {
    commandCount: commands.length,
  });
}

/**
 * Example: Command with subcommands
 */
async function subcommandExample() {
  const client = new DiscordClient();
  const commandManager = new CommandManager(client, config);

  // Define a command with subcommands
  const moderationCommand: CommandDefinition = {
    name: 'mod',
    description: 'Moderation commands',
    builder: new SlashCommandBuilder()
      .setName('mod')
      .setDescription('Moderation commands')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('timeout')
          .setDescription('Timeout a user')
          .addUserOption((option) =>
            option.setName('user').setDescription('User to timeout').setRequired(true)
          )
          .addIntegerOption((option) =>
            option
              .setName('duration')
              .setDescription('Duration in minutes')
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('kick')
          .setDescription('Kick a user')
          .addUserOption((option) =>
            option.setName('user').setDescription('User to kick').setRequired(true)
          )
      ),
    handler: async (interaction) => {
      const subcommand = interaction.options.getSubcommand();
      const user = interaction.options.getUser('user', true);

      if (subcommand === 'timeout') {
        const duration = interaction.options.getInteger('duration', true);
        await client.timeoutUser(
          interaction.guildId!,
          user.id,
          duration * 60 * 1000,
          'Timed out via command'
        );

        await interaction.reply({
          content: `✅ Timed out ${user.tag} for ${duration} minutes`,
          ephemeral: true,
        });
      } else if (subcommand === 'kick') {
        await client.kickUser(interaction.guildId!, user.id, 'Kicked via command');

        await interaction.reply({
          content: `✅ Kicked ${user.tag}`,
          ephemeral: true,
        });
      }
    },
    permissions: [PermissionFlagsBits.ModerateMembers],
    moderatorOnly: true,
  };

  commandManager.registerCommand(moderationCommand);
  await commandManager.deployCommands(config.discordToken, config.clientId);

  client.on('interactionCreate', async (interaction) => {
    if (interaction.isCommand()) {
      await commandManager.handleInteraction(interaction);
    }
  });

  await client.connect(config.discordToken);
}

/**
 * Example: Graceful shutdown with CommandManager
 */
async function gracefulShutdownExample() {
  const client = new DiscordClient();
  const commandManager = new CommandManager(client, config);

  // Register commands...
  const pingCommand: CommandDefinition = {
    name: 'ping',
    description: 'Ping command',
    builder: new SlashCommandBuilder().setName('ping').setDescription('Ping command'),
    handler: async (interaction) => {
      await interaction.reply('Pong!');
    },
  };

  commandManager.registerCommand(pingCommand);
  await commandManager.deployCommands(config.discordToken, config.clientId);

  client.on('interactionCreate', async (interaction) => {
    if (interaction.isCommand()) {
      await commandManager.handleInteraction(interaction);
    }
  });

  await client.connect(config.discordToken);

  // Handle shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down');

    // Cleanup command manager
    commandManager.destroy();

    // Disconnect client
    await client.disconnect();

    logger.info('Shutdown complete');
    process.exit(0);
  });
}

// Export examples
export {
  basicCommandExample,
  moderatorCommandExample,
  cooldownCommandExample,
  multipleCommandsExample,
  subcommandExample,
  gracefulShutdownExample,
};

// Run basic example if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  basicCommandExample().catch((error) => {
    logger.error('Example failed', { error });
    process.exit(1);
  });
}
