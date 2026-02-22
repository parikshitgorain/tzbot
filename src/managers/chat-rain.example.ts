/* eslint-disable no-console */
/**
 * @file chat-rain.example.ts
 * @description Example usage of ChatRainManager
 */

import { Pool } from 'pg';
import { ChatRainManager } from './chat-rain.manager.js';
import { ChatActivityRepository } from '../core/database/repositories/ChatActivityRepository.js';
import { ViolationRepository } from '../core/database/repositories/ViolationRepository.js';

async function exampleChatRainUsage() {
  // Initialize database connection
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'tzbot',
    user: 'postgres',
    password: 'password',
  });

  // Create repositories
  const chatActivityRepo = new ChatActivityRepository(pool);
  const violationRepo = new ViolationRepository(pool);

  // Configure chat rain
  const config = {
    minDelayMinutes: 5,        // 5 minutes between events
    activeWindowMinutes: 10,   // Track messages from last 10 minutes
    minMessages: 3,            // Require 3+ messages to be eligible
    cooldownMinutes: 60,       // 60 minute cooldown for winners
    rewardType: 'role',        // Reward type (role, currency, etc.)
    rewardValue: '123456789',  // Role ID or other reward value
  };

  // Create chat rain manager
  const chatRainManager = new ChatRainManager(
    chatActivityRepo,
    violationRepo,
    config
  );

  // Initialize (loads last chat rain time from database)
  await chatRainManager.initialize();

  // Example 1: Execute chat rain event
  console.log('Executing chat rain event...');
  const winners = await chatRainManager.executeChatRain();

  if (winners === null) {
    console.log('Chat rain cannot be executed yet (minimum delay not met)');
  } else if (winners.length === 0) {
    console.log('No eligible users for chat rain');
  } else {
    console.log(`Chat rain winners (${winners.length}):`, winners);
    // Announce winners in Discord channel
    // await discordClient.sendMessage(channelId, `🌧️ Chat Rain! Winners: ${winners.map(id => `<@${id}>`).join(', ')}`);
  }

  // Example 2: Check time until next chat rain
  const timeUntilNext = chatRainManager.getTimeUntilNextChatRain();
  if (timeUntilNext > 0) {
    const minutesRemaining = Math.ceil(timeUntilNext / 60000);
    console.log(`Next chat rain available in ${minutesRemaining} minutes`);
  } else {
    console.log('Chat rain is available now');
  }

  // Example 3: Scheduled chat rain (every 15 minutes)
  setInterval(async () => {
    const winners = await chatRainManager.executeChatRain();
    
    if (winners && winners.length > 0) {
      console.log(`Scheduled chat rain executed with ${winners.length} winners`);
      // Distribute rewards and announce
    }
  }, 15 * 60 * 1000); // Check every 15 minutes

  // Clean up
  await pool.end();
}

// Run example
if (import.meta.url === `file://${process.argv[1]}`) {
  exampleChatRainUsage().catch(console.error);
}
