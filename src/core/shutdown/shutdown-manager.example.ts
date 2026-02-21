/**
 * Example usage of the Graceful Shutdown Manager
 */

import { GracefulShutdownManager } from './shutdown-manager';
import { logger } from '../logger/logger';

// Example 1: Basic setup with signal handlers
async function example1() {
  const shutdownManager = new GracefulShutdownManager(logger);

  // Register cleanup functions
  shutdownManager.registerCleanup('example-resource', async () => {
    logger.info('Cleaning up example resource');
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  // Setup signal handlers (SIGTERM, SIGINT, etc.)
  shutdownManager.setupSignalHandlers();

  logger.info('Application started. Press Ctrl+C to trigger graceful shutdown.');
}

// Example 2: Tracking in-flight operations
async function example2() {
  const shutdownManager = new GracefulShutdownManager(logger);

  shutdownManager.setupSignalHandlers();

  // Simulate processing messages
  async function processMessage(id: number): Promise<void> {
    const complete = shutdownManager.trackOperation();
    
    try {
      logger.info(`Processing message ${id}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      logger.info(`Completed message ${id}`);
    } finally {
      complete();
    }
  }

  // Start some operations
  processMessage(1);
  processMessage(2);
  processMessage(3);

  // Shutdown will wait for these to complete
  setTimeout(() => {
    shutdownManager.shutdown('manual');
  }, 1000);
}

// Example 3: Multiple component cleanup
async function example3() {
  const shutdownManager = new GracefulShutdownManager(logger);

  // Simulate different components
  class DatabaseConnection {
    async close(): Promise<void> {
      logger.info('Closing database connection');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  class CacheClient {
    async quit(): Promise<void> {
      logger.info('Closing cache client');
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  class WebSocketClient {
    async disconnect(): Promise<void> {
      logger.info('Disconnecting WebSocket');
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  const db = new DatabaseConnection();
  const cache = new CacheClient();
  const ws = new WebSocketClient();

  // Register all cleanup functions
  shutdownManager.registerCleanup('database', () => db.close());
  shutdownManager.registerCleanup('cache', () => cache.quit());
  shutdownManager.registerCleanup('websocket', () => ws.disconnect());

  shutdownManager.setupSignalHandlers();

  logger.info('All components initialized');
}

// Example 4: Custom timeout
async function example4() {
  // Set a custom timeout of 60 seconds
  const shutdownManager = new GracefulShutdownManager(logger, 60000);

  shutdownManager.registerCleanup('slow-operation', async () => {
    logger.info('Starting slow cleanup operation');
    await new Promise(resolve => setTimeout(resolve, 5000));
    logger.info('Slow cleanup completed');
  });

  shutdownManager.setupSignalHandlers();
}

// Example 5: Error handling in cleanup
async function example5() {
  const shutdownManager = new GracefulShutdownManager(logger);

  // This cleanup will fail
  shutdownManager.registerCleanup('failing-cleanup', async () => {
    throw new Error('Cleanup failed!');
  });

  // This cleanup will still run
  shutdownManager.registerCleanup('successful-cleanup', async () => {
    logger.info('This cleanup runs even if previous one failed');
  });

  shutdownManager.setupSignalHandlers();

  // Trigger shutdown to see error handling
  setTimeout(() => {
    shutdownManager.shutdown('manual');
  }, 1000);
}

// Example 6: Complete application setup
async function example6() {
  const shutdownManager = new GracefulShutdownManager(logger);

  // Simulate a complete application
  class Application {
    private shutdownManager: GracefulShutdownManager;

    constructor(shutdownManager: GracefulShutdownManager) {
      this.shutdownManager = shutdownManager;
    }

    async start(): Promise<void> {
      logger.info('Starting application');

      // Initialize components (simulated)
      await this.initializeDatabase();
      await this.initializeCache();
      await this.initializeDiscord();

      // Setup signal handlers
      this.shutdownManager.setupSignalHandlers();

      logger.info('Application started successfully');
    }

    private async initializeDatabase(): Promise<void> {
      logger.info('Initializing database');
      
      this.shutdownManager.registerCleanup('database', async () => {
        logger.info('Closing database connection');
        await new Promise(resolve => setTimeout(resolve, 500));
      });
    }

    private async initializeCache(): Promise<void> {
      logger.info('Initializing cache');
      
      this.shutdownManager.registerCleanup('cache', async () => {
        logger.info('Closing cache connection');
        await new Promise(resolve => setTimeout(resolve, 300));
      });
    }

    private async initializeDiscord(): Promise<void> {
      logger.info('Initializing Discord client');
      
      this.shutdownManager.registerCleanup('discord', async () => {
        logger.info('Disconnecting Discord client');
        await new Promise(resolve => setTimeout(resolve, 1000));
      });
    }

    async processEvent(event: string): Promise<void> {
      if (this.shutdownManager.isShuttingDown()) {
        logger.warn('Rejecting event during shutdown', { event });
        return;
      }

      const complete = this.shutdownManager.trackOperation();
      
      try {
        logger.info('Processing event', { event });
        await new Promise(resolve => setTimeout(resolve, 1000));
        logger.info('Event processed', { event });
      } finally {
        complete();
      }
    }
  }

  const app = new Application(shutdownManager);
  await app.start();

  // Simulate some events
  app.processEvent('message.create');
  app.processEvent('message.update');
}

// Run examples (uncomment to test)
// example1();
// example2();
// example3();
// example4();
// example5();
// example6();

export {
  example1,
  example2,
  example3,
  example4,
  example5,
  example6
};
