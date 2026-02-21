# Graceful Shutdown Manager

The Graceful Shutdown Manager handles clean shutdown of the bot by coordinating cleanup of all components and waiting for in-flight operations to complete.

## Features

- **Signal Handling**: Responds to SIGTERM and SIGINT signals
- **Cleanup Registration**: Components can register cleanup functions
- **Operation Tracking**: Tracks in-flight operations and waits for completion
- **Timeout Protection**: Forces shutdown after 30 seconds if operations don't complete
- **Error Handling**: Continues cleanup even if individual functions fail

## Usage

### Basic Setup

```typescript
import { GracefulShutdownManager } from './core/shutdown/shutdown-manager';
import { logger } from './core/logger/logger';

const shutdownManager = new GracefulShutdownManager(logger, 30000);

// Setup signal handlers
shutdownManager.setupSignalHandlers();
```

### Registering Cleanup Functions

Components should register their cleanup functions during initialization:

```typescript
// Discord client cleanup
shutdownManager.registerCleanup('discord', async () => {
  await discordClient.destroy();
});

// Database cleanup
shutdownManager.registerCleanup('database', async () => {
  await database.close();
});

// Redis cleanup
shutdownManager.registerCleanup('redis', async () => {
  await redis.quit();
});

// Kick chat client cleanup
shutdownManager.registerCleanup('kick-chat', async () => {
  await kickChatClient.disconnect();
});

// Webhook server cleanup
shutdownManager.registerCleanup('webhook-server', async () => {
  await webhookServer.close();
});
```

### Tracking In-Flight Operations

For long-running operations that should complete before shutdown:

```typescript
async function processMessage(message: Message): Promise<void> {
  // Track this operation
  const complete = shutdownManager.trackOperation();
  
  try {
    // Process the message
    await handleMessage(message);
  } finally {
    // Mark operation as complete
    complete();
  }
}
```

### Manual Shutdown

You can also trigger shutdown manually:

```typescript
// Trigger shutdown programmatically
await shutdownManager.shutdown('manual');
```

## Shutdown Sequence

1. **Signal Received**: SIGTERM or SIGINT signal is received
2. **Mark Shutting Down**: Set internal flag to prevent new operations
3. **Wait for Operations**: Wait up to 30 seconds for in-flight operations
4. **Run Cleanup**: Execute all registered cleanup functions in order
5. **Exit**: Exit process with code 0 (success) or 1 (error)

## Configuration

The shutdown manager accepts a timeout parameter (default: 30000ms):

```typescript
// Custom timeout of 60 seconds
const shutdownManager = new GracefulShutdownManager(logger, 60000);
```

## Error Handling

- Individual cleanup function failures are logged but don't stop other cleanups
- Timeout is enforced to prevent hanging
- Uncaught exceptions and unhandled rejections trigger shutdown
- Exit codes: 0 for clean shutdown, 1 for errors

## Best Practices

1. **Register Early**: Register cleanup functions during component initialization
2. **Track Operations**: Use `trackOperation()` for any async work that should complete
3. **Idempotent Cleanup**: Make cleanup functions safe to call multiple times
4. **Fast Cleanup**: Keep cleanup functions quick (< 5 seconds each)
5. **Error Handling**: Handle errors within cleanup functions when possible

## Example Integration

```typescript
import { GracefulShutdownManager } from './core/shutdown/shutdown-manager';
import { logger } from './core/logger/logger';
import { Database } from './core/database/Database';
import { RedisClient } from './core/cache/redis.client';
import { DiscordClient } from './core/discord/client';

async function main() {
  const shutdownManager = new GracefulShutdownManager(logger);
  
  // Initialize components
  const database = new Database(config.database);
  const redis = new RedisClient(config.redis);
  const discord = new DiscordClient(config.discord);
  
  // Register cleanup functions
  shutdownManager.registerCleanup('database', () => database.close());
  shutdownManager.registerCleanup('redis', () => redis.quit());
  shutdownManager.registerCleanup('discord', () => discord.destroy());
  
  // Setup signal handlers
  shutdownManager.setupSignalHandlers();
  
  // Start the bot
  await discord.login(config.discordToken);
  
  logger.info('Bot started successfully');
}

main().catch(error => {
  console.error('Failed to start bot:', error);
  process.exit(1);
});
```

## Testing

See `tests/unit/core/shutdown/shutdown-manager.test.ts` for comprehensive test coverage.

## Requirements

Validates: Requirements 14.2 (System Reliability - Graceful Shutdown)
