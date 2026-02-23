import { Message } from 'discord.js';
import { RateLimiterConfig } from './types.js';
/**
 * Classifies messages and determines if rate limiting applies
 */
export declare class MessageClassifier {
    /**
     * Check if message is from a bot
     */
    isBotMessage(message: Message): boolean;
    /**
     * Check if message contains media (attachments or media embeds)
     */
    isMediaMessage(message: Message): boolean;
    /**
     * Check if channel is restricted
     */
    isRestrictedChannel(channelId: string, config: RateLimiterConfig): boolean;
    /**
     * Get redirect channel for a restricted channel
     */
    getRedirectChannel(channelId: string, config: RateLimiterConfig): string | null;
}
//# sourceMappingURL=message-classifier.d.ts.map