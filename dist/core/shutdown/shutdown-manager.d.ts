/**
 * Graceful Shutdown Manager
 *
 * Handles clean shutdown of the bot by:
 * - Registering cleanup functions for all components
 * - Handling SIGTERM and SIGINT signals
 * - Waiting for in-flight operations (max 30s)
 * - Closing all connections cleanly
 *
 * Validates: Requirements 14.2
 */
import type winston from 'winston';
export interface ShutdownManager {
    /**
     * Register a cleanup function to be called during shutdown
     * @param name - Descriptive name for the cleanup function
     * @param fn - Async cleanup function
     */
    registerCleanup(name: string, fn: () => Promise<void>): void;
    /**
     * Initiate graceful shutdown
     * @param signal - The signal that triggered shutdown (optional)
     */
    shutdown(signal?: string): Promise<void>;
    /**
     * Check if shutdown is in progress
     */
    isShuttingDown(): boolean;
    /**
     * Register an in-flight operation
     * @returns A function to mark the operation as complete
     */
    trackOperation(): () => void;
    /**
     * Check if there are in-flight operations
     */
    hasInflightOperations(): boolean;
}
export declare class GracefulShutdownManager implements ShutdownManager {
    private cleanupFunctions;
    private shuttingDown;
    private inflightOperations;
    private logger;
    private shutdownTimeout;
    constructor(logger: winston.Logger, shutdownTimeout?: number);
    registerCleanup(name: string, fn: () => Promise<void>): void;
    isShuttingDown(): boolean;
    trackOperation(): () => void;
    hasInflightOperations(): boolean;
    shutdown(signal?: string): Promise<void>;
    private waitForInflightOperations;
    private runCleanupFunctions;
    private sleep;
    /**
     * Setup signal handlers for graceful shutdown
     */
    setupSignalHandlers(): void;
}
//# sourceMappingURL=shutdown-manager.d.ts.map