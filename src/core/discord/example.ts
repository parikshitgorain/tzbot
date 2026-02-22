/* eslint-disable no-console */
/**
 * @file example.ts
 * @description Example usage of the Discord client wrapper
 * @module core/discord
 */

import { DiscordClient, MessageContent } from './client.js';
import { EmbedBuilder } from 'discord.js';
import { config } from '@/config/index.js';

/**
 * Example: Basic Discord client usage
 */
async function basicExample() {
  // Create a new Discord client
  const client = new DiscordClient();

  // Connect to Discord
  await client.connect(config.discordToken);

  // Subscribe to clientReady event
  client.on('clientReady', () => {
    console.log('Bot is ready!');
  });

  // Subscribe to message events
  client.on('messageCreate', async (message) => {
    if (message.content === '!ping') {
      await client.sendMessage(message.channelId, {
        content: 'Pong!',
      });
    }
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await client.disconnect();
    process.exit(0);
  });
}

/**
 * Example: Sending messages with embeds
 */
async function sendEmbedExample(client: DiscordClient, channelId: string) {
  const embed = new EmbedBuilder()
    .setTitle('Welcome!')
    .setDescription('Thanks for joining our server')
    .setColor(0x00ff00)
    .setTimestamp();

  const content: MessageContent = {
    content: 'Check out this embed:',
    embeds: [embed],
  };

  await client.sendMessage(channelId, content);
}

/**
 * Example: Moderation actions
 */
async function moderationExample(
  client: DiscordClient,
  guildId: string,
  userId: string
) {
  // Warn a user (send DM)
  const member = await client.getMember(guildId, userId);
  if (member) {
    // Send warning via DM (would need to implement DM sending)
    console.log(`Warning user ${userId}`);
  }

  // Timeout a user for 1 hour
  const oneHour = 60 * 60 * 1000;
  await client.timeoutUser(guildId, userId, oneHour, 'Spam violation');

  // Kick a user
  await client.kickUser(guildId, userId, 'Repeated violations');

  // Ban a user
  await client.banUser(guildId, userId, 'Severe rule violation');
}

/**
 * Example: Role management
 */
async function roleManagementExample(
  client: DiscordClient,
  guildId: string,
  userId: string,
  roleId: string
) {
  // Add a role to a user
  await client.addRole(guildId, userId, roleId);
  console.log(`Added role ${roleId} to user ${userId}`);

  // Remove a role from a user
  await client.removeRole(guildId, userId, roleId);
  console.log(`Removed role ${roleId} from user ${userId}`);
}

/**
 * Example: Auto-reconnect handling
 */
async function reconnectExample() {
  const client = new DiscordClient();

  // The client will automatically attempt to reconnect on connection failure
  try {
    await client.connect(config.discordToken);
  } catch (error) {
    console.error('Failed to connect after multiple attempts:', error);
    // Implement additional error handling or alerting here
  }

  // Monitor connection status
  client.on('disconnect', () => {
    console.log('Disconnected from Discord');
  });

  client.on('clientReady', () => {
    console.log('Connected to Discord');
  });
}

/**
 * Example: Event-driven moderation
 */
async function eventDrivenModerationExample() {
  const client = new DiscordClient();
  await client.connect(config.discordToken);

  // Track message counts for spam detection
  const messageCounts = new Map<string, number[]>();

  client.on('messageCreate', async (message) => {
    // Skip bot messages
    if (message.author.bot) return;

    const userId = message.author.id;
    const now = Date.now();

    // Track message timestamps
    if (!messageCounts.has(userId)) {
      messageCounts.set(userId, []);
    }

    const timestamps = messageCounts.get(userId)!;
    timestamps.push(now);

    // Remove timestamps older than 10 seconds
    const recentTimestamps = timestamps.filter((t) => now - t < 10000);
    messageCounts.set(userId, recentTimestamps);

    // Check for spam (10+ messages in 10 seconds)
    if (recentTimestamps.length >= 10) {
      // Delete the message
      await client.deleteMessage(message.channelId, message.id);

      // Timeout the user for 1 hour
      const oneHour = 60 * 60 * 1000;
      await client.timeoutUser(
        message.guildId!,
        userId,
        oneHour,
        'Spam detected: 10+ messages in 10 seconds'
      );

      console.log(`User ${userId} timed out for spam`);
    }
  });
}

/**
 * Example: Complete bot setup
 */
async function completeBotExample() {
  const client = new DiscordClient();

  // Connect to Discord
  await client.connect(config.discordToken);

  // Log when ready
  client.on('clientReady', () => {
    console.log('TZBOT is online!');
  });

  // Handle errors
  client.on('error', (error) => {
    console.error('Discord client error:', error);
  });

  // Handle warnings
  client.on('warn', (warning) => {
    console.warn('Discord client warning:', warning);
  });

  // Message handling
  client.on('messageCreate', async (message) => {
    // Skip bot messages
    if (message.author.bot) return;

    // Command handling
    if (message.content.startsWith('!')) {
      const command = message.content.slice(1).split(' ')[0];

      switch (command) {
        case 'ping': {
          await client.sendMessage(message.channelId, {
            content: 'Pong!',
          });
          break;
        }

        case 'help': {
          const helpEmbed = new EmbedBuilder()
            .setTitle('TZBOT Commands')
            .setDescription('Available commands:')
            .addFields(
              { name: '!ping', value: 'Check if bot is responsive' },
              { name: '!help', value: 'Show this help message' }
            )
            .setColor(0x0099ff);

          await client.sendMessage(message.channelId, {
            embeds: [helpEmbed],
          });
          break;
        }
      }
    }
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await client.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await client.disconnect();
    process.exit(0);
  });
}

// Export examples
export {
  basicExample,
  sendEmbedExample,
  moderationExample,
  roleManagementExample,
  reconnectExample,
  eventDrivenModerationExample,
  completeBotExample,
};
