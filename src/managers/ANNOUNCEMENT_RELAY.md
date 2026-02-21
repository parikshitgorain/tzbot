# Announcement Relay System

The announcement relay system allows moderators to post messages in a private channel that are automatically relayed to multiple public channels. This ensures announcements are reviewed before publication and maintains consistent messaging across the server.

## Features

- **Automatic Relay**: Messages from moderators in the private channel are automatically relayed to all configured public channels
- **Content Preservation**: All message formatting, embeds, and attachments are preserved during relay
- **Bot Attribution**: Relayed messages are attributed to TZBOT, not the original moderator
- **Multi-Channel Support**: Relay to any number of public channels simultaneously
- **Failure Notifications**: Moderators are notified in the private channel if relay fails
- **Fast Delivery**: Messages are relayed within 2 seconds (typically <1 second)

## Requirements Satisfied

- **6.1**: Relay messages within 2 seconds
- **6.2**: Preserve message formatting, embeds, and attachments
- **6.3**: Attribute messages to TZBOT
- **6.4**: Relay to all configured public channels
- **6.5**: Notify moderator on relay failure

## Configuration

### Environment Variables

```env
# Private channel where moderators post announcements
PRIVATE_ANNOUNCEMENT_CHANNEL_ID=123456789012345678

# Comma-separated list of public channels to relay to
PUBLIC_ANNOUNCEMENT_CHANNEL_IDS=234567890123456789,345678901234567890,456789012345678901

# Discord server ID
GUILD_ID=567890123456789012

# Moderator role ID (only users with this role can trigger relays)
MODERATOR_ROLE_ID=678901234567890123
```

### Code Configuration

```typescript
import { DiscordClient } from '@/core/discord/client.js';
import { AnnouncementRelayManager } from '@/managers/announcement-relay.manager.js';

const discordClient = new DiscordClient();
await discordClient.connect(process.env.DISCORD_TOKEN!);

const relayManager = new AnnouncementRelayManager(discordClient, {
  privateChannelId: process.env.PRIVATE_ANNOUNCEMENT_CHANNEL_ID!,
  publicChannelIds: process.env.PUBLIC_ANNOUNCEMENT_CHANNEL_IDS!.split(','),
  guildId: process.env.GUILD_ID!,
  moderatorRoleId: process.env.MODERATOR_ROLE_ID!,
});

relayManager.start();
```

## Usage

### Basic Usage

1. Moderators post messages in the designated private channel
2. The relay manager automatically detects the message
3. The message is relayed to all configured public channels
4. If any relay fails, the moderator is notified in the private channel

### Message Types Supported

- **Text Messages**: Plain text content
- **Embeds**: Rich embeds with titles, descriptions, fields, etc.
- **Attachments**: Images, files, videos, etc.
- **Combined**: Messages with text, embeds, and attachments

### Example Workflow

```
Moderator (in #mod-announcements):
"🎉 Server update! We've added new channels for gaming discussions."

TZBOT (in #announcements):
"🎉 Server update! We've added new channels for gaming discussions."

TZBOT (in #general):
"🎉 Server update! We've added new channels for gaming discussions."

TZBOT (in #news):
"🎉 Server update! We've added new channels for gaming discussions."
```

## API Reference

### AnnouncementRelayManager

#### Constructor

```typescript
constructor(
  discordClient: IDiscordClient,
  config: AnnouncementRelayConfig
)
```

**Parameters:**
- `discordClient`: Discord client instance
- `config`: Relay configuration object
  - `privateChannelId`: Private channel to monitor
  - `publicChannelIds`: Array of public channels to relay to
  - `guildId`: Discord server ID
  - `moderatorRoleId`: Role ID for moderators

#### Methods

##### start()

Start monitoring the private channel for announcements.

```typescript
relayManager.start();
```

##### enable()

Enable the announcement relay (enabled by default).

```typescript
relayManager.enable();
```

##### disable()

Temporarily disable the announcement relay.

```typescript
relayManager.disable();
```

##### isEnabled()

Check if the relay is currently enabled.

```typescript
const enabled = relayManager.isEnabled();
```

##### updateConfig()

Update the relay configuration without restarting.

```typescript
relayManager.updateConfig({
  publicChannelIds: ['new-channel-1', 'new-channel-2'],
});
```

## Error Handling

### Relay Failures

If a message fails to relay to one or more channels, the moderator receives a notification in the private channel:

```
⚠️ **Announcement Relay Failure**

Failed to relay your message to the following channels:
• #announcements: Permission denied
• #general: Channel not found

Original message: https://discord.com/channels/...
```

### Common Failure Reasons

1. **Permission Denied**: Bot lacks permissions in the target channel
2. **Channel Not Found**: Channel was deleted or bot doesn't have access
3. **Rate Limited**: Discord API rate limit exceeded (rare)
4. **Network Error**: Temporary connection issue

### Troubleshooting

**Problem**: Messages aren't being relayed

**Solutions**:
- Verify the bot has the moderator role configured
- Check that the private channel ID is correct
- Ensure the bot has "Send Messages" permission in public channels
- Verify the relay is enabled: `relayManager.isEnabled()`

**Problem**: Embeds or attachments are missing

**Solutions**:
- Ensure the bot has "Embed Links" permission
- Verify the bot has "Attach Files" permission
- Check that attachment URLs are accessible

**Problem**: Relay is slow (>2 seconds)

**Solutions**:
- Check network latency to Discord servers
- Reduce the number of public channels
- Verify the bot isn't rate limited

## Performance

### Benchmarks

- **Average Relay Time**: 200-500ms
- **Maximum Relay Time**: <2 seconds (requirement)
- **Concurrent Channels**: Tested with up to 10 channels
- **Message Size**: Supports up to 2000 characters + embeds + attachments

### Optimization Tips

1. **Limit Public Channels**: More channels = longer relay time
2. **Use Embeds Wisely**: Large embeds increase processing time
3. **Monitor Rate Limits**: Discord has rate limits on message sending

## Security Considerations

### Access Control

- Only users with the configured moderator role can trigger relays
- Bot messages are ignored to prevent relay loops
- Messages from other channels are ignored

### Content Validation

- No content modification or filtering is performed
- Moderators are responsible for message content
- Consider implementing content moderation if needed

### Permissions Required

The bot needs the following permissions:
- **Read Messages**: To monitor the private channel
- **Send Messages**: To relay to public channels
- **Embed Links**: To preserve embeds
- **Attach Files**: To preserve attachments
- **Read Message History**: To fetch message details

## Integration Examples

### With Event Manager

```typescript
import { EventManager } from '@/managers/event.manager.js';
import { AnnouncementRelayManager } from '@/managers/announcement-relay.manager.js';

const eventManager = new EventManager(discordClient, config);
const relayManager = new AnnouncementRelayManager(discordClient, relayConfig);

// Start both managers
eventManager.start();
relayManager.start();

// The relay manager automatically integrates with Discord events
```

### With Command System

```typescript
// Add a command to toggle relay
commandManager.registerCommand({
  name: 'togglerelay',
  description: 'Enable or disable announcement relay',
  execute: async (interaction) => {
    if (relayManager.isEnabled()) {
      relayManager.disable();
      await interaction.reply('Announcement relay disabled');
    } else {
      relayManager.enable();
      await interaction.reply('Announcement relay enabled');
    }
  },
});
```

### With Logging

```typescript
// The relay manager automatically logs all operations
// Check logs for relay activity:
// - "Relaying announcement" - When a message is being relayed
// - "Announcement relay completed" - When relay finishes
// - "Announcement relay exceeded 2 seconds" - Performance warning
// - "Moderator notified of relay failures" - When failures occur
```

## Testing

### Unit Tests

Run the unit tests:

```bash
npm test -- tests/unit/managers/announcement-relay.manager.test.ts
```

### Manual Testing

1. Set up a test server with private and public channels
2. Configure the relay manager with test channel IDs
3. Post a message in the private channel as a moderator
4. Verify the message appears in all public channels
5. Test with embeds and attachments
6. Test failure scenarios (remove bot permissions)

## Changelog

### Version 1.0.0 (2025-02-21)

- Initial implementation
- Support for text, embeds, and attachments
- Multi-channel relay
- Failure notifications
- Performance optimization (<2 second relay time)

## Future Enhancements

Potential improvements for future versions:

1. **Scheduled Announcements**: Allow moderators to schedule announcements for later
2. **Announcement Templates**: Pre-defined templates for common announcements
3. **Approval Workflow**: Require multiple moderators to approve before relay
4. **Analytics**: Track announcement reach and engagement
5. **Selective Relay**: Allow moderators to choose which channels to relay to
6. **Edit Propagation**: Automatically update relayed messages when original is edited
7. **Delete Propagation**: Automatically delete relayed messages when original is deleted

## Support

For issues or questions:
- Check the troubleshooting section above
- Review the example files in `src/managers/announcement-relay.example.ts`
- Check the test files for usage examples
- Review the logs for error details
