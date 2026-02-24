/**
 * @file spam-detector.ts
 * @description Spam detection system for TZBOT
 * @module moderation
 */
/**
 * Default spam detection thresholds
 * - 5+ identical messages within 10 seconds = spam
 * - 10+ messages within 5 seconds = spam
 */
export const DEFAULT_SPAM_THRESHOLDS = {
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
    userHistory;
    thresholds;
    constructor(thresholds = DEFAULT_SPAM_THRESHOLDS) {
        this.userHistory = new Map();
        this.thresholds = thresholds;
    }
    /**
     * Check if a message is spam
     * @param userId - Discord user ID
     * @param messageId - Discord message ID
     * @param messageContent - Message content to check
     * @param timestamp - Message timestamp (defaults to now)
     * @returns SpamResult with detection details
     */
    checkSpam(userId, messageId, messageContent, timestamp = new Date()) {
        // Get or create user history
        let history = this.userHistory.get(userId);
        if (!history) {
            history = { messages: [] };
            this.userHistory.set(userId, history);
        }
        // Add current message to history
        history.messages.push({
            messageId,
            content: messageContent,
            timestamp,
        });
        // Clean up old messages outside all detection windows
        const maxWindow = Math.max(this.thresholds.identicalWindow, this.thresholds.rapidWindow);
        this.cleanupOldMessages(history, timestamp, maxWindow);
        // Check for identical message spam
        const identicalSpam = this.checkIdenticalMessages(history, messageContent, timestamp);
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
    checkIdenticalMessages(history, messageContent, timestamp) {
        const windowStart = new Date(timestamp.getTime() - this.thresholds.identicalWindow * 1000);
        // Get all identical messages within the window
        const identicalMessages = history.messages.filter((msg) => msg.content === messageContent &&
            msg.timestamp >= windowStart &&
            msg.timestamp <= timestamp);
        if (identicalMessages.length >= this.thresholds.identicalMessages) {
            return {
                isSpam: true,
                reason: `${identicalMessages.length} identical messages within ${this.thresholds.identicalWindow} seconds`,
                violationType: 'spam',
                messageIds: identicalMessages.map(msg => msg.messageId),
            };
        }
        return { isSpam: false };
    }
    /**
     * Check for rapid message spam
     * Requirements 4.5: 10+ messages within 5 seconds
     */
    checkRapidMessages(history, timestamp) {
        const windowStart = new Date(timestamp.getTime() - this.thresholds.rapidWindow * 1000);
        // Get all messages within the window
        const rapidMessages = history.messages.filter((msg) => msg.timestamp >= windowStart && msg.timestamp <= timestamp);
        if (rapidMessages.length >= this.thresholds.rapidMessages) {
            return {
                isSpam: true,
                reason: `${rapidMessages.length} messages within ${this.thresholds.rapidWindow} seconds`,
                violationType: 'spam',
                messageIds: rapidMessages.map(msg => msg.messageId),
            };
        }
        return { isSpam: false };
    }
    /**
     * Clean up old messages outside the detection window
     */
    cleanupOldMessages(history, currentTime, maxWindowSeconds) {
        const cutoffTime = new Date(currentTime.getTime() - maxWindowSeconds * 1000);
        history.messages = history.messages.filter((msg) => msg.timestamp >= cutoffTime);
    }
    /**
     * Clear history for a specific user
     * Useful for testing or manual resets
     */
    clearUserHistory(userId) {
        this.userHistory.delete(userId);
    }
    /**
     * Set spam cooldown for a user (1 minute)
     * During cooldown, ALL messages from this user should be deleted
     */
    setSpamCooldown(userId) {
        let history = this.userHistory.get(userId);
        if (!history) {
            history = { messages: [] };
            this.userHistory.set(userId, history);
        }
        // Set cooldown for 1 minute from now
        history.spamCooldownUntil = new Date(Date.now() + 60000); // 60 seconds
        history.totalSpamMessages = 0;
    }
    /**
     * Check if a user is in spam cooldown
     * Returns true if the user should have ALL their messages deleted
     */
    isInSpamCooldown(userId) {
        const history = this.userHistory.get(userId);
        if (!history || !history.spamCooldownUntil) {
            return false;
        }
        // Check if cooldown has expired
        if (new Date() > history.spamCooldownUntil) {
            // Cooldown expired, clear it
            history.spamCooldownUntil = undefined;
            return false;
        }
        return true;
    }
    /**
     * Increment spam message count during cooldown
     */
    incrementSpamCount(userId) {
        const history = this.userHistory.get(userId);
        if (history) {
            history.totalSpamMessages = (history.totalSpamMessages || 0) + 1;
            return history.totalSpamMessages;
        }
        return 0;
    }
    /**
     * Get total spam messages during cooldown
     */
    getSpamCount(userId) {
        const history = this.userHistory.get(userId);
        return history?.totalSpamMessages || 0;
    }
    /**
     * Clear all user histories
     * Useful for testing
     */
    clearAllHistory() {
        this.userHistory.clear();
    }
    /**
     * Get current message count for a user within a time window
     * Useful for monitoring and debugging
     * @param userId - User ID to check
     * @param windowSeconds - Time window in seconds
     * @param referenceTime - Reference time (defaults to now)
     */
    getUserMessageCount(userId, windowSeconds, referenceTime = new Date()) {
        const history = this.userHistory.get(userId);
        if (!history) {
            return 0;
        }
        const windowStart = new Date(referenceTime.getTime() - windowSeconds * 1000);
        return history.messages.filter((msg) => msg.timestamp >= windowStart && msg.timestamp <= referenceTime).length;
    }
}
//# sourceMappingURL=spam-detector.js.map