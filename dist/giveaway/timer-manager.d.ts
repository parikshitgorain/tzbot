/**
 * TimerManager manages reminder and expiry timers for winner confirmation
 * Handles timer scheduling, cancellation, and restoration on system restart
 *
 * Requirements: 1.3, 2.3, 4.5, 9.1, 9.2, 9.3
 */
/**
 * Callback functions for timer events
 */
export interface TimerCallbacks {
    onReminder: (giveawayId: string, userId: string) => Promise<void>;
    onExpiry: (giveawayId: string, userId: string) => Promise<void>;
}
/**
 * TimerManager class manages winner confirmation timers
 */
export declare class TimerManager {
    private callbacks;
    private timers;
    private readonly REMINDER_DELAY_MS;
    private readonly EXPIRY_DELAY_MS;
    constructor(callbacks: TimerCallbacks);
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
    startTimers(giveawayId: string, userId: string, startTime: Date): void;
    /**
     * Stop all timers for a winner
     * Cancels pending reminder and expiry callbacks
     *
     * @param giveawayId - The giveaway ID
     * @param userId - The user ID
     *
     * Requirements: 2.3, 9.3
     */
    stopTimers(giveawayId: string, userId: string): void;
    /**
     * Restore timers from database on system restart
     * Loads pending winners and recalculates remaining time for each timer
     *
     * @param activeWinners - Array of pending winner records with active timers
     *
     * Requirements: 9.4, 10.4, 10.5
     */
    restoreTimers(activeWinners: Array<{
        giveawayId: string;
        userId: string;
        timerStartTime: Date;
    }>): void;
    /**
     * Check if timers exist for a winner
     *
     * @param giveawayId - The giveaway ID
     * @param userId - The user ID
     * @returns True if active timers exist
     */
    hasActiveTimers(giveawayId: string, userId: string): boolean;
    /**
     * Get the timer key for a winner
     * Format: ${giveawayId}:${userId}
     */
    private getTimerKey;
    /**
     * Handle reminder callback
     * Wraps the callback to handle errors and cleanup
     */
    private handleReminderCallback;
    /**
     * Handle expiry callback
     * Wraps the callback to handle errors and cleanup
     */
    private handleExpiryCallback;
}
//# sourceMappingURL=timer-manager.d.ts.map