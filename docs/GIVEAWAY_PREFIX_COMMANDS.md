# Giveaway Prefix Commands

## Overview

In addition to slash commands, the bot supports prefix commands for quick giveaway management. These commands are designed to be clean, stable, and similar to popular giveaway bots.

## Command Prefix

The bot uses the `gw.` prefix for all giveaway-related prefix commands.

## Available Commands

### gw.reroll

Reroll a specific winner from an ended giveaway.

**Format:**
```
gw.reroll <giveaway_id> @user
```

**Parameters:**
- `giveaway_id`: The unique ID of the giveaway (shown in winner announcements)
- `@user`: Mention of the user to reroll/replace

**Permissions Required:**
- Manage Events permission

**Example:**
```
gw.reroll 1475607354715279361 @Ace
```

**Behavior:**
- ✅ Provides clear feedback messages for all scenarios
- ✅ Auto-deletes command and response messages after 10 seconds (keeps channels clean)
- ✅ Validates all inputs before processing
- ✅ Shows processing status while rerolling
- ✅ Announces new winner in the giveaway channel
- ❌ Fails gracefully with helpful error messages

**Error Messages:**

| Scenario | Message |
|----------|---------|
| No permission | ❌ You need the `Manage Events` permission to use this command. |
| Invalid format | ❌ Invalid format. Use: `gw.reroll <giveaway_id> @user` |
| Invalid mention | ❌ Invalid user mention. Please mention a user like @username |
| Giveaway not found | ❌ Giveaway not found. Please check the giveaway ID. |
| Giveaway not ended | ❌ Can only reroll winners from ended giveaways. |
| User not a winner | ❌ This user is not a winner of this giveaway. |
| System error | ❌ An error occurred while rerolling. Please try again or use `/giveaway reroll` instead. |

## Comparison with Slash Commands

Both prefix and slash commands are supported for flexibility:

| Feature | Prefix Command | Slash Command |
|---------|---------------|---------------|
| Format | `gw.reroll <id> @user` | `/giveaway reroll giveaway_id:<id> winner:@user` |
| Speed | ⚡ Faster to type | Slower (more typing) |
| Autocomplete | ❌ No | ✅ Yes |
| Validation | ✅ Real-time | ✅ Before submission |
| Cleanup | ✅ Auto-deletes | ❌ Stays visible |
| Mobile-friendly | ✅ Very easy | ⚠️ Requires more taps |

## Design Philosophy

The prefix command system is designed to match the UX of popular giveaway bots:

1. **Clean and Simple**: Short prefix (`gw.`) that's easy to remember
2. **Helpful Feedback**: Clear error messages guide users to correct usage
3. **Auto-cleanup**: Commands and responses auto-delete to keep channels tidy
4. **Fail-safe**: Validates everything before making changes
5. **Consistent**: Works the same way as other popular bots

## Finding Giveaway IDs

The giveaway ID is displayed in:
- Winner announcement messages
- Reroll command suggestions
- `/giveaway list` command output

Example from winner announcement:
```
Congratulations! 🎉

@Ace's won the giveaway of 10!

• Hosted by: BOBOC
• Reroll Command: gw.reroll 1475607354715279361 @Ace
```

## Technical Implementation

### Message Flow

1. User sends `gw.reroll <id> @user`
2. Bot validates permission (Manage Events)
3. Bot parses and validates all parameters
4. Bot checks giveaway exists and is ended
5. Bot verifies user is a winner
6. Bot sends "🔄 Rerolling winner..." message
7. Bot performs reroll via confirmation system
8. Bot updates message to "✅ Winner rerolled successfully!"
9. Bot announces new winner in giveaway channel
10. Bot auto-deletes command and response after 10 seconds

### Error Handling

- All errors are caught and logged
- User-friendly error messages are shown
- Messages auto-delete to avoid clutter
- Fallback to slash command is suggested on system errors

### Permission Checks

- Requires `Manage Events` permission
- Permission is checked before any processing
- Clear error message if permission is missing

### Auto-cleanup

- Success messages: Deleted after 10 seconds
- Error messages: Deleted after 10 seconds (or 5 seconds for permission errors)
- Original command: Always deleted with the response
- Keeps channels clean and professional

## Best Practices

1. **Use the short format**: `gw.reroll <id> @user` is faster than slash commands
2. **Copy the ID**: Copy the giveaway ID from the winner announcement
3. **Mention correctly**: Use Discord's @mention feature, don't type manually
4. **Check permissions**: Ensure you have Manage Events permission
5. **Wait for confirmation**: The bot will show a success message when done

## Troubleshooting

**Command not working?**
- Check you have Manage Events permission
- Verify the giveaway ID is correct
- Make sure you're mentioning the user correctly
- Ensure the giveaway has ended

**Messages not deleting?**
- This is normal - they auto-delete after 10 seconds
- If they don't delete, the bot may lack message management permissions

**Error messages?**
- Read the error message carefully - it tells you exactly what's wrong
- Follow the suggested format in the error message
- Try the slash command as a fallback

## Related Documentation

- [Giveaway Command Reference](./COMMAND_REFERENCE.md#giveaway-commands)
- [Giveaway Quick Reference](./GIVEAWAY_QUICK_REFERENCE.md)
- [Giveaway Fixes](./GIVEAWAY_FIXES.md)
