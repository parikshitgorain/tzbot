import { Message, TextChannel } from 'discord.js';
import { RateLimiterConfig, RateLimiterDependencies } from './types.js';
import { MessageClassifier } from './message-classifier.js';
import { RateLimitEnforcer } from './rate-limit-enforcer.js';
import { MessageActionHandler } from './message-action-handler.js';

/**
 * Main orchestrator for channel text rate limiting
 */
export class ChannelTextRateLimiter {
  private config!: RateLimiterConfig;
  private classifier!: MessageClassifier;
  private enforcer!: RateLimitEnforcer;
  private actionHandler!: MessageActionHandler;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private initialized = false;

  /**
   * Initialize the rate limiter with configuration and dependencies
   */
  async initialize(config: RateLimiterConfig, dependencies: RateLimiterDependencies): Promise<void> {
    this.config = config;
    this.classifier = new MessageClassifier();
    this.enforcer = new RateLimitEnforcer(dependencies.stateStore, config);
    this.actionHandler = new MessageActionHandler(
      dependencies.logger,
      config.warningDeleteDelayMs
    );

    // Start periodic cleanup
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredState().catch((error) => {
        dependencies.logger.error('Failed to cleanup expired state', { error });
      });
    }, config.cleanupIntervalMs);

    this.initialized = true;
    dependencies.logger.info('Channel text rate limiter initialized', {
      restrictedChannels: Array.from(config.restrictedChannels.keys()),
      rateLimitWindowMs: config.rateLimitWindowMs,
      violationWindowMs: config.violationWindowMs,
    });
  }

  /**
   * Handle incoming Discord message event
   * Returns true if message should be allowed, false if it was handled/deleted
   */
  async handleMessage(message: Message): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('ChannelTextRateLimiter not initialized');
    }

    // Step 1: Ignore bot messages
    if (this.classifier.isBotMessage(message)) {
      return true;
    }

    // Step 2: Check if channel is restricted
    if (!this.classifier.isRestrictedChannel(message.channelId, this.config)) {
      return true;
    }

    // Step 3: Check if message is media (unlimited)
    if (this.classifier.isMediaMessage(message)) {
      return true;
    }

    // Step 4: It's a text message in a restricted channel - apply rate limiting
    const timestamp = Date.now();
    const userId = message.author.id;
    const channelId = message.channelId;

    // Step 5: Check if user is in violation window
    const inViolationWindow = await this.enforcer.isInViolationWindow(userId, channelId, timestamp);
    
    if (inViolationWindow) {
      // Silent deletion during violation window
      await this.actionHandler.deleteSilently(message);
      return false;
    }

    // Step 6: Check rate limit
    const violation = await this.enforcer.checkRateLimit(userId, channelId, timestamp);

    if (violation) {
      // Rate limit exceeded - delete message and send warning
      await this.actionHandler.deleteMessage(message);

      // Send warning with redirect channel
      const redirectChannelId = this.classifier.getRedirectChannel(channelId, this.config);
      if (redirectChannelId && message.channel instanceof TextChannel) {
        const channelName = `#${message.channel.name}`;
        await this.actionHandler.sendWarning(
          message.channel,
          userId,
          channelName,
          redirectChannelId
        );
      }

      // Enter user into violation window
      await this.enforcer.enterViolationWindow(
        userId,
        channelId,
        timestamp,
        this.config.violationWindowMs
      );

      return false;
    }

    // Step 7: Allow message and record timestamp
    await this.enforcer.recordMessage(userId, channelId, timestamp);
    return true;
  }

  /**
   * Clean up expired state data
   */
  async cleanupExpiredState(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    const currentTime = Date.now();
    await this.enforcer.cleanupExpired(currentTime);
  }

  /**
   * Reload configuration without restarting the bot
   * Updates the restricted channels map dynamically
   */
  async reloadConfig(newRestrictedChannels: Map<string, string>): Promise<void> {
    if (!this.initialized) {
      throw new Error('ChannelTextRateLimiter not initialized');
    }

    // Update the restricted channels configuration
    this.config.restrictedChannels = newRestrictedChannels;

    // Note: We don't need to reinitialize other components as they reference this.config
    // The classifier will use the updated config on the next message check
  }

  /**
   * Get current configuration
   */
  getConfig(): RateLimiterConfig {
    return this.config;
  }

  /**
   * Shutdown and cleanup resources
   */
  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.initialized = false;
  }
}
