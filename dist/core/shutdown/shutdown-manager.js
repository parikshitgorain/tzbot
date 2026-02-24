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
export class GracefulShutdownManager {
    cleanupFunctions = [];
    shuttingDown = false;
    inflightOperations = 0;
    logger;
    shutdownTimeout;
    constructor(logger, shutdownTimeout = 30000) {
        this.logger = logger;
        this.shutdownTimeout = shutdownTimeout;
    }
    registerCleanup(name, fn) {
        if (this.shuttingDown) {
            this.logger.warn('Cannot register cleanup during shutdown', { name });
            return;
        }
        this.cleanupFunctions.push({ name, fn });
        this.logger.debug('Registered cleanup function', { name });
    }
    isShuttingDown() {
        return this.shuttingDown;
    }
    trackOperation() {
        if (this.shuttingDown) {
            throw new Error('Cannot start new operations during shutdown');
        }
        this.inflightOperations++;
        let completed = false;
        return () => {
            if (!completed) {
                this.inflightOperations--;
                completed = true;
            }
        };
    }
    hasInflightOperations() {
        return this.inflightOperations > 0;
    }
    async shutdown(signal) {
        if (this.shuttingDown) {
            this.logger.warn('Shutdown already in progress');
            return;
        }
        this.shuttingDown = true;
        this.logger.info('Initiating graceful shutdown', {
            signal,
            inflightOperations: this.inflightOperations,
            cleanupFunctions: this.cleanupFunctions.length,
        });
        try {
            // Wait for in-flight operations to complete (max 30 seconds)
            await this.waitForInflightOperations();
            // Run all cleanup functions in order
            await this.runCleanupFunctions();
            this.logger.info('Graceful shutdown complete');
            process.exit(0);
        }
        catch (error) {
            this.logger.error('Error during shutdown', { error });
            process.exit(1);
        }
    }
    async waitForInflightOperations() {
        if (this.inflightOperations === 0) {
            this.logger.debug('No in-flight operations to wait for');
            return;
        }
        this.logger.info('Waiting for in-flight operations to complete', {
            count: this.inflightOperations,
            timeout: this.shutdownTimeout,
        });
        const start = Date.now();
        const checkInterval = 100; // Check every 100ms
        while (this.inflightOperations > 0) {
            const elapsed = Date.now() - start;
            if (elapsed >= this.shutdownTimeout) {
                this.logger.warn('Shutdown timeout reached, forcing shutdown', {
                    remainingOperations: this.inflightOperations,
                    elapsed,
                });
                break;
            }
            await this.sleep(checkInterval);
        }
        const elapsed = Date.now() - start;
        this.logger.info('In-flight operations completed', {
            elapsed,
            remainingOperations: this.inflightOperations,
        });
    }
    async runCleanupFunctions() {
        this.logger.info('Running cleanup functions', {
            count: this.cleanupFunctions.length,
        });
        for (const { name, fn } of this.cleanupFunctions) {
            try {
                this.logger.debug('Running cleanup function', { name });
                await fn();
                this.logger.debug('Cleanup function completed', { name });
            }
            catch (error) {
                this.logger.error('Cleanup function failed', { name, error });
                // Continue with other cleanup functions even if one fails
            }
        }
        this.logger.info('All cleanup functions completed');
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Setup signal handlers for graceful shutdown
     */
    setupSignalHandlers() {
        // Handle SIGTERM (e.g., from Docker, Kubernetes)
        process.on('SIGTERM', () => {
            this.logger.info('Received SIGTERM signal');
            this.shutdown('SIGTERM').catch(error => {
                this.logger.error('Error handling SIGTERM', { error });
                process.exit(1);
            });
        });
        // Handle SIGINT (e.g., Ctrl+C)
        process.on('SIGINT', () => {
            this.logger.info('Received SIGINT signal');
            this.shutdown('SIGINT').catch(error => {
                this.logger.error('Error handling SIGINT', { error });
                process.exit(1);
            });
        });
        // Note: uncaughtException and unhandledRejection handlers are in index.ts
        // to prevent bot crashes - they log errors but don't shutdown
        this.logger.info('Signal handlers registered');
    }
}
//# sourceMappingURL=shutdown-manager.js.map