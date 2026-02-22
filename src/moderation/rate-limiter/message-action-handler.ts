import { Message, TextChannel } from 'discord.js';
import { logger } from '../../core/logger/logger.js';

/**
 * Executes actions like message deletion and warning delivery
 */
export class MessageActionHandler {
  private logger: typeof logger;
  private warningDeleteDelayMs: number;

  constructor(loggerInstance: typeof logger, warningDeleteDelayMs: number) {
    this.logger = loggerInstance;
    this.warningDeleteDelayMs = warningDeleteDelayMs;
  }

  /**
   * Delete a message from Discord
   */
  async deleteMessage(message: Message): Promise<boolean> {
    try {
      await message.delete();
      return true;
    } catch (error) {
      // Log error but don't throw - continue operation
      if (error instanceof Error) {
        if (error.message.includes('Missing Permissions')) {
          this.logger.error('Failed to delete message: Missing Permissions', {
            messageId: message.id,
            channelId: message.channelId,
          });
        } else if (error.message.includes('Unknown Message')) {
          this.logger.warn('Failed to delete message: Already deleted', {
            messageId: message.id,
            channelId: message.channelId,
          });
        } else {
          this.logger.error('Failed to delete message', {
            error: error.message,
            messageId: message.id,
            channelId: message.channelId,
          });
        }
      }
      return false;
    }
  }

  /**
   * Send warning message and schedule its deletion
   */
  async sendWarning(
    channel: TextChannel,
    userId: string,
    channelName: string,
    redirectChannelId: string
  ): Promise<void> {
    try {
      const warningMessage = `Hey <@${userId}> looks like you are chatting in ${channelName}. Kindly go <#${redirectChannelId}> for chatting. I'm deleting the message to keep the channel clean.`;
      
      const sentMessage = await channel.send(warningMessage);

      // Schedule deletion after delay
      setTimeout(async () => {
        try {
          await sentMessage.delete();
        } catch (error) {
          this.logger.warn('Failed to delete warning message', {
            error: error instanceof Error ? error.message : String(error),
            messageId: sentMessage.id,
          });
        }
      }, this.warningDeleteDelayMs);

      this.logger.info('Rate limit warning sent', {
        userId,
        channelId: channel.id,
        channelName,
        redirectChannelId,
      });
    } catch (error) {
      this.logger.error('Failed to send warning message', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        channelId: channel.id,
      });
    }
  }

  /**
   * Delete a message silently (during violation window)
   */
  async deleteSilently(message: Message): Promise<void> {
    const deleted = await this.deleteMessage(message);
    
    if (deleted) {
      this.logger.debug('Message deleted silently during violation window', {
        userId: message.author.id,
        channelId: message.channelId,
        messageId: message.id,
      });
    }
  }
}
