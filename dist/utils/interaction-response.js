/**
 * @file interaction-response.ts
 * @description Utility functions for safely responding to Discord interactions
 * @module utils
 */
import { logger } from '../core/logger/logger.js';
/**
 * Safely reply to an interaction with proper error handling
 * Handles cases where interaction token has expired or interaction was already acknowledged
 */
export async function safeReply(interaction, options) {
    try {
        if (interaction.replied) {
            // Already replied, try followUp
            await interaction.followUp(options);
            return true;
        }
        else if (interaction.deferred) {
            // Deferred but not replied, use editReply
            // Remove ephemeral flag for editReply as it's not supported
            const editOptions = {
                content: options.content,
                embeds: options.embeds,
                components: options.components,
                files: options.files,
                allowedMentions: options.allowedMentions,
            };
            await interaction.editReply(editOptions);
            return true;
        }
        else {
            // Not replied or deferred, use reply
            await interaction.reply(options);
            return true;
        }
    }
    catch (error) {
        // Log specific Discord API errors
        const err = error;
        if (err.code === 10062) {
            logger.warn('Interaction token expired (Unknown interaction)', {
                interactionId: interaction.id,
                commandName: interaction.isCommand() ? interaction.commandName : 'button',
            });
        }
        else if (err.code === 40060) {
            logger.warn('Interaction already acknowledged', {
                interactionId: interaction.id,
                commandName: interaction.isCommand() ? interaction.commandName : 'button',
            });
        }
        else {
            logger.error('Failed to respond to interaction', {
                error: err,
                interactionId: interaction.id,
                interactionState: {
                    replied: interaction.replied,
                    deferred: interaction.deferred,
                },
            });
        }
        return false;
    }
}
/**
 * Safely edit a reply with proper error handling
 */
export async function safeEditReply(interaction, options) {
    try {
        if (!interaction.deferred && !interaction.replied) {
            logger.warn('Cannot edit reply - interaction not deferred or replied', {
                interactionId: interaction.id,
            });
            return false;
        }
        await interaction.editReply(options);
        return true;
    }
    catch (error) {
        const err = error;
        if (err.code === 10062) {
            logger.warn('Interaction token expired (Unknown interaction)', {
                interactionId: interaction.id,
            });
        }
        else {
            logger.error('Failed to edit interaction reply', {
                error: err,
                interactionId: interaction.id,
            });
        }
        return false;
    }
}
/**
 * Safely defer a reply with proper error handling
 */
export async function safeDeferReply(interaction, options) {
    try {
        if (interaction.deferred || interaction.replied) {
            logger.warn('Cannot defer - interaction already deferred or replied', {
                interactionId: interaction.id,
                deferred: interaction.deferred,
                replied: interaction.replied,
            });
            return false;
        }
        await interaction.deferReply(options);
        return true;
    }
    catch (error) {
        const err = error;
        if (err.code === 10062) {
            logger.warn('Interaction token expired before defer (Unknown interaction)', {
                interactionId: interaction.id,
            });
        }
        else if (err.code === 40060) {
            logger.warn('Interaction already acknowledged before defer', {
                interactionId: interaction.id,
            });
        }
        else {
            logger.error('Failed to defer interaction reply', {
                error: err,
                interactionId: interaction.id,
            });
        }
        return false;
    }
}
/**
 * Safely update an interaction (for button interactions)
 */
export async function safeUpdate(interaction, options) {
    try {
        await interaction.update(options);
        return true;
    }
    catch (error) {
        const err = error;
        if (err.code === 10062) {
            logger.warn('Interaction token expired (Unknown interaction)', {
                interactionId: interaction.id,
            });
        }
        else if (err.code === 40060) {
            logger.warn('Interaction already acknowledged', {
                interactionId: interaction.id,
            });
        }
        else {
            logger.error('Failed to update interaction', {
                error: err,
                interactionId: interaction.id,
            });
        }
        return false;
    }
}
//# sourceMappingURL=interaction-response.js.map