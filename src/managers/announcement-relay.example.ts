/**
 * @file announcement-relay.example.ts
 * @description Example usage of the announcement relay manager
 * @module managers
 */

import { DiscordClient } from '@/core/discord/client.js';
import { AnnouncementRelayManager } from './announcement-relay.manager.js';

/**
 * Example: Basic announcement relay setup
 */
async function basicAnnouncementRelayExample() {
  // Initialize Discord client
  const discordClient = new DiscordClient();
  await discordClient.connect(process.env.DISCORD_TOKEN!);

  // Configure announcement relay
  const relayConfig = {
    privateChannelId: '123456789012345678', // Private moderator channel
    publicChannelIds: [
      '234567890123456789', // #announcements
      '345678901234567890', // #general
      '456789012345678901', // #news
    ],
    guildId: '567890123456789012', // Your Discord server ID
    moderatorRoleId: '678901234567890123', // Moderator role ID
  };

  // Create announcement relay manager
  const relayManager = new AnnouncementRelayManager(discordClient, relayConfig);

  // Start monitoring for announcements
  relayManager.start();

  console.log('Announcement relay is now active!');
  console.log(`Monitoring channel: ${relayConfig.privateChannelId}`);
  console.log(`Relaying to ${relayConfig.publicChannelIds.length} public channels`);
}

/**
 * Example: Dynamic configuration updates
 */
async function dynamicConfigurationExample() {
  const discordClient = new DiscordClient();
  await discordClient.connect(process.env.DISCORD_TOKEN!);

  const relayManager = new AnnouncementRelayManager(discordClient, {
    privateChannelId: '123456789012345678',
    publicChannelIds: ['234567890123456789'],
    guildId: '567890123456789012',
    moderatorRoleId: '678901234567890123',
  });

  relayManager.start();

  // Later, add more public channels
  relayManager.updateConfig({
    publicChannelIds: [
      '234567890123456789', // #announcements
      '345678901234567890', // #general (newly added)
      '456789012345678901', // #news (newly added)
    ],
  });

  console.log('Configuration updated with additional channels');
}

/**
 * Example: Temporarily disable relay
 */
async function temporaryDisableExample() {
  const discordClient = new DiscordClient();
  await discordClient.connect(process.env.DISCORD_TOKEN!);

  const relayManager = new AnnouncementRelayManager(discordClient, {
    privateChannelId: '123456789012345678',
    publicChannelIds: ['234567890123456789'],
    guildId: '567890123456789012',
    moderatorRoleId: '678901234567890123',
  });

  relayManager.start();

  // Temporarily disable relay (e.g., during maintenance)
  relayManager.disable();
  console.log('Relay disabled');

  // Do maintenance work...
  await new Promise((resolve) => setTimeout(resolve, 60000)); // 1 minute

  // Re-enable relay
  relayManager.enable();
  console.log('Relay re-enabled');
}

/**
 * Example: Integration with event manager
 */
async function eventManagerIntegrationExample() {
  const discordClient = new DiscordClient();
  await discordClient.connect(process.env.DISCORD_TOKEN!);

  const relayManager = new AnnouncementRelayManager(discordClient, {
    privateChannelId: process.env.PRIVATE_ANNOUNCEMENT_CHANNEL_ID!,
    publicChannelIds: process.env.PUBLIC_ANNOUNCEMENT_CHANNEL_IDS!.split(','),
    guildId: process.env.GUILD_ID!,
    moderatorRoleId: process.env.MODERATOR_ROLE_ID!,
  });

  // Start the relay manager
  relayManager.start();

  // The relay manager automatically listens to messageCreate events
  // and handles relay logic internally

  console.log('Announcement relay integrated with Discord events');
}

/**
 * Example: Full production setup
 */
async function productionSetupExample() {
  // Validate environment variables
  const requiredEnvVars = [
    'DISCORD_TOKEN',
    'GUILD_ID',
    'MODERATOR_ROLE_ID',
    'PRIVATE_ANNOUNCEMENT_CHANNEL_ID',
    'PUBLIC_ANNOUNCEMENT_CHANNEL_IDS',
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  // Initialize Discord client
  const discordClient = new DiscordClient();
  await discordClient.connect(process.env.DISCORD_TOKEN!);

  // Parse public channel IDs from comma-separated string
  const publicChannelIds = process.env.PUBLIC_ANNOUNCEMENT_CHANNEL_IDS!
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (publicChannelIds.length === 0) {
    throw new Error('No public announcement channels configured');
  }

  // Create relay manager
  const relayManager = new AnnouncementRelayManager(discordClient, {
    privateChannelId: process.env.PRIVATE_ANNOUNCEMENT_CHANNEL_ID!,
    publicChannelIds,
    guildId: process.env.GUILD_ID!,
    moderatorRoleId: process.env.MODERATOR_ROLE_ID!,
  });

  // Start relay
  relayManager.start();

  console.log('✅ Announcement relay system started');
  console.log(`📥 Monitoring: <#${process.env.PRIVATE_ANNOUNCEMENT_CHANNEL_ID}>`);
  console.log(`📤 Relaying to ${publicChannelIds.length} channels:`);
  publicChannelIds.forEach((id, index) => {
    console.log(`   ${index + 1}. <#${id}>`);
  });

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down announcement relay...');
    relayManager.disable();
    await discordClient.disconnect();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('Shutting down announcement relay...');
    relayManager.disable();
    await discordClient.disconnect();
    process.exit(0);
  });
}

// Run examples (uncomment the one you want to test)
// basicAnnouncementRelayExample();
// dynamicConfigurationExample();
// temporaryDisableExample();
// eventManagerIntegrationExample();
// productionSetupExample();

export {
  basicAnnouncementRelayExample,
  dynamicConfigurationExample,
  temporaryDisableExample,
  eventManagerIntegrationExample,
  productionSetupExample,
};
