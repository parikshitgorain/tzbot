/**
 * @file image.commands.ts
 * @description Image search commands
 * @module commands
 */
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { UnsplashProvider } from '../ai/image/unsplash-provider.js';
import { config } from '../config/index.js';
import { logger, logError } from '../core/logger/logger.js';
export const imageCommand = {
    name: 'image',
    description: 'Search for images on Unsplash',
    builder: new SlashCommandBuilder()
        .setName('image')
        .setDescription('Search for images on Unsplash')
        .addStringOption((option) => option
        .setName('query')
        .setDescription('What to search for')
        .setRequired(true))
        .addIntegerOption((option) => option
        .setName('count')
        .setDescription('Number of images (1-5)')
        .setMinValue(1)
        .setMaxValue(5)
        .setRequired(false)),
    async handler(interaction) {
        if (!config.unsplashAccessKey) {
            await interaction.reply({
                content: 'Image search is not configured. Please set UNSPLASH_ACCESS_KEY in .env',
                ephemeral: true,
            });
            return;
        }
        const query = interaction.options.getString('query', true);
        const count = interaction.options.getInteger('count') || 1;
        await interaction.deferReply();
        try {
            const unsplash = new UnsplashProvider(config.unsplashAccessKey);
            const images = await unsplash.searchImages(query, count);
            if (images.length === 0) {
                await interaction.editReply({
                    content: `No images found for "${query}". Try a different search term!`,
                });
                return;
            }
            // Send first image as embed
            const firstImage = images[0];
            const embed = new EmbedBuilder()
                .setTitle(firstImage.description || query)
                .setImage(firstImage.url)
                .setColor(0x00d4ff)
                .setFooter({
                text: `Photo by ${firstImage.photographer} on Unsplash`,
            })
                .setURL(firstImage.photographerUrl);
            await interaction.editReply({
                embeds: [embed],
            });
            // Track download (required by Unsplash API)
            await unsplash.trackDownload(firstImage.downloadUrl);
            // If multiple images requested, send additional ones
            if (images.length > 1) {
                for (let i = 1; i < images.length; i++) {
                    const image = images[i];
                    const additionalEmbed = new EmbedBuilder()
                        .setTitle(image.description || query)
                        .setImage(image.url)
                        .setColor(0x00d4ff)
                        .setFooter({
                        text: `Photo by ${image.photographer} on Unsplash`,
                    })
                        .setURL(image.photographerUrl);
                    await interaction.followUp({
                        embeds: [additionalEmbed],
                    });
                    await unsplash.trackDownload(image.downloadUrl);
                }
            }
            logger.info('Image search completed', {
                userId: interaction.user.id,
                query,
                resultsCount: images.length,
            });
        }
        catch (error) {
            logError('Image search failed', error, {
                userId: interaction.user.id,
                query,
            });
            await interaction.editReply({
                content: 'Failed to search for images. Please try again later.',
            });
        }
    },
};
//# sourceMappingURL=image.commands.js.map