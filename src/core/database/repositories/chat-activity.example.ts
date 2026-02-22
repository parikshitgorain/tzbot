/* eslint-disable no-console */
/**
 * Example usage of ChatActivityRepository
 * Demonstrates active chatter tracking for chat rain system
 */

import { createPool } from '../pool.js';
import { ChatActivityRepository } from './ChatActivityRepository.js';

async function main() {
  // Create database connection pool
  const pool = createPool({
    host: 'localhost',
    port: 5432,
    database: 'tzbot',
    user: 'postgres',
    password: 'postgres',
  });

  const chatActivityRepo = new ChatActivityRepository(pool);

  // Example 1: Record chat activity
  console.log('Example 1: Recording chat activity');
  const userId = '123456789';
  const timestamp = new Date();
  await chatActivityRepo.record(userId, timestamp);
  console.log(`Recorded chat activity for user ${userId}`);

  // Example 2: Get active chatters (users who chatted in last 10 minutes)
  console.log('\nExample 2: Getting active chatters');
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const activeChatters = await chatActivityRepo.getActiveChatters(tenMinutesAgo);
  console.log(`Active chatters: ${activeChatters.length} users`);

  // Example 3: Get message count for a user
  console.log('\nExample 3: Getting message count');
  const messageCount = await chatActivityRepo.getMessageCount(userId, tenMinutesAgo);
  console.log(`User ${userId} sent ${messageCount} messages in the last 10 minutes`);

  // Example 4: Get qualified chatters (3+ messages in 10 minutes)
  console.log('\nExample 4: Getting qualified chatters for chat rain');
  const qualifiedChatters = await chatActivityRepo.getQualifiedChatters(tenMinutesAgo, 3);
  console.log(`Qualified chatters: ${qualifiedChatters.length} users`);
  console.log('These users are eligible for chat rain rewards');

  // Example 5: Record a chat rain winner
  console.log('\nExample 5: Recording chat rain winner');
  const winnerId = qualifiedChatters[0];
  if (winnerId) {
    await chatActivityRepo.recordWinner(winnerId, new Date(), 'role', 'VIP');
    console.log(`Recorded ${winnerId} as chat rain winner`);
  }

  // Example 6: Check if user has won recently (cooldown check)
  console.log('\nExample 6: Checking recent win cooldown');
  const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);
  const hasRecentWin = await chatActivityRepo.hasRecentWin(userId, sixtyMinutesAgo);
  console.log(`User ${userId} has recent win: ${hasRecentWin}`);
  if (hasRecentWin) {
    console.log('User is in cooldown period and cannot win again yet');
  }

  // Example 7: Get recent winners (for cooldown enforcement)
  console.log('\nExample 7: Getting recent winners');
  const recentWinners = await chatActivityRepo.getRecentWinners(sixtyMinutesAgo);
  console.log(`Recent winners (last 60 minutes): ${recentWinners.length} users`);
  console.log('These users should be excluded from the next chat rain');

  // Example 8: Get last chat rain time (for minimum delay enforcement)
  console.log('\nExample 8: Getting last chat rain time');
  const lastChatRainTime = await chatActivityRepo.getLastChatRainTime();
  if (lastChatRainTime) {
    const minutesSinceLastRain = (Date.now() - lastChatRainTime.getTime()) / (60 * 1000);
    console.log(`Last chat rain was ${minutesSinceLastRain.toFixed(1)} minutes ago`);
    if (minutesSinceLastRain < 5) {
      console.log('Too soon for another chat rain (minimum 5 minutes)');
    } else {
      console.log('Enough time has passed, can trigger another chat rain');
    }
  } else {
    console.log('No chat rain has occurred yet');
  }

  // Example 9: Clean up old activity records (maintenance task)
  console.log('\nExample 9: Cleaning up old activity records');
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const deletedCount = await chatActivityRepo.cleanupOldActivity(oneHourAgo);
  console.log(`Cleaned up ${deletedCount} old activity records`);

  // Example 10: Complete chat rain eligibility check
  console.log('\nExample 10: Complete chat rain eligibility check');
  const eligibleUsers = await getEligibleChatRainUsers(chatActivityRepo);
  console.log(`Eligible users for chat rain: ${eligibleUsers.length}`);
  console.log('These users meet all criteria:');
  console.log('- 3+ messages in last 10 minutes');
  console.log('- No win in last 60 minutes');
  console.log('- Not spam-flagged (would need to check ViolationRepository)');

  // Close the pool
  await pool.end();
}

/**
 * Helper function to get eligible users for chat rain
 * Combines multiple checks to determine eligibility
 */
async function getEligibleChatRainUsers(
  chatActivityRepo: ChatActivityRepository
): Promise<string[]> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Get users with 3+ messages in last 10 minutes
  const qualifiedChatters = await chatActivityRepo.getQualifiedChatters(tenMinutesAgo, 3);

  // Get users who won in last 60 minutes (cooldown)
  const recentWinners = await chatActivityRepo.getRecentWinners(sixtyMinutesAgo);
  const recentWinnersSet = new Set(recentWinners);

  // Filter out users in cooldown
  const eligibleUsers = qualifiedChatters.filter(userId => !recentWinnersSet.has(userId));

  return eligibleUsers;
}

// Run the example
main().catch(console.error);
