# Kick API Client

OAuth 2.0 authenticated client for Kick.com API with automatic token refresh, retry logic, and exponential backoff.

## Features

- **OAuth 2.0 Authentication**: Full authorization code flow with automatic token refresh
- **Token Management**: Automatic token expiration detection and refresh
- **Retry Logic**: Configurable retry attempts with exponential backoff
- **Error Handling**: Comprehensive error handling with detailed logging
- **Type Safety**: Full TypeScript type definitions

## Requirements

Validates requirements: 2.1-2.4, 8.1-8.7, 14.6

## Configuration

```typescript
import { initializeKickAPIClient } from './services/kick';

const client = initializeKickAPIClient({
  clientId: process.env.KICK_CLIENT_ID!,
  clientSecret: process.env.KICK_CLIENT_SECRET!,
  redirectUri: process.env.KICK_REDIRECT_URI!,
  baseUrl: 'https://kick.com/api/v2', // Optional, defaults to this
});
```

## OAuth 2.0 Flow

### 1. Generate Authorization URL

```typescript
import { getKickAPIClient } from './services/kick';

const client = getKickAPIClient();
const authUrl = client.getAuthorizationUrl('optional-state-parameter');

// Redirect user to authUrl
console.log('Visit:', authUrl);
```

### 2. Exchange Authorization Code for Token

After user authorizes, Kick redirects to your `redirectUri` with a `code` parameter:

```typescript
const code = 'authorization-code-from-redirect';
const tokens = await client.exchangeCodeForToken(code);

// Tokens are automatically stored in the client
console.log('Access token expires at:', tokens.expiresAt);
```

### 3. Make API Requests

The client automatically handles token refresh:

```typescript
// Get channel information
const channel = await client.getChannel('channel-slug');
console.log('Channel:', channel.username, 'Subscribers:', channel.subscriber_count);

// Get stream status
const stream = await client.getStreamStatus(channel.id);
console.log('Is live:', stream.is_live);

// Get subscribers (if endpoint is available)
const subscribers = await client.getSubscribers(channel.id);
console.log('Subscribers:', subscribers.length);
```

## Token Management

### Automatic Token Refresh

The client automatically refreshes tokens when they expire or are about to expire (within 5 minutes):

```typescript
// This will automatically refresh if needed
const channel = await client.getChannel('channel-slug');
```

### Manual Token Refresh

```typescript
const newTokens = await client.refreshAccessToken();
console.log('New access token expires at:', newTokens.expiresAt);
```

### Load Tokens from Storage

If you store tokens in a database, you can load them:

```typescript
import type { StoredTokens } from './services/kick';

const tokens: StoredTokens = {
  accessToken: 'stored-access-token',
  refreshToken: 'stored-refresh-token',
  expiresAt: new Date('2025-01-15T12:00:00Z'),
  scope: 'channel:read chat:read',
};

client.setTokens(tokens);
```

### Check Authentication Status

```typescript
if (client.isAuthenticated()) {
  console.log('Client is authenticated');
} else {
  console.log('Client needs authentication');
}
```

## Retry Logic and Exponential Backoff

The client implements exponential backoff for failed requests:

- **Initial delay**: 1 second
- **Max delay**: 60 seconds
- **Backoff multiplier**: 2x
- **Max retries**: 5 attempts

```typescript
// This will automatically retry with exponential backoff
try {
  const channel = await client.getChannel('channel-slug');
} catch (error) {
  // Failed after 5 retries
  console.error('Request failed:', error);
}
```

### Custom Retry Configuration

```typescript
// Override retry count for specific request
const channel = await client.getChannel('channel-slug', { retries: 3 });
```

## API Methods

### getChannel(slug: string)

Get channel information by slug.

```typescript
const channel = await client.getChannel('channel-slug');
console.log(channel.username, channel.subscriber_count);
```

### getSubscribers(channelId: number)

Get channel subscribers (if endpoint is available).

```typescript
const subscribers = await client.getSubscribers(12345);
subscribers.forEach(sub => {
  console.log(sub.username, 'subscribed for', sub.months, 'months');
});
```

### getVIPs(channelId: number)

Get channel VIPs (if endpoint is available).

```typescript
const vips = await client.getVIPs(12345);
vips.forEach(vip => {
  console.log(vip.username, 'granted VIP at', vip.granted_at);
});
```

### getStreamStatus(channelId: number)

Get current stream status.

```typescript
const stream = await client.getStreamStatus(12345);
if (stream.is_live) {
  console.log('Live with', stream.viewer_count, 'viewers');
  console.log('Title:', stream.title);
}
```

### getLiveEvents(channelId: number, since: Date)

Get events since a specific date.

```typescript
const since = new Date(Date.now() - 3600000); // Last hour
const events = await client.getLiveEvents(12345, since);
events.forEach(event => {
  console.log(event.type, 'at', event.timestamp);
});
```

## Error Handling

The client throws errors for:

- **Authentication failures**: Invalid credentials, expired tokens
- **API errors**: Invalid requests, rate limits, server errors
- **Network errors**: Connection failures, timeouts

```typescript
try {
  const channel = await client.getChannel('invalid-slug');
} catch (error) {
  if (error.message.includes('401')) {
    console.error('Authentication failed');
  } else if (error.message.includes('404')) {
    console.error('Channel not found');
  } else {
    console.error('Request failed:', error);
  }
}
```

## Logging

The client uses the application logger for detailed logging:

- **Info**: Successful operations, token refresh
- **Debug**: Request details, retry attempts
- **Warn**: Endpoint unavailable, token expiration
- **Error**: Request failures, authentication errors

## Known Limitations

### Kick API Availability

Some endpoints may not be available in the Kick API:

- **Subscribers list**: May not have direct endpoint
- **VIPs list**: May not have direct endpoint
- **Events**: May not have historical events endpoint

The client gracefully handles unavailable endpoints by returning empty arrays and logging warnings.

### Alternative Approaches

For subscriber/VIP detection, consider:

1. **Badge detection**: Monitor Kick chat for subscriber/VIP badges (see Pusher client)
2. **Webhook events**: Use `kicks.gifted` webhook for new subscriptions
3. **Manual commands**: Provide `/addrole` and `/removerole` commands for moderators

## Testing

See `tests/unit/services/kick/client.test.ts` for comprehensive unit tests.

## Security

- **Never commit tokens**: Store tokens in environment variables or secure database
- **Token encryption**: Encrypt tokens at rest using AES-256
- **HTTPS only**: All API requests use HTTPS
- **Token rotation**: Tokens automatically refresh before expiration

## References

- [Kick Developer Portal](https://dev.kick.com)
- [OAuth 2.0 Specification](https://oauth.net/2/)
- Requirements: 2.1-2.4, 8.1-8.7, 14.6
- Design Properties: 58 (Exponential Backoff)


---

# Kick Chat Client

High-level client for monitoring Kick chat via Pusher WebSocket with automatic badge detection for role synchronization.

## Features

- **Real-time Chat Monitoring**: Connect to Kick chat via Pusher WebSocket
- **Badge Detection**: Automatically extract subscriber, VIP, moderator, and broadcaster badges
- **Role Sync Callbacks**: Dedicated callbacks for subscriber and VIP detection
- **Automatic Reconnection**: Exponential backoff reconnection on connection loss
- **Connection Management**: Track connection state and handle errors gracefully

## Requirements

Validates requirements: 2.1-2.4

## Basic Usage

```typescript
import { kickChatClient } from './services/kick/chat-client';

// Start monitoring Kick chat
await kickChatClient.connect({
  channelId: '12345', // Kick channel ID
  
  // Handle all chat messages
  onMessage: (message) => {
    console.log(`[${message.username}]: ${message.content}`);
  },
  
  // Detect subscribers for role sync
  onSubscriberDetected: async (username, months) => {
    console.log(`Subscriber: ${username} (${months} months)`);
    // Look up Discord user and assign subscriber role
  },
  
  // Detect VIPs for role sync
  onVIPDetected: async (username) => {
    console.log(`VIP: ${username}`);
    // Look up Discord user and assign VIP role
  },
});

// Check connection status
console.log('Connected:', kickChatClient.isConnected());

// Disconnect when done
await kickChatClient.disconnect();
```

## Badge Extraction

Extract badge information from any chat message:

```typescript
import { kickChatClient } from './services/kick/chat-client';

const badgeInfo = kickChatClient.extractBadges(message);

console.log({
  username: badgeInfo.username,
  isSubscriber: badgeInfo.isSubscriber,
  subscriberMonths: badgeInfo.subscriberMonths,
  isVIP: badgeInfo.isVIP,
  isModerator: badgeInfo.isModerator,
  isBroadcaster: badgeInfo.isBroadcaster,
});
```

## Connection Management

### Monitor Connection State

```typescript
await kickChatClient.connect({
  channelId: '12345',
  onConnectionChange: (state) => {
    console.log('Connection state:', state);
    // States: 'initialized', 'connecting', 'connected', 'disconnected', 'failed'
  },
});
```

### Handle Errors

```typescript
await kickChatClient.connect({
  channelId: '12345',
  onError: (error) => {
    console.error('Chat error:', error);
    // Handle connection errors, message parsing errors, etc.
  },
});
```

### Graceful Shutdown

```typescript
// Handle shutdown signals
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await kickChatClient.disconnect();
  process.exit(0);
});
```

## Role Synchronization Pattern

Typical pattern for syncing Discord roles based on Kick badges:

```typescript
import { kickChatClient } from './services/kick/chat-client';
import { database } from './core/database';
import { discordClient } from './core/discord';

await kickChatClient.connect({
  channelId: process.env.KICK_CHANNEL_ID!,
  
  onSubscriberDetected: async (kickUsername, months) => {
    // Look up linked Discord user
    const user = await database.getUserByKickUsername(kickUsername);
    if (!user) {
      console.log(`No linked Discord user for ${kickUsername}`);
      return;
    }
    
    // Assign subscriber role
    await discordClient.addRole(
      user.discordId,
      process.env.SUBSCRIBER_ROLE_ID!
    );
    
    console.log(`Assigned subscriber role to ${kickUsername}`);
  },
  
  onVIPDetected: async (kickUsername) => {
    // Look up linked Discord user
    const user = await database.getUserByKickUsername(kickUsername);
    if (!user) {
      console.log(`No linked Discord user for ${kickUsername}`);
      return;
    }
    
    // Assign VIP role
    await discordClient.addRole(
      user.discordId,
      process.env.VIP_ROLE_ID!
    );
    
    console.log(`Assigned VIP role to ${kickUsername}`);
  },
});
```

## Automatic Reconnection

The client automatically reconnects on connection loss with exponential backoff:

- **Initial delay**: 1 second
- **Max delay**: 60 seconds
- **Backoff multiplier**: 2x
- **Max attempts**: 10 retries

```typescript
await kickChatClient.connect({
  channelId: '12345',
  onConnectionChange: (state) => {
    if (state === 'connecting') {
      console.log('Reconnecting...');
    } else if (state === 'connected') {
      console.log('Reconnected successfully!');
    } else if (state === 'failed') {
      console.log('Connection failed, will retry...');
    }
  },
});
```

## Message Types

### KickChatMessage

```typescript
interface KickChatMessage {
  id: string;              // Message ID
  username: string;        // Sender username
  content: string;         // Message content
  timestamp: Date;         // Message timestamp
  badges: KickChatBadge[]; // User badges
}
```

### KickChatBadge

```typescript
interface KickChatBadge {
  type: 'subscriber' | 'vip' | 'moderator' | 'broadcaster';
  months?: number; // For subscribers, number of months subscribed
}
```

### UserBadgeInfo

```typescript
interface UserBadgeInfo {
  username: string;
  isSubscriber: boolean;
  isVIP: boolean;
  isModerator: boolean;
  isBroadcaster: boolean;
  subscriberMonths?: number;
}
```

## Connection States

- **initialized**: Client created but not connected
- **connecting**: Attempting to connect to Pusher
- **connected**: Successfully connected and monitoring chat
- **disconnected**: Disconnected (intentionally or connection lost)
- **failed**: Connection failed (will retry automatically)

## Examples

See `chat-client.example.ts` for comprehensive usage examples including:

- Basic chat monitoring
- Badge detection for role sync
- Full monitoring with all handlers
- Graceful shutdown
- Badge extraction
- Reconnection handling

## Testing

See `tests/unit/services/kick/chat-client.test.ts` for comprehensive unit tests covering:

- Connection management
- Badge extraction
- Message handling
- Error handling
- Reconnection logic

## Architecture

The KickChatClient wraps the PusherClient (see `../pusher/README.md`) and provides:

1. **High-level interface**: Simplified API for Kick-specific chat monitoring
2. **Badge extraction**: Automatic parsing of Kick badge data
3. **Role sync callbacks**: Dedicated handlers for subscriber/VIP detection
4. **Error handling**: Comprehensive error handling and logging

```
KickChatClient → PusherClient → Pusher WebSocket → Kick Chat
     ↓
Badge Extraction
     ↓
Callbacks: onSubscriberDetected, onVIPDetected
```

## Limitations

### Badge-Based Detection

- **Requires chat activity**: Users must send a message in Kick chat for badges to be detected
- **No historical data**: Only detects badges from messages received while monitoring
- **Timing delay**: Role sync happens when user chats, not immediately on status change

### Workarounds

1. **Encourage chat**: Ask users to send a message in Kick chat after subscribing
2. **Manual commands**: Provide `/link` command for users to manually link accounts
3. **Webhook events**: Use `kicks.gifted` webhook for immediate subscription detection
4. **Periodic polling**: Poll Kick API for subscriber list (if endpoint becomes available)

## Related Documentation

- [Pusher Client](../pusher/README.md) - Underlying WebSocket client
- [Kick API Client](#kick-api-client) - REST API client (above)
- [Design Document](../../../.kiro/specs/tzbot-discord-bot/design.md) - System architecture
- [Requirements](../../../.kiro/specs/tzbot-discord-bot/requirements.md) - Feature requirements
