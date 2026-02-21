/**
 * @file clear-commands.ts
 * @description Script to clear all Discord slash commands (useful for fixing command cache issues)
 */

import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function clearCommands() {
  console.log('🗑️  Clearing all Discord slash commands...\n');

  // Get config from environment variables directly
  const discordToken = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!discordToken) {
    console.error('❌ DISCORD_TOKEN not found in .env file');
    process.exit(1);
  }

  if (!clientId) {
    console.error('❌ DISCORD_CLIENT_ID not found in .env file');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(discordToken);

  try {
    // Clear guild commands
    if (guildId) {
      console.log(`Clearing guild commands for guild: ${guildId}`);
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: [] }
      );
      console.log('✅ Guild commands cleared\n');
    }

    // Clear global commands
    console.log('Clearing global commands...');
    await rest.put(Routes.applicationCommands(clientId), {
      body: [],
    });
    console.log('✅ Global commands cleared\n');

    console.log('✅ All commands cleared successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Restart the bot to re-register commands');
    console.log('2. Wait 1-2 minutes for Discord to update');
    console.log('3. Restart your Discord client if needed\n');
  } catch (error) {
    console.error('❌ Failed to clear commands:', error);
    process.exit(1);
  }
}

clearCommands();
