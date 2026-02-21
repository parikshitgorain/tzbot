# Announcement Relay Commands - Ready to Use! ✅

## What's New

I've created Discord slash commands to manage the announcement relay system. No more editing `.env` files - everything can be configured directly in Discord!

## Available Commands

### 1. `/announcement-setup`
**Configure the entire announcement relay system in one command**

**Parameters:**
- `private_channel` - The private channel where moderators post announcements
- `public_channels` - Comma-separated list of public channel IDs (max 5)

**Example:**
```
/announcement-setup 
  private_channel: #mod-announcements
  public_channels: 1234567890,9876543210,5555555555
```

**What it does:**
- Sets up the private channel for moderators
- Configures up to 5 public channels for relay
- Validates all channels exist and are text channels
- Saves configuration to database
- Updates the relay manager in real-time (no restart needed!)

---

### 2. `/announcement-add-channel`
**Add a single public channel to the relay**

**Parameters:**
- `channel` - The public channel to add

**Example:**
```
/announcement-add-channel channel: #announcements
```

**What it does:**
- Adds one more public channel to the relay list
- Checks you haven't exceeded the 5-channel limit
- Updates configuration instantly

---

### 3. `/announcement-remove-channel`
**Remove a public channel from the relay**

**Parameters:**
- `channel` - The public channel to remove

**Example:**
```
/announcement-remove-channel channel: #general
```

**What it does:**
- Removes a channel from the relay list
- Updates configuration instantly

---

### 4. `/announcement-status`
**View current announcement relay configuration**

**No parameters needed**

**Example:**
```
/announcement-status
```

**What it shows:**
- Current status (Active/Inactive)
- Private channel
- All configured public channels (X/5)
- How the system works

---

### 5. `/announcement-toggle`
**Enable or disable the announcement relay**

**Parameters:**
- `enabled` - True to enable, False to disable

**Example:**
```
/announcement-toggle enabled: true
```

**What it does:**
- Temporarily enables/disables the relay
- Useful for maintenance or testing
- No configuration is lost when disabled

---

## Quick Start Guide

### Step 1: Initial Setup

Run this command to set everything up:

```
/announcement-setup 
  private_channel: #mod-announcements
  public_channels: 1234567890,9876543210
```

**How to get channel IDs:**
1. Enable Developer Mode (User Settings > Advanced > Developer Mode)
2. Right-click on a channel
3. Click "Copy Channel ID"
4. Paste the IDs separated by commas

### Step 2: Test It!

1. Go to your private channel (#mod-announcements)
2. Post a message as a moderator
3. Check that it appears in all public channels
4. The message will be attributed to TZBOT

### Step 3: Manage Channels

Add more channels:
```
/announcement-add-channel channel: #news
```

Remove channels:
```
/announcement-remove-channel channel: #general
```

Check status:
```
/announcement-status
```

---

## Features

✅ **No Restart Required** - All changes apply instantly
✅ **Database Persistence** - Configuration survives bot restarts
✅ **Hot Reload** - Add/remove channels on the fly
✅ **Validation** - Checks channels exist and are valid
✅ **Max 5 Channels** - Prevents configuration errors
✅ **Admin Only** - Only administrators can use these commands

---

## Permissions Required

### Bot Permissions
The bot needs these permissions in all channels:
- Read Messages
- Send Messages
- Embed Links
- Attach Files

### User Permissions
Only users with **Administrator** permission can use these commands.

---

## Usage Example

### Initial Setup
```
Admin: /announcement-setup 
         private_channel: #mod-announcements
         public_channels: 1234567890,9876543210,5555555555

Bot: ✅ Announcement Relay Configured

     Private Channel: #mod-announcements
     Public Channels: #announcements, #general, #news

     Messages from moderators in #mod-announcements will now be 
     automatically relayed to the public channels.
```

### Adding a Channel
```
Admin: /announcement-add-channel channel: #updates

Bot: ✅ Channel Added

     #updates has been added to the announcement relay.

     Current public channels (4/5):
     • #announcements
     • #general
     • #news
     • #updates
```

### Checking Status
```
Admin: /announcement-status

Bot: 📢 Announcement Relay Status

     Status: 🟢 Active
     Private Channel: #mod-announcements

     Public Channels (4/5):
     • #announcements
     • #general
     • #news
     • #updates

     How it works:
     Messages from moderators in #mod-announcements are automatically 
     relayed to all public channels listed above.
```

---

## How It Works

1. **Moderator posts** in the private channel
2. **Bot detects** the message (checks moderator role)
3. **Bot relays** to all configured public channels
4. **Message appears** as coming from TZBOT
5. **All formatting preserved** (embeds, attachments, etc.)

---

## Error Handling

### Channel Not Found
```
❌ Channel with ID `1234567890` not found.
```
**Solution:** Double-check the channel ID

### Not a Text Channel
```
❌ Channel #voice-chat is not a text channel.
```
**Solution:** Only text channels can be used

### Max Channels Reached
```
❌ Maximum of 5 public channels reached. Remove a channel first.
```
**Solution:** Use `/announcement-remove-channel` first

### Channel Already Added
```
❌ Channel #announcements is already in the relay list.
```
**Solution:** Channel is already configured

---

## Technical Details

### Database Storage
Configuration is stored in the `config` table:
- `privateAnnouncementChannelId` - Private channel ID
- `publicAnnouncementChannelIds` - Comma-separated public channel IDs

### Real-Time Updates
When you use these commands, the bot:
1. Saves to database
2. Updates the `AnnouncementRelayManager` in memory
3. Changes take effect immediately

### Restart Behavior
On bot restart:
1. Loads configuration from database
2. Initializes `AnnouncementRelayManager` if configured
3. Starts monitoring the private channel

---

## Files Modified

1. **src/commands/announcement.commands.ts** (NEW)
   - All 5 slash commands
   - Validation logic
   - Database integration

2. **src/index.ts** (UPDATED)
   - Uncommented `AnnouncementRelayManager` import
   - Added initialization logic
   - Loads config from database
   - Registers announcement commands

3. **ANNOUNCEMENT_RELAY_GUIDE.md** (CREATED)
   - Complete setup guide
   - Troubleshooting tips

---

## Next Steps

1. **Build the bot:**
   ```bash
   npm run build
   ```

2. **Restart the bot:**
   ```bash
   npm start
   ```

3. **Run the setup command in Discord:**
   ```
   /announcement-setup 
     private_channel: #your-private-channel
     public_channels: id1,id2,id3
   ```

4. **Test it:**
   - Post a message in the private channel
   - Verify it appears in all public channels

---

## Support

If you encounter issues:
1. Check bot permissions in all channels
2. Verify channel IDs are correct
3. Use `/announcement-status` to check configuration
4. Check logs: `tail -f logs/tzbot-*.log`

---

## Summary

✅ **5 new slash commands** for managing announcement relay
✅ **No .env editing** required - all done in Discord
✅ **Hot reload** - changes apply instantly
✅ **Database persistence** - survives restarts
✅ **Full validation** - prevents configuration errors
✅ **Ready to use** - just build and restart!

The announcement relay system is now fully manageable through Discord commands. No more manual configuration files!
