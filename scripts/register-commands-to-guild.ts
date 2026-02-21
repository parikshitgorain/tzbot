/**
 * Script to register commands to Discord
 * Usage: 
 *   Global: npx tsx scripts/register-commands-to-guild.ts
 *   Specific guild: npx tsx scripts/register-commands-to-guild.ts <GUILD_ID>
 */

import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { config } from 'dotenv';

config();

const guildId = process.argv[2];
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  console.error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in .env');
  process.exit(1);
}

// Define all commands here (simplified versions for registration)
const commands = [
  new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways')
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Create a new giveaway')
        .addStringOption(opt => opt.setName('title').setDescription('Giveaway title').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('Giveaway description').setRequired(true))
        .addIntegerOption(opt => opt.setName('duration').setDescription('Duration in minutes').setRequired(true))
        .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('end')
        .setDescription('End a giveaway early')
        .addStringOption(opt => opt.setName('giveaway_id').setDescription('Giveaway ID').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('reroll')
        .setDescription('Reroll a giveaway winner')
        .addStringOption(opt => opt.setName('giveaway_id').setDescription('Giveaway ID').setRequired(true))
        .addUserOption(opt => opt.setName('winner').setDescription('Winner to reroll').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('config').setDescription('Configure giveaway permissions')
    ),
  
  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a warning to a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for warning').setRequired(true))
    .setDefaultMemberPermissions('0'), // Requires Administrator by default
  
  new SlashCommandBuilder()
    .setName('warnlist')
    .setDescription('View warnings for a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to check').setRequired(true))
    .setDefaultMemberPermissions('0'),
  
  new SlashCommandBuilder()
    .setName('warnall')
    .setDescription('View all users with active warnings')
    .setDefaultMemberPermissions('0'),
  
  new SlashCommandBuilder()
    .setName('clearwarn')
    .setDescription('Clear the last warning for a user')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
    .setDefaultMemberPermissions('0'),
  
  new SlashCommandBuilder()
    .setName('resetoffenses')
    .setDescription('Reset all offenses for a user')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
    .setDefaultMemberPermissions('0'),
  
  new SlashCommandBuilder()
    .setName('modlog')
    .setDescription('View moderation log for a user')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
    .setDefaultMemberPermissions('0'),
  
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption(opt => opt.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for ban'))
    .setDefaultMemberPermissions('0'),
  
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption(opt => opt.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for kick'))
    .setDefaultMemberPermissions('0'),
  
  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to timeout').setRequired(true))
    .addIntegerOption(opt => opt.setName('duration').setDescription('Duration in minutes').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for timeout'))
    .setDefaultMemberPermissions('0'),
  
  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Display bot configuration'),
  
  new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Discord account to Kick'),
  
  new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink your Discord account from Kick'),
  
  new SlashCommandBuilder()
    .setName('checklink')
    .setDescription('Check your account linking status'),
  
  new SlashCommandBuilder()
    .setName('deletemydata')
    .setDescription('Delete all your data from the bot (GDPR compliance)'),
];

async function registerCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(token!);
    const commandsJson = commands.map(cmd => cmd.toJSON());

    if (guildId) {
      console.log(`Registering ${commandsJson.length} commands to guild ${guildId}...`);
      await rest.put(
        Routes.applicationGuildCommands(clientId!, guildId),
        { body: commandsJson }
      );
      console.log(`✓ Successfully registered commands to guild ${guildId}`);
      console.log('Commands should appear immediately in that server.');
    } else {
      console.log(`Registering ${commandsJson.length} commands globally...`);
      await rest.put(
        Routes.applicationCommands(clientId!),
        { body: commandsJson }
      );
      console.log('✓ Successfully registered commands globally');
      console.log('⚠ Note: Global commands can take up to 1 hour to appear in all servers.');
    }

    console.log('\nRegistered commands:', commandsJson.map(c => c.name).join(', '));
  } catch (error) {
    console.error('Failed to register commands:', error);
    process.exit(1);
  }
}

registerCommands();
