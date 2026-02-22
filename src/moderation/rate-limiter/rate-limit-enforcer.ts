import { StateStore, RateLimitViolation, RateLimiterConfig } from './types.js';

/**
 * Manages rate limit state and determines if messages violate limits
 */
export class RateLimitEnforcer {
  private stateStore: StateStore;
  private config: RateLimiterConfig;

  constructor(stateStore: StateStore, config: RateLimiterConfig) {
    this.stateStore = stateStore;
    this.config = config;
  }

  /**
   * Check if user has exceeded rate limit in channel
   * Returns violation info if limit exceeded, null otherwise
   */
  async checkRateLimit(
    userId: string,
    channelId: string,
    timestamp: number,
  ): Promise<RateLimitViolation | null> {
    const lastMessageTime = await this.stateStore.getLastMessageTime(userId, channelId);

    // First message in channel - no violation
    if (lastMessageTime === null) {
      return null;
    }

    const timeSinceLastMessage = timestamp - lastMessageTime;

    // Check if within rate limit window
    if (timeSinceLastMessage < this.config.rateLimitWindowMs) {
      return {
        userId,
        channelId,
        lastMessageTime,
        currentTime: timestamp,
        timeSinceLastMessage,
      };
    }

    return null;
  }

  /**
   * Record a message timestamp for a user in a channel
   */
  async recordMessage(
    userId: string,
    channelId: string,
    timestamp: number,
  ): Promise<void> {
    await this.stateStore.setLastMessageTime(userId, channelId, timestamp);
  }

  /**
   * Check if user is in violation window for a channel
   */
  async isInViolationWindow(
    userId: string,
    channelId: string,
    timestamp: number,
  ): Promise<boolean> {
    const expiryTime = await this.stateStore.getViolationExpiry(userId, channelId);

    if (expiryTime === null) {
      return false;
    }

    return timestamp < expiryTime;
  }

  /**
   * Enter user into violation window for a channel
   */
  async enterViolationWindow(
    userId: string,
    channelId: string,
    timestamp: number,
    durationMs: number,
  ): Promise<void> {
    const expiryTime = timestamp + durationMs;
    await this.stateStore.setViolationExpiry(userId, channelId, expiryTime);
  }

  /**
   * Remove expired timestamps and violation windows
   */
  async cleanupExpired(currentTime: number): Promise<void> {
    await this.stateStore.removeExpired(currentTime);
  }
}
