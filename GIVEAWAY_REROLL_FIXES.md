# Giveaway Reroll Fixes

## Issues Fixed

### 1. Guild ID Error in Manual Reroll ✅

**Problem:** When using `gw.reroll`, the bot was trying to fetch the moderator as a guild member using the moderator's ID as the guild ID, causing "Unknown User" error.

**Error:**
```
DiscordAPIError[10013]: Unknown User
at GuildMemberManager._fetchSingle
url: "https://discord.com/api/v10/guilds/1340129566429024297/members/1340129566429024297"
```

**Root Cause:** The `manualReroll` method was using `moderatorId` instead of `guildId` when fetching guild members.

**Fix:**
- Changed `manualReroll` signature from `(giveawayId, userId, moderatorId)` to `(giveawayId, userId, guildId)`
- Removed unnecessary permission check that was causing the error
- Permission is already checked in the command handler before calling manualReroll

**Files Changed:**
- `src/giveaway/confirmation-system.ts` - Fixed manualReroll method
- `src/index.ts` - Updated call to use guildId

---

### 2. Single Entry Reroll Issue ✅

**Problem:** When only one person entered the giveaway and they were rerolled, there were no other participants to select.

**Fix:**
- The reroll handler already handles this correctly by returning `null` when no eligible participants remain
- Added proper error handling to show "Giveaway Complete - no eligible participants" message
- System gracefully handles the edge case

---

### 3. Command Message Not Deleted ✅

**Problem:** The `gw.reroll` command message was not being deleted, leaving clutter in the channel.

**Fix:**
- Added immediate deletion of command message after validation
- Uses try-catch to handle deletion failures gracefully
- Processing message is still shown and auto-deleted after 10 seconds

**Before:**
```
User: gw.reroll abc123 @winner
Bot: 🔄 Rerolling winner...
Bot: ✅ Winner rerolled successfully!
[Both messages stay visible]
```

**After:**
```
[Command message deleted immediately]
Bot: 🔄 Rerolling winner...
Bot: ✅ Winner rerolled successfully!
[Bot message auto-deletes after 10 seconds]
```

---

### 4. Slash Command Format in Messages ✅

**Problem:** Winner announcement messages were showing both `gw.reroll` and `/giveaway reroll` formats, making it cluttered.

**Fix:**
- Removed slash command format from reroll announcements
- Only show the cleaner `gw.reroll` prefix command
- Slash command is still available but not advertised in every message

**Before:**
```
Moderators: To manually reroll a winner, use:
gw.reroll 16a0f358... @user

or

/giveaway reroll giveaway_id:16a0f358... winner:@user
```

**After:**
```
Moderators: To manually reroll a winner, use:
gw.reroll 16a0f358... @user
```

---

### 5. Response Delays Added ✅

**Problem:** Bot was sending messages too quickly, potentially hitting rate limits and appearing robotic.

**Fix:**
- Added 500ms delay before sending channel messages
- Added 300ms delay before sending DM messages
- Prevents rate limiting issues
- Makes bot behavior more natural

**Delays Added:**
- Winner announcement: 500ms before channel message, 300ms before DMs
- Reminder: 500ms before channel message, 300ms before DM
- Confirmation: 500ms before channel message, 300ms before DM
- Reroll announcement: 500ms before channel message, 300ms before DM

---

## Technical Details

### manualReroll Method Changes

**Before:**
```typescript
async manualReroll(
  giveawayId: string,
  userId: string,
  moderatorId: string,  // ❌ Wrong parameter
): Promise<void> {
  const guild = await this.client.guilds.fetch(giveaway.guildId);
  const moderatorMember = await guild.members.fetch(moderatorId);  // ❌ Causes error
  // ... permission check
}
```

**After:**
```typescript
async manualReroll(
  giveawayId: string,
  userId: string,
  guildId: string,  // ✅ Correct parameter
): Promise<void> {
  // Permission already checked in command handler
  // Just perform the reroll
}
```

### Message Deletion Logic

```typescript
// Delete command message immediately
try {
  await message.delete();
} catch (error) {
  logger.debug('Failed to delete command message', {
    messageId: message.id,
    error: (error as Error).message,
  });
}
```

### Delay Implementation

```typescript
// Add small delay before sending
await new Promise(resolve => setTimeout(resolve, 500));

// Send channel message
await channel.send({ content: mention, embeds: [embed] });

// Add small delay before DM
await new Promise(resolve => setTimeout(resolve, 300));

// Send DM
await user.send({ embeds: [dmEmbed] });
```

---

## Testing Checklist

- [x] Reroll with multiple entries works
- [x] Reroll with single entry shows "no eligible participants"
- [x] Command message is deleted immediately
- [x] Processing message auto-deletes after 10 seconds
- [x] Only `gw.reroll` format shown in messages
- [x] Delays prevent rate limiting
- [x] Error messages are clear and helpful
- [x] Guild ID is used correctly

---

## Error Handling

### Single Entry Case
```
❌ No eligible participants remain
✅ Shows "Giveaway Complete" message
✅ Logs the event
✅ Doesn't crash or show error to user
```

### Permission Errors
```
❌ User lacks permission
✅ Shows clear error message
✅ Auto-deletes after 5 seconds
✅ Deletes command message
```

### Invalid Input
```
❌ Invalid giveaway ID
✅ Shows "Giveaway not found" message
✅ Auto-deletes after 10 seconds
✅ Deletes command message
```

---

## Related Files

- `src/giveaway/confirmation-system.ts` - Main reroll logic
- `src/giveaway/reroll-handler.ts` - Winner selection logic
- `src/index.ts` - Command handler
- `docs/GIVEAWAY_PREFIX_COMMANDS.md` - Command documentation

---

## Summary

All reroll issues have been fixed:
- ✅ Guild ID error resolved
- ✅ Single entry case handled gracefully
- ✅ Command messages deleted properly
- ✅ Clean message format (no slash commands shown)
- ✅ Response delays added for rate limit prevention
- ✅ Better error handling throughout

The reroll system is now stable and production-ready!
