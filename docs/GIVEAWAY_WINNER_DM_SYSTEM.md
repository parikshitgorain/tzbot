# Giveaway Winner DM System

## Overview

The winner DM system ensures that all giveaway winners receive timely notifications via Direct Messages (DMs) at every stage of the confirmation process. Every message includes @user mentions for proper notification delivery.

## DM Message Flow

### 1. Initial Winner Selection

**When:** Immediately after giveaway ends and winners are selected

**Channel Message:**
```
🎉 Giveaway Winners Selected!

Congratulations @winner1, @winner2!

⏰ IMPORTANT: You must send any message in this server within the next 5 minutes to confirm your win!

Failure to respond will result in an automatic reroll.
```

**DM Message:**
```
🎉 Congratulations!

@winner You won: **[Giveaway Title]**

⏰ IMPORTANT: You must send any message in the server within the next 5 minutes to confirm your win!

Failure to respond will result in an automatic reroll.

Next Steps:
[Condition if specified, or "Check the giveaway channel for more details!"]
```

**Features:**
- ✅ @mention included in DM
- ✅ Clear 5-minute deadline
- ✅ Includes giveaway title
- ✅ Shows next steps/conditions
- ✅ Sent to all winners simultaneously

---

### 2. Reminder (After 2 Minutes)

**When:** 2 minutes after winner selection (3 minutes remaining)

**Channel Message:**
```
⏰ Giveaway Winner Reminder

@winner, you have 3 minutes remaining to confirm your win!

Send any message in this server to confirm.
```

**DM Message:**
```
⏰ Reminder: Confirm Your Win!

@winner You have 3 minutes remaining to confirm your win for: **[Giveaway Title]**

Action Required: Send any message in the server to confirm.

Warning: Failure to respond will result in an automatic reroll.
```

**Features:**
- ✅ @mention included in DM
- ✅ Clear time remaining
- ✅ Includes giveaway title
- ✅ Emphasizes urgency
- ✅ Sent both in channel and DM

---

### 3. Winner Confirmation

**When:** Winner sends any message in the server

**Channel Message:**
```
✅ Winner Confirmed!

@winner has confirmed their win!

Next Steps:
[Condition or "Check with the giveaway host for prize details."]
```

**DM Message:**
```
✅ Win Confirmed!

@winner Your win has been confirmed for: **[Giveaway Title]**

Next Steps:
[Condition or "Check with the giveaway host for prize details."]
```

**Features:**
- ✅ @mention included in DM
- ✅ Confirmation acknowledgment
- ✅ Includes giveaway title
- ✅ Shows next steps
- ✅ Sent both in channel and DM

---

### 4. Automatic Reroll (After 5 Minutes)

**When:** Winner doesn't respond within 5 minutes

**Channel Message:**
```
🔄 Winner Rerolled

@old_winner did not respond in time.

New Winner: @new_winner

⏰ IMPORTANT: You must send any message in this server within the next 5 minutes to confirm your win!
```

**DM Message (to new winner):**
```
🎉 Congratulations!

@new_winner You won: **[Giveaway Title]**

⏰ IMPORTANT: You must send any message in the server within the next 5 minutes to confirm your win!

Failure to respond will result in an automatic reroll.

Next Steps:
[Condition if specified]
```

**Features:**
- ✅ @mention included in DM
- ✅ Explains why reroll happened
- ✅ New winner gets full confirmation flow
- ✅ Same 5-minute timer starts for new winner

---

### 5. Manual Reroll (Moderator Action)

**When:** Moderator uses `gw.reroll` or `/giveaway reroll`

**Channel Message:**
```
🔄 [Giveaway Title] - Winner Rerolled

A winner has been rerolled!

❌ Previous Winner: @old_winner
✅ New Winner: @new_winner

🎊 Congratulations to the new winner!
```

**DM Message (to new winner):**
```
🎉 You Won!

@new_winner Congratulations! You won the giveaway: **[Giveaway Title]**

Next Steps:
[Condition or "Check the giveaway channel for more details!"]
```

**Features:**
- ✅ @mention included in DM
- ✅ Shows both old and new winner
- ✅ Includes giveaway title
- ✅ Shows next steps/conditions
- ✅ No confirmation timer (manual reroll is final)

---

## @Mention Implementation

All DM messages include `<@userId>` mentions to ensure:

1. **Proper Notifications**: Discord highlights the message for the user
2. **Clear Identification**: User knows the message is specifically for them
3. **Consistency**: Matches the format used in channel messages
4. **Mobile Friendly**: Mentions work better on mobile devices

### Example Format

```typescript
const dmEmbed = new EmbedBuilder()
  .setTitle('🎉 Congratulations!')
  .setDescription(
    `<@${userId}> You won: **${giveaway.title}**\n\n` +
    'Additional information...'
  )
  .setColor(0x00ff00);

await user.send({ embeds: [dmEmbed] });
```

## DM Failure Handling

If a DM cannot be sent (user has DMs disabled):

1. **Logged as Warning**: System logs the failure
2. **Channel Message Still Sent**: User is still mentioned in channel
3. **Confirmation Still Works**: User can still confirm by sending a message
4. **No Penalty**: User is not disqualified for having DMs disabled

**Log Example:**
```
[WARN] Failed to send DM to winner - user may have DMs disabled
{
  giveawayId: "abc123",
  userId: "123456789",
  error: "Cannot send messages to this user"
}
```

## Message Timing

| Event | Timing | Channel Message | DM Message |
|-------|--------|----------------|------------|
| Winner Selected | Immediate | ✅ Yes | ✅ Yes |
| Reminder | After 2 min | ✅ Yes | ✅ Yes |
| Confirmation | When user responds | ✅ Yes | ✅ Yes |
| Auto Reroll | After 5 min | ✅ Yes | ✅ Yes (new winner) |
| Manual Reroll | When moderator acts | ✅ Yes | ✅ Yes (new winner) |

## Best Practices

### For Bot Administrators

1. **Test DMs**: Ensure the bot can send DMs to test users
2. **Monitor Logs**: Check for DM failures in logs
3. **Inform Users**: Let server members know to enable DMs for giveaways
4. **Set Clear Conditions**: Provide clear next steps in giveaway conditions

### For Moderators

1. **Check DMs**: Verify winners received their DMs
2. **Manual Reroll**: Use if winner claims they didn't receive DM
3. **Communicate**: Reach out to winners if they don't respond
4. **Document**: Keep track of manual rerolls and reasons

### For Users

1. **Enable DMs**: Allow DMs from server members
2. **Check Notifications**: Watch for DM notifications
3. **Respond Quickly**: Send any message within 5 minutes
4. **Read Instructions**: Follow the next steps in the DM

## Troubleshooting

### Winner Didn't Receive DM

**Possible Causes:**
- User has DMs disabled
- User blocked the bot
- Discord service issues

**Solutions:**
1. Check bot logs for DM failure
2. Ask user to enable DMs and manually reroll
3. Mention user in channel as backup
4. Use manual reroll if needed

### DM Sent But User Didn't See It

**Possible Causes:**
- User has notifications disabled
- DM is buried in other messages
- User not checking DMs

**Solutions:**
1. Mention user in channel
2. Send reminder after 2 minutes
3. Wait for auto-reroll if no response
4. Educate users to check DMs

### Multiple DMs Sent

**Possible Causes:**
- Bot restarted during confirmation
- Manual reroll triggered
- System error

**Solutions:**
1. Check logs for duplicate sends
2. Verify timer restoration on restart
3. Ensure only one confirmation flow per winner

## Technical Details

### DM Embed Structure

```typescript
{
  title: "🎉 Congratulations!",
  description: "<@userId> You won: **Title**\n\nDetails...",
  color: 0x00ff00, // Green for success
  timestamp: new Date()
}
```

### Error Handling

```typescript
try {
  await user.send({ embeds: [dmEmbed] });
  logger.info('Winner DM sent', { giveawayId, userId });
} catch (error) {
  logger.warn('Failed to send DM - user may have DMs disabled', {
    giveawayId,
    userId,
    error: error.message
  });
}
```

### Retry Logic

- **No Retries**: DM failures are logged but not retried
- **Reason**: Retrying won't help if user has DMs disabled
- **Fallback**: Channel mentions serve as backup notification

## Related Documentation

- [Giveaway Prefix Commands](./GIVEAWAY_PREFIX_COMMANDS.md)
- [Giveaway Quick Reference](./GIVEAWAY_QUICK_REFERENCE.md)
- [Giveaway Fixes](./GIVEAWAY_FIXES.md)
