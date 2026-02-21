/**
 * @file notification.example.ts
 * @description Example usage of NotificationManager
 * @module managers
 */

import { DiscordClient } from '@/core/discord/client.js';
import {
  NotificationManager,
  type PremiumEmbedData,
} from './notification.manager.js';
import { EventType, type NotificationEvent } from '@/types/models.js';

// Initialize Discord client
const discordClient = new DiscordClient();

// Configure notification manager
const notificationManager = new NotificationManager(discordClient, {
  primaryChannelId: '1234567890', // Your notification channel ID
  fallbackChannelId: '0987654321', // Optional fallback channel
  maxRetries: 3,
  retryDelayMs: 5000, // 5 seconds between retries
});

// Example 1: Send a stream live notification
async function sendStreamLiveNotification() {
  const event: NotificationEvent = {
    id: 'event-123',
    type: EventType.STREAM_LIVE,
    channelId: 'kick-channel-id',
    data: {
      streamer: 'ExampleStreamer',
      title: 'Playing Awesome Game',
      viewers: 1234,
    },
    timestamp: new Date(),
    delivered: false,
  };

  const embedData: PremiumEmbedData = {
    title: '🔴 Stream is Live!',
    description: 'ExampleStreamer is now streaming',
    thumbnail: 'https://example.com/avatar.png',
    color: 0xff0000, // Red
    fields: [
      { name: 'Game', value: 'Awesome Game', inline: true },
      { name: 'Viewers', value: '1,234', inline: true },
    ],
  };

  await notificationManager.sendNotification(event, embedData);
}

// Example 2: Send a new subscriber notification
async function sendNewSubscriberNotification(username: string) {
  const event: NotificationEvent = {
    id: `sub-${Date.now()}`,
    type: EventType.NEW_SUBSCRIBER,
    channelId: 'kick-channel-id',
    data: { username },
    timestamp: new Date(),
    delivered: false,
  };

  const embedData: PremiumEmbedData = {
    title: '⭐ New Subscriber!',
    description: `${username} just subscribed to the channel!`,
    thumbnail: `https://kick.com/api/v2/channels/${username}/avatar`,
    color: 0xffd700, // Gold
  };

  await notificationManager.sendNotification(event, embedData);
}

// Example 3: Send multiple notifications in chronological order
async function sendMultipleNotifications() {
  const notifications = [
    {
      event: {
        id: 'event-1',
        type: EventType.STREAM_LIVE,
        channelId: 'kick-channel-id',
        data: {},
        timestamp: new Date('2025-01-01T12:00:00Z'),
        delivered: false,
      } as NotificationEvent,
      embedData: {
        title: '🔴 Stream Started',
        description: 'The stream has started!',
        color: 0x00ff00,
      } as PremiumEmbedData,
    },
    {
      event: {
        id: 'event-2',
        type: EventType.NEW_SUBSCRIBER,
        channelId: 'kick-channel-id',
        data: { username: 'NewSub1' },
        timestamp: new Date('2025-01-01T12:05:00Z'),
        delivered: false,
      } as NotificationEvent,
      embedData: {
        title: '⭐ New Subscriber',
        description: 'NewSub1 subscribed!',
        color: 0xffd700,
      } as PremiumEmbedData,
    },
    {
      event: {
        id: 'event-3',
        type: EventType.RAID,
        channelId: 'kick-channel-id',
        data: { raider: 'FriendlyStreamer', viewers: 50 },
        timestamp: new Date('2025-01-01T12:10:00Z'),
        delivered: false,
      } as NotificationEvent,
      embedData: {
        title: '🎉 Incoming Raid!',
        description: 'FriendlyStreamer is raiding with 50 viewers!',
        color: 0xff00ff,
        fields: [
          { name: 'Raider', value: 'FriendlyStreamer', inline: true },
          { name: 'Viewers', value: '50', inline: true },
        ],
      } as PremiumEmbedData,
    },
  ];

  // Notifications will be sent in chronological order
  await notificationManager.sendNotifications(notifications);
}

// Example 4: Monitor queue statistics
function monitorQueue() {
  setInterval(() => {
    const stats = notificationManager.getQueueStats();
    
    if (stats.queueSize > 0) {
      console.log('Notification queue status:', {
        queueSize: stats.queueSize,
        processing: stats.processing,
        oldestQueuedAt: stats.oldestQueuedAt,
      });
    }
  }, 10000); // Check every 10 seconds
}

// Example 5: Handle webhook events from Kick
async function handleKickWebhook(webhookPayload: any) {
  const eventType = webhookPayload.event_type;
  
  switch (eventType) {
    case 'livestream.started':
      await sendStreamLiveNotification();
      break;
      
    case 'subscription.created':
      await sendNewSubscriberNotification(webhookPayload.data.username);
      break;
      
    case 'channel.raid':
      const raidEvent: NotificationEvent = {
        id: `raid-${Date.now()}`,
        type: EventType.RAID,
        channelId: webhookPayload.channel_id,
        data: webhookPayload.data,
        timestamp: new Date(webhookPayload.timestamp),
        delivered: false,
      };
      
      const raidEmbed: PremiumEmbedData = {
        title: '🎉 Incoming Raid!',
        description: `${webhookPayload.data.raider} is raiding with ${webhookPayload.data.viewers} viewers!`,
        color: 0xff00ff,
        fields: [
          { name: 'Raider', value: webhookPayload.data.raider, inline: true },
          { name: 'Viewers', value: String(webhookPayload.data.viewers), inline: true },
        ],
      };
      
      await notificationManager.sendNotification(raidEvent, raidEmbed);
      break;
  }
}

// Example 6: Clear queue on shutdown
async function gracefulShutdown() {
  console.log('Shutting down...');
  
  // Get queue stats before clearing
  const stats = notificationManager.getQueueStats();
  if (stats.queueSize > 0) {
    console.warn(`Clearing ${stats.queueSize} queued notifications`);
  }
  
  // Clear the queue
  notificationManager.clearQueue();
  
  // Disconnect Discord client
  await discordClient.disconnect();
}

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Export examples
export {
  sendStreamLiveNotification,
  sendNewSubscriberNotification,
  sendMultipleNotifications,
  monitorQueue,
  handleKickWebhook,
  gracefulShutdown,
};
