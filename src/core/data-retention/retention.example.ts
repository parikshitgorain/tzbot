// @ts-nocheck
/**
 * @file retention.example.ts
 * @description Example usage of the Data Retention Service
 * @module core/data-retention
 */

import { DataRetentionService, DEFAULT_RETENTION_CONFIG } from './retention.service.js';
import { getPool } from '@/core/database/pool.js';
import { logger } from '@/core/logger/logger.js';

/**
 * Example 1: Basic setup with default configuration
 */
async function example1_BasicSetup() {
  console.log('\n=== Example 1: Basic Setup ===');

  const pool = getPool();
  const retentionService = new DataRetentionService(pool);

  // Start automatic cleanup (runs every hour)
  retentionService.start();

  console.log('Data retention service started with default config:');
  console.log('- Message retention: 7 days');
  console.log('- Chat activity retention: 30 days');
  console.log('- Cleanup interval: 60 minutes');

  // Stop the service (would normally be called on shutdown)
  setTimeout(() => {
    retentionService.stop();
    console.log('Data retention service stopped');
  }, 5000);
}

/**
 * Example 2: Custom configuration
 */
async function example2_CustomConfiguration() {
  console.log('\n=== Example 2: Custom Configuration ===');

  const pool = getPool();

  // Custom retention policy
  const customConfig = {
    messageContentRetentionDays: 14, // Keep messages for 14 days instead of 7
    chatActivityRetentionDays: 60, // Keep activity for 60 days instead of 30
    cleanupIntervalMinutes: 120, // Run cleanup every 2 hours instead of 1
  };

  const retentionService = new DataRetentionService(pool, customConfig);
  retentionService.start();

  console.log('Data retention service started with custom config:');
  console.log(`- Message retention: ${customConfig.messageContentRetentionDays} days`);
  console.log(`- Chat activity retention: ${customConfig.chatActivityRetentionDays} days`);
  console.log(`- Cleanup interval: ${customConfig.cleanupIntervalMinutes} minutes`);
}

/**
 * Example 3: Manual cleanup operations
 */
async function example3_ManualCleanup() {
  console.log('\n=== Example 3: Manual Cleanup ===');

  const pool = getPool();
  const retentionService = new DataRetentionService(pool);

  // Get current retention statistics
  const statsBefore = await retentionService.getRetentionStats();
  console.log('Statistics before cleanup:');
  console.log(`- Total message content: ${statsBefore.messageContentCount}`);
  console.log(`- Old message content: ${statsBefore.oldMessageContentCount}`);
  console.log(`- Total chat activity: ${statsBefore.chatActivityCount}`);
  console.log(`- Old chat activity: ${statsBefore.oldChatActivityCount}`);

  // Run manual cleanup
  console.log('\nRunning manual cleanup...');
  const deletedMessages = await retentionService.cleanupOldMessageContent();
  const deletedActivity = await retentionService.cleanupOldChatActivity();

  console.log(`Deleted ${deletedMessages} old message records`);
  console.log(`Deleted ${deletedActivity} old activity records`);

  // Get statistics after cleanup
  const statsAfter = await retentionService.getRetentionStats();
  console.log('\nStatistics after cleanup:');
  console.log(`- Total message content: ${statsAfter.messageContentCount}`);
  console.log(`- Old message content: ${statsAfter.oldMessageContentCount}`);
}

/**
 * Example 4: GDPR data deletion
 */
async function example4_GDPRDeletion() {
  console.log('\n=== Example 4: GDPR Data Deletion ===');

  const pool = getPool();
  const retentionService = new DataRetentionService(pool);

  const userId = '123456789'; // Example Discord user ID

  console.log(`Deleting all data for user ${userId}...`);

  try {
    await retentionService.deleteAllUserData(userId);
    console.log('✅ All user data deleted successfully');
    console.log('\nDeleted data includes:');
    console.log('- Message content');
    console.log('- Chat activity');
    console.log('- Chat rain winners');
    console.log('- Giveaway entries');
    console.log('- Violations');
    console.log('- Moderation logs (as target)');
    console.log('- User record');
  } catch (error) {
    console.error('❌ Failed to delete user data:', error);
  }
}

/**
 * Example 5: Integration with bot lifecycle
 */
async function example5_BotLifecycle() {
  console.log('\n=== Example 5: Bot Lifecycle Integration ===');

  const pool = getPool();
  const retentionService = new DataRetentionService(pool);

  // Start retention service when bot starts
  console.log('Bot starting...');
  retentionService.start();
  console.log('✅ Data retention service started');

  // Simulate bot running
  console.log('Bot running...');

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    retentionService.stop();
    console.log('✅ Data retention service stopped');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    retentionService.stop();
    console.log('✅ Data retention service stopped');
    process.exit(0);
  });
}

/**
 * Example 6: Monitoring retention statistics
 */
async function example6_MonitoringStats() {
  console.log('\n=== Example 6: Monitoring Retention Statistics ===');

  const pool = getPool();
  const retentionService = new DataRetentionService(pool);

  // Get statistics periodically
  const checkStats = async () => {
    const stats = await retentionService.getRetentionStats();

    console.log('\n📊 Retention Statistics:');
    console.log(`Message Content: ${stats.messageContentCount} total, ${stats.oldMessageContentCount} old`);
    console.log(`Chat Activity: ${stats.chatActivityCount} total, ${stats.oldChatActivityCount} old`);

    // Alert if too much old data
    if (stats.oldMessageContentCount > 1000) {
      console.warn('⚠️  Warning: More than 1000 old message records pending cleanup');
    }

    if (stats.oldChatActivityCount > 5000) {
      console.warn('⚠️  Warning: More than 5000 old activity records pending cleanup');
    }
  };

  // Check stats every 5 minutes
  setInterval(checkStats, 5 * 60 * 1000);

  // Initial check
  await checkStats();
}

/**
 * Example 7: Error handling
 */
async function example7_ErrorHandling() {
  console.log('\n=== Example 7: Error Handling ===');

  const pool = getPool();
  const retentionService = new DataRetentionService(pool);

  try {
    // Attempt to delete data for a user
    await retentionService.deleteAllUserData('invalid-user-id');
    console.log('✅ User data deleted');
  } catch (error) {
    console.error('❌ Error deleting user data:', error);
    // Error is automatically logged by the service
    // Transaction is rolled back automatically
  }

  try {
    // Attempt cleanup
    await retentionService.cleanupOldMessageContent();
    console.log('✅ Message cleanup completed');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    // Error is automatically logged by the service
  }
}

/**
 * Example 8: Testing retention policies
 */
async function example8_TestingPolicies() {
  console.log('\n=== Example 8: Testing Retention Policies ===');

  const pool = getPool();

  // Test with very short retention period (for testing only!)
  const testConfig = {
    messageContentRetentionDays: 1, // 1 day for testing
    chatActivityRetentionDays: 7, // 7 days for testing
    cleanupIntervalMinutes: 5, // 5 minutes for testing
  };

  const retentionService = new DataRetentionService(pool, testConfig);

  console.log('⚠️  Using test configuration with short retention periods');
  console.log('This should only be used in development/testing environments!');

  retentionService.start();

  // Get stats to verify policy is working
  setTimeout(async () => {
    const stats = await retentionService.getRetentionStats();
    console.log('\nTest statistics:');
    console.log(`Old messages (>1 day): ${stats.oldMessageContentCount}`);
    console.log(`Old activity (>7 days): ${stats.oldChatActivityCount}`);
  }, 1000);
}

/**
 * Run all examples
 */
async function runExamples() {
  console.log('='.repeat(60));
  console.log('Data Retention Service Examples');
  console.log('='.repeat(60));

  try {
    await example1_BasicSetup();
    await example2_CustomConfiguration();
    await example3_ManualCleanup();
    await example4_GDPRDeletion();
    await example5_BotLifecycle();
    await example6_MonitoringStats();
    await example7_ErrorHandling();
    await example8_TestingPolicies();
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples().catch(console.error);
}

export {
  example1_BasicSetup,
  example2_CustomConfiguration,
  example3_ManualCleanup,
  example4_GDPRDeletion,
  example5_BotLifecycle,
  example6_MonitoringStats,
  example7_ErrorHandling,
  example8_TestingPolicies,
};
