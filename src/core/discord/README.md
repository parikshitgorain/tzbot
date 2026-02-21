# Discord Client Module

This module provides a clean wrapper around Discord.js for TZBOT, handling connection management, auto-reconnect, and all Discord operations.

## Features

- **Auto-reconnect**: Automatically reconnects on connection failure with exponential backoff
- **Connection Management**: Clean connect/disconnect lifecycle
- **Event Subscription**: Type-safe event handling
- **Message Operations**: Send and delete messages with embeds
- **Moderation Operations**: Ban, kick, and timeout users
- **Role Management**: Add and remove roles from users
- **Error Handling**: Comprehensive error logging and recovery
- **Permission Verification**: Automatic permission checking on startup

## Usage

### Basic Setup

```typescript
import { DiscordClient } from '@/core/discord/client.js';
import { config } from '@/config/index.js';

const client = new DiscordClient();

// Connect to Discord
await client.connect(config.discordToken);

// Subscribe to events
client.on('ready', () => {
  console.log('Bot is ready!');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await client.disconnect();
  process.exit(0);
});
```

### Sending Messages

```typescript
// Simple text message
await client.sendMessage('channel-id', {
  content: 'Hello, world!',
});

// Message with embeds
import { EmbedBuilder } from 'discord.js';

const embed = new EmbedBuilder()
  .setTitle('Notification')
  .setDescription('Stream is live!')
  .setColor(0x00ff00)
  .setTimestamp();

await client.sendMessage('channel-id', {
  content: 'Check this out:',
  embeds: [embed],
});

// Message with files
await client.sendMessage('channel-id', {
  content: 'Here is an image:',
  files: [{ attachment: './image.png', name: 'image.png' }],
});
```

### Moderation Actions

```typescript
const guildId = 'guild-id';
const userId = 'user-id';

// Ban a user
await client.banUser(guildId, userId, 'Spam violation');

// Kick a user
await client.kickUser(guildId, userId, 'Rule violation');

// Timeout a user (1 hour)
const oneHour = 60 * 60 * 1000;
await client.timeoutUser(guildId, userId, oneHour, 'Spam detected');

// Remove timeout (set duration to 0)
await client.timeoutUser(guildId, userId, 0, 'Timeout removed');
```

### Role Management

```typescript
const guildId = 'guild-id';
const userId = 'user-id';
const roleId = 'role-id';

// Add a role to a user
await client.addRole(guildId, userId, roleId);

// Remove a role from a user
await client.removeRole(guildId, userId, roleId);
```

### Event Handling

```typescript
// Subscribe to message events
client.on('messageCreate', async (message) => {
  if (message.content === '!ping') {
    await client.sendMessage(message.channelId, {
      content: 'Pong!',
    });
  }
});

// Subscribe to member join events
client.on('guildMemberAdd', async (member) => {
  console.log(`${member.user.username} joined the server`);
});

// One-time event subscription
client.once('ready', () => {
  console.log('Bot is ready!');
});

// Unsubscribe from events
const handler = (message) => console.log(message.content);
client.on('messageCreate', handler);
client.off('messageCreate', handler);
```

### Utility Methods

```typescript
// Get a guild
const guild = client.getGuild('guild-id');
if (guild) {
  console.log(`Guild name: ${guild.name}`);
}

// Get a member
const member = await client.getMember('guild-id', 'user-id');
if (member) {
  console.log(`Member: ${member.user.username}`);
}

// Check connection status
if (client.isConnected()) {
  console.log('Bot is connected');
}
```

## Auto-Reconnect

The client automatically handles reconnection with exponential backoff:

- **Initial delay**: 5 seconds
- **Max attempts**: 5
- **Backoff strategy**: Exponential (5s, 10s, 20s, 40s, 80s)
- **Max delay**: Capped at 60 seconds

```typescript
try {
  await client.connect(config.discordToken);
} catch (error) {
  // Connection failed after 5 attempts
  console.error('Failed to connect:', error);
}
```

## Error Handling

All methods include comprehensive error handling and logging:

```typescript
try {
  await client.sendMessage('invalid-channel', { content: 'test' });
} catch (error) {
  // Error is logged automatically
  console.error('Failed to send message:', error);
}
```

## Permission Verification

The client automatically verifies bot permissions on startup:

```typescript
// Permissions are checked when the 'ready' event fires
client.on('ready', () => {
  // If permissions are missing, warnings are logged
  console.log('Bot is ready!');
});
```

Required permissions:
- `MANAGE_ROLES` - Assign subscriber/VIP roles
- `MANAGE_MESSAGES` - Delete spam and unauthorized messages
- `BAN_MEMBERS` - Ban users who violate rules
- `KICK_MEMBERS` - Kick users from the server
- `MODERATE_MEMBERS` - Timeout users for spam violations

## Internal Event Handlers

The client sets up internal event handlers for monitoring:

- `ready` - Logs connection success and verifies permissions
- `disconnect` - Logs disconnection
- `error` - Logs errors
- `warn` - Logs warnings
- `shardError` - Logs shard errors
- `shardReconnecting` - Logs shard reconnection attempts
- `shardResume` - Logs shard resume events

## Type Safety

The client provides full TypeScript type safety:

```typescript
import type { DiscordEvent, EventHandler, MessageContent } from '@/core/discord/client.js';

// Type-safe event handlers
const handler: EventHandler<'messageCreate'> = (message) => {
  console.log(message.content);
};

client.on('messageCreate', handler);

// Type-safe message content
const content: MessageContent = {
  content: 'Hello',
  embeds: [],
  files: [],
};
```

## Interface

The client implements the `IDiscordClient` interface:

```typescript
interface IDiscordClient {
  // Connection management
  connect(token: string): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Event subscription
  on<K extends DiscordEvent>(event: K, handler: EventHandler<K>): void;
  once<K extends DiscordEvent>(event: K, handler: EventHandler<K>): void;
  off<K extends DiscordEvent>(event: K, handler: EventHandler<K>): void;

  // Message operations
  sendMessage(channelId: string, content: MessageContent): Promise<Message>;
  deleteMessage(channelId: string, messageId: string): Promise<void>;

  // Moderation operations
  banUser(guildId: string, userId: string, reason: string): Promise<void>;
  kickUser(guildId: string, userId: string, reason: string): Promise<void>;
  timeoutUser(guildId: string, userId: string, duration: number, reason: string): Promise<void>;

  // Role operations
  addRole(guildId: string, userId: string, roleId: string): Promise<void>;
  removeRole(guildId: string, userId: string, roleId: string): Promise<void>;

  // Utility methods
  getGuild(guildId: string): Guild | undefined;
  getMember(guildId: string, userId: string): Promise<GuildMember | null>;
}
```

## Testing

The module includes comprehensive unit tests:

```bash
npm test -- tests/unit/core/discord/client.test.ts
```

## Examples

See `src/core/discord/example.ts` for complete usage examples including:
- Basic bot setup
- Sending embeds
- Moderation actions
- Role management
- Auto-reconnect handling
- Event-driven moderation
- Complete bot implementation

## Requirements

This module satisfies the following requirements from the design document:

- **Requirement 3.1**: Message deletion within 1 second
- **Requirement 3.2**: Direct message notifications
- **Requirement 4.1-4.4**: Automated spam protection with escalation
- **Requirement 5.1-5.4**: Manual moderation commands
- **Requirement 2.1-2.4**: Role synchronization

## Related Modules

- `src/core/discord/permissions.ts` - Permission verification utilities
- `src/core/logger/logger.ts` - Structured logging
- `src/config/index.ts` - Configuration management
