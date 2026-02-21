// @ts-nocheck
/**
 * @file state-persistence.example.ts
 * @description Example usage of the state persistence service
 */

import { StatePersistenceService } from './state-persistence.js';
import type { GiveawayManager } from '@/managers/giveaway.manager.js';
import type { ChatRainManager } from '@/managers/chat-rain.manager.js';
import type { NotificationManager } from '@/managers/notification.manager.js';

/**
 * Example 1: Initialize and start state persistence
 */
async function example1_InitializeStatePersistence() {
  const statePersistence = new StatePersistenceService({
    stateDir: './data/state',
    stateFile: 'bot-state.json',
    persistIntervalMs: 60000, // 60 seconds
    maxBackups: 5,
  });

  // Initialize (creates state directory if needed)
  await statePersistence.initialize();

  // Start automatic persistence every 60 seconds
  statePersistence.startAutoPersistence();

  console.log('State persistence started');
}

/**
 * Example 2: Update state when critical data changes
 */
function example2_UpdateState(
  statePersistence: StatePersistenceService,
  chatRainManager: ChatRainManager
) {
  // After executing a chat rain event
  statePersistence.updateState({
    chatRain: {
      lastExecutionTime: new Date(),
    },
  });

  console.log('Chat rain state updated');
}

/**
 * Example 3: Update notification queue state
 */
function example3_UpdateNotificationQueue(
  statePersistence: StatePersistenceService,
  notificationManager: NotificationManager
) {
  // Get current queue stats
  const queueStats = notificationManager.getQueueStats();

  // Update state with queued notifications
  // Note: In real implementation, you'd get the actual queue data
  statePersistence.updateState({
    notificationQueue: [
      {
        id: 'queue-1',
        eventId: 'event-123',
        eventType: 'stream_live',
        embedData: {
          title: 'Stream is Live!',
          description: 'Come watch the stream',
        },
        attempts: 1,
        lastAttempt: new Date(),
        createdAt: new Date(),
      },
    ],
  });

  console.log('Notification queue state updated');
}

/**
 * Example 4: Update active giveaways state
 */
async function example4_UpdateActiveGiveaways(
  statePersistence: StatePersistenceService,
  giveawayManager: GiveawayManager
) {
  // After creating a giveaway, update state
  // Note: In real implementation, you'd track active giveaways
  statePersistence.updateState({
    activeGiveaways: [
      {
        id: 'giveaway-123',
        endsAt: new Date(Date.now() + 3600000), // Ends in 1 hour
      },
      {
        id: 'giveaway-456',
        endsAt: new Date(Date.now() + 7200000), // Ends in 2 hours
      },
    ],
  });

  console.log('Active giveaways state updated');
}

/**
 * Example 5: Recover state on bot startup
 */
async function example5_RecoverStateOnStartup(
  statePersistence: StatePersistenceService,
  giveawayManager: GiveawayManager,
  chatRainManager: ChatRainManager,
  notificationManager: NotificationManager,
  guildId: string
) {
  // Initialize state persistence
  await statePersistence.initialize();

  // Attempt to recover state from disk
  const recoveredState = await statePersistence.recoverState();

  if (recoveredState) {
    console.log('State recovered successfully');
    console.log('State timestamp:', recoveredState.timestamp);
    console.log('State version:', recoveredState.version);

    // Restore chat rain state
    if (recoveredState.data.chatRain) {
      console.log(
        'Restoring chat rain state:',
        recoveredState.data.chatRain.lastExecutionTime
      );
      // In real implementation, chatRainManager would have a restoreState method
      // chatRainManager.restoreState(recoveredState.data.chatRain);
    }

    // Restore notification queue
    if (recoveredState.data.notificationQueue) {
      console.log(
        'Restoring notification queue:',
        recoveredState.data.notificationQueue.length,
        'items'
      );
      // In real implementation, notificationManager would have a restoreQueue method
      // notificationManager.restoreQueue(recoveredState.data.notificationQueue);
    }

    // Restore active giveaways
    if (recoveredState.data.activeGiveaways) {
      console.log(
        'Restoring active giveaways:',
        recoveredState.data.activeGiveaways.length,
        'giveaways'
      );
      // Giveaway manager already has recovery method
      await giveawayManager.recoverActiveGiveaways(guildId);
    }
  } else {
    console.log('No state to recover, starting fresh');
  }

  // Start auto-persistence
  statePersistence.startAutoPersistence();
}

/**
 * Example 6: Force immediate state persistence
 */
async function example6_ForceImmediatePersistence(
  statePersistence: StatePersistenceService
) {
  // Update some critical state
  statePersistence.updateState({
    chatRain: {
      lastExecutionTime: new Date(),
    },
  });

  // Force immediate persistence (useful before shutdown)
  await statePersistence.forcePersist();

  console.log('State persisted immediately');
}

/**
 * Example 7: Graceful shutdown with state persistence
 */
async function example7_GracefulShutdown(
  statePersistence: StatePersistenceService
) {
  console.log('Initiating graceful shutdown...');

  // Shutdown state persistence (stops auto-persistence and saves final state)
  await statePersistence.shutdown();

  console.log('State persistence shutdown complete');
}

/**
 * Example 8: Get current state
 */
function example8_GetCurrentState(statePersistence: StatePersistenceService) {
  const currentState = statePersistence.getCurrentState();

  if (currentState) {
    console.log('Current state:');
    console.log('- Version:', currentState.version);
    console.log('- Timestamp:', currentState.timestamp);
    console.log('- Checksum:', currentState.checksum);
    console.log('- Has chat rain state:', !!currentState.data.chatRain);
    console.log(
      '- Notification queue size:',
      currentState.data.notificationQueue?.length ?? 0
    );
    console.log(
      '- Active giveaways:',
      currentState.data.activeGiveaways?.length ?? 0
    );
  } else {
    console.log('No current state');
  }
}

/**
 * Example 9: Complete bot lifecycle with state persistence
 */
async function example9_CompleteBotLifecycle(
  giveawayManager: GiveawayManager,
  chatRainManager: ChatRainManager,
  notificationManager: NotificationManager,
  guildId: string
) {
  // 1. Initialize state persistence
  const statePersistence = new StatePersistenceService({
    stateDir: './data/state',
    persistIntervalMs: 60000,
    maxBackups: 5,
  });

  await statePersistence.initialize();

  // 2. Recover state from previous run
  const recoveredState = await statePersistence.recoverState();

  if (recoveredState) {
    // Restore managers' state
    if (recoveredState.data.activeGiveaways) {
      await giveawayManager.recoverActiveGiveaways(guildId);
    }
    // ... restore other managers
  }

  // 3. Start auto-persistence
  statePersistence.startAutoPersistence();

  // 4. Bot runs and updates state as needed
  // When chat rain executes:
  statePersistence.updateState({
    chatRain: { lastExecutionTime: new Date() },
  });

  // When giveaway is created:
  statePersistence.updateState({
    activeGiveaways: [
      { id: 'giveaway-1', endsAt: new Date(Date.now() + 3600000) },
    ],
  });

  // 5. On shutdown signal (SIGTERM, SIGINT)
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await statePersistence.shutdown();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    await statePersistence.shutdown();
    process.exit(0);
  });
}

/**
 * Example 10: Handling state persistence errors
 */
async function example10_ErrorHandling(
  statePersistence: StatePersistenceService
) {
  try {
    // Initialize
    await statePersistence.initialize();

    // Recover state (may return null if corrupted or missing)
    const state = await statePersistence.recoverState();

    if (!state) {
      console.log('No valid state found, starting fresh');
      // Initialize with default state
      statePersistence.updateState({
        chatRain: { lastExecutionTime: null },
        notificationQueue: [],
        activeGiveaways: [],
      });
    }

    // Start auto-persistence
    statePersistence.startAutoPersistence();
  } catch (error) {
    console.error('Failed to initialize state persistence:', error);
    // Bot can still run without state persistence, but won't survive restarts
    console.warn('Continuing without state persistence');
  }
}

// Export examples for documentation
export {
  example1_InitializeStatePersistence,
  example2_UpdateState,
  example3_UpdateNotificationQueue,
  example4_UpdateActiveGiveaways,
  example5_RecoverStateOnStartup,
  example6_ForceImmediatePersistence,
  example7_GracefulShutdown,
  example8_GetCurrentState,
  example9_CompleteBotLifecycle,
  example10_ErrorHandling,
};
