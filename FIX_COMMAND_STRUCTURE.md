# Fix Command Structure - Force Discord to Update

## Problem

Discord is caching the old command structure and showing multiple `/setup` commands instead of one command with subcommands.

## Solution - Force Clear and Re-register

Follow these steps IN ORDER:

### Step 1: Stop the Bot

Stop the bot if it's running:
```bash
# Press Ctrl+C in the terminal where the bot is running
# OR
pm2 stop tzbot
```

### Step 2: Clear All Commands

Run the clear commands script:
```bash
npm run commands:clear
```

This will:
- Delete all guild commands
- Delete all global commands
- Force Discord to clear its cache

### Step 3: Wait 30 Seconds

Wait at least 30 seconds for Discord to process the deletion.

### Step 4: Restart the Bot

```bash
npm start
# OR
pm2 start tzbot
```

The bot will automatically re-register all commands with the correct structure.

### Step 5: Wait for Discord to Update

Wait 1-2 minutes for Discord to propagate the new commands.

### Step 6: Refresh Discord

- Close and reopen Discord completely
- OR use Discord web in a new incognito window
- OR use Discord mobile

### Step 7: Verify

Type `/setup` in Discord. You should now see:

```
/setup
  channel - Configure channel settings
  role - Configure role settings
```

When you select `channel`, you'll see:
- `notification` - Set the notification channel
- `fallback` - Set the fallback notification channel

When you select `role`, you'll see:
- `subscriber` - Set the subscriber role
- `vip` - Set the VIP role
- `moderator` - Set the moderator role

## If It Still Doesn't Work

### Option 1: Clear Commands Manually via Discord Developer Portal

1. Go to https://discord.com/developers/applications
2. Select your bot application
3. Go to "Bot" section
4. Scroll down to "Slash Commands"
5. Delete all commands manually
6. Restart your bot

### Option 2: Use a Different Guild for Testing

1. Invite the bot to a new test server
2. Update `GUILD_ID` in `.env` to the new server ID
3. Restart the bot
4. Commands will register fresh in the new server

### Option 3: Wait for Global Command Propagation

If you're using global commands (no GUILD_ID set):
- Global commands take up to 1 hour to propagate
- Use guild commands for faster updates during development

## Technical Details

### Why This Happens

Discord caches slash commands aggressively for performance. When you update command structure (like changing from multiple commands to subcommands), Discord may not immediately reflect the changes.

### Command Registration Method

The bot uses `PUT` to replace all commands:
```typescript
await rest.put(
  Routes.applicationGuildCommands(clientId, guildId),
  { body: commandsJson }
);
```

This SHOULD replace all commands, but Discord's cache can cause issues.

### The Clear Script

The clear script sends an empty array to Discord:
```typescript
await rest.put(
  Routes.applicationGuildCommands(clientId, guildId),
  { body: [] }  // Empty array = delete all
);
```

This forces Discord to clear its cache.

## Prevention

To avoid this issue in the future:

1. **Use guild commands during development** - They update instantly
2. **Clear commands before major structure changes** - Run `npm run commands:clear` first
3. **Test in a separate guild** - Keep a test server for command testing
4. **Wait between changes** - Give Discord time to propagate updates

## Verification Checklist

- [ ] Bot is stopped
- [ ] Ran `npm run commands:clear`
- [ ] Waited 30 seconds
- [ ] Restarted bot
- [ ] Waited 1-2 minutes
- [ ] Refreshed Discord client
- [ ] Typed `/setup` and see subcommand groups
- [ ] Can select `channel` or `role` groups
- [ ] Can see subcommands under each group
