/**
 * @file spam-detector.ts
 * @description Spam detection system for TZBOT
 * @module moderation
 */

import type { SpamResult, ViolationType } from '../types/index.js';

interface MessageRecord {
  content: string;
  timestamp: Date;
}

interface UserMessageHistory {
  messages: MessageRecord[];
}

/**
 * Spam detection thresholds from Requirements 4.5
 */
export interface SpamThresholds {
  /** Number of identical messages to trigger spam detection */
  identicalMessages: number;
  /** Time window (seconds) for identical message detection */
  identicalWindow: number;
  /** Number of rapid messages to trigger spam detection */
  rapidMessages: number;
  /** Time window (seconds) for rapid message detection */
  rapidWindow: number;
}

/**
 * Default spam detection thresholds
 * - 5+ identical messages within 10 seconds = spam
 * - 10+ messages within 5 seconds = spam
 */
export const DEFAULT_SPAM_THRESHOLDS: SpamThresholds = {
  identicalMessages: 5,
  identicalWindow: 10,
  rapidMessages: 10,
  rapidWindow: 5,
};

/**
 * SpamDetector class
 * Implements spam detection algorithm for identical and rapid messages
 * Validates: Requirements 4.5
 */
export class SpamDetector {
  private userHistory: Map<string, UserMessageHistory>;
  private thresholds: SpamThresholds;

  constructor(thresholds: SpamThresholds = DEFAULT_SPAM_THRESHOLDS) {
    this.userHistory = new Map();
    this.thresholds = thresholds;
  }

  /**
   * Check if a message is spam
   * @param userId - Discord user ID
   * @param messageContent - Message content to check
   * @param timestamp - Message timestamp (defaults to now)
   * @returns SpamResult with detection details
   */
  checkSpam(
    userId: string,
    messageContent: string,
    timestamp: Date = new Date()
  ): SpamResult {
    // Get or create user history
    let history = this.userHistory.get(userId);
    if (!history) {
      history = { messages: [] };
      this.userHistory.set(userId, history);
    }

    // Add current message to history
    history.messages.push({
      content: messageContent,
      timestamp,
    });

    // Clean up old messages outside all detection windows
    const maxWindow = Math.max(
      this.thresholds.identicalWindow,
      this.thresholds.rapidWindow
    );
    this.cleanupOldMessages(history, timestamp, maxWindow);

    // Check for identical message spam
    const identicalSpam = this.checkIdenticalMessages(
      history,
      messageContent,
      timestamp
    );
    if (identicalSpam.isSpam) {
      return identicalSpam;
    }

    // Check for rapid message spam
    const rapidSpam = this.checkRapidMessages(history, timestamp);
    if (rapidSpam.isSpam) {
      return rapidSpam;
    }

    return { isSpam: false };
  }

  /**
   * Check for identical message spam
   * Requirements 4.5: 5+ identical messages within 10 seconds
   */
  private checkIdenticalMessages(
    history: UserMessageHistory,
    messageContent: string,
    timestamp: Date
  ): SpamResult {
    const windowStart = new Date(
      timestamp.getTime() - this.thresholds.identicalWindow * 1000
    );

    // Count identical messages within the window
    const identicalCount = history.messages.filter(
      (msg) =>
        msg.content === messageContent &&
        msg.timestamp >= windowStart &&
        msg.timestamp <= timestamp
    ).length;

    if (identicalCount >= this.thresholds.identicalMessages) {
      return {
        isSpam: true,
        reason: `${identicalCount} identical messages within ${this.thresholds.identicalWindow} seconds`,
        violationType: 'spam' as ViolationType,
      };
    }

    return { isSpam: false };
  }

  /**
   * Check for rapid message spam
   * Requirements 4.5: 10+ messages within 5 seconds
   */
  private checkRapidMessages(
    history: UserMessageHistory,
    timestamp: Date
  ): SpamResult {
    const windowStart = new Date(
      timestamp.getTime() - this.thresholds.rapidWindow * 1000
    );

    // Count all messages within the window
    const messageCount = history.messages.filter(
      (msg) => msg.timestamp >= windowStart && msg.timestamp <= timestamp
    ).length;

    if (messageCount >= this.thresholds.rapidMessages) {
      return {
        isSpam: true,
        reason: `${messageCount} messages within ${this.thresholds.rapidWindow} seconds`,
        violationType: 'spam' as ViolationType,
      };
    }

    return { isSpam: false };
  }

  /**
   * Clean up old messages outside the detection window
   */
  private cleanupOldMessages(
    history: UserMessageHistory,
    currentTime: Date,
    maxWindowSeconds: number
  ): void {
    const cutoffTime = new Date(currentTime.getTime() - maxWindowSeconds * 1000);
    history.messages = history.messages.filter(
      (msg) => msg.timestamp >= cutoffTime
    );
  }

  /**
   * Clear history for a specific user
   * Useful for testing or manual resets
   */
  clearUserHistory(userId: string): void {
    this.userHistory.delete(userId);
  }

  /**
   * Clear all user histories
   * Useful for testing
   */
  clearAllHistory(): void {
    this.userHistory.clear();
  }

  /**
   * Get current message count for a user within a time window
   * Useful for monitoring and debugging
   * @param userId - User ID to check
   * @param windowSeconds - Time window in seconds
   * @param referenceTime - Reference time (defaults to now)
   */
  getUserMessageCount(
    userId: string,
    windowSeconds: number,
    referenceTime: Date = new Date()
  ): number {
    const history = this.userHistory.get(userId);
    if (!history) return 0;

    const windowStart = new Date(
      referenceTime.getTime() - windowSeconds * 1000
    );

    return history.messages.filter(
      (msg) => msg.timestamp >= windowStart && msg.timestamp <= referenceTime
    ).length;
  }
}
