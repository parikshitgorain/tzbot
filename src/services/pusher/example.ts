/* eslint-disable no-console */
/**
 * @file example.ts
 * @description Example usage of the Pusher client for Kick chat monitoring
 * 
 * This file demonstrates how to connect to Kick chat and monitor for
 * subscriber/VIP badges for role synchronization.
 */

import { pusherClient } from './client.js';
import type { KickChatMessage } from './types.js';

/**
 * Example: Connect to Kick chat and monitor for badges
 */
async function monitorKickChat() {
  const kickChannelId = '12345'; // Replace with actual Kick channel ID

  try {
    await pusherClient.connect({
      channelId: kickChannelId,
      
      // Handle incoming chat messages
      onMessage: (message: KickChatMessage) => {
        console.log(`[${message.timestamp.toISOString()}] ${message.username}: ${message.content}`);
        
        // Check for subscriber badge
        const hasSubBadge = message.badges.some(b => b.type === 'subscriber');
        if (hasSubBadge) {
          console.log(`  → ${message.username} is a subscriber`);
          // TODO: Assign subscriber role on Discord
        }
        
        // Check for VIP badge
        const hasVIPBadge = message.badges.some(b => b.type === 'vip');
        if (hasVIPBadge) {
          console.log(`  → ${message.username} is a VIP`);
          // TODO: Assign VIP role on Discord
        }
        
        // Check for moderator badge
        const hasModBadge = message.badges.some(b => b.type === 'moderator');
        if (hasModBadge) {
          console.log(`  → ${message.username} is a moderator`);
        }
      },
      
      // Handle connection state changes
      onConnectionChange: (state) => {
        console.log(`Connection state changed: ${state}`);
      },
      
      // Handle errors
      onError: (error) => {
        console.error('Pusher error:', error);
      },
    });

    console.log('Successfully connected to Kick chat!');
    console.log('Monitoring for chat messages and badges...');
    
    // Keep the process running
    // In a real application, this would be part of the main bot process
    
  } catch (error) {
    console.error('Failed to connect to Kick chat:', error);
    process.exit(1);
  }
}

/**
 * Example: Graceful shutdown
 */
async function shutdown() {
  console.log('Shutting down...');
  await pusherClient.disconnect();
  console.log('Disconnected from Kick chat');
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  monitorKickChat().catch(console.error);
}

export { monitorKickChat };
