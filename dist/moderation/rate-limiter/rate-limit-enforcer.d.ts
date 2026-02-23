import { StateStore, RateLimitViolation, RateLimiterConfig } from './types.js';
/**
 * Manages rate limit state and determines if messages violate limits
 */
export declare class RateLimitEnforcer {
    private stateStore;
    private config;
    constructor(stateStore: StateStore, config: RateLimiterConfig);
    /**
     * Check if user has exceeded rate limit in channel
     * Returns violation info if limit exceeded, null otherwise
     */
    checkRateLimit(userId: string, channelId: string, timestamp: number): Promise<RateLimitViolation | null>;
    /**
     * Record a message timestamp for a user in a channel
     */
    recordMessage(userId: string, channelId: string, timestamp: number): Promise<void>;
    /**
     * Check if user is in violation window for a channel
     */
    isInViolationWindow(userId: string, channelId: string, timestamp: number): Promise<boolean>;
    /**
     * Enter user into violation window for a channel
     */
    enterViolationWindow(userId: string, channelId: string, timestamp: number, durationMs: number): Promise<void>;
    /**
     * Remove expired timestamps and violation windows
     */
    cleanupExpired(currentTime: number): Promise<void>;
}
//# sourceMappingURL=rate-limit-enforcer.d.ts.map