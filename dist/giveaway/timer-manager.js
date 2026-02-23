/**
 * TimerManager manages reminder and expiry timers for winner confirmation
 * Handles timer scheduling, cancellation, and restoration on system restart
 *
 * Requirements: 1.3, 2.3, 4.5, 9.1, 9.2, 9.3
 */
import { logError } from '../core/logger/logger.js';
/**
 * TimerManager class manages winner confirmation timers
 */
export class TimerManager {
    callbacks;
    timers = new Map();
    REMINDER_DELAY_MS = 2 * 60 * 1000; // 2 minutes
    EXPIRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes
    constructor(callbacks) {
        this.callbacks = callbacks;
    }
    /**
     * Start timers for a winner
     * Schedules reminder callback at 2 minutes and expiry callback at 5 minutes
     *
     * @param giveawayId - The giveaway ID
     * @param userId - The user ID
     * @param startTime - The time when the timer started (for restart recovery)
     *
     * Requirements: 1.3, 4.5, 9.1, 9.2
     */
    startTimers(giveawayId, userId, startTime) {
        const key = this.getTimerKey(giveawayId, userId);
        // Stop any existing timers for this winner
        this.stopTimers(giveawayId, userId);
        // Calculate elapsed time since start
        const now = Date.now();
        const elapsed = now - startTime.getTime();
        const timerRefs = {};
        // Schedule reminder timer if not yet elapsed
        if (elapsed < this.REMINDER_DELAY_MS) {
            const reminderDelay = this.REMINDER_DELAY_MS - elapsed;
            timerRefs.reminderTimer = setTimeout(() => {
                this.handleReminderCallback(giveawayId, userId);
            }, reminderDelay);
        }
        // Schedule expiry timer if not yet elapsed
        if (elapsed < this.EXPIRY_DELAY_MS) {
            const expiryDelay = this.EXPIRY_DELAY_MS - elapsed;
            timerRefs.expiryTimer = setTimeout(() => {
                this.handleExpiryCallback(giveawayId, userId);
            }, expiryDelay);
        }
        else {
            // Timer already expired - trigger immediately
            setImmediate(() => {
                this.handleExpiryCallback(giveawayId, userId);
            });
        }
        // Store timer references
        this.timers.set(key, timerRefs);
    }
    /**
     * Stop all timers for a winner
     * Cancels pending reminder and expiry callbacks
     *
     * @param giveawayId - The giveaway ID
     * @param userId - The user ID
     *
     * Requirements: 2.3, 9.3
     */
    stopTimers(giveawayId, userId) {
        const key = this.getTimerKey(giveawayId, userId);
        const timerRefs = this.timers.get(key);
        if (timerRefs) {
            // Clear reminder timer if exists
            if (timerRefs.reminderTimer) {
                clearTimeout(timerRefs.reminderTimer);
            }
            // Clear expiry timer if exists
            if (timerRefs.expiryTimer) {
                clearTimeout(timerRefs.expiryTimer);
            }
            // Remove from map
            this.timers.delete(key);
        }
    }
    /**
     * Restore timers from database on system restart
     * Loads pending winners and recalculates remaining time for each timer
     *
     * @param activeWinners - Array of pending winner records with active timers
     *
     * Requirements: 9.4, 10.4, 10.5
     */
    restoreTimers(activeWinners) {
        for (const winner of activeWinners) {
            // Use startTimers which already handles elapsed time calculation
            this.startTimers(winner.giveawayId, winner.userId, winner.timerStartTime);
        }
    }
    /**
     * Check if timers exist for a winner
     *
     * @param giveawayId - The giveaway ID
     * @param userId - The user ID
     * @returns True if active timers exist
     */
    hasActiveTimers(giveawayId, userId) {
        const key = this.getTimerKey(giveawayId, userId);
        return this.timers.has(key);
    }
    /**
     * Get the timer key for a winner
     * Format: ${giveawayId}:${userId}
     */
    getTimerKey(giveawayId, userId) {
        return `${giveawayId}:${userId}`;
    }
    /**
     * Handle reminder callback
     * Wraps the callback to handle errors and cleanup
     */
    async handleReminderCallback(giveawayId, userId) {
        try {
            await this.callbacks.onReminder(giveawayId, userId);
        }
        catch (error) {
            logError(`Error in reminder callback for ${giveawayId}:${userId}`, error);
        }
    }
    /**
     * Handle expiry callback
     * Wraps the callback to handle errors and cleanup
     */
    async handleExpiryCallback(giveawayId, userId) {
        try {
            await this.callbacks.onExpiry(giveawayId, userId);
        }
        catch (error) {
            logError(`Error in expiry callback for ${giveawayId}:${userId}`, error);
        }
        finally {
            // Clean up timer references after expiry
            const key = this.getTimerKey(giveawayId, userId);
            this.timers.delete(key);
        }
    }
}
//# sourceMappingURL=timer-manager.js.map