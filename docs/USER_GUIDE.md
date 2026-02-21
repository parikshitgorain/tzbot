# TZBOT User Guide

Welcome to TZBOT! This guide explains how to use all features of the bot from both a regular user and moderator perspective.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Account Linking](#account-linking)
3. [Slash Commands](#slash-commands)
4. [Giveaways](#giveaways)
5. [Chat Rain](#chat-rain)
6. [Moderation Features](#moderation-features)
7. [Announcements](#announcements)
8. [AI Auto-Responder](#ai-auto-responder-optional)
9. [Troubleshooting](#troubleshooting)

---

## Getting Started

### What is TZBOT?

TZBOT is a comprehensive Discord bot that provides:
- Live notifications from Kick.com streams
- Automatic role synchronization with Kick subscriber/VIP status
- Advanced moderation and spam protection
- Interactive giveaways with role restrictions
- Chat rain rewards for active members
- AI-powered question answering (optional)

### First Steps

1. **Check if TZBOT is online**: Look for the bot in your server's member list with a green status
2. **View available commands**: Type `/` in any channel to see all available slash commands
3. **Link your Kick account** (optional): Use `/link` to connect your Kick and Discord accounts

---

## Account Linking

### Why Link Your Account?

Linking your Kick account with Discord allows you to:
- Automatically receive subscriber/VIP roles when you subscribe on Kick
- Participate in subscriber-only giveaways
- Get recognized for your Kick activity

### How to Link Your Account

1. **Start the linking process**:
   ```
   /link kick_username:YourKickUsername
   ```

2. **Confirmation**: You'll receive a message confirming your accounts are linked

3. **Verify your link**:
   ```
   /checklink
   ```

### Example

```
User: /link kick_username:CoolStreamer123
TZBOT: ✅ Successfully linked your Discord account to Kick username: CoolStreamer123

You will now receive role updates based on your Kick status.
```

### Unlinking Your Account

If you need to unlink your account:

```
/unlink
```

You'll receive confirmation that your accounts have been unlinked.

---

## Slash Commands

### User Commands

#### `/link`
Link your Discord account to your Kick account.

**Usage:**
```
/link kick_username:YourKickUsername
```

**Parameters:**
- `kick_username` (required): Your Kick.com username

**Example:**
```
/link kick_username:StreamerPro
```

---

#### `/unlink`
Remove the link between your Discord and Kick accounts.

**Usage:**
```
/unlink
```

---

#### `/checklink`
Check if your Discord account is linked to a Kick account.

**Usage:**
```
/checklink
```

**Response:**
- If linked: Shows your linked Kick username
- If not linked: Prompts you to use `/link`

---

#### `/deletemydata`
Delete all your data from the bot (GDPR compliance).

**Usage:**
```
/deletemydata
```

**What gets deleted:**
- Account links
- Violation history
- Chat activity records
- Giveaway entries
- Message content
- Chat rain winner records
- Moderation logs (where you are the target)

**Warning:** This action is permanent and cannot be undone!

---

### Moderator Commands

These commands require moderator permissions.

#### `/ban`
Permanently ban a user from the server.

**Usage:**
```
/ban user:@Username reason:Reason for ban
```

**Parameters:**
- `user` (required): The user to ban
- `reason` (required): Reason for the ban

**Example:**
```
/ban user:@Spammer reason:Repeated spam after warnings
```

**What happens:**
- User is immediately banned from the server
- User receives a DM with the ban reason
- Action is logged in the moderation logs
- Violation is recorded in the database

---

#### `/timeout`
Temporarily mute a user for a specified duration.

**Usage:**
```
/timeout user:@Username duration:60 reason:Reason for timeout
```

**Parameters:**
- `user` (required): The user to timeout
- `duration` (required): Duration in minutes (1-40320, max 28 days)
- `reason` (required): Reason for the timeout

**Example:**
```
/timeout user:@Troublemaker duration:120 reason:Disruptive behavior in chat
```

**What happens:**
- User cannot send messages, react, or speak in voice channels
- User receives a DM with the timeout reason and duration
- Action is logged in the moderation logs
- Timeout automatically expires after the specified duration

---

#### `/warn`
Issue a warning to a user.

**Usage:**
```
/warn user:@Username reason:Reason for warning
```

**Parameters:**
- `user` (required): The user to warn
- `reason` (required): Reason for the warning

**Example:**
```
/warn user:@NewUser reason:Please avoid posting links without permission
```

**What happens:**
- User receives a DM with the warning and server rules reminder
- Warning is recorded in the database
- Action is logged in the moderation logs
- Warnings contribute to the automatic escalation system

---

#### `/kick`
Remove a user from the server (they can rejoin with a new invite).

**Usage:**
```
/kick user:@Username reason:Reason for kick
```

**Parameters:**
- `user` (required): The user to kick
- `reason` (required): Reason for the kick

**Example:**
```
/kick user:@Raider reason:Raiding from another server
```

**What happens:**
- User is immediately removed from the server
- User receives a DM with the kick reason
- Action is logged in the moderation logs
- User can rejoin if they have a valid invite link

---

#### `/config`
Display the current bot configuration (Admin only).

**Usage:**
```
/config
```

**Shows:**
- Server and channel IDs
- Role configurations
- Feature toggles (AI, Chat Rain, Link Scanning)
- Spam detection thresholds

---

## Giveaways

### What are Giveaways?

Giveaways are interactive events where users can enter to win prizes. TZBOT supports role-restricted giveaways to reward specific community members.

### How to Enter a Giveaway

1. **Find an active giveaway**: Look for giveaway announcements in your server
2. **Click the "Enter Giveaway" button**: Located below the giveaway message
3. **Confirmation**: You'll receive a message confirming your entry

### Example Giveaway

```
🎉 Premium Nitro Giveaway 🎉

Win 1 month of Discord Nitro!

Requirements: Subscriber role
Winners: 3
Ends: January 20, 2025 at 3:00 PM

Entries: 42

[Enter Giveaway] ← Click this button
```

### Entry Requirements

Some giveaways may require specific roles:
- **Subscriber**: Must be a Kick subscriber
- **VIP**: Must have VIP status on Kick
- **Active Member**: Must have the active member role
- **No Requirements**: Anyone can enter

If you don't meet the requirements, you'll receive a message explaining what's needed.

### What Happens When You Enter

1. **Validation**: Bot checks if you meet the role requirements
2. **Duplicate Check**: Bot ensures you haven't already entered
3. **Entry Recorded**: Your entry is saved with a timestamp
4. **Confirmation**: You receive a confirmation message

### When the Giveaway Ends

1. **Winner Selection**: Winners are randomly selected using cryptographically secure randomization
2. **Announcement**: Winners are announced in the giveaway channel
3. **Direct Message**: Each winner receives a DM with instructions
4. **Message Update**: The giveaway message is updated to show winners

### Example Winner Announcement

```
🎉 Giveaway Ended! 🎉

Premium Nitro Giveaway

Winners:
🏆 @User1
🏆 @User2
🏆 @User3

Congratulations! Check your DMs for details.
```

### Giveaway Troubleshooting

**Problem**: "You don't have the required roles"

**Solution**: Check the giveaway requirements. You may need to:
- Link your Kick account with `/link`
- Subscribe on Kick to get the subscriber role
- Earn the required role through server activity

**Problem**: "You've already entered this giveaway"

**Solution**: You can only enter each giveaway once. Wait for the results!

**Problem**: "This giveaway has ended"

**Solution**: The giveaway is no longer accepting entries. Watch for future giveaways!

---

## Chat Rain

### What is Chat Rain?

Chat Rain is an automated reward system that randomly selects active chatters to receive rewards. It encourages genuine engagement without rewarding spam.

### How to Be Eligible

To be eligible for Chat Rain, you must:
1. **Be Active**: Send at least 3 messages in the last 10 minutes
2. **No Spam**: Have no spam violations in the last 24 hours
3. **Cooldown**: Haven't won Chat Rain in the last 60 minutes

### How Chat Rain Works

1. **Automatic Trigger**: Chat Rain events happen automatically (typically every 15-30 minutes)
2. **Eligibility Check**: Bot identifies all eligible active chatters
3. **Random Selection**: 3-10 winners are randomly selected
4. **Announcement**: Winners are announced in the chat
5. **Reward Distribution**: Rewards are automatically distributed

### Example Chat Rain Event

```
🌧️ Chat Rain! 🌧️

Congratulations to: @User1, @User2, @User3, @User4, @User5

You've been awarded the Active Chatter role! (24 hours)
```

### Types of Rewards

Rewards vary by server configuration:
- **Temporary Roles**: Special role for 24 hours
- **Server Currency**: Points or coins (if economy bot is enabled)
- **Recognition**: Public acknowledgment of activity
- **Custom Rewards**: Server-specific rewards

### Chat Rain Tips

**Do:**
- ✅ Participate naturally in conversations
- ✅ Engage with other community members
- ✅ Stay active across different channels
- ✅ Follow server rules

**Don't:**
- ❌ Spam messages to become eligible
- ❌ Post repetitive content
- ❌ Use bots or automation
- ❌ Violate server rules

### Chat Rain Troubleshooting

**Problem**: "I'm active but never win"

**Explanation**: Chat Rain is random! Being eligible doesn't guarantee winning. Keep participating naturally.

**Problem**: "I won but didn't receive the reward"

**Solution**: 
- Check if you have the reward role
- Verify you're still in the server
- Contact a moderator if the issue persists

**Problem**: "How often does Chat Rain happen?"

**Answer**: Chat Rain events are automatic and typically occur every 15-30 minutes, with a minimum 5-minute delay between events.

---

## Moderation Features

### Automatic Spam Protection

TZBOT automatically detects and punishes spam behavior using an escalation system.

#### Spam Detection

Spam is detected when a user:
- Sends 5+ identical messages within 10 seconds
- Sends 10+ messages within 5 seconds

#### Escalation Matrix

Violations are automatically escalated:

1. **First Violation**: Warning (DM sent to user)
2. **Second Violation (within 24h)**: 1-hour timeout
3. **Third Violation (within 24h)**: 24-hour timeout
4. **Fourth Violation (within 7 days)**: Permanent ban

#### Violation Reset

Your violation count resets after 7 days of no violations.

### Link Scanning

TZBOT automatically scans all messages for malicious links.

#### What Gets Detected

- **Phishing Links**: Known phishing domains from public blocklists
- **Malware Links**: Links flagged by Google Safe Browsing
- **Obfuscated Links**: URLs with zero-width characters

#### What Happens

1. **Instant Deletion**: Malicious link messages are deleted within 500ms
2. **Automatic Timeout**: User receives a 24-hour timeout
3. **Logging**: Incident is logged for moderator review
4. **Notification**: User receives a DM explaining the action

#### Moderator Exemption

Moderators are exempt from link scanning to allow sharing of examples and warnings.

### Read-Only Channels

Some channels may be designated as read-only for regular members.

#### What Happens

If you post in a read-only channel without permission:
1. **Instant Deletion**: Your message is deleted within 1 second
2. **DM Notification**: You receive a DM explaining the restriction
3. **Logging**: The deletion is logged

#### Who Can Post

- Moderators
- Users with whitelisted roles for that channel
- Bots (if configured)

---

## Announcements

### How Announcements Work

Moderators can post announcements in a private channel, and TZBOT automatically relays them to public channels.

### For Regular Users

You'll see announcements from TZBOT in designated announcement channels. These are official server announcements reviewed by moderators.

### For Moderators

1. **Post in Private Channel**: Post your announcement in the designated moderator announcement channel
2. **Automatic Relay**: TZBOT automatically relays your message to all configured public channels within 2 seconds
3. **Content Preservation**: All formatting, embeds, and attachments are preserved
4. **Bot Attribution**: The message appears as sent by TZBOT, not you

#### Example Workflow

```
Moderator (in #mod-announcements):
🎉 Server Update! We've added new gaming channels.

TZBOT (in #announcements):
🎉 Server Update! We've added new gaming channels.

TZBOT (in #general):
🎉 Server Update! We've added new gaming channels.
```

#### Relay Failures

If a relay fails, you'll be notified in the private channel with details about which channels failed and why.

---

## AI Auto-Responder (Optional)

**Note:** This feature may not be enabled on all servers.

### What is the AI Responder?

The AI Auto-Responder uses artificial intelligence to automatically answer common questions in designated channels.

### How It Works

1. **Question Detection**: Bot detects messages ending with "?" or containing question keywords (who, what, when, where, why, how)
2. **AI Processing**: Question is sent to the AI model
3. **Confidence Check**: Response is only sent if confidence is above 70%
4. **Response**: AI-generated answer is posted in the channel

### Example

```
User: What are the server rules?

TZBOT: The server rules are:
1. Be respectful to all members
2. No spam or self-promotion
3. Keep content appropriate
4. Follow Discord's Terms of Service
...
```

### Rate Limiting

To prevent spam, AI responses are limited to:
- 1 response per user per 30 seconds
- Only in configured AI channels

### Moderator Controls

Moderators can:
- Delete incorrect responses by reacting with ❌
- Toggle the AI responder on/off with `/ai-toggle` (if available)
- Add approved answers to the knowledge base

### AI Responder Tips

**Do:**
- ✅ Ask clear, specific questions
- ✅ Use proper grammar and spelling
- ✅ Ask one question at a time

**Don't:**
- ❌ Spam questions to test the bot
- ❌ Ask inappropriate questions
- ❌ Rely solely on AI answers for critical information

---

## Troubleshooting

### Common Issues

#### Bot Not Responding to Commands

**Possible Causes:**
- Bot is offline
- You don't have permission to use the command
- Command cooldown is active

**Solutions:**
- Check if bot is online (green status)
- Verify you have the required role/permissions
- Wait a few seconds and try again

---

#### Can't Enter Giveaway

**Possible Causes:**
- You don't have the required roles
- You've already entered
- Giveaway has ended

**Solutions:**
- Check giveaway requirements
- Link your Kick account if needed
- Wait for the next giveaway

---

#### Not Receiving Role Updates

**Possible Causes:**
- Account not linked
- Haven't chatted on Kick recently
- Role sync delay

**Solutions:**
- Link your account with `/link`
- Chat on Kick to show your subscriber/VIP badge
- Wait up to 60 seconds for sync

---

#### Didn't Receive DM from Bot

**Possible Causes:**
- DMs from server members are disabled
- Bot is blocked

**Solutions:**
- Enable DMs: Server Settings → Privacy Settings → Allow direct messages from server members
- Unblock the bot if blocked

---

#### Commands Not Showing Up

**Possible Causes:**
- Slash commands not synced
- Bot permissions issue

**Solutions:**
- Wait 1 hour for Discord to sync commands globally
- Ask a moderator to check bot permissions
- Try kicking and re-inviting the bot

---

### Getting Help

If you're experiencing issues not covered here:

1. **Check Bot Status**: Verify the bot is online
2. **Review This Guide**: Re-read the relevant section
3. **Contact Moderators**: Ask in the support channel
4. **Check Logs**: Moderators can check bot logs for errors

---

## Privacy and Data

### What Data Does TZBOT Store?

- Discord user IDs (not personal information)
- Kick usernames (if you link your account)
- Violation records (for moderation)
- Giveaway entries
- Chat activity timestamps
- Message content (deleted after 7 days)

### Your Rights

- **Access**: Use `/checklink` to see your linked account
- **Deletion**: Use `/deletemydata` to delete all your data
- **Portability**: Contact moderators for a data export

### Data Retention

- Message content: 7 days
- Violation records: 7 days (then reset)
- Account links: Until you unlink
- Giveaway entries: Until giveaway ends
- Chat activity: 24 hours

---

## Tips for Best Experience

### For All Users

1. **Link Your Account**: Get automatic role updates by linking your Kick account
2. **Enable DMs**: Allow DMs from server members to receive bot notifications
3. **Read Announcements**: Stay informed about server updates and giveaways
4. **Follow Rules**: Avoid violations to maintain eligibility for rewards
5. **Be Active**: Participate naturally to be eligible for Chat Rain

### For Moderators

1. **Use Slash Commands**: Faster and more reliable than text commands
2. **Provide Reasons**: Always include clear reasons for moderation actions
3. **Check Logs**: Review moderation logs regularly
4. **Test Features**: Test giveaways and announcements before major events
5. **Monitor Performance**: Use `/config` to verify bot settings

---

## Feature Summary

| Feature | User Access | Moderator Access | Description |
|---------|-------------|------------------|-------------|
| Account Linking | ✅ | ✅ | Link Discord and Kick accounts |
| Giveaways | ✅ | ✅ | Enter and win prizes |
| Chat Rain | ✅ | ✅ | Receive rewards for activity |
| Moderation Commands | ❌ | ✅ | Ban, timeout, warn, kick users |
| Announcements | ❌ | ✅ | Post server-wide announcements |
| Configuration | ❌ | ✅ | View and modify bot settings |
| AI Responder | ✅ | ✅ | Ask questions and get answers |
| Data Deletion | ✅ | ✅ | Delete personal data (GDPR) |

---

## Frequently Asked Questions

### General

**Q: Is TZBOT free to use?**
A: Yes, TZBOT is free for all server members.

**Q: Does TZBOT work on mobile?**
A: Yes, all features work on Discord mobile apps.

**Q: Can I use TZBOT in DMs?**
A: No, TZBOT only works in servers.

### Account Linking

**Q: Do I need to link my account?**
A: No, but linking enables automatic role updates and subscriber-only features.

**Q: Is linking safe?**
A: Yes, only your Kick username is stored, no passwords or personal information.

**Q: Can I link multiple Discord accounts to one Kick account?**
A: No, each Kick account can only be linked to one Discord account.

### Giveaways

**Q: How are winners selected?**
A: Winners are randomly selected using cryptographically secure randomization (CSPRNG).

**Q: Can I enter multiple times?**
A: No, you can only enter each giveaway once.

**Q: What if I win but don't respond?**
A: Winners are typically given 24-48 hours to respond before a reroll.

### Chat Rain

**Q: How often does Chat Rain happen?**
A: Typically every 15-30 minutes, with a minimum 5-minute delay between events.

**Q: Can I increase my chances of winning?**
A: No, all eligible users have equal chances. Spamming will disqualify you.

**Q: What rewards can I win?**
A: Rewards vary by server: roles, currency, recognition, or custom rewards.

### Moderation

**Q: How long do violations last?**
A: Violations reset after 7 days of no violations.

**Q: Can I appeal a moderation action?**
A: Contact server moderators through the appropriate channel.

**Q: Why was my message deleted?**
A: Check your DMs for an explanation from TZBOT.

---

## Changelog

### Version 1.0.0 (2025-02-21)

Initial release with:
- Account linking system
- Giveaway system with role restrictions
- Chat rain rewards
- Comprehensive moderation tools
- Announcement relay system
- AI auto-responder (optional)
- GDPR-compliant data management

---

## Support

For additional help:
- Ask in your server's support channel
- Contact server moderators
- Check the bot's status page (if available)
- Review the deployment documentation for technical details

---

**Thank you for using TZBOT!** 🎉

