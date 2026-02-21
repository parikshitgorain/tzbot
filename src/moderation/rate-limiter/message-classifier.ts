import { Message } from 'discord.js';
import { RateLimiterConfig } from './types.js';

/**
 * Classifies messages and determines if rate limiting applies
 */
export class MessageClassifier {
  /**
   * Check if message is from a bot
   */
  isBotMessage(message: Message): boolean {
    return message.author.bot;
  }

  /**
   * Check if message contains media (attachments or media embeds)
   */
  isMediaMessage(message: Message): boolean {
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
  isRestrictedChannel(channelId: string, config: RateLimiterConfig): boolean {
    return config.restrictedChannels.has(channelId);
  }

  /**
   * Get redirect channel for a restricted channel
   */
  getRedirectChannel(channelId: string, config: RateLimiterConfig): string | null {
    return config.restrictedChannels.get(channelId) ?? null;
  }
}
