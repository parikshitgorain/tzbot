# Managers

This directory contains manager classes that coordinate different aspects of the bot's functionality.

## CommandManager

The `CommandManager` handles slash command registration, permission validation, and cooldown management.

### Features

- **Command Registration**: Register slash commands with Discord
- **Permission Validation**: Validate user permissions before command execution
- **Cooldown Management**: Enforce per-user or global cooldowns on commands
- **Moderator-Only Commands**: Restrict commands to moderators
- **Error Handling**: Graceful error handling with user-friendly messages

### Usage

```typescript
import { CommandManager } from '@/managers/command.manager.js';
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

// Initialize command manager
const commandManager = new CommandManager(discordClient, config);

// Define a command
const pingCommand: CommandDefinition = {
  name: 'ping',
  description: 'Check bot latency',
  builder: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency'),
  handler: async (interaction) => {
    await interaction.reply('Pong!');
  },
};

// Register command
commandManager.registerCommand(pingCommand);

// Deploy commands to Discord
await commandManager.deployCommands(token, clientId);

// Handle interactions
discordClient.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand()) {
    await commandManager.handleInteraction(interaction);
  }
});
```

### Command Definition

```typescript
interface CommandDefinition {
  name: string;                    // Command name
  description: string;             // Command description
  builder: SlashCommandBuilder;    // Discord.js command builder
  handler: CommandHandler;         // Command execution function
  permissions?: bigint[];          // Required Discord permissions
  cooldown?: CommandCooldown;      // Cooldown configuration
  moderatorOnly?: boolean;         // Restrict to moderators
}
```

### Cooldown Configuration

```typescript
interface CommandCooldown {
  duration: number;    // Cooldown duration in milliseconds
  perUser: boolean;    // If true, cooldown is per user; if false, global
}
```

### Example: Moderator Command with Cooldown

```typescript
const banCommand: CommandDefinition = {
  name: 'ban',
  description: 'Ban a user from the server',
  builder: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to ban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for ban')
        .setRequired(false)
    ),
  handler: async (interaction) => {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    await discordClient.banUser(
      interaction.guildId!,
      user.id,
      reason
    );
    
    await interaction.reply({
      content: `Banned ${user.tag} for: ${reason}`,
      ephemeral: true,
    });
  },
  permissions: [PermissionFlagsBits.BanMembers],
  moderatorOnly: true,
  cooldown: {
    duration: 5000, // 5 seconds
    perUser: true,
  },
};
```

### Permission Validation

The CommandManager automatically validates permissions before executing commands:

1. **Moderator-Only**: Checks if user has moderator role or Administrator permission
2. **Custom Permissions**: Validates user has all required Discord permissions
3. **Guild Context**: Ensures command is executed in a guild (not DMs)

### Cooldown Management

Cooldowns prevent command spam:

- **Per-User Cooldowns**: Each user has their own cooldown timer
- **Global Cooldowns**: All users share the same cooldown timer
- **Automatic Cleanup**: Expired cooldowns are automatically cleaned up every 60 seconds

### Error Handling

The CommandManager handles errors gracefully:

- Unknown commands receive a user-friendly error message
- Permission errors explain what's missing
- Cooldown messages show remaining time
- Command execution errors are logged and reported to users

## EventManager

The `EventManager` handles Discord event routing with queuing and rate limiting.

### Features

- **Event Queuing**: Queue events for processing to handle high-volume servers
- **Rate Limiting**: Limit event processing to prevent overwhelming the bot
- **Priority Handling**: Process critical events first
- **Event Statistics**: Track processed, queued, and dropped events
- **Pause/Resume**: Pause event processing during maintenance

### Usage

```typescript
import { EventManager } from '@/managers/event.manager.js';

// Initialize event manager
const eventManager = new EventManager(discordClient, config);

// Register event handlers
eventManager.registerHandler('messageCreate', async (message) => {
  // Handle message
}, 50); // Priority: 50

// Start processing events
eventManager.start();

// Pause during maintenance
eventManager.pause();

// Resume after maintenance
eventManager.resume();

// Check if events are in-flight
if (eventManager.hasInflight()) {
  console.log('Waiting for events to complete...');
}

// Get statistics
const stats = eventManager.getStats();
console.log('Event statistics:', stats);
```

### Event Priorities

Higher priority events are processed first:

- `ready`: 100
- `error`, `shardError`: 90
- `interactionCreate`: 60
- `messageCreate`, `messageDelete`: 50
- `guildMemberAdd`, `guildMemberRemove`: 40
- Default: 0

### Rate Limiting

The EventManager enforces rate limits to prevent overwhelming the bot:

- Default: 100 events per second (configurable via `maxMessagesPerSecond`)
- Events exceeding the limit are queued
- Queue has a maximum size (default: 10,000 events)
- Events exceeding queue size are dropped

### Statistics

Track event processing with built-in statistics:

```typescript
const stats = eventManager.getStats();
// Map<DiscordEvent, EventStats>
// EventStats: { processed, queued, dropped, lastProcessedAt }
```

## NotificationManager

The `NotificationManager` handles delivery of Premium_Embeds to Discord channels with automatic retry and fallback logic.

### Features

- **Premium Embed Formatting**: Format embeds with title, description, thumbnail, timestamp, and color
- **Channel Targeting**: Send notifications to designated channels only
- **Fallback Delivery**: Automatically attempt fallback channel on primary failure
- **Retry Queue**: Queue failed notifications for automatic retry
- **Chronological Ordering**: Deliver multiple events in chronological order
- **Delivery Monitoring**: Track delivery times and queue statistics

### Usage

```typescript
import { NotificationManager } from '@/managers/notification.manager.js';
import { EventType } from '@/types/models.js';

// Initialize notification manager
const notificationManager = new NotificationManager(discordClient, {
  primaryChannelId: '1234567890',
  fallbackChannelId: '0987654321', // Optional
  maxRetries: 3,
  retryDelayMs: 5000, // 5 seconds
});

// Send a notification
const event = {
  id: 'event-123',
  type: EventType.STREAM_LIVE,
  channelId: 'kick-channel-id',
  data: { streamer: 'ExampleStreamer' },
  timestamp: new Date(),
  delivered: false,
};

const embedData = {
  title: '🔴 Stream is Live!',
  description: 'ExampleStreamer is now streaming',
  thumbnail: 'https://example.com/avatar.png',
  color: 0xff0000,
  fields: [
    { name: 'Game', value: 'Awesome Game', inline: true },
    { name: 'Viewers', value: '1,234', inline: true },
  ],
};

await notificationManager.sendNotification(event, embedData);

// Send multiple notifications in chronological order
await notificationManager.sendNotifications([
  { event: event1, embedData: embedData1 },
  { event: event2, embedData: embedData2 },
]);

// Monitor queue
const stats = notificationManager.getQueueStats();
console.log('Queue size:', stats.queueSize);
console.log('Processing:', stats.processing);
```

### Premium Embed Structure

All Premium_Embeds include:
- **Title**: Main heading (required)
- **Description**: Detailed message (required)
- **Thumbnail**: Image URL (optional)
- **Timestamp**: Event timestamp (automatic)
- **Color**: Embed color (default: Discord blurple)
- **Fields**: Additional key-value pairs (optional)

### Delivery Guarantees

- **Primary Channel**: Attempts delivery to primary channel first
- **Fallback Channel**: Automatically tries fallback if primary fails
- **Retry Queue**: Queues notifications that fail on both channels
- **Max Retries**: Configurable retry limit (default: 3)
- **Chronological Order**: Multiple events delivered in timestamp order

### Queue Management

```typescript
// Get queue statistics
const stats = notificationManager.getQueueStats();
// { queueSize, processing, oldestQueuedAt }

// Clear queue (useful during shutdown)
notificationManager.clearQueue();
```

### Requirements Validation

The NotificationManager validates the following requirements:
- **1.1**: Deliver Premium_Embed within 1 second (logs warning if exceeded)
- **1.2**: Format embeds with all required fields
- **1.3**: Deliver multiple events in chronological order
- **1.4**: Only send to designated channel
- **1.5**: Fallback channel delivery on error

## Best Practices

1. **Command Registration**: Register all commands before deploying to Discord
2. **Error Handling**: Always handle errors in command handlers
3. **Cooldowns**: Use appropriate cooldown durations to prevent spam
4. **Permissions**: Validate permissions for sensitive operations
5. **Event Handlers**: Keep event handlers lightweight and fast
6. **Cleanup**: Call `destroy()` on managers during shutdown

## Testing

All managers have comprehensive unit tests:

```bash
# Test CommandManager
npm test -- tests/unit/managers/command.manager.test.ts

# Test EventManager
npm test -- tests/unit/managers/event.manager.test.ts

# Test NotificationManager
npm test -- tests/unit/managers/notification.manager.test.ts
```

## Related Documentation

- [Discord Client](../core/discord/README.md)
- [Configuration](../../docs/configuration.md)
- [Project Structure](../../docs/project-structure.md)
