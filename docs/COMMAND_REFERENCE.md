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

Issue a warning to a user and record an offense.

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
Offense #1: Warning
Next punishment: Warning
Reason: Please avoid posting links without permission
```

**What happens:**
- Offense is recorded in database
- Appropriate punishment is applied based on offense count
- User receives a DM with warning, offense count, and next punishment
- Ephemeral message sent in channel
- Action is logged in mod-log channel

**Progressive Punishment:**
- 1st-2nd offense: Warning only
- 3rd offense: 1-hour timeout
- 4th offense: 2-hour timeout
- 5th offense: 4-hour timeout
- 6th offense: 8-hour timeout
- 7th offense: 16-hour timeout
- 8th+ offense: Permanent ban

**Required Permission:** MODERATE_MEMBERS

---

### `/warnlist`

View a user's complete offense history.

**Syntax:**
```
/warnlist user:<@user>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user | User | Yes | The user to check |

**Example:**
```
/warnlist user:@Spammer
```

**Response:**
```
📋 Offense History for Spammer

Total Offenses: 3
Current Status: 1-hour timeout
Last Offense: 2 hours ago
Next Punishment: 2-hour timeout

Offense History:
1. 3 days ago - Warning
   Reason: Spam messages
   Moderator: @ModName

2. 2 days ago - Warning
   Reason: Repeated spam
   Moderator: @ModName

3. 2 hours ago - 1-hour timeout
   Reason: Continued spam behavior
   Moderator: @ModName
```

**Required Permission:** MODERATE_MEMBERS

---

### `/warnall`

View all users with active offenses.

**Syntax:**
```
/warnall
```

**Parameters:** None

**Example:**
```
/warnall
```

**Response:**
```
📋 All Active Offenses

User: @Spammer
Offenses: 3 | Status: 1h timeout | Last: 2h ago

User: @Troublemaker
Offenses: 2 | Status: Warning | Last: 1d ago

User: @NewUser
Offenses: 1 | Status: Warning | Last: 3h ago

Total: 3 users with active offenses
```

**Required Permission:** MODERATE_MEMBERS

---

### `/clearwarn`

Remove the most recent offense from a user's history.

**Syntax:**
```
/clearwarn user:<@user>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user | User | Yes | The user whose last offense to clear |

**Example:**
```
/clearwarn user:@NewUser
```

**Response:**
```
✅ Cleared last offense for NewUser

Previous: 3 offenses (1-hour timeout)
Current: 2 offenses (Warning)
```

**What happens:**
- Most recent offense is removed from database
- Punishment status is recalculated based on remaining offenses
- Action is logged in mod-log channel

**Use Cases:**
- Correcting mistakes
- Showing leniency
- Removing accidental warnings

**Required Permission:** MODERATE_MEMBERS

---

### `/resetoffenses`

Clear all offenses for a user (moderator override).

**Syntax:**
```
/resetoffenses user:<@user>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user | User | Yes | The user whose offenses to reset |

**Example:**
```
/resetoffenses user:@ReformedUser
```

**Response:**
```
✅ Reset all offenses for ReformedUser

Cleared: 5 offenses
Previous status: 4-hour timeout
New status: Clean record
```

**What happens:**
- All offense records are permanently deleted
- User's punishment status is cleared
- Ban status is removed (if applicable)
- Action is logged in mod-log channel

**Use Cases:**
- User has reformed after long period
- Correcting major mistakes
- Fresh start after appeal

**Warning:** This action is permanent and cannot be undone!

**Required Permission:** MODERATE_MEMBERS

---

### `/modlog`

View all moderation actions taken against a user.

**Syntax:**
```
/modlog user:<@user>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user | User | Yes | The user to check |

**Example:**
```
/modlog user:@Spammer
```

**Response:**
```
📜 Moderation Log for Spammer

Total Actions: 5

1. 5 days ago - Warning
   Reason: First spam warning
   Moderator: @Mod1

2. 4 days ago - Warning
   Reason: Repeated spam
   Moderator: @Mod1

3. 3 days ago - 1-hour timeout
   Reason: Third spam offense
   Moderator: @Mod2

4. 2 days ago - Offense cleared
   Moderator: @Mod1

5. 1 hour ago - 1-hour timeout
   Reason: Spam after warning
   Moderator: @Mod2
```

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

### `/setup` (NEW!)

Configure bot settings directly through Discord without editing configuration files.

**Syntax:**
```
/setup channel notification <channel>
/setup channel fallback <channel>
/setup role subscriber <role>
/setup role vip <role>
/setup role moderator <role>
```

**Parameters:**

#### Channel Subcommands

**`/setup channel notification`**
Set the notification channel where the bot sends important messages.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| channel | Channel | Yes | The channel for notifications |

**Example:**
```
/setup channel notification channel:#notifications
```

**Response:**
```
✅ Notification channel set to #notifications
```

---

**`/setup channel fallback`**
Set the fallback notification channel used when the primary channel is unavailable.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| channel | Channel | Yes | The fallback channel |

**Example:**
```
/setup channel fallback channel:#general
```

**Response:**
```
✅ Fallback channel set to #general
```

---

#### Role Subcommands

**`/setup role subscriber`**
Set the role assigned to Kick subscribers.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| role | Role | Yes | The subscriber role |

**Example:**
```
/setup role subscriber role:@Subscriber
```

**Response:**
```
✅ Subscriber role set to @Subscriber
```

---

**`/setup role vip`**
Set the role assigned to Kick VIPs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| role | Role | Yes | The VIP role |

**Example:**
```
/setup role vip role:@VIP
```

**Response:**
```
✅ VIP role set to @VIP
```

---

**`/setup role moderator`**
Set the role that grants moderator permissions for bot commands.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| role | Role | Yes | The moderator role |

**Example:**
```
/setup role moderator role:@Moderator
```

**Response:**
```
✅ Moderator role set to @Moderator
```

---

**Notes:**
- All settings are saved to the database and persist across bot restarts
- Changes take effect immediately
- You can verify changes using `/config`
- Only users with Administrator permission can use this command

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
| /warnlist | Moderator Role | MODERATE_MEMBERS |
| /warnall | Moderator Role | MODERATE_MEMBERS |
| /clearwarn | Moderator Role | MODERATE_MEMBERS |
| /resetoffenses | Moderator Role | MODERATE_MEMBERS |
| /modlog | Moderator Role | MODERATE_MEMBERS |
| /kick | Moderator Role | KICK_MEMBERS |

### Admin Commands

| Command | Required Permission | Discord Permission |
|---------|-------------------|-------------------|
| /config | Moderator Role | ADMINISTRATOR |
| /setup | Moderator Role | ADMINISTRATOR |

### Giveaway Commands

| Command | Required Permission | Discord Permission |
|---------|-------------------|-------------------|
| /giveaway create | Moderator Role | MANAGE_EVENTS |
| /giveaway cancel | Moderator Role | MANAGE_EVENTS |
| /giveaway list | Moderator Role | MANAGE_EVENTS |
| Giveaway Entry (Button) | None | None |

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

### Version 1.0.1 (2026-02-21)

**Added:**
- `/setup` - Configure bot settings through Discord (channels and roles)
  - `/setup channel notification` - Set notification channel
  - `/setup channel fallback` - Set fallback channel
  - `/setup role subscriber` - Set subscriber role
  - `/setup role vip` - Set VIP role
  - `/setup role moderator` - Set moderator role

**Notes:**
- Configuration changes are now saved to database and persist across restarts
- No more manual `.env` file editing required for basic configuration

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
- `/ai-toggle` - Toggle AI responder
- `/kb` - Knowledge base management

---

## Giveaway Commands

### `/giveaway create`

Create a new giveaway with interactive button entry.

**Syntax:**
```
/giveaway create title:<title> description:<description> duration:<minutes> winners:<count> [channel:<channel>] [role1:<role>] [role2:<role>] [role3:<role>]
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| title | String | Yes | Title of the giveaway (max 256 chars) |
| description | String | Yes | Description of the giveaway (max 1024 chars) |
| duration | Integer | Yes | Duration in minutes (1-10080 = 7 days max) |
| winners | Integer | Yes | Number of winners (1-10) |
| channel | Channel | No | Channel to post giveaway (defaults to current) |
| role1 | Role | No | Required role 1 (optional) |
| role2 | Role | No | Required role 2 (optional) |
| role3 | Role | No | Required role 3 (optional) |

**Example (Open to Everyone):**
```
/giveaway create title:Free Game Key description:Win a Steam game key! duration:1440 winners:3
```

**Example (Role-Gated):**
```
/giveaway create title:Subscriber Giveaway description:Exclusive for subscribers! duration:2880 winners:5 role1:@Subscriber
```

**Response:**
```
✅ Giveaway created successfully!

ID: abc123def456
Title: Free Game Key
Channel: #giveaways
Duration: 1440 minutes (1 day)
Winners: 3
Required Roles: None (open to everyone)

The giveaway has been posted in #giveaways. Users can enter by clicking the button!
```

**What happens:**
- Giveaway message is posted with interactive button
- Users click "🎉 Enter Giveaway" button to enter
- Entry validation checks required roles (if any)
- Winners are selected using CSPRNG when giveaway ends
- Winners are announced and receive DMs

**Duration Limits:**
- Minimum: 1 minute
- Maximum: 10,080 minutes (7 days)

**Winner Limits:**
- Minimum: 1 winner
- Maximum: 10 winners

**Required Permission:** MANAGE_EVENTS

---

### `/giveaway cancel`

Cancel an active giveaway before it ends.

**Syntax:**
```
/giveaway cancel giveaway_id:<id>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| giveaway_id | String | Yes | ID of the giveaway to cancel |

**Example:**
```
/giveaway cancel giveaway_id:abc123def456
```

**Response:**
```
✅ Giveaway abc123def456 has been cancelled.
```

**What happens:**
- Giveaway status is set to "cancelled"
- Giveaway message is updated to show cancellation
- Entry button is disabled
- No winners are selected
- Action is logged

**Use Cases:**
- Correcting mistakes
- Changing giveaway terms
- Responding to issues

**Required Permission:** MANAGE_EVENTS

---

### `/giveaway list`

List all active giveaways in the server.

**Syntax:**
```
/giveaway list
```

**Parameters:** None

**Example:**
```
/giveaway list
```

**Response:**
```
🎉 Active Giveaways

Total active giveaways: 2

Free Game Key
Channel: #giveaways
Entries: 45
Winners: 3
Ends: in 12 hours
ID: abc123def456

Subscriber Giveaway
Channel: #giveaways
Entries: 23
Winners: 5
Ends: in 2 days
ID: def456ghi789
```

**Required Permission:** MANAGE_EVENTS

---

### Giveaway Entry (Button Interaction)

Users enter giveaways by clicking the "🎉 Enter Giveaway" button on the giveaway message.

**Entry Validation:**
- User must have at least one required role (if roles are specified)
- User can only enter once per giveaway
- Duplicate entries are automatically prevented

**Success Response:**
```
✅ You've successfully entered the giveaway!
```

**Already Entered Response:**
```
❌ You've already entered this giveaway.
```

**Missing Role Response:**
```
❌ You don't have the required roles to enter this giveaway.

Required roles: @Subscriber, @VIP
```

**Winner Selection:**
- Uses cryptographically secure random number generator (CSPRNG)
- Ensures fair and unpredictable selection
- Winners are announced in the giveaway channel
- Each winner receives a DM notification

---

**Last Updated:** 2026-02-21
**Version:** 1.0.2

