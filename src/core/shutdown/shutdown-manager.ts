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

interface CleanupFunction {
  name: string;
  fn: () => Promise<void>;
}

export class GracefulShutdownManager implements ShutdownManager {
  private cleanupFunctions: CleanupFunction[] = [];
  private shuttingDown = false;
  private inflightOperations = 0;
  private logger: winston.Logger;
  private shutdownTimeout: number;

  constructor(logger: winston.Logger, shutdownTimeout: number = 30000) {
    this.logger = logger;
    this.shutdownTimeout = shutdownTimeout;
  }

  registerCleanup(name: string, fn: () => Promise<void>): void {
    if (this.shuttingDown) {
      this.logger.warn('Cannot register cleanup during shutdown', { name });
      return;
    }

    this.cleanupFunctions.push({ name, fn });
    this.logger.debug('Registered cleanup function', { name });
  }

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  trackOperation(): () => void {
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

  hasInflightOperations(): boolean {
    return this.inflightOperations > 0;
  }

  async shutdown(signal?: string): Promise<void> {
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
    } catch (error) {
      this.logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  }

  private async waitForInflightOperations(): Promise<void> {
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

  private async runCleanupFunctions(): Promise<void> {
    this.logger.info('Running cleanup functions', {
      count: this.cleanupFunctions.length,
    });

    for (const { name, fn } of this.cleanupFunctions) {
      try {
        this.logger.debug('Running cleanup function', { name });
        await fn();
        this.logger.debug('Cleanup function completed', { name });
      } catch (error) {
        this.logger.error('Cleanup function failed', { name, error });
        // Continue with other cleanup functions even if one fails
      }
    }

    this.logger.info('All cleanup functions completed');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers(): void {
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

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', { error });
      this.shutdown('uncaughtException').catch(() => {
        process.exit(1);
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled promise rejection', { reason, promise });
      this.shutdown('unhandledRejection').catch(() => {
        process.exit(1);
      });
    });

    this.logger.info('Signal handlers registered');
  }
}
