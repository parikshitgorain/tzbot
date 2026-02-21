/**
 * @file chat-client.example.ts
 * @description Example usage of KickChatClient for monitoring Kick chat
 * @module services/kick
 */

import { kickChatClient } from './chat-client.js';
import type { KickChatMessage } from '../pusher/types.js';
import { logger } from '../../core/logger/logger.js';

/**
 * Example 1: Basic chat monitoring
 */
async function basicChatMonitoring() {
  try {
    await kickChatClient.connect({
      channelId: '12345', // Replace with actual Kick channel ID
      onMessage: (message: KickChatMessage) => {
        console.log(`[${message.username}]: ${message.content}`);
      },
    });

    console.log('Monitoring Kick chat...');
    console.log('Connection state:', kickChatClient.getConnectionState());
  } catch (error) {
    console.error('Failed to start monitoring:', error);
  }
}

/**
 * Example 2: Badge detection for role synchronization
 */
async function badgeDetectionExample() {
  try {
    await kickChatClient.connect({
      channelId: '12345',
      onSubscriberDetected: async (username, months) => {
        console.log(`Subscriber detected: ${username} (${months} months)`);
        // Here you would:
        // 1. Look up Discord user by Kick username
        // 2. Assign subscriber role in Discord
      },
      onVIPDetected: async (username) => {
        console.log(`VIP detected: ${username}`);
        // Here you would:
        // 1. Look up Discord user by Kick username
        // 2. Assign VIP role in Discord
      },
    });

    console.log('Monitoring for subscriber/VIP badges...');
  } catch (error) {
    console.error('Failed to start monitoring:', error);
  }
}

/**
 * Example 3: Full monitoring with all handlers
 */
async function fullMonitoringExample() {
  try {
    await kickChatClient.connect({
      channelId: '12345',
      
      // Handle all messages
      onMessage: async (message: KickChatMessage) => {
        const badgeInfo = kickChatClient.extractBadges(message);
        
        logger.info('Chat message received', {
          username: message.username,
          content: message.content,
          badges: {
            subscriber: badgeInfo.isSubscriber,
            vip: badgeInfo.isVIP,
            moderator: badgeInfo.isModerator,
            broadcaster: badgeInfo.isBroadcaster,
          },
        });
      },
      
      // Handle subscriber detection
      onSubscriberDetected: async (username, months) => {
        logger.info('Subscriber detected', { username, months });
        // Implement role sync logic here
      },
      
      // Handle VIP detection
      onVIPDetected: async (username) => {
        logger.info('VIP detected', { username });
        // Implement role sync logic here
      },
      
      // Handle connection state changes
      onConnectionChange: (state) => {
        logger.info('Connection state changed', { state });
        
        if (state === 'disconnected') {
          console.log('Lost connection to Kick chat');
        } else if (state === 'connected') {
          console.log('Connected to Kick chat');
        }
      },
      
      // Handle errors
      onError: (error) => {
        logger.error('Kick chat error', { error });
      },
    });

    console.log('Full monitoring started');
    console.log('Is connected:', kickChatClient.isConnected());
  } catch (error) {
    console.error('Failed to start monitoring:', error);
  }
}

/**
 * Example 4: Graceful shutdown
 */
async function gracefulShutdownExample() {
  try {
    await kickChatClient.connect({
      channelId: '12345',
      onMessage: (message) => {
        console.log(`[${message.username}]: ${message.content}`);
      },
    });

    console.log('Monitoring started. Press Ctrl+C to stop...');

    // Handle shutdown signals
    process.on('SIGINT', async () => {
      console.log('\nShutting down gracefully...');
      await kickChatClient.disconnect();
      console.log('Disconnected from Kick chat');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\nShutting down gracefully...');
      await kickChatClient.disconnect();
      console.log('Disconnected from Kick chat');
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start monitoring:', error);
  }
}

/**
 * Example 5: Badge extraction without connecting
 */
function badgeExtractionExample() {
  // You can extract badges from any message object
  const message: KickChatMessage = {
    id: '123',
    username: 'testuser',
    content: 'Hello world!',
    timestamp: new Date(),
    badges: [
      { type: 'subscriber', months: 6 },
      { type: 'vip' },
    ],
  };

  const badgeInfo = kickChatClient.extractBadges(message);

  console.log('Badge information:', {
    username: badgeInfo.username,
    isSubscriber: badgeInfo.isSubscriber,
    subscriberMonths: badgeInfo.subscriberMonths,
    isVIP: badgeInfo.isVIP,
    isModerator: badgeInfo.isModerator,
    isBroadcaster: badgeInfo.isBroadcaster,
  });
}

/**
 * Example 6: Reconnection handling
 */
async function reconnectionExample() {
  let reconnectCount = 0;

  try {
    await kickChatClient.connect({
      channelId: '12345',
      onMessage: (message) => {
        console.log(`[${message.username}]: ${message.content}`);
      },
      onConnectionChange: (state) => {
        if (state === 'connecting') {
          reconnectCount++;
          console.log(`Reconnection attempt #${reconnectCount}`);
        } else if (state === 'connected') {
          console.log('Successfully reconnected!');
          reconnectCount = 0;
        } else if (state === 'failed') {
          console.log('Connection failed, will retry...');
        }
      },
      onError: (error) => {
        console.error('Connection error:', error.message);
      },
    });

    console.log('Monitoring with automatic reconnection...');
  } catch (error) {
    console.error('Failed to start monitoring:', error);
  }
}

// Run examples (uncomment to test)
// basicChatMonitoring();
// badgeDetectionExample();
// fullMonitoringExample();
// gracefulShutdownExample();
// badgeExtractionExample();
// reconnectionExample();

export {
  basicChatMonitoring,
  badgeDetectionExample,
  fullMonitoringExample,
  gracefulShutdownExample,
  badgeExtractionExample,
  reconnectionExample,
};
