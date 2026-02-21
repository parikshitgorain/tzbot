# Pusher Client Service

This service provides a client for connecting to Kick.com's chat system via Pusher WebSocket.

## Overview

Kick.com uses Pusher (cluster: us2) for real-time chat functionality. This client handles:
- Connection management with automatic reconnection
- Message parsing and badge detection
- Connection state monitoring
- Error handling and recovery

## Usage

### Basic Connection

```typescript
import { pusherClient } from './services/pusher';

// Connect to a Kick channel
await pusherClient.connect({
  channelId: '12345', // Kick channel ID
  onMessage: (message) => {
    console.log(`${message.username}: ${message.content}`);
    console.log('Badges:', message.badges);
  },
  onConnectionChange: (state) => {
    console.log('Connection state:', state);
  },
  onError: (error) => {
    console.error('Pusher error:', error);
  },
});
```

### Disconnection

```typescript
await pusherClient.disconnect();
```

### Check Connection Status

```typescript
if (pusherClient.isConnected()) {
  console.log('Connected to Kick chat');
}

const state = pusherClient.getConnectionState();
// Possible states: 'initialized', 'connecting', 'connected', 'disconnected', 'failed'
```

## Message Format

Chat messages are parsed into the following format:

```typescript
interface KickChatMessage {
  id: string;              // Message ID
  username: string;        // Sender username
  content: string;         // Message content
  timestamp: Date;         // When message was sent
  badges: KickChatBadge[]; // User badges
}

interface KickChatBadge {
  type: 'subscriber' | 'vip' | 'moderator' | 'broadcaster';
  months?: number; // For subscribers, how many months subscribed
}
```

## Badge Detection

The client automatically parses user badges from chat messages. This is used for role synchronization:

- **subscriber**: User is subscribed to the channel
- **vip**: User has VIP status
- **moderator**: User is a channel moderator
- **broadcaster**: User is the channel owner

## Automatic Reconnection

The client implements exponential backoff for reconnection:
- Initial delay: 1 second
- Maximum delay: 60 seconds
- Maximum attempts: 10

After 10 failed attempts, manual reconnection is required.

## Connection States

- **initialized**: Client created but not connected
- **connecting**: Attempting to establish connection
- **connected**: Successfully connected and subscribed
- **disconnected**: Cleanly disconnected
- **failed**: Connection failed or lost

## Error Handling

The client handles various error scenarios:
- Connection timeouts (10 second timeout)
- Subscription errors
- Message parsing errors
- Network failures

All errors are logged and can be handled via the `onError` callback.

## Requirements

This service fulfills requirements 2.1-2.4:
- Monitors Kick chat for subscriber/VIP badges
- Enables role synchronization based on chat activity
- Provides reliable connection with automatic recovery

## Testing

### Unit Tests
```bash
npm test tests/unit/services/pusher
```

### Integration Tests
```bash
npm test tests/integration/pusher.integration.test.ts
```

Note: Integration tests require network connectivity to Kick's Pusher servers.

## Configuration

The client uses the following Pusher configuration:
- **Cluster**: us2 (Kick's Pusher cluster)
- **Encryption**: Enabled (WSS)
- **App Key**: eb1d5f283081a78b932c (Kick's public Pusher key)

## Limitations

1. **Badge Detection Only**: Role sync only works when users chat on Kick
2. **No Historical Data**: Only receives messages sent after connection
3. **Rate Limits**: Subject to Pusher's rate limits (typically not an issue)
4. **Network Dependent**: Requires stable internet connection

## Future Enhancements

- Message rate limiting
- Message filtering by badge type
- Historical message retrieval (if Kick API supports)
- Multiple channel subscriptions
- Custom event handlers
