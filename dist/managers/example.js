/**
 * @file example.ts
 * @description Example usage of EventManager
 * @module managers
 */
import { EventManager } from './event.manager.js';
import { DiscordClient } from '../core/discord/client.js';
import { config } from '../config/index.js';
import { logger } from '../core/logger/logger.js';
/**
 * Example: Basic EventManager setup
 */
async function basicExample() {
    // Create Discord client
    const client = new DiscordClient();
    // Create event manager
    const eventManager = new EventManager(client, config);
    // Register message handler
    eventManager.registerHandler('messageCreate', async (message) => {
        logger.info('Message received', {
            content: message.content,
            author: message.author.username,
            channelId: message.channelId,
        });
    });
    // Register error handler with high priority
    eventManager.registerHandler('error', async (error) => {
        logger.error('Discord error occurred', { error });
    }, 90);
    // Start event processing
    eventManager.start();
    // Connect to Discord
    await client.connect(config.discordToken);
    logger.info('Bot is running with EventManager');
}
/**
 * Example: Multiple handlers for the same event
 */
async function multipleHandlersExample() {
    const client = new DiscordClient();
    const eventManager = new EventManager(client, config);
    // Handler 1: Log message
    eventManager.registerHandler('messageCreate', async (message) => {
        logger.debug('Message logged', { messageId: message.id });
    }, 10);
    // Handler 2: Check for spam (higher priority)
    eventManager.registerHandler('messageCreate', async (message) => {
        // Spam detection logic here
        logger.debug('Spam check completed', { messageId: message.id });
    }, 50);
    // Handler 3: Check for malicious links (highest priority)
    eventManager.registerHandler('messageCreate', async (message) => {
        // Link scanning logic here
        logger.debug('Link scan completed', { messageId: message.id });
    }, 100);
    eventManager.start();
    await client.connect(config.discordToken);
}
/**
 * Example: Pause and resume event processing
 */
async function pauseResumeExample() {
    const client = new DiscordClient();
    const eventManager = new EventManager(client, config);
    eventManager.registerHandler('messageCreate', async (message) => {
        logger.info('Processing message', { messageId: message.id });
    });
    eventManager.start();
    await client.connect(config.discordToken);
    // Pause processing after 10 seconds
    setTimeout(() => {
        logger.info('Pausing event processing');
        eventManager.pause();
        // Resume after 5 seconds
        setTimeout(() => {
            logger.info('Resuming event processing');
            eventManager.resume();
        }, 5000);
    }, 10000);
}
/**
 * Example: Monitor event statistics
 */
async function statisticsExample() {
    const client = new DiscordClient();
    const eventManager = new EventManager(client, config);
    eventManager.registerHandler('messageCreate', async (message) => {
        logger.debug('Message processed', { messageId: message.id });
    });
    eventManager.start();
    await client.connect(config.discordToken);
    // Log statistics every 30 seconds
    setInterval(() => {
        const stats = eventManager.getStats();
        for (const [event, eventStats] of stats) {
            logger.info('Event statistics', {
                event,
                processed: eventStats.processed,
                queued: eventStats.queued,
                dropped: eventStats.dropped,
                lastProcessedAt: eventStats.lastProcessedAt,
            });
        }
    }, 30000);
}
/**
 * Example: Graceful shutdown with EventManager
 */
async function gracefulShutdownExample() {
    const client = new DiscordClient();
    const eventManager = new EventManager(client, config);
    eventManager.registerHandler('messageCreate', async (message) => {
        logger.debug('Message processed', { messageId: message.id });
    });
    eventManager.start();
    await client.connect(config.discordToken);
    // Handle shutdown signals
    process.on('SIGTERM', async () => {
        logger.info('SIGTERM received, shutting down gracefully');
        // Pause event processing
        eventManager.pause();
        // Wait for in-flight events to complete
        let attempts = 0;
        while (eventManager.hasInflight() && attempts < 30) {
            logger.info('Waiting for in-flight events to complete', {
                attempts,
            });
            await new Promise((resolve) => setTimeout(resolve, 1000));
            attempts++;
        }
        // Clear remaining queue
        eventManager.clearQueue();
        // Disconnect from Discord
        await client.disconnect();
        logger.info('Shutdown complete');
        process.exit(0);
    });
}
/**
 * Example: Error handling in event handlers
 */
async function errorHandlingExample() {
    const client = new DiscordClient();
    const eventManager = new EventManager(client, config);
    // Handler that might throw an error
    eventManager.registerHandler('messageCreate', async (message) => {
        if (message.content.includes('error')) {
            throw new Error('Simulated error');
        }
        logger.info('Message processed successfully', { messageId: message.id });
    });
    // This handler will still execute even if the previous one throws
    eventManager.registerHandler('messageCreate', async (message) => {
        logger.info('Second handler executed', { messageId: message.id });
    });
    eventManager.start();
    await client.connect(config.discordToken);
}
// Export examples
export { basicExample, multipleHandlersExample, pauseResumeExample, statisticsExample, gracefulShutdownExample, errorHandlingExample, };
// Run basic example if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    basicExample().catch((error) => {
        logger.error('Example failed', { error });
        process.exit(1);
    });
}
//# sourceMappingURL=example.js.map