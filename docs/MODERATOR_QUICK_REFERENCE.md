# TZBOT Moderator Quick Reference

Quick reference guide for moderators using TZBOT.

## Quick Command Reference

### Moderation Commands

```
/ban user:@User reason:Reason
/timeout user:@User duration:60 reason:Reason
/warn user:@User reason:Reason
/kick user:@User reason:Reason
/warnlist user:@User              # View user's offense history
/warnall                          # View all users with active offenses
/clearwarn user:@User             # Remove last offense
/resetoffenses user:@User         # Clear all offenses
/modlog user:@User                # View moderation action history
```

### Utility Commands

```
/config                    # View bot configuration
/link kick_username:Name   # Link Kick account
/unlink                    # Unlink Kick account
/checklink                 # Check link status
```

---

## Moderation Actions

### Ban User
```
/ban user:@Spammer reason:Repeated spam after warnings
```
- **Effect**: Permanent removal from server
- **User Notification**: DM with reason
- **Logged**: Yes
- **Reversible**: Via Discord server settings

### Timeout User
```
/timeout user:@Troublemaker duration:120 reason:Disruptive behavior
```
- **Duration**: 1-40320 minutes (max 28 days)
- **Effect**: Cannot send messages, react, or speak
- **User Notification**: DM with reason and duration
- **Logged**: Yes
- **Auto-expires**: Yes

### Warn User
```
/warn user:@NewUser reason:Please read the rules
```
- **Effect**: Warning recorded, contributes to escalation
- **User Notification**: DM with reason and rules reminder
- **Logged**: Yes
- **Escalation**: Counts toward automatic punishments

### Kick User
```
/kick user:@Raider reason:Raiding from another server
```
- **Effect**: Removed from server (can rejoin)
- **User Notification**: DM with reason
- **Logged**: Yes
- **Reversible**: User can rejoin with invite

---

## Automatic Moderation

### Spam Detection

**Triggers:**
- 5+ identical messages in 10 seconds
- 10+ messages in 5 seconds

**Progressive Punishment Ladder:**
1. 1st offense → Warning
2. 2nd offense → Warning
3. 3rd offense → 1-hour timeout
4. 4th offense → 2-hour timeout
5. 5th offense → 4-hour timeout
6. 6th offense → 8-hour timeout
7. 7th offense → 16-hour timeout
8. 8th+ offense → Permanent ban

**Reset:** 30 days of good behavior automatically clears offense history

**Notifications:** Each punishment triggers:
- Direct message to user
- Ephemeral in-channel message
- Mod-log channel entry

### Link Scanning

**Detects:**
- Phishing links (blocklist)
- Malware (Google Safe Browsing)
- Obfuscated URLs (zero-width characters)

**Action:**
- Message deleted (<500ms)
- User receives 24-hour timeout
- Incident logged

**Exemption:** Moderators are exempt

### Read-Only Channels

**Enforcement:**
- Unauthorized messages deleted (<1s)
- User receives DM explanation
- Deletion logged

**Allowed:**
- Moderators
- Users with whitelist roles

---

## Giveaway Management

### Creating Giveaways

**Via Slash Command** (if implemented):
```
/giveaway 
  title:Premium Nitro
  description:Win 1 month!
  duration:24
  winners:3
  required_role:@Subscriber
```

**Via Code** (for custom giveaways):
```typescript
await giveawayManager.createGiveaway({
  title: 'Premium Nitro Giveaway',
  description: 'Win 1 month of Discord Nitro!',
  channelId: 'channel_id',
  guildId: 'guild_id',
  requiredRoles: ['subscriber_role_id'],
  winnerCount: 3,
  durationMs: 24 * 60 * 60 * 1000,
});
```

### Giveaway Best Practices

**Do:**
- ✅ Set clear requirements
- ✅ Specify prize details
- ✅ Set reasonable duration (24h-7d)
- ✅ Test with small giveaways first

**Don't:**
- ❌ Create too many simultaneous giveaways
- ❌ Set unrealistic winner counts
- ❌ Forget to announce winners
- ❌ Change rules mid-giveaway

### Canceling Giveaways

```typescript
await giveawayManager.cancelGiveaway(giveawayId);
```

---

## Chat Rain Configuration

### Recommended Settings

**Small Server (<100 active):**
```typescript
{
  minDelayMinutes: 10,
  activeWindowMinutes: 15,
  minMessages: 3,
  cooldownMinutes: 120
}
```

**Medium Server (100-500 active):**
```typescript
{
  minDelayMinutes: 5,
  activeWindowMinutes: 10,
  minMessages: 3,
  cooldownMinutes: 60
}
```

**Large Server (500+ active):**
```typescript
{
  minDelayMinutes: 5,
  activeWindowMinutes: 5,
  minMessages: 5,
  cooldownMinutes: 30
}
```

### Eligibility Criteria

Users must:
- ✅ Send 3+ messages in last 10 minutes
- ✅ Have no spam violations (24h)
- ✅ Not won in last 60 minutes

### Reward Types

**Role Reward:**
```typescript
{
  rewardType: 'role',
  rewardValue: 'role_id',
  durationMs: 24 * 60 * 60 * 1000 // 24 hours
}
```

**Currency Reward:**
```typescript
{
  rewardType: 'currency',
  rewardValue: '100'
}
```

**Announcement Only:**
```typescript
{
  rewardType: 'announcement'
}
```

---

## Announcement Relay

### How It Works

1. Post in private moderator channel
2. TZBOT automatically relays to public channels
3. Message appears as sent by TZBOT
4. All formatting/embeds/attachments preserved

### Example

```
You (in #mod-announcements):
🎉 Server update! New gaming channels added.

TZBOT (in #announcements, #general, #news):
🎉 Server update! New gaming channels added.
```

### Relay Failures

If relay fails, you'll be notified:
```
⚠️ Announcement Relay Failure

Failed to relay to:
• #announcements: Permission denied
• #general: Channel not found
```

### Best Practices

**Do:**
- ✅ Preview formatting before posting
- ✅ Use embeds for important announcements
- ✅ Keep messages concise
- ✅ Include relevant links/images

**Don't:**
- ❌ Post test messages in production
- ❌ Relay sensitive information
- ❌ Spam announcements
- ❌ Forget to proofread

---

## AI Auto-Responder

### Enabling/Disabling

```
/ai-toggle
```

### How It Works

1. Detects questions (ends with "?" or contains question keywords)
2. Processes with AI model
3. Only responds if confidence >70%
4. Rate limited: 1 response per user per 30s

### Moderator Controls

**Delete Incorrect Response:**
- React with ❌ to any AI response
- Bot will delete the response

**Add to Knowledge Base:**
- Use knowledge base commands (if implemented)
- Add approved Q&A pairs

### Best Practices

**Do:**
- ✅ Monitor AI responses regularly
- ✅ Delete incorrect answers immediately
- ✅ Build knowledge base with common questions
- ✅ Set appropriate channels for AI

**Don't:**
- ❌ Rely on AI for critical information
- ❌ Enable in all channels
- ❌ Ignore incorrect responses
- ❌ Let AI answer moderation questions

---

## Monitoring and Logs

### Viewing Configuration

```
/config
```

Shows:
- Server/channel IDs
- Role configurations
- Feature toggles
- Spam thresholds

### Log Locations

**Application Logs:**
```
logs/tzbot.log
```

**System Logs (if using systemd):**
```bash
sudo journalctl -u tzbot -f
```

**PM2 Logs:**
```bash
pm2 logs tzbot
```

### What Gets Logged

- All moderation actions
- Spam detections
- Link scanning results
- Giveaway events
- Chat rain distributions
- Errors and warnings
- System state changes

### Log Levels

- `error`: Critical errors only
- `warn`: Warnings and errors
- `info`: General information (recommended)
- `debug`: Detailed debugging

---

## Troubleshooting

### Bot Not Responding

**Check:**
1. Bot is online (green status)
2. Bot has required permissions
3. Commands are properly formatted
4. No rate limiting active

**Solutions:**
```bash
# Check bot status
systemctl status tzbot

# View recent logs
tail -f logs/tzbot.log

# Restart bot
systemctl restart tzbot
```

### Commands Not Working

**Possible Causes:**
- Missing permissions
- Bot role position too low
- Command cooldown active

**Solutions:**
- Verify bot has Administrator or specific permissions
- Move bot role above managed roles
- Wait and retry

### Giveaways Not Ending

**Possible Causes:**
- Bot was offline when giveaway should have ended
- System time incorrect

**Solutions:**
- Bot automatically recovers active giveaways on restart
- Check system time: `date`
- Manually end if needed

### Chat Rain Not Working

**Possible Causes:**
- No eligible users
- Cooldown active
- Configuration issue

**Solutions:**
- Check eligibility criteria
- Verify configuration with `/config`
- Review logs for errors

### Roles Not Syncing

**Possible Causes:**
- User hasn't linked account
- User hasn't chatted on Kick recently
- Kick API issues

**Solutions:**
- Verify user linked with `/checklink`
- Ask user to chat on Kick
- Check Kick API status in logs

---

## Emergency Procedures

### Bot Crash

1. Check logs for error:
   ```bash
   tail -100 logs/tzbot.log
   ```

2. Restart bot:
   ```bash
   systemctl restart tzbot
   ```

3. Verify recovery:
   ```bash
   systemctl status tzbot
   ```

### Database Issues

1. Check PostgreSQL status:
   ```bash
   systemctl status postgresql
   ```

2. Restart if needed:
   ```bash
   systemctl restart postgresql
   ```

3. Verify connection:
   ```bash
   psql -U tzbot_user -d tzbot -c "SELECT 1;"
   ```

### Redis Issues

1. Check Redis status:
   ```bash
   systemctl status redis
   ```

2. Restart if needed:
   ```bash
   systemctl restart redis
   ```

3. Test connection:
   ```bash
   redis-cli PING
   ```

### Rate Limiting

If bot is rate limited by Discord:

1. Reduce command frequency
2. Wait 10-60 minutes
3. Check for command spam
4. Review rate limit logs

### Webhook Failures

If Kick webhooks stop working:

1. Bot automatically falls back to polling
2. Check webhook configuration in Kick Developer Portal
3. Verify webhook URL is accessible
4. Check webhook secret matches configuration

---

## Performance Optimization

### Database Maintenance

```bash
# Vacuum database (weekly)
vacuumdb -U tzbot_user -d tzbot -z -v

# Check database size
psql -U tzbot_user -d tzbot -c "SELECT pg_size_pretty(pg_database_size('tzbot'));"
```

### Redis Maintenance

```bash
# Check memory usage
redis-cli INFO memory

# Clear cache if needed
redis-cli FLUSHDB
```

### Log Rotation

Logs are automatically rotated daily. To manually rotate:

```bash
logrotate -f /etc/logrotate.d/tzbot
```

---

## Security Checklist

### Regular Tasks

- [ ] Review moderation logs weekly
- [ ] Check for unusual activity
- [ ] Update bot dependencies monthly
- [ ] Rotate API keys quarterly
- [ ] Backup database weekly
- [ ] Test disaster recovery quarterly

### Security Best Practices

**Do:**
- ✅ Use strong passwords
- ✅ Enable 2FA on Discord account
- ✅ Restrict bot permissions to minimum required
- ✅ Keep .env file secure
- ✅ Monitor bot logs regularly
- ✅ Update dependencies regularly

**Don't:**
- ❌ Share bot token
- ❌ Commit .env to git
- ❌ Give bot unnecessary permissions
- ❌ Ignore security warnings
- ❌ Use default passwords
- ❌ Disable security features

---

## Quick Reference Tables

### Command Permissions

| Command | Required Permission | Moderator Only |
|---------|-------------------|----------------|
| /ban | BAN_MEMBERS | Yes |
| /timeout | MODERATE_MEMBERS | Yes |
| /warn | MODERATE_MEMBERS | Yes |
| /kick | KICK_MEMBERS | Yes |
| /config | ADMINISTRATOR | Yes |
| /link | None | No |
| /unlink | None | No |
| /checklink | None | No |
| /deletemydata | None | No |

### Timeout Durations

| Duration | Minutes | Use Case |
|----------|---------|----------|
| 5 min | 5 | Minor infractions |
| 1 hour | 60 | Spam, minor disruption |
| 24 hours | 1440 | Repeated violations |
| 7 days | 10080 | Serious violations |
| 28 days | 40320 | Maximum allowed |

### Spam Escalation

| Offense | Punishment | Duration |
|---------|------------|----------|
| 1st | Warning | - |
| 2nd | Warning | - |
| 3rd | Timeout | 1 hour |
| 4th | Timeout | 2 hours |
| 5th | Timeout | 4 hours |
| 6th | Timeout | 8 hours |
| 7th | Timeout | 16 hours |
| 8th+ | Permanent Ban | - |

**Reset:** 30 days of good behavior

### Chat Rain Timing

| Server Size | Min Delay | Active Window | Min Messages |
|-------------|-----------|---------------|--------------|
| Small | 10 min | 15 min | 3 |
| Medium | 5 min | 10 min | 3 |
| Large | 5 min | 5 min | 5 |

---

## Contact and Support

### For Technical Issues

1. Check this guide
2. Review logs
3. Check deployment documentation
4. Contact bot administrator

### For Feature Requests

1. Document the request
2. Discuss with other moderators
3. Submit to bot administrator
4. Consider contributing code

---

## Additional Resources

- [User Guide](./USER_GUIDE.md) - For end users
- [Deployment Guide](./DEPLOYMENT.md) - For setup and deployment
- [Quick Start](./QUICK_START.md) - For initial setup
- [Project Structure](./project-structure.md) - For code organization

---

**Last Updated:** 2025-02-21
**Version:** 1.0.0

