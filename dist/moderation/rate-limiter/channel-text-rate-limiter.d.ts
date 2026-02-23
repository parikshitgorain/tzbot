import { Message } from 'discord.js';
import { RateLimiterConfig, RateLimiterDependencies } from './types.js';
/**
 * Main orchestrator for channel text rate limiting
 */
export declare class ChannelTextRateLimiter {
    private config;
    private classifier;
    private enforcer;
    private actionHandler;
    private cleanupTimer;
    private initialized;
    /**
     * Initialize the rate limiter with configuration and dependencies
     */
    initialize(config: RateLimiterConfig, dependencies: RateLimiterDependencies): Promise<void>;
    /**
     * Handle incoming Discord message event
     * Returns true if message should be allowed, false if it was handled/deleted
     */
    handleMessage(message: Message): Promise<boolean>;
    /**
     * Clean up expired state data
     */
    cleanupExpiredState(): Promise<void>;
    /**
     * Reload configuration without restarting the bot
     * Updates the restricted channels map dynamically
     */
    reloadConfig(newRestrictedChannels: Map<string, string>): Promise<void>;
    /**
     * Get current configuration
     */
    getConfig(): RateLimiterConfig;
    /**
     * Shutdown and cleanup resources
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=channel-text-rate-limiter.d.ts.map