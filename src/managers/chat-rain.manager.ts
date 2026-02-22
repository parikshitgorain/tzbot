import { randomBytes } from 'crypto';
import type { ChatActivityRepository } from '../core/database/repositories/ChatActivityRepository.js';
import type { ViolationRepository } from '../core/database/repositories/ViolationRepository.js';
import type { RewardSystem, Reward } from './reward-system.js';
import { ViolationType } from '../types/models.js';

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
export class ChatRainManager {
  private lastChatRainTime: Date | null = null;

  constructor(
    private chatActivityRepo: ChatActivityRepository,
    private violationRepo: ViolationRepository,
    private rewardSystem: RewardSystem,
    private config: ChatRainConfig
  ) {}

  /**
   * Execute a chat rain event
   * Selects eligible active chatters, distributes rewards, and announces winners
   * 
   * @param channelId Channel to announce winners in
   * @returns Array of winner user IDs, or null if event cannot proceed
   * 
   * Validates: Requirements 11.7
   */
  async executeChatRain(channelId: string): Promise<string[] | null> {
    // Check minimum delay between events (5 minutes)
    if (!this.canExecuteChatRain()) {
      return null;
    }

    // Get eligible recipients
    const eligibleUsers = await this.getEligibleRecipients();

    if (eligibleUsers.length === 0) {
      return null;
    }

    // Select random recipients (3-10 users)
    const recipientCount = this.selectRecipientCount(eligibleUsers.length);
    const winners = this.selectRandomRecipients(eligibleUsers, recipientCount);

    // Distribute rewards and announce winners
    const reward = this.buildReward();
    await this.rewardSystem.distributeRewards(winners, reward, channelId);

    // Update last chat rain time
    this.lastChatRainTime = new Date();

    return winners;
  }

  /**
   * Check if chat rain can be executed
   * Enforces minimum 5-minute delay between events
   * 
   * Validates: Requirement 11.5
   */
  private canExecuteChatRain(): boolean {
    if (!this.lastChatRainTime) {
      return true;
    }

    const minDelayMs = this.config.minDelayMinutes * 60 * 1000;
    const timeSinceLastRain = Date.now() - this.lastChatRainTime.getTime();

    return timeSinceLastRain >= minDelayMs;
  }

  /**
   * Get eligible recipients for chat rain
   * Filters out:
   * - Users without minimum message count (3+ messages in 10 minutes)
   * - Spam-flagged users (violations in last 24 hours)
   * - Recent winners (won in last 60 minutes)
   * 
   * Validates: Requirements 11.1, 11.4, 11.8
   */
  private async getEligibleRecipients(): Promise<string[]> {
    // Get active chatters (3+ messages in last 10 minutes)
    const activeWindow = new Date(Date.now() - this.config.activeWindowMinutes * 60 * 1000);
    const activeChatters = await this.chatActivityRepo.getQualifiedChatters(
      activeWindow,
      this.config.minMessages
    );

    if (activeChatters.length === 0) {
      return [];
    }

    // Get spam-flagged users (violations in last 24 hours)
    const spamWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const spamFlaggedUsers = await this.getSpamFlaggedUsers(activeChatters, spamWindow);

    // Get recent winners (won in last 60 minutes)
    const cooldownWindow = new Date(Date.now() - this.config.cooldownMinutes * 60 * 1000);
    const recentWinners = await this.chatActivityRepo.getRecentWinners(cooldownWindow);

    // Filter out ineligible users
    const ineligibleUsers = new Set([...spamFlaggedUsers, ...recentWinners]);
    const eligibleUsers = activeChatters.filter(userId => !ineligibleUsers.has(userId));

    return eligibleUsers;
  }

  /**
   * Get users who have spam violations in the specified time window
   * 
   * Validates: Requirement 11.4
   */
  private async getSpamFlaggedUsers(userIds: string[], since: Date): Promise<string[]> {
    const spamFlaggedUsers: string[] = [];

    // Check each user for spam violations
    for (const userId of userIds) {
      const spamCount = await this.violationRepo.getCount(userId, since, ViolationType.SPAM);
      if (spamCount > 0) {
        spamFlaggedUsers.push(userId);
      }
    }

    return spamFlaggedUsers;
  }

  /**
   * Select the number of recipients for this chat rain event
   * Returns a random number between 3 and 10, capped by available users
   * 
   * Validates: Requirement 11.2
   */
  private selectRecipientCount(availableUsers: number): number {
    const min = 3;
    const max = 10;

    // Cap by available users
    const maxPossible = Math.min(max, availableUsers);
    
    if (maxPossible < min) {
      return maxPossible;
    }

    // Use CSPRNG to select count between min and maxPossible (inclusive)
    return this.secureRandomInt(min, maxPossible + 1);
  }

  /**
   * Select random recipients using CSPRNG
   * Implements Fisher-Yates shuffle with cryptographically secure randomness
   * 
   * Validates: Requirement 11.3
   */
  private selectRandomRecipients(users: string[], count: number): string[] {
    if (count >= users.length) {
      return [...users];
    }

    const available = [...users];
    const winners: string[] = [];

    for (let i = 0; i < count; i++) {
      const randomIndex = this.secureRandomInt(0, available.length);
      winners.push(available[randomIndex]);
      available.splice(randomIndex, 1);
    }

    return winners;
  }

  /**
   * Record chat rain winners in the database
   * @internal Reserved for future use
   */
  // @ts-expect-error - Reserved for future use
  private async recordWinners(winners: string[], timestamp: Date): Promise<void> {
    for (const userId of winners) {
      await this.chatActivityRepo.recordWinner(
        userId,
        timestamp,
        this.config.rewardType,
        this.config.rewardValue
      );
    }
  }

  /**
   * Build reward configuration from config
   */
  private buildReward(): Reward {
    return {
      type: this.config.rewardType,
      value: this.config.rewardValue,
      durationMs: this.config.rewardDurationMs,
      customMessage: this.config.customMessage
    };
  }

  /**
   * Generate cryptographically secure random integer in range [min, max)
   * Uses rejection sampling to ensure uniform distribution
   * 
   * Validates: Requirement 11.3 (CSPRNG usage)
   */
  private secureRandomInt(min: number, max: number): number {
    const range = max - min;
    const bytesNeeded = Math.ceil(Math.log2(range) / 8);
    const maxValue = Math.pow(256, bytesNeeded);
    const threshold = maxValue - (maxValue % range);

    let randomValue: number;
    do {
      const randomBytesBuffer = randomBytes(bytesNeeded);
      randomValue = 0;
      for (let i = 0; i < bytesNeeded; i++) {
        randomValue = randomValue * 256 + randomBytesBuffer[i];
      }
    } while (randomValue >= threshold);

    return min + (randomValue % range);
  }

  /**
   * Initialize the manager by loading the last chat rain time from database
   */
  async initialize(): Promise<void> {
    this.lastChatRainTime = await this.chatActivityRepo.getLastChatRainTime();
  }

  /**
   * Get the time until the next chat rain can be executed
   * Returns milliseconds, or 0 if chat rain can be executed now
   */
  getTimeUntilNextChatRain(): number {
    if (!this.lastChatRainTime) {
      return 0;
    }

    const minDelayMs = this.config.minDelayMinutes * 60 * 1000;
    const timeSinceLastRain = Date.now() - this.lastChatRainTime.getTime();
    const timeRemaining = minDelayMs - timeSinceLastRain;

    return Math.max(0, timeRemaining);
  }
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
  rewardType: any;
  
  /** Value of reward (role ID, currency amount, etc.) */
  rewardValue?: string;
  
  /** Duration for temporary rewards in milliseconds */
  rewardDurationMs?: number;
  
  /** Custom message to include in announcement */
  customMessage?: string;
}
