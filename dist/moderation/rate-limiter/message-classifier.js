/**
 * Classifies messages and determines if rate limiting applies
 */
export class MessageClassifier {
    /**
     * Check if message is from a bot
     */
    isBotMessage(message) {
        return message.author.bot;
    }
    /**
     * Check if message contains media (attachments or media embeds)
     */
    isMediaMessage(message) {
        // Check for attachments
        if (message.attachments.size > 0) {
            return true;
        }
        // Check for media embeds (images, videos, etc.)
        if (message.embeds.length > 0) {
            for (const embed of message.embeds) {
                // Check if embed has image, video, or thumbnail
                if (embed.image || embed.video || embed.thumbnail) {
                    return true;
                }
            }
        }
        return false;
    }
    /**
     * Check if channel is restricted
     */
    isRestrictedChannel(channelId, config) {
        return config.restrictedChannels.has(channelId);
    }
    /**
     * Get redirect channel for a restricted channel
     */
    getRedirectChannel(channelId, config) {
        return config.restrictedChannels.get(channelId) ?? null;
    }
}
//# sourceMappingURL=message-classifier.js.map