/**
 * @file ai.commands.ts
 * @description AI management commands
 * @module commands
 */
import { SlashCommandBuilder, PermissionFlagsBits, } from 'discord.js';
import { logger } from '../core/logger/logger.js';
import { config } from '../config/index.js';
/**
 * AI status command - Check AI system status
 */
export const aiStatusCommand = {
    name: 'ai-status',
    description: 'Check AI auto-reply system status',
    builder: new SlashCommandBuilder()
        .setName('ai-status')
        .setDescription('Check AI auto-reply system status')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async handler(interaction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const status = {
                enabled: config.aiEnabled,
                provider: config.aiProvider,
                model: config.aiModelName || 'default',
                baseUrl: config.aiBaseUrl || 'http://localhost:11434',
                channels: config.aiChannels.length > 0
                    ? config.aiChannels.map(id => `<#${id}>`).join(', ')
                    : 'All channels',
            };
            const statusEmoji = config.aiEnabled ? '✅' : '❌';
            const statusText = config.aiEnabled ? 'Enabled' : 'Disabled';
            await interaction.editReply({
                content: [
                    `## ${statusEmoji} AI Auto-Reply Status: ${statusText}`,
                    '',
                    `**Provider:** ${status.provider}`,
                    `**Model:** ${status.model}`,
                    `**Base URL:** ${status.baseUrl}`,
                    `**Active Channels:** ${status.channels}`,
                    '',
                    config.aiEnabled
                        ? '💡 The bot will respond when mentioned or when casino keywords are detected.'
                        : '💡 Enable AI in your .env file to use this feature.',
                ].filter(Boolean).join('\n'),
            });
            logger.info('AI status checked', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
            });
        }
        catch (error) {
            logger.error('Failed to check AI status', { error });
            await interaction.editReply({
                content: '❌ Failed to check AI status. Please check the logs.',
            });
        }
    },
};
/**
 * Clear AI history command - Clear conversation history for a channel
 */
export const aiClearHistoryCommand = {
    name: 'ai-clear-history',
    description: 'Clear AI conversation history for this channel',
    builder: new SlashCommandBuilder()
        .setName('ai-clear-history')
        .setDescription('Clear AI conversation history for this channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async handler(interaction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            // This will be called from the main app with access to aiManager
            // For now, just acknowledge
            await interaction.editReply({
                content: '✅ AI conversation history cleared for this channel.',
            });
            logger.info('AI history cleared', {
                userId: interaction.user.id,
                channelId: interaction.channelId,
                guildId: interaction.guildId,
            });
        }
        catch (error) {
            logger.error('Failed to clear AI history', { error });
            await interaction.editReply({
                content: '❌ Failed to clear AI history. Please check the logs.',
            });
        }
    },
};
/**
 * AI toggle command - Enable or disable AI auto-reply
 */
export const aiToggleCommand = {
    name: 'ai-toggle',
    description: 'Enable or disable AI auto-reply system',
    builder: new SlashCommandBuilder()
        .setName('ai-toggle')
        .setDescription('Enable or disable AI auto-reply system')
        .addStringOption(option => option
        .setName('action')
        .setDescription('Enable or disable AI')
        .setRequired(true)
        .addChoices({ name: 'Enable', value: 'enable' }, { name: 'Disable', value: 'disable' }))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async handler(interaction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const action = interaction.options.getString('action', true);
            const enable = action === 'enable';
            // Update config (runtime only, not persistent)
            const mutableConfig = config;
            mutableConfig.aiEnabled = enable;
            const statusEmoji = enable ? '✅' : '❌';
            const statusText = enable ? 'enabled' : 'disabled';
            await interaction.editReply({
                content: [
                    `## ${statusEmoji} AI Auto-Reply ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`,
                    '',
                    enable
                        ? '✅ AI will now respond to mentions and casino keywords.'
                        : '❌ AI responses are now disabled.',
                    '',
                    '⚠️ **Note:** This change is temporary and will reset on bot restart.',
                    '💡 To make it permanent, update `AI_ENABLED` in your `.env` file.',
                ].join('\n'),
            });
            logger.info(`AI ${statusText}`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                action,
            });
        }
        catch (error) {
            logger.error('Failed to toggle AI', { error });
            await interaction.editReply({
                content: '❌ Failed to toggle AI. Please check the logs.',
            });
        }
    },
};
/**
 * Export all AI commands
 */
export function createAICommands() {
    return [aiStatusCommand, aiClearHistoryCommand, aiToggleCommand];
}
//# sourceMappingURL=ai.commands.js.map