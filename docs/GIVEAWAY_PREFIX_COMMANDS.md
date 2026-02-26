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
gw.reroll <giveaway_id> @username
```

**Parameters:**
- `giveaway_id`: The unique ID of the giveaway (shown in winner announcements)
- `@username`: Username with @ prefix (e.g., @parik) - Discord will auto-detect it

**Permissions Required:**
- Manage Events permission

**Examples:**
```
gw.reroll GW-02-16306 @parik
gw.reroll GW-02-16306 @Parik
```

**How it works:**
When you copy `gw.reroll GW-02-16306 @parik` and paste it, Discord automatically detects `@parik` and converts it to a proper mention. This makes it easy to copy and paste on both mobile and desktop.

**Behavior:**
- ✅ Accepts @username format (Discord auto-converts to mention)
- ✅ Accepts Discord mention format (<@123456>)
- ✅ Case-insensitive username matching
- ✅ Provides clear feedback messages for all scenarios
- ✅ Auto-deletes command and response messages after 10 seconds (keeps channels clean)
- ✅ Validates all inputs before processing
- ✅ Shows processing status while rerolling
- ✅ Announces new winner in the giveaway channel
- ✅ Easy to copy on both mobile and desktop
- ❌ Fails gracefully with helpful error messages

**Error Messages:**

| Scenario | Message |
|----------|---------|
| No permission | ❌ You need the `Manage Events` permission to use this command. |
| Invalid format | ❌ Invalid format. Use: `gw.reroll <giveaway_id> @username` |
| Invalid user | ❌ Invalid user. Please use the format: `gw.reroll <giveaway_id> @username` |
| Giveaway not found | ❌ Giveaway not found. Please check the giveaway ID. |
| Giveaway not ended | ❌ Can only reroll winners from ended giveaways. |
| User not a winner | ❌ This user is not a winner of this giveaway. |
| System error | ❌ An error occurred while rerolling. Please try again or use `/giveaway reroll` instead. |

## Comparison with Slash Commands

Both prefix and slash commands are supported for flexibility:

| Feature | Prefix Command | Slash Command |
|---------|---------------|---------------|
| Format | `gw.reroll <id> @username` | `/giveaway reroll giveaway_id:<id> winner:@user` |
| Speed | ⚡ Faster to type | Slower (more typing) |
| Autocomplete | ❌ No | ✅ Yes |
| Validation | ✅ Real-time | ✅ Before submission |
| Cleanup | ✅ Auto-deletes | ❌ Stays visible |
| Mobile-friendly | ✅ Very easy (@username format) | ⚠️ Requires more taps |
| Copy-friendly | ✅ @username Discord auto-detects | ⚠️ Mention format harder |

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

@Parik won the giveaway!

• Hosted by: BOBOC
• Reroll Command: gw.reroll GW-02-16306 @parik
```

The @username format makes it easy to copy and paste. When you paste `@parik`, Discord automatically detects it and converts it to a proper mention. This works on both mobile and desktop.

## Technical Implementation

### Message Flow

1. User sends `gw.reroll <id> @username` (Discord auto-converts @username to mention)
2. Bot validates permission (Manage Events)
3. Bot parses and validates all parameters (handles @username and <@id> formats)
4. Bot checks giveaway exists and is ended
5. Bot verifies user is a winner
6. Bot sends "🔄 Rerolling winner..." message
7. Bot performs reroll via confirmation system
8. Bot updates message to "✅ Winner rerolled successfully!"
9. Bot announces new winner in giveaway channel with @username format
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

1. **Use the @username format**: `gw.reroll <id> @username` - Discord auto-detects and converts it
2. **Copy from announcements**: The bot displays the exact command you need to copy
3. **Case doesn't matter**: @parik and @Parik both work
4. **Check permissions**: Ensure you have Manage Events permission
5. **Wait for confirmation**: The bot will show a success message when done

## Troubleshooting

**Command not working?**
- Check you have Manage Events permission
- Verify the giveaway ID is correct
- Make sure you're using @username format (e.g., @parik)
- Ensure the giveaway has ended
- Try typing the username - Discord should auto-complete it

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
