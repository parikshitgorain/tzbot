# TZBOT Command Reference

Quick reference for all TZBOT slash commands.

## Table of Contents

- [User Commands](#user-commands)
- [Moderator Commands](#moderator-commands)
- [Admin Commands](#admin-commands)
- [Command Examples](#command-examples)
- [Permission Requirements](#permission-requirements)

---

## User Commands

### `/link`

Link your Discord account to your Kick account.

**Syntax:**
```
/link kick_username:<username>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| kick_username | String | Yes | Your Kick.com username |

**Example:**
```
/link kick_username:CoolStreamer123
```

**Response:**
```
✅ Successfully linked your Discord account to Kick username: CoolStreamer123

You will now receive role updates based on your Kick status.
```

**Notes:**
- You can only link one Kick account per Discord account
- Each Kick account can only be linked to one Discord account
- Use `/unlink` to remove the link before linking a different account

---

### `/unlink`

Remove the link between your Discord and Kick accounts.

**Syntax:**
```
/unlink
```

**Parameters:** None

**Example:**
```
/unlink
```

**Response:**
```
✅ Successfully unlinked your Discord account from Kick username: CoolStreamer123
```

**Notes:**
- This removes automatic role synchronization
- You can re-link at any time with `/link`
- This does not delete your data (use `/deletemydata` for that)

---

### `/checklink`

Check if your Discord account is linked to a Kick account.

**Syntax:**
```
/checklink
```

**Parameters:** None

**Example:**
```
/checklink
```

**Response (if linked):**
```
✅ Your Discord account is linked to Kick username: CoolStreamer123
```

**Response (if not linked):**
```
❌ Your Discord account is not linked to any Kick account.

Use /link to link your accounts.
```

---

### `/deletemydata`

Delete all your data from the bot (GDPR compliance).

**Syntax:**
```
/deletemydata
```

**Parameters:** None

**Example:**
```
/deletemydata
```

**Response:**
```
✅ All your data has been permanently deleted from the bot.

Deleted data includes:
- Account links
- Violation history
- Chat activity records
- Giveaway entries
- Message content
- Chat rain winner records
- Moderation logs (where you are the target)
```

**Warning:** This action is permanent and cannot be undone!

---

## Moderator Commands

### `/ban`

Permanently ban a user from the server.

**Syntax:**
```
/ban user:<@user> reason:<reason>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user | User | Yes | The user to ban |
| reason | String | Yes | Reason for the ban |

**Example:**
```
/ban user:@Spammer reason:Repeated spam after multiple warnings
```

**Response:**
```
✅ Successfully banned Spammer (123456789012345678).
Reason: Repeated spam after multiple warnings
```

**What happens:**
- User is immediately banned from the server
- User receives a DM with the ban reason
- Action is logged in moderation logs
- Violation is recorded in database

**Required Permission:** BAN_MEMBERS

---

### `/timeout`

Temporarily mute a user for a specified duration.

**Syntax:**
```
/timeout user:<@user> duration:<minutes> reason:<reason>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user | User | Yes | The user to timeout |
| duration | Integer | Yes | Duration in minutes (1-40320) |
| reason | String | Yes | Reason for the timeout |

**Example:**
```
/timeout user:@Troublemaker duration:120 reason:Disruptive behavior in chat
```

**Response:**
```
✅ Successfully timed out Troublemaker (123456789012345678) for 120 minutes.
Reason: Disruptive behavior in chat
```

**Duration Limits:**
- Minimum: 1 minute
- Maximum: 40,320 minutes (28 days)

**What happens:**
- User cannot send messages, react, or speak in voice channels
- User receives a DM with reason and duration
- Action is logged in moderation logs
- Timeout automatically expires after duration

**Required Permission:** MODERATE_MEMBERS

---

### `/warn`

Issue a warning to a user.

**Syntax:**
```
/warn user:<@user> reason:<reason>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user | User | Yes | The user to warn |
| reason | String | Yes | Reason for the warning |

**Example:**
```
/warn user:@NewUser reason:Please avoid posting links without permission
```

**Response:**
```
✅ Successfully warned NewUser (123456789012345678).
Reason: Please avoid posting links without permission
```

**What happens:**
- User receives a DM with warning and rules reminder
- Warning is recorded in database
- Action is logged in moderation logs
- Warnings contribute to automatic escalation

**Required Permission:** MODERATE_MEMBERS

---

### `/kick`

Remove a user from the server (they can rejoin with an invite).

**Syntax:**
```
/kick user:<@user> reason:<reason>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user | User | Yes | The user to kick |
| reason | String | Yes | Reason for the kick |

**Example:**
```
/kick user:@Raider reason:Raiding from another server
```

**Response:**
```
✅ Successfully kicked Raider (123456789012345678).
Reason: Raiding from another server
```

**What happens:**
- User is immediately removed from the server
- User receives a DM with the kick reason
- Action is logged in moderation logs
- User can rejoin if they have a valid invite link

**Required Permission:** KICK_MEMBERS

---

## Admin Commands

### `/config`

Display the current bot configuration.

**Syntax:**
```
/config
```

**Parameters:** None

**Example:**
```
/config
```

**Response:**
```
🔧 Bot Configuration

Guild ID: 123456789012345678
Client ID: 987654321098765432
Notification Channel: #notifications
Fallback Channel: #general
Subscriber Role: @Subscriber
VIP Role: @VIP
Moderator Role: @Moderator
Read-Only Channels: #announcements, #rules
Link Scanning: ✅ Enabled
AI Responder: ❌ Disabled
Chat Rain: ✅ Enabled
Spam Threshold: 5 identical messages in 10s
                10 rapid messages in 5s
```

**Required Permission:** ADMINISTRATOR

---

## Command Examples

### Account Linking Workflow

```
User: /link kick_username:StreamerPro
Bot: ✅ Successfully linked your Discord account to Kick username: StreamerPro

User: /checklink
Bot: ✅ Your Discord account is linked to Kick username: StreamerPro

User: /unlink
Bot: ✅ Successfully unlinked your Discord account from Kick username: StreamerPro
```

---

### Moderation Workflow

```
Moderator: /warn user:@User reason:First warning for spam
Bot: ✅ Successfully warned User (123456789012345678).

[User continues spamming]

Moderator: /timeout user:@User duration:60 reason:Second violation - spam
Bot: ✅ Successfully timed out User for 60 minutes.

[User returns and spams again]

Moderator: /ban user:@User reason:Third violation - repeated spam
Bot: ✅ Successfully banned User.
```

---

### Giveaway Participation

```
[Giveaway message appears with button]

User: [Clicks "Enter Giveaway" button]
Bot: ✅ You've successfully entered the giveaway!

User: [Clicks button again]
Bot: ❌ You've already entered this giveaway.

[Giveaway ends]

Bot: 🎉 Giveaway Ended!
     Winners: @User1, @User2, @User3
```

---

## Permission Requirements

### User Commands

| Command | Required Permission | Notes |
|---------|-------------------|-------|
| /link | None | Available to all users |
| /unlink | None | Available to all users |
| /checklink | None | Available to all users |
| /deletemydata | None | Available to all users |

### Moderator Commands

| Command | Required Permission | Discord Permission |
|---------|-------------------|-------------------|
| /ban | Moderator Role | BAN_MEMBERS |
| /timeout | Moderator Role | MODERATE_MEMBERS |
| /warn | Moderator Role | MODERATE_MEMBERS |
| /kick | Moderator Role | KICK_MEMBERS |

### Admin Commands

| Command | Required Permission | Discord Permission |
|---------|-------------------|-------------------|
| /config | Moderator Role | ADMINISTRATOR |

---

## Command Response Times

| Command Type | Expected Response Time |
|-------------|----------------------|
| User Commands | <1 second |
| Moderation Commands | <1 second |
| Admin Commands | <2 seconds |
| Giveaway Entry | <1 second |

---

## Command Cooldowns

| Command | Cooldown | Applies To |
|---------|----------|-----------|
| /link | 5 seconds | Per user |
| /unlink | 5 seconds | Per user |
| /checklink | 3 seconds | Per user |
| /deletemydata | 60 seconds | Per user |
| /ban | None | - |
| /timeout | None | - |
| /warn | None | - |
| /kick | None | - |
| /config | 10 seconds | Per user |

---

## Error Messages

### Common Errors

**"This command can only be used in a server."**
- Cause: Command used in DMs
- Solution: Use command in a server channel

**"You don't have permission to use this command."**
- Cause: Missing required role or permission
- Solution: Contact a moderator

**"Interaction failed"**
- Cause: Command timeout or internal error
- Solution: Try again, contact moderator if persists

**"Your Discord account is already linked to Kick username: X"**
- Cause: Account already linked
- Solution: Use `/unlink` first, then `/link` with new username

**"This Kick username is already linked to another Discord account."**
- Cause: Kick account already linked elsewhere
- Solution: Unlink from other Discord account first

**"You don't have the required roles"**
- Cause: Missing roles for giveaway entry
- Solution: Check giveaway requirements, link Kick account if needed

---

## Command Aliases

TZBOT uses slash commands only. There are no text-based command aliases.

**Why slash commands?**
- ✅ Auto-completion
- ✅ Built-in help text
- ✅ Parameter validation
- ✅ Better user experience
- ✅ No prefix conflicts

---

## Command Tips

### For Users

1. **Use tab completion** - Press Tab to auto-complete command parameters
2. **Read the descriptions** - Each parameter has a helpful description
3. **Check your DMs** - Bot sends important notifications via DM
4. **Enable DMs** - Allow DMs from server members to receive notifications

### For Moderators

1. **Always provide reasons** - Clear reasons help with accountability
2. **Use appropriate durations** - Match timeout duration to violation severity
3. **Check logs regularly** - Review moderation logs for patterns
4. **Document decisions** - Use detailed reasons for future reference

### For Admins

1. **Test in dev server** - Test commands in a development server first
2. **Monitor performance** - Use `/config` to verify settings
3. **Review logs** - Check logs for errors and warnings
4. **Keep documentation handy** - Bookmark this reference

---

## Keyboard Shortcuts

When typing commands in Discord:

| Shortcut | Action |
|----------|--------|
| `/` | Open command menu |
| `Tab` | Auto-complete parameter |
| `Enter` | Execute command |
| `Esc` | Cancel command |
| `↑` `↓` | Navigate command list |

---

## Command Formatting

### Mentioning Users

```
/ban user:@Username reason:Reason
```

Use `@` to mention users, or type their name and select from the list.

### Duration Format

```
/timeout user:@User duration:60 reason:Reason
```

Duration is always in **minutes**:
- 60 = 1 hour
- 1440 = 1 day
- 10080 = 1 week
- 40320 = 28 days (maximum)

### Reason Format

```
/warn user:@User reason:Please read the rules before posting
```

Reasons can be any text up to 512 characters. Be clear and specific.

---

## Command Best Practices

### Do's ✅

- ✅ Use clear, specific reasons
- ✅ Match punishment to violation severity
- ✅ Document all moderation actions
- ✅ Communicate with users
- ✅ Review logs regularly
- ✅ Test commands in safe environment first

### Don'ts ❌

- ❌ Abuse moderation commands
- ❌ Use vague reasons like "bad"
- ❌ Skip documentation
- ❌ Ignore user appeals
- ❌ Forget to check logs
- ❌ Test on production server

---

## Getting Help with Commands

### If a command doesn't work:

1. **Check permissions** - Verify you have required role/permissions
2. **Check syntax** - Ensure parameters are correct
3. **Check bot status** - Verify bot is online
4. **Check logs** - Look for error messages
5. **Ask for help** - Contact moderators or admins

### If you need more information:

- **User Guide**: [./USER_GUIDE.md](./USER_GUIDE.md)
- **Moderator Guide**: [./MODERATOR_QUICK_REFERENCE.md](./MODERATOR_QUICK_REFERENCE.md)
- **Troubleshooting**: [./TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## Command Changelog

### Version 1.0.0 (2025-02-21)

**Added:**
- `/link` - Link Discord and Kick accounts
- `/unlink` - Unlink accounts
- `/checklink` - Check link status
- `/deletemydata` - GDPR data deletion
- `/ban` - Ban users
- `/timeout` - Timeout users
- `/warn` - Warn users
- `/kick` - Kick users
- `/config` - View configuration

**Future Commands (Planned):**
- `/giveaway` - Create giveaways
- `/ai-toggle` - Toggle AI responder
- `/kb` - Knowledge base management

---

**Last Updated:** 2025-02-21
**Version:** 1.0.0

