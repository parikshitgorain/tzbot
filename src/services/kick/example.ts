/* eslint-disable no-console, @typescript-eslint/no-unused-vars */
/**
 * @file example.ts
 * @description Example usage of Kick API client
 * @module services/kick
 */

import { initializeKickAPIClient, getKickAPIClient } from './client.js';
import type { StoredTokens } from './types.js';

/**
 * Example: Initialize and authenticate with Kick API
 */
async function exampleOAuthFlow() {
  // 1. Initialize the client
  const client = initializeKickAPIClient({
    clientId: process.env.KICK_CLIENT_ID || 'your-client-id',
    clientSecret: process.env.KICK_CLIENT_SECRET || 'your-client-secret',
    redirectUri: process.env.KICK_REDIRECT_URI || 'http://localhost:3000/callback',
  });

  // 2. Generate authorization URL
  const authUrl = client.getAuthorizationUrl('random-state-string');
  console.log('Visit this URL to authorize:', authUrl);

  // 3. After user authorizes, exchange code for token
  // (In real app, this would be in your redirect handler)
  const authorizationCode = 'code-from-redirect';
  try {
    const tokens = await client.exchangeCodeForToken(authorizationCode);
    console.log('Successfully authenticated!');
    console.log('Access token expires at:', tokens.expiresAt);
    
    // Store tokens in database for later use
    await saveTokensToDatabase(tokens);
  } catch (error) {
    console.error('Authentication failed:', error);
  }
}

/**
 * Example: Load tokens and make API requests
 */
async function exampleAPIRequests() {
  const client = getKickAPIClient();

  // Load tokens from database
  const storedTokens = await loadTokensFromDatabase();
  if (storedTokens) {
    client.setTokens(storedTokens);
  }

  // Check if authenticated
  if (!client.isAuthenticated()) {
    console.error('Not authenticated. Please run OAuth flow first.');
    return;
  }

  try {
    // Get channel information
    const channel = await client.getChannel('xqc');
    console.log('Channel:', channel.username);
    console.log('Subscribers:', channel.subscriber_count);
    console.log('Is live:', channel.is_live);

    // Get stream status
    if (channel.is_live) {
      const stream = await client.getStreamStatus(channel.id);
      console.log('Stream title:', stream.title);
      console.log('Viewers:', stream.viewer_count);
      console.log('Category:', stream.category);
    }

    // Get subscribers (if available)
    const subscribers = await client.getSubscribers(channel.id);
    console.log('Total subscribers:', subscribers.length);
    subscribers.slice(0, 5).forEach(sub => {
      console.log(`- ${sub.username} (${sub.months} months)`);
    });

    // Get VIPs (if available)
    const vips = await client.getVIPs(channel.id);
    console.log('Total VIPs:', vips.length);
    vips.slice(0, 5).forEach(vip => {
      console.log(`- ${vip.username}`);
    });

    // Get recent events
    const oneHourAgo = new Date(Date.now() - 3600000);
    const events = await client.getLiveEvents(channel.id, oneHourAgo);
    console.log('Recent events:', events.length);
    events.forEach(event => {
      console.log(`- ${event.type} at ${event.timestamp}`);
    });
  } catch (error) {
    console.error('API request failed:', error);
  }
}

/**
 * Example: Handle token refresh
 */
async function exampleTokenRefresh() {
  const client = getKickAPIClient();

  try {
    // Manually refresh token
    const newTokens = await client.refreshAccessToken();
    console.log('Token refreshed successfully');
    console.log('New expiration:', newTokens.expiresAt);

    // Save new tokens to database
    await saveTokensToDatabase(newTokens);
  } catch (error) {
    console.error('Token refresh failed:', error);
    // User needs to re-authenticate
    console.log('Please re-authenticate using OAuth flow');
  }
}

/**
 * Example: Automatic retry with exponential backoff
 */
async function exampleRetryLogic() {
  const client = getKickAPIClient();

  try {
    // This will automatically retry up to 5 times with exponential backoff
    // Delays: 1s, 2s, 4s, 8s, 16s
    const channel = await client.getChannel('channel-slug');
    console.log('Request succeeded:', channel.username);
  } catch (error) {
    // Failed after all retries
    console.error('Request failed after all retries:', error);
  }
}

/**
 * Example: Monitor for new subscribers
 */
async function exampleSubscriberMonitoring() {
  const client = getKickAPIClient();
  const channelId = 12345;

  // Store last known subscriber count
  let lastSubscriberCount = 0;

  // Poll every 60 seconds
  setInterval(async () => {
    try {
      const subscribers = await client.getSubscribers(channelId);
      const currentCount = subscribers.length;

      if (currentCount > lastSubscriberCount) {
        const newSubscribers = subscribers.slice(0, currentCount - lastSubscriberCount);
        console.log('New subscribers detected:', newSubscribers.length);
        
        newSubscribers.forEach(sub => {
          console.log(`- ${sub.username} just subscribed!`);
          // Trigger Discord role assignment here
        });
      }

      lastSubscriberCount = currentCount;
    } catch (error) {
      console.error('Failed to check subscribers:', error);
    }
  }, 60000);
}

// Mock database functions (replace with actual database implementation)
async function saveTokensToDatabase(tokens: StoredTokens): Promise<void> {
  // In real app, save to database with encryption
  console.log('Saving tokens to database...');
}

async function loadTokensFromDatabase(): Promise<StoredTokens | null> {
  // In real app, load from database and decrypt
  console.log('Loading tokens from database...');
  return null;
}

// Run examples
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Kick API Client Examples\n');
  
  // Uncomment to run specific examples:
  // await exampleOAuthFlow();
  // await exampleAPIRequests();
  // await exampleTokenRefresh();
  // await exampleRetryLogic();
  // await exampleSubscriberMonitoring();
}
