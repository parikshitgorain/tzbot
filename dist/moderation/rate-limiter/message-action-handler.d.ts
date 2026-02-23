import { Message, TextChannel } from 'discord.js';
import { logger } from '../../core/logger/logger.js';
/**
 * Executes actions like message deletion and warning delivery
 */
export declare class MessageActionHandler {
    private logger;
    private warningDeleteDelayMs;
    constructor(loggerInstance: typeof logger, warningDeleteDelayMs: number);
    /**
     * Delete a message from Discord
     */
    deleteMessage(message: Message): Promise<boolean>;
    /**
     * Send warning message and schedule its deletion
     */
    sendWarning(channel: TextChannel, userId: string, channelName: string, redirectChannelId: string): Promise<void>;
    /**
     * Delete a message silently (during violation window)
     */
    deleteSilently(message: Message): Promise<void>;
}
//# sourceMappingURL=message-action-handler.d.ts.map