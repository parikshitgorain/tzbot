/**
 * @file giveaway.example.ts
 * @description Example usage of the GiveawayManager
 * @module managers
 */

import { GiveawayManager } from './giveaway.manager.js';
import { DiscordClient } from '@/core/discord/client.js';
import { GiveawayRepository } from '@/core/database/repositories/GiveawayRepository.js';
import { Pool } from 'pg';
import { ButtonInteraction } from 'discord.js';

/**
 * Example: Initialize giveaway manager
 */
async function initializeGiveawayManager() {
  // Initialize dependencies
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const discordClient = new DiscordClient();
  const giveawayRepository = new GiveawayRepository(pool);

  // Create giveaway manager
  const giveawayManager = new GiveawayManager(discordClient, giveawayRepository);

  return giveawayManager;
}

/**
 * Example: Create a giveaway with role restrictions
 */
async function createRoleGatedGiveaway(giveawayManager: GiveawayManager) {
  const giveaway = await giveawayManager.createGiveaway({
    title: 'Premium Nitro Giveaway',
    description: 'Win 1 month of Discord Nitro! Click the button below to enter.',
    channelId: '1234567890123456789',
    guildId: '9876543210987654321',
    requiredRoles: ['subscriber_role_id', 'vip_role_id'], // Users need one of these roles
    winnerCount: 3,
    durationMs: 24 * 60 * 60 * 1000, // 24 hours
  });

  console.log('Giveaway created:', giveaway.id);
}

/**
 * Example: Create a giveaway with no role restrictions
 */
async function createPublicGiveaway(giveawayManager: GiveawayManager) {
  const giveaway = await giveawayManager.createGiveaway({
    title: 'Community Appreciation Giveaway',
    description: 'Thank you for being part of our community! Everyone can enter.',
    channelId: '1234567890123456789',
    guildId: '9876543210987654321',
    requiredRoles: [], // No role restrictions
    winnerCount: 5,
    durationMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  console.log('Public giveaway created:', giveaway.id);
}

/**
 * Example: Handle button interaction for giveaway entry
 */
async function handleGiveawayButton(
  giveawayManager: GiveawayManager,
  interaction: ButtonInteraction
) {
  // Check if this is a giveaway entry button
  if (interaction.customId.startsWith('giveaway_enter_')) {
    await giveawayManager.handleEntryInteraction(
      interaction,
      interaction.guildId || ''
    );
  }
}

/**
 * Example: Set up Discord client to handle giveaway interactions
 */
async function setupGiveawayHandlers(
  discordClient: DiscordClient,
  giveawayManager: GiveawayManager
) {
  // Handle button interactions
  discordClient.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith('giveaway_enter_')) {
      await giveawayManager.handleEntryInteraction(
        interaction,
        interaction.guildId || ''
      );
    }
  });

  console.log('Giveaway handlers registered');
}

/**
 * Example: Recover active giveaways on bot startup
 */
async function recoverGiveawaysOnStartup(
  giveawayManager: GiveawayManager,
  guildId: string
) {
  // This should be called when the bot starts up
  await giveawayManager.recoverActiveGiveaways(guildId);
  console.log('Active giveaways recovered');
}

/**
 * Example: Cancel a giveaway
 */
async function cancelGiveaway(
  giveawayManager: GiveawayManager,
  giveawayId: string
) {
  await giveawayManager.cancelGiveaway(giveawayId);
  console.log('Giveaway cancelled:', giveawayId);
}

/**
 * Example: Complete workflow
 */
async function completeWorkflow() {
  // 1. Initialize manager
  const giveawayManager = await initializeGiveawayManager();

  // 2. Recover active giveaways on startup
  await recoverGiveawaysOnStartup(giveawayManager, 'your_guild_id');

  // 3. Create a new giveaway
  await createRoleGatedGiveaway(giveawayManager);

  // 4. Set up handlers (this would be in your main bot file)
  // setupGiveawayHandlers(discordClient, giveawayManager);

  // 5. Users click the button to enter (handled automatically)
  // 6. Giveaway ends automatically after duration
  // 7. Winners are selected and announced
}

/**
 * Example: Integration with slash command
 */
async function createGiveawayCommand(
  giveawayManager: GiveawayManager,
  interaction: any // ChatInputCommandInteraction
) {
  // Get command options
  const title = interaction.options.getString('title', true);
  const description = interaction.options.getString('description', true);
  const duration = interaction.options.getInteger('duration', true); // in hours
  const winners = interaction.options.getInteger('winners', true);
  const requiredRole = interaction.options.getRole('required_role'); // optional

  // Create giveaway
  const giveaway = await giveawayManager.createGiveaway({
    title,
    description,
    channelId: interaction.channelId,
    guildId: interaction.guildId,
    requiredRoles: requiredRole ? [requiredRole.id] : [],
    winnerCount: winners,
    durationMs: duration * 60 * 60 * 1000, // Convert hours to milliseconds
  });

  // Reply to command
  await interaction.reply({
    content: `✅ Giveaway created! Check <#${interaction.channelId}> to enter.`,
    ephemeral: true,
  });
}

// Export examples
export {
  initializeGiveawayManager,
  createRoleGatedGiveaway,
  createPublicGiveaway,
  handleGiveawayButton,
  setupGiveawayHandlers,
  recoverGiveawaysOnStartup,
  cancelGiveaway,
  completeWorkflow,
  createGiveawayCommand,
};
