# Announcement Relay System - Setup Guide

## Overview

The announcement relay system is **already implemented** in your bot. It allows moderators to post messages in a private channel that are automatically relayed to multiple public channels.

## Current Status

✅ **Implemented**: The `AnnouncementRelayManager` is fully coded and tested
⚠️ **Disabled**: Currently commented out in `src/index.ts` (lines 28, 80, 632)
📝 **Configuration**: Environment variables are already in `.env` file

## How It Works

1. Moderator posts a message in the **private announcement channel**
2. Bot detects the message (only from users with moderator role)
3. Bot automatically relays the message to **all configured public channels**
4. Message is attributed to TZBOT (not the original moderator)
5. All formatting, embeds, and attachments are preserved
6. If relay fails, moderator is notified in the private channel

## Features

- ✅ Automatic relay within 2 seconds
- ✅ Preserves message formatting, embeds, and attachments
- ✅ Multi-channel support (relay to unlimited channels)
- ✅ Failure notifications
- ✅ Moderator-only access
- ✅ Bot message filtering (prevents loops)

## Setup Instructions

### Step 1: Configure Environment Variables

Edit your `.env` file and set these values:

```env
# Private channel where moderators post announcements
PRIVATE_ANNOUNCEMENT_CHANNEL_ID=1234567890123456789

# Comma-separated list of public channels to relay to
PUBLIC_ANNOUNCEMENT_CHANNEL_IDS=1234567890123456789,9876543210987654321,5555555555555555555

# Moderator role (already configured)
MODERATOR_ROLE_ID=your_moderator_role_id
```

**How to get channel IDs:**
1. Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode)
2. Right-click on a channel
3. Click "Copy Channel ID"

### Step 2: Enable in Code

Uncomment the following lines in `src/index.ts`:

**Line 28** - Import statement:
```typescript
import { AnnouncementRelayManager } from '@/managers/announcement-relay.manager.js';
```

**Line 80** - Property declaration:
```typescript
private announcementRelay!: AnnouncementRelayManager;
```

**Lines 631-633** - Initialization in `initializeManagers()`:
```typescript
// Announcement relay manager
if (config.privateAnnouncementChannelId && config.publicAnnouncementChannelIds.length > 0) {
  this.announcementRelay = new AnnouncementRelayManager(this.discordClient, {
    privateChannelId: config.privateAnnouncementChannelId,
    publicChannelIds: config.publicAnnouncementChannelIds,
    guildId: config.guildId,
    moderatorRoleId: config.moderatorRoleId,
  });
  
  this.announcementRelay.start();
  
  logger.info('Announcement relay enabled', {
    privateChannel: config.privateAnnouncementChannelId,
    publicChannels: config.publicAnnouncementChannelIds,
  });
}
```

### Step 3: Update Config Loading

Make sure the config manager loads these values. Check `src/config/config-manager.ts` includes:

```typescript
privateAnnouncementChannelId: process.env.PRIVATE_ANNOUNCEMENT_CHANNEL_ID,
publicAnnouncementChannelIds: process.env.PUBLIC_ANNOUNCEMENT_CHANNEL_IDS?.split(',') || [],
```

### Step 4: Restart the Bot

```bash
npm run build
npm start
```

## Usage Example

### Moderator Posts in Private Channel

```
#mod-announcements (private)
Moderator: 🎉 Server update! We've added new gaming channels.
```

### Bot Relays to Public Channels

```
#announcements (public)
TZBOT: 🎉 Server update! We've added new gaming channels.

#general (public)
TZBOT: 🎉 Server update! We've added new gaming channels.

#news (public)
TZBOT: 🎉 Server update! We've added new gaming channels.
```

## Supported Message Types

✅ **Plain text messages**
✅ **Rich embeds** (with titles, descriptions, fields, colors)
✅ **Images and attachments**
✅ **Combined** (text + embeds + attachments)

## Error Handling

If a message fails to relay to one or more channels, the moderator receives a notification:

```
⚠️ Announcement Relay Failure

Failed to relay your message to the following channels:
• #announcements: Permission denied
• #general: Channel not found

Original message: https://discord.com/channels/...
```

## Permissions Required

The bot needs these permissions in all public channels:
- ✅ Read Messages
- ✅ Send Messages
- ✅ Embed Links
- ✅ Attach Files

## Testing

1. Post a test message in the private channel as a moderator
2. Verify it appears in all public channels
3. Try with embeds and attachments
4. Test with a non-moderator (should be ignored)

## Troubleshooting

**Problem**: Messages aren't being relayed

**Solutions**:
- Verify you have the moderator role
- Check that channel IDs are correct in `.env`
- Ensure bot has permissions in public channels
- Check logs for errors: `tail -f logs/tzbot-*.log`

**Problem**: Only some channels receive the message

**Solutions**:
- Check bot permissions in failed channels
- Verify channel IDs are correct
- Check for typos in comma-separated list

**Problem**: Embeds or attachments are missing

**Solutions**:
- Ensure bot has "Embed Links" permission
- Ensure bot has "Attach Files" permission
- Check attachment URLs are accessible

## Advanced Configuration

### Dynamically Add/Remove Channels

You can update channels without restarting:

```typescript
announcementRelay.updateConfig({
  publicChannelIds: ['new-channel-1', 'new-channel-2', 'new-channel-3'],
});
```

### Temporarily Disable Relay

```typescript
announcementRelay.disable();  // Stop relaying
announcementRelay.enable();   // Resume relaying
```

### Check Status

```typescript
const isEnabled = announcementRelay.isEnabled();
```

## Documentation

For more details, see:
- Implementation: `src/managers/announcement-relay.manager.ts`
- Documentation: `src/managers/ANNOUNCEMENT_RELAY.md`
- Examples: `src/managers/announcement-relay.example.ts`
- Tests: `tests/unit/managers/announcement-relay.manager.test.ts`

## Summary

The announcement relay system is fully implemented and ready to use. Just:
1. Configure channel IDs in `.env`
2. Uncomment 3 lines in `src/index.ts`
3. Restart the bot

That's it! Your moderators can now post in the private channel and have messages automatically relayed to all public channels.
