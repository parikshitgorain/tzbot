# Announcement Relay - Unknown Channels Issue & Fix

## Problem
The `/announcement-status` command is showing channels as `#_unknown` instead of the actual channel names.

## What This Means
When Discord shows `#_unknown`, it means:
1. The channel ID stored in the database is invalid/incorrect
2. The channel was deleted after being configured
3. The bot doesn't have permission to see that channel

## Root Cause
The channel IDs in your database don't match any channels the bot can see in your server. This likely happened because:
- You configured the relay with channels from a different server
- The channels were deleted after configuration
- The channel IDs were entered incorrectly

## Solution

### Step 1: Restart the Bot
First, restart the bot to load the updated code that will help diagnose the issue:

```bash
# Stop the bot (Ctrl+C)
# Then restart:
npm start
```

### Step 2: Run Status Command Again
After restart, run `/announcement-status` again. The updated command will now:
- Show ✅ next to valid channels
- Show ❌ with error details for invalid channels
- Display the actual channel IDs so you can verify them

### Step 3: Reconfigure with Correct Channels
Run `/announcement-setup` again and select the correct channels from the dropdown:

```
/announcement-setup
  private_channel: [Select your private channel]
  public_channel_1: [Select your public channel]
```

**Important:** Use the dropdown selectors - don't try to type channel IDs manually!

## Why the Dropdown is Important
When you use the dropdown selector:
- Discord automatically provides the correct channel ID
- You can see the channel names visually
- No risk of typos or wrong IDs
- The bot validates the channels exist

## Expected Result After Reconfiguration

### Before (Current):
```
Private Channel: #_unknown
Public Channels (1/5):
• #_unknown
```

### After (Fixed):
```
Private Channel: #announcement-private ✅
Public Channels (1/5):
• #announcements ✅
```

## Verification Steps

1. **Restart the bot** - Load the updated diagnostic code
2. **Run `/announcement-status`** - See which channels are invalid
3. **Run `/announcement-setup`** - Reconfigure with correct channels using dropdowns
4. **Run `/announcement-status` again** - Verify all channels show ✅
5. **Test the relay** - Post a message in the private channel

## Technical Details

### What Changed in the Code
The `/announcement-status` command now:
- Attempts to fetch each channel from Discord's API
- Shows ✅ if the channel is found and accessible
- Shows ❌ with the channel ID if the channel is invalid
- Provides clear error messages

### Channel ID Format
Discord channel IDs are 18-19 digit numbers (snowflakes), like:
- Valid: `1474852657079517200`
- Invalid: `123` or `abc` or empty string

### Database Storage
Channel IDs are stored in the `config` table:
- `privateAnnouncementChannelId` - Single channel ID
- `publicAnnouncementChannelIds` - Comma-separated list of IDs

## Common Issues

### Issue: All channels show as #_unknown
**Cause:** Wrong server or deleted channels
**Fix:** Run `/announcement-setup` again with correct channels

### Issue: Private channel works but public channels don't
**Cause:** Public channel IDs are incorrect
**Fix:** Use `/announcement-add-channel` to add correct channels, then `/announcement-remove-channel` to remove invalid ones

### Issue: Bot can't see the channels
**Cause:** Missing permissions
**Fix:** Ensure the bot has "View Channels" permission in all announcement channels

## Quick Fix Command Sequence

```bash
# 1. Restart bot
npm start

# 2. In Discord, run:
/announcement-status
# (Check which channels are invalid)

# 3. Reconfigure:
/announcement-setup
  private_channel: [Select from dropdown]
  public_channel_1: [Select from dropdown]

# 4. Verify:
/announcement-status
# (All channels should show ✅)

# 5. Test:
# Post a message in the private channel as a moderator
```

## Summary

✅ **Updated code** - Better diagnostics in `/announcement-status`
✅ **Built successfully** - Ready to deploy
⏳ **Restart required** - Load the new diagnostic code
🔧 **Reconfigure needed** - Use `/announcement-setup` with dropdowns

The issue is that the stored channel IDs don't match any channels in your server. Simply reconfigure using the dropdown selectors and it will work!
