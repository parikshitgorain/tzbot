import type { ChatActivityRepository } from '../core/database/repositories/ChatActivityRepository.js';
import type { ViolationRepository } from '../core/database/repositories/ViolationRepository.js';
import type { RewardSystem } from './reward-system.js';
import { RewardType } from './reward-system.js';
/**
 * ChatRainManager handles automated reward distribution for active chatters
 * Implements eligibility filtering, cooldown enforcement, and CSPRNG-based selection
 *
 * Requirements:
 * - 11.2: Select 3-10 random recipients
 * - 11.3: Use CSPRNG for random selection
 * - 11.4: Exclude spam-flagged users (last 24 hours)
 * - 11.5: Enforce minimum 5-minute delay between events
 * - 11.7: Announce winners in chat
 * - 11.8: Exclude users who won in last 60 minutes
 */
export declare class ChatRainManager {
    private chatActivityRepo;
    private violationRepo;
    private rewardSystem;
    private config;
    private lastChatRainTime;
    constructor(chatActivityRepo: ChatActivityRepository, violationRepo: ViolationRepository, rewardSystem: RewardSystem, config: ChatRainConfig);
    /**
     * Execute a chat rain event
     * Selects eligible active chatters, distributes rewards, and announces winners
     *
     * @param channelId Channel to announce winners in
     * @returns Array of winner user IDs, or null if event cannot proceed
     *
     * Validates: Requirements 11.7
     */
    executeChatRain(channelId: string): Promise<string[] | null>;
    /**
     * Check if chat rain can be executed
     * Enforces minimum 5-minute delay between events
     *
     * Validates: Requirement 11.5
     */
    private canExecuteChatRain;
    /**
     * Get eligible recipients for chat rain
     * Filters out:
     * - Users without minimum message count (3+ messages in 10 minutes)
     * - Spam-flagged users (violations in last 24 hours)
     * - Recent winners (won in last 60 minutes)
     *
     * Validates: Requirements 11.1, 11.4, 11.8
     */
    private getEligibleRecipients;
    /**
     * Get users who have spam violations in the specified time window
     *
     * Validates: Requirement 11.4
     */
    private getSpamFlaggedUsers;
    /**
     * Select the number of recipients for this chat rain event
     * Returns a random number between 3 and 10, capped by available users
     *
     * Validates: Requirement 11.2
     */
    private selectRecipientCount;
    /**
     * Select random recipients using CSPRNG
     * Implements Fisher-Yates shuffle with cryptographically secure randomness
     *
     * Validates: Requirement 11.3
     */
    private selectRandomRecipients;
    /**
     * Record chat rain winners in the database
     * @internal Reserved for future use
     */
    private recordWinners;
    /**
     * Build reward configuration from config
     */
    private buildReward;
    /**
     * Generate cryptographically secure random integer in range [min, max)
     * Uses rejection sampling to ensure uniform distribution
     *
     * Validates: Requirement 11.3 (CSPRNG usage)
     */
    private secureRandomInt;
    /**
     * Initialize the manager by loading the last chat rain time from database
     */
    initialize(): Promise<void>;
    /**
     * Get the time until the next chat rain can be executed
     * Returns milliseconds, or 0 if chat rain can be executed now
     */
    getTimeUntilNextChatRain(): number;
}
/**
 * Configuration for chat rain system
 */
export interface ChatRainConfig {
    /** Minimum delay between chat rain events in minutes (default: 5) */
    minDelayMinutes: number;
    /** Time window for active chatter tracking in minutes (default: 10) */
    activeWindowMinutes: number;
    /** Minimum messages required to be considered active (default: 3) */
    minMessages: number;
    /** Cooldown period for winners in minutes (default: 60) */
    cooldownMinutes: number;
    /** Type of reward to distribute */
    rewardType: RewardType;
    /** Value of reward (role ID, currency amount, etc.) */
    rewardValue?: string;
    /** Duration for temporary rewards in milliseconds */
    rewardDurationMs?: number;
    /** Custom message to include in announcement */
    customMessage?: string;
}
//# sourceMappingURL=chat-rain.manager.d.ts.map