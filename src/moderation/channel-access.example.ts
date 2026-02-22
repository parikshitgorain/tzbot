/* eslint-disable no-console */
/**
 * @file channel-access.example.ts
 * @description Example usage of the channel access enforcement system
 * @module moderation
 */

import { DiscordClient } from '@/core/discord/client.js';
import { ViolationRepository } from '@/core/database/repositories/ViolationRepository.js';
import { Database } from '@/core/database/Database.js';
import { ChannelAccessEnforcer } from './channel-access.js';
import type { Message } from 'discord.js';

/**
 * Example: Setting up channel access enforcement
 */
async function setupChannelAccessEnforcement() {
  // Initialize dependencies
  const database = new Database();
  await database.connect();

  const violationRepo = new ViolationRepository(database);
  const discordClient = new DiscordClient();

  // Configuration
  const moderatorRoleId = '123456789012345678'; // Your moderator role ID
  const announcementChannelId = '234567890123456789'; // Read-only announcement channel
  const subscriberRoleId = '345678901234567890'; // Subscribers can post
  const vipRoleId = '456789012345678901'; // VIPs can post

  // Create the enforcer with read-only channel configurations
  const channelEnforcer = new ChannelAccessEnforcer(
    discordClient,
    violationRepo,
    moderatorRoleId,
    [
      {
        channelId: announcementChannelId,
        whitelistRoleIds: [subscriberRoleId, vipRoleId],
      },
    ]
  );

  // Connect to Discord
  await discordClient.connect(process.env.DISCORD_TOKEN!);

  // Set up message event handler
  discordClient.on('messageCreate', async (message: Message) => {
    // Ignore bot messages
    if (message.author.bot) return;

    // Enforce channel access
    const wasDeleted = await channelEnforcer.enforceAccess(message);

    if (wasDeleted) {
      console.log(`Deleted unauthorized message from ${message.author.tag}`);
    }
  });

  console.log('Channel access enforcement is now active');
}

/**
 * Example: Adding a new read-only channel dynamically
 */
function addReadOnlyChannel(enforcer: ChannelAccessEnforcer) {
  const newChannelId = '567890123456789012';
  const whitelistRoles = ['678901234567890123', '789012345678901234'];

  enforcer.addReadOnlyChannel({
    channelId: newChannelId,
    whitelistRoleIds: whitelistRoles,
  });

  console.log(`Added read-only channel: ${newChannelId}`);
}

/**
 * Example: Updating whitelist roles for a channel
 */
function updateChannelWhitelist(enforcer: ChannelAccessEnforcer) {
  const channelId = '234567890123456789';
  const newWhitelistRoles = [
    '111111111111111111',
    '222222222222222222',
    '333333333333333333',
  ];

  enforcer.updateWhitelistRoles(channelId, newWhitelistRoles);

  console.log(`Updated whitelist for channel: ${channelId}`);
}

/**
 * Example: Checking if a user can post before they send a message
 */
async function checkUserAccess(
  enforcer: ChannelAccessEnforcer,
  message: Message
): Promise<void> {
  const accessResult = await enforcer.checkAccess(message);

  if (accessResult.isAuthorized) {
    console.log(`User ${message.author.tag} is authorized to post`);
  } else {
    console.log(`User ${message.author.tag} is NOT authorized: ${accessResult.reason}`);
  }
}

/**
 * Example: Getting all read-only channels
 */
function listReadOnlyChannels(enforcer: ChannelAccessEnforcer) {
  const channels = enforcer.getReadOnlyChannels();

  console.log('Read-only channels:');
  channels.forEach((config) => {
    console.log(`  Channel: ${config.channelId}`);
    console.log(`  Whitelist roles: ${config.whitelistRoleIds.join(', ')}`);
  });
}

/**
 * Example: Removing a read-only channel
 */
function removeReadOnlyChannel(enforcer: ChannelAccessEnforcer, channelId: string) {
  enforcer.removeReadOnlyChannel(channelId);
  console.log(`Removed read-only channel: ${channelId}`);
}

/**
 * Example: Complete integration with event manager
 */
async function integrateWithEventManager() {
  // Setup
  const database = new Database();
  await database.connect();

  const violationRepo = new ViolationRepository(database);
  const discordClient = new DiscordClient();

  const enforcer = new ChannelAccessEnforcer(
    discordClient,
    violationRepo,
    process.env.MODERATOR_ROLE_ID!,
    [
      {
        channelId: process.env.ANNOUNCEMENT_CHANNEL_ID!,
        whitelistRoleIds: [
          process.env.SUBSCRIBER_ROLE_ID!,
          process.env.VIP_ROLE_ID!,
        ],
      },
    ]
  );

  await discordClient.connect(process.env.DISCORD_TOKEN!);

  // Message handler with comprehensive logging
  discordClient.on('messageCreate', async (message: Message) => {
    // Skip bot messages
    if (message.author.bot) return;

    // Check if channel is read-only
    if (!enforcer.isReadOnlyChannel(message.channelId)) {
      return; // Not a read-only channel, allow message
    }

    // Enforce access
    try {
      const wasDeleted = await enforcer.enforceAccess(message);

      if (wasDeleted) {
        console.log('Unauthorized message deleted:', {
          user: message.author.tag,
          userId: message.author.id,
          channel: message.channelId,
          content: message.content.substring(0, 50),
        });
      }
    } catch (error) {
      console.error('Error enforcing channel access:', error);
    }
  });

  console.log('Channel access enforcement integrated with event manager');
}

// Export examples for documentation
export {
  setupChannelAccessEnforcement,
  addReadOnlyChannel,
  updateChannelWhitelist,
  checkUserAccess,
  listReadOnlyChannels,
  removeReadOnlyChannel,
  integrateWithEventManager,
};
