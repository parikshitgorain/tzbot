/**
 * @file clear-commands.ts
 * @description Script to clear all Discord slash commands (useful for fixing command cache issues)
 */

import { REST, Routes } from 'discord.js';
import { config } from '../src/config/index.js';

async function clearCommands() {
  console.log('🗑️  Clearing all Discord slash commands...\n');

  const rest = new REST({ version: '10' }).setToken(config.discordToken);

  try {
    // Clear guild commands
    if (config.guildId) {
      console.log(`Clearing guild commands for guild: ${config.guildId}`);
      await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: [] }
      );
      console.log('✅ Guild commands cleared\n');
    }

    // Clear global commands
    console.log('Clearing global commands...');
    await rest.put(Routes.applicationCommands(config.clientId), {
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
