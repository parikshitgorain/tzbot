/**
 * Example usage of the RewardSystem
 * 
 * This file demonstrates how to configure and use the reward distribution system
 * for chat rain events.
 */

import { Client } from 'discord.js';
import { RewardSystem, RewardType, type Reward } from './reward-system.js';
import { ChatRainManager, type ChatRainConfig } from './chat-rain.manager.js';
import { ChatActivityRepository } from '../core/database/repositories/ChatActivityRepository.js';
import { ViolationRepository } from '../core/database/repositories/ViolationRepository.js';
import type { Pool } from 'pg';

// Example 1: Basic setup with role reward
async function setupChatRainWithRoleReward(
  client: Client,
  pool: Pool,
  guildId: string
): Promise<ChatRainManager> {
  // Create repositories
  const chatActivityRepo = new ChatActivityRepository(pool);
  const violationRepo = new ViolationRepository(pool);
  
  // Create reward system
  const rewardSystem = new RewardSystem(client, chatActivityRepo, guildId);
  
  // Configure chat rain with role reward
  const config: ChatRainConfig = {
    minDelayMinutes: 5,
    activeWindowMinutes: 10,
    minMessages: 3,
    cooldownMinutes: 60,
    rewardType: RewardType.ROLE,
    rewardValue: '1234567890123456789', // Discord role ID
    rewardDurationMs: 24 * 60 * 60 * 1000, // 24 hours
    customMessage: 'You\'ve been awarded the Active Chatter role for 24 hours!'
  };
  
  // Create chat rain manager
  const chatRainManager = new ChatRainManager(
    chatActivityRepo,
    violationRepo,
    rewardSystem,
    config
  );
  
  await chatRainManager.initialize();
  
  return chatRainManager;
}

// Example 2: Currency reward
async function setupChatRainWithCurrency(
  client: Client,
  pool: Pool,
  guildId: string
): Promise<ChatRainManager> {
  const chatActivityRepo = new ChatActivityRepository(pool);
  const violationRepo = new ViolationRepository(pool);
  const rewardSystem = new RewardSystem(client, chatActivityRepo, guildId);
  
  const config: ChatRainConfig = {
    minDelayMinutes: 5,
    activeWindowMinutes: 10,
    minMessages: 3,
    cooldownMinutes: 60,
    rewardType: RewardType.CURRENCY,
    rewardValue: '100', // 100 currency units
    customMessage: 'You\'ve been awarded 100 coins!'
  };
  
  const chatRainManager = new ChatRainManager(
    chatActivityRepo,
    violationRepo,
    rewardSystem,
    config
  );
  
  await chatRainManager.initialize();
  
  return chatRainManager;
}

// Example 3: Announcement only (no tangible reward)
async function setupChatRainWithAnnouncement(
  client: Client,
  pool: Pool,
  guildId: string
): Promise<ChatRainManager> {
  const chatActivityRepo = new ChatActivityRepository(pool);
  const violationRepo = new ViolationRepository(pool);
  const rewardSystem = new RewardSystem(client, chatActivityRepo, guildId);
  
  const config: ChatRainConfig = {
    minDelayMinutes: 5,
    activeWindowMinutes: 10,
    minMessages: 3,
    cooldownMinutes: 60,
    rewardType: RewardType.ANNOUNCEMENT,
    customMessage: 'You\'ve been recognized as one of our most active chatters! Keep up the great conversation! 🎉'
  };
  
  const chatRainManager = new ChatRainManager(
    chatActivityRepo,
    violationRepo,
    rewardSystem,
    config
  );
  
  await chatRainManager.initialize();
  
  return chatRainManager;
}

// Example 4: Execute chat rain event
async function executeChatRainEvent(
  chatRainManager: ChatRainManager,
  channelId: string
): Promise<void> {
  // Check if chat rain can be executed
  const timeUntilNext = chatRainManager.getTimeUntilNextChatRain();
  
  if (timeUntilNext > 0) {
    console.log(`Chat rain on cooldown. ${Math.ceil(timeUntilNext / 1000 / 60)} minutes remaining.`);
    return;
  }
  
  // Execute chat rain
  const winners = await chatRainManager.executeChatRain(channelId);
  
  if (!winners) {
    console.log('Chat rain could not be executed (no eligible users or on cooldown)');
    return;
  }
  
  console.log(`Chat rain executed! ${winners.length} winners selected.`);
}

// Example 5: Manual reward distribution
async function distributeManualReward(
  rewardSystem: RewardSystem,
  userIds: string[],
  channelId: string
): Promise<void> {
  // Create custom reward
  const reward: Reward = {
    type: RewardType.ROLE,
    value: '1234567890123456789', // Role ID
    durationMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    customMessage: 'Special event reward! You\'ve been awarded VIP status for 7 days!'
  };
  
  // Distribute rewards
  const result = await rewardSystem.distributeRewards(userIds, reward, channelId);
  
  console.log(`Successfully distributed to: ${result.successful.length} users`);
  console.log(`Failed to distribute to: ${result.failed.length} users`);
  
  // Log errors
  for (const [userId, error] of result.errors) {
    console.error(`Failed to reward ${userId}: ${error}`);
  }
}

// Example 6: Get reward history for a user
async function getUserRewardHistory(
  rewardSystem: RewardSystem,
  userId: string
): Promise<void> {
  // Get all rewards
  const allRewards = await rewardSystem.getRewardHistory(userId);
  console.log(`User ${userId} has received ${allRewards.length} total rewards`);
  
  // Get rewards from last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentRewards = await rewardSystem.getRewardHistory(userId, thirtyDaysAgo);
  console.log(`User ${userId} has received ${recentRewards.length} rewards in the last 30 days`);
  
  // Display reward details
  for (const reward of recentRewards) {
    console.log(`- ${reward.timestamp.toISOString()}: ${reward.rewardType} (${reward.rewardValue || 'N/A'})`);
  }
}

// Example 7: Scheduled chat rain (run every hour)
async function scheduleAutomaticChatRain(
  chatRainManager: ChatRainManager,
  channelId: string
): Promise<void> {
  // Check every hour
  setInterval(async () => {
    try {
      const winners = await chatRainManager.executeChatRain(channelId);
      
      if (winners) {
        console.log(`Automatic chat rain executed: ${winners.length} winners`);
      }
    } catch (error) {
      console.error('Failed to execute automatic chat rain:', error);
    }
  }, 60 * 60 * 1000); // 1 hour
}

// Example 8: Custom reward with webhook integration
async function setupCustomReward(
  client: Client,
  pool: Pool,
  guildId: string
): Promise<void> {
  const chatActivityRepo = new ChatActivityRepository(pool);
  const rewardSystem = new RewardSystem(client, chatActivityRepo, guildId);
  
  // Custom reward with webhook payload
  const customReward: Reward = {
    type: RewardType.CUSTOM,
    value: JSON.stringify({
      webhookUrl: 'https://example.com/api/rewards',
      action: 'award_points',
      amount: 500
    }),
    customMessage: 'You\'ve been awarded 500 bonus points in our external system!'
  };
  
  const userIds = ['123456789012345678'];
  const channelId = '987654321098765432';
  
  await rewardSystem.distributeRewards(userIds, customReward, channelId);
}

export {
  setupChatRainWithRoleReward,
  setupChatRainWithCurrency,
  setupChatRainWithAnnouncement,
  executeChatRainEvent,
  distributeManualReward,
  getUserRewardHistory,
  scheduleAutomaticChatRain,
  setupCustomReward
};
