# TZBOT Troubleshooting Guide

Comprehensive troubleshooting guide for common TZBOT issues.

## Table of Contents

1. [Bot Startup Issues](#bot-startup-issues)
2. [Command Issues](#command-issues)
3. [Account Linking Issues](#account-linking-issues)
4. [Giveaway Issues](#giveaway-issues)
5. [Chat Rain Issues](#chat-rain-issues)
6. [Moderation Issues](#moderation-issues)
7. [Notification Issues](#notification-issues)
8. [Performance Issues](#performance-issues)
9. [Database Issues](#database-issues)
10. [Network Issues](#network-issues)

---

## Bot Startup Issues

### Bot Won't Start

**Symptom:** Bot fails to start or crashes immediately

**Possible Causes:**
1. Missing or invalid environment variables
2. Database connection failure
3. Redis connection failure
4. Invalid Discord token
5. Port already in use

**Diagnostic Steps:**

```bash
# Check logs
tail -100 logs/tzbot.log

# Check environment variables
cat .env | grep -v "^#" | grep -v "^$"

# Test database connection
psql -U tzbot_user -d tzbot -c "SELECT 1;"

# Test Redis connection
redis-cli PING

# Check if port is in use
lsof -i :3000
```

**Solutions:**

**Missing Environment Variables:**
```bash
# Verify all required variables are set
grep "DISCORD_TOKEN" .env
grep "DATABASE_URL" .env
grep "REDIS_URL" .env

# Copy from example if needed
cp .env.example .env
nano .env
```

**Invalid Discord Token:**
```bash
# Regenerate token in Discord Developer Portal
# Update .env with new token
nano .env
# Find DISCORD_TOKEN= and update
```

**Database Connection Failed:**
```bash
# Start PostgreSQL
sudo systemctl start postgresql

# Create database if missing
sudo -u postgres psql -c "CREATE DATABASE tzbot;"

# Run migrations
npm run migrate
```

**Redis Connection Failed:**
```bash
# Start Redis
sudo systemctl start redis

# Test connection
redis-cli PING
# Should return: PONG
```

**Port Already in Use:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in .env
echo "WEBHOOK_PORT=3001" >> .env
```

---

### Bot Starts But Immediately Crashes

**Symptom:** Bot starts successfully but crashes within seconds

**Possible Causes:**
1. Unhandled promise rejection
2. Invalid configuration values
3. Missing permissions
4. Memory limit exceeded

**Diagnostic Steps:**

```bash
# Enable debug logging
echo "LOG_LEVEL=debug" >> .env

# Run in foreground to see errors
npm start

# Check for unhandled rejections
grep "UnhandledPromiseRejection" logs/tzbot.log
```

**Solutions:**

**Invalid Configuration:**
```bash
# Validate all IDs are correct
# Guild ID should be 18-19 digits
# Channel IDs should be 18-19 digits
# Role IDs should be 18-19 digits

# Test configuration
npm run validate-config
```

**Missing Permissions:**
```bash
# Check bot has required permissions:
# - MANAGE_ROLES
# - MANAGE_MESSAGES
# - BAN_MEMBERS
# - KICK_MEMBERS
# - MODERATE_MEMBERS
# - SEND_MESSAGES
# - EMBED_LINKS

# Re-invite bot with correct permissions
# Use invite URL from Discord Developer Portal
```

**Memory Limit:**
```bash
# Check available memory
free -h

# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=2048"
npm start
```

---

## Command Issues

### Slash Commands Not Showing Up

**Symptom:** Commands don't appear when typing `/`

**Possible Causes:**
1. Commands not registered
2. Discord cache delay
3. Bot lacks application.commands scope
4. Guild-specific commands not synced

**Solutions:**

**Register Commands:**
```bash
# Build project
npm run build

# Register commands
npm run commands:register
```

**Wait for Discord Sync:**
- Global commands take up to 1 hour to sync
- Guild commands sync within seconds
- Try kicking and re-inviting bot to force sync

**Check Bot Scopes:**
1. Go to Discord Developer Portal
2. OAuth2 → URL Generator
3. Ensure both `bot` and `applications.commands` are selected
4. Re-invite bot with new URL

---

### Commands Return "Interaction Failed"

**Symptom:** Commands execute but return error message

**Possible Causes:**
1. Command handler timeout (>3 seconds)
2. Missing permissions
3. Database error
4. Network error

**Diagnostic Steps:**

```bash
# Check logs for specific error
grep "command" logs/tzbot.log | tail -20

# Check command execution time
grep "Command executed" logs/tzbot.log | tail -10
```

**Solutions:**

**Timeout Issues:**
```typescript
// Ensure commands defer reply for long operations
await interaction.deferReply({ ephemeral: true });

// Then edit reply later
await interaction.editReply({ content: 'Done!' });
```

**Permission Issues:**
```bash
# Verify bot role is above managed roles
# Check bot has specific permission for command
# Example: /ban requires BAN_MEMBERS permission
```

**Database Errors:**
```bash
# Check database connection
psql -U tzbot_user -d tzbot -c "SELECT 1;"

# Check for slow queries
psql -U tzbot_user -d tzbot -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
```

---

### Commands Work But No Response

**Symptom:** Command executes but bot doesn't respond

**Possible Causes:**
1. Response sent to wrong channel
2. Bot lacks Send Messages permission
3. Response is ephemeral but user has DMs disabled
4. Rate limiting

**Solutions:**

**Check Permissions:**
```bash
# Verify bot can send messages in channel
# Check channel permissions for bot role
```

**Check Rate Limits:**
```bash
# Look for rate limit warnings in logs
grep "rate limit" logs/tzbot.log

# Wait 10-60 minutes if rate limited
```

**Enable DMs:**
- User Settings → Privacy & Safety
- Enable "Allow direct messages from server members"

---

## Account Linking Issues

### Can't Link Account

**Symptom:** `/link` command fails or returns error

**Possible Causes:**
1. Kick username already linked to another Discord account
2. Discord account already linked to another Kick username
3. Invalid Kick username
4. Database error

**Diagnostic Steps:**

```bash
# Check if username exists in database
psql -U tzbot_user -d tzbot -c "SELECT * FROM users WHERE kick_username = 'username';"

# Check if Discord ID already linked
psql -U tzbot_user -d tzbot -c "SELECT * FROM users WHERE discord_id = 'discord_id';"
```

**Solutions:**

**Already Linked:**
```
# Unlink first
/unlink

# Then link again
/link kick_username:NewUsername
```

**Invalid Username:**
- Verify username is correct on Kick.com
- Check for typos
- Ensure username doesn't contain special characters

**Database Error:**
```bash
# Check database connection
systemctl status postgresql

# Check database logs
tail -50 /var/log/postgresql/postgresql-15-main.log
```

---

### Roles Not Syncing After Linking

**Symptom:** Account linked but subscriber/VIP roles not assigned

**Possible Causes:**
1. User hasn't chatted on Kick recently
2. Kick API not returning badge data
3. Role sync delay (up to 60 seconds)
4. Bot lacks Manage Roles permission

**Solutions:**

**Chat on Kick:**
- User must send a message in Kick chat
- Bot detects subscriber/VIP badges from chat messages
- Badges must be visible in chat

**Wait for Sync:**
- Role sync happens within 60 seconds of chat activity
- Be patient and wait

**Check Permissions:**
```bash
# Verify bot has MANAGE_ROLES permission
# Verify bot role is above subscriber/VIP roles in hierarchy
```

**Check Kick Connection:**
```bash
# Look for Kick connection errors in logs
grep "kick" logs/tzbot.log | grep -i "error"

# Verify Kick API credentials in .env
grep "KICK_" .env
```

---

## Giveaway Issues

### Can't Enter Giveaway

**Symptom:** Clicking "Enter Giveaway" button shows error

**Possible Causes:**
1. Missing required roles
2. Already entered
3. Giveaway ended
4. Giveaway cancelled

**Solutions:**

**Check Requirements:**
```
# Look at giveaway message for required roles
# Example: "Requirements: Subscriber role"

# Verify you have the role
# Check your roles in server member list
```

**Already Entered:**
- You can only enter once per giveaway
- Wait for results

**Giveaway Ended:**
- Check giveaway message status
- Look for "Ended" or "Cancelled" status

---

### Giveaway Not Ending

**Symptom:** Giveaway end time passed but no winners announced

**Possible Causes:**
1. Bot was offline when giveaway should have ended
2. System time incorrect
3. Giveaway end event not scheduled

**Solutions:**

**Bot Offline:**
```bash
# Check bot uptime
systemctl status tzbot

# Bot automatically recovers active giveaways on restart
systemctl restart tzbot
```

**System Time:**
```bash
# Check system time
date

# Sync time if incorrect
sudo ntpdate -s time.nist.gov
```

**Manual End:**
```typescript
// Moderators can manually end giveaway
await giveawayManager.endGiveaway(giveawayId);
```

---

### Winners Not Receiving DMs

**Symptom:** Winners announced but don't receive DM

**Possible Causes:**
1. User has DMs disabled
2. User blocked the bot
3. User left the server

**Solutions:**

**Enable DMs:**
- Server Settings → Privacy Settings
- Enable "Allow direct messages from server members"

**Unblock Bot:**
- Check blocked users list
- Unblock TZBOT if blocked

**Check Logs:**
```bash
# Look for DM failures
grep "Failed to send.*DM" logs/tzbot.log
```

---

## Chat Rain Issues

### No Chat Rain Events

**Symptom:** Chat rain never happens

**Possible Causes:**
1. Chat rain disabled in configuration
2. No eligible users
3. Cooldown active
4. Configuration error

**Diagnostic Steps:**

```bash
# Check if chat rain is enabled
grep "CHAT_RAIN_ENABLED" .env

# Check configuration
/config

# Check logs for chat rain events
grep "chat rain" logs/tzbot.log
```

**Solutions:**

**Enable Chat Rain:**
```bash
# In .env file
echo "CHAT_RAIN_ENABLED=true" >> .env

# Restart bot
systemctl restart tzbot
```

**No Eligible Users:**
- Users must send 3+ messages in last 10 minutes
- Users must have no spam violations (24h)
- Users must not have won recently (60min)

**Check Cooldown:**
```bash
# Minimum 5 minutes between events
# Check last chat rain time in logs
grep "Chat rain executed" logs/tzbot.log | tail -1
```

---

### Always Same Winners

**Symptom:** Same users win chat rain repeatedly

**Possible Causes:**
1. Small pool of eligible users
2. Cooldown not working
3. Random selection issue

**Diagnostic Steps:**

```bash
# Check winner cooldown in database
psql -U tzbot_user -d tzbot -c "SELECT user_id, timestamp FROM chat_rain_winners ORDER BY timestamp DESC LIMIT 10;"

# Check eligible user count in logs
grep "eligible" logs/tzbot.log | grep "chat rain"
```

**Solutions:**

**Increase Eligible Pool:**
- Lower minMessages requirement
- Increase activeWindowMinutes
- Decrease cooldownMinutes

**Verify Cooldown:**
```typescript
// Check cooldown configuration
{
  cooldownMinutes: 60, // Should be at least 60
}
```

---

## Moderation Issues

### Automatic Spam Detection Not Working

**Symptom:** Spam messages not being detected

**Possible Causes:**
1. Spam detection disabled
2. Thresholds too high
3. User is moderator (exempt)
4. Detection logic error

**Diagnostic Steps:**

```bash
# Check spam detection configuration
/config

# Look for spam detection in logs
grep "spam" logs/tzbot.log

# Test with known spam pattern
# Send 5 identical messages quickly
```

**Solutions:**

**Adjust Thresholds:**
```bash
# In .env or configuration
SPAM_IDENTICAL_MESSAGES=5
SPAM_IDENTICAL_WINDOW=10
SPAM_RAPID_MESSAGES=10
SPAM_RAPID_WINDOW=5
```

**Check Exemptions:**
- Moderators are exempt from spam detection
- Check if user has moderator role

---

### Link Scanning Not Detecting Malicious Links

**Symptom:** Known phishing links not being blocked

**Possible Causes:**
1. Link scanning disabled
2. Google Safe Browsing API key missing/invalid
3. Link not in blocklist
4. Rate limit exceeded

**Diagnostic Steps:**

```bash
# Check if link scanning is enabled
grep "LINK_SCANNING_ENABLED" .env

# Check Google Safe Browsing API key
grep "GOOGLE_SAFE_BROWSING_API_KEY" .env

# Check logs for link scanning
grep "link" logs/tzbot.log | grep -i "scan"
```

**Solutions:**

**Enable Link Scanning:**
```bash
echo "LINK_SCANNING_ENABLED=true" >> .env
systemctl restart tzbot
```

**Add API Key:**
```bash
# Get API key from Google Cloud Console
# Add to .env
echo "GOOGLE_SAFE_BROWSING_API_KEY=your_key_here" >> .env
systemctl restart tzbot
```

**Update Blocklist:**
```bash
# Blocklist is updated automatically
# Force update by restarting bot
systemctl restart tzbot
```

---

### Violations Not Escalating

**Symptom:** User has multiple violations but no escalation

**Possible Causes:**
1. Violations outside time window
2. Escalation logic error
3. Database not recording violations

**Diagnostic Steps:**

```bash
# Check user violations
psql -U tzbot_user -d tzbot -c "SELECT * FROM violations WHERE user_id = 'user_id' ORDER BY timestamp DESC;"

# Check violation timestamps
# Should be within 24h for 2nd/3rd violation
# Should be within 7d for 4th violation
```

**Solutions:**

**Check Time Windows:**
- 2nd violation: Within 24 hours of 1st
- 3rd violation: Within 24 hours of 2nd
- 4th violation: Within 7 days of 3rd

**Manual Escalation:**
```
# Moderators can manually apply punishments
/timeout user:@User duration:60 reason:Repeated violations
```

---

## Notification Issues

### Not Receiving Kick Notifications

**Symptom:** Stream goes live but no Discord notification

**Possible Causes:**
1. Kick API credentials invalid
2. Webhook not configured
3. Polling disabled
4. Notification channel incorrect

**Diagnostic Steps:**

```bash
# Check Kick API connection
grep "kick" logs/tzbot.log | grep -i "connect"

# Check webhook status
grep "webhook" logs/tzbot.log

# Check notification channel
/config
```

**Solutions:**

**Verify Credentials:**
```bash
# Check Kick API credentials in .env
grep "KICK_API_KEY" .env
grep "KICK_CHANNEL_ID" .env

# Regenerate if needed from Kick Developer Portal
```

**Configure Webhook:**
```bash
# In Kick Developer Portal:
# 1. Add webhook URL: https://yourdomain.com/webhooks/kick
# 2. Select events: stream online/offline
# 3. Copy webhook secret to .env

echo "KICK_WEBHOOK_SECRET=your_secret" >> .env
systemctl restart tzbot
```

**Enable Polling Fallback:**
```bash
# Bot automatically falls back to polling if webhooks fail
# Check logs for polling activity
grep "polling" logs/tzbot.log
```

---

### Notifications Delayed

**Symptom:** Notifications arrive late (>1 second)

**Possible Causes:**
1. Using polling instead of webhooks
2. Network latency
3. Rate limiting
4. System overload

**Diagnostic Steps:**

```bash
# Check if using webhooks or polling
grep "webhook\|polling" logs/tzbot.log | tail -10

# Check notification delivery time
grep "notification.*delivered" logs/tzbot.log | tail -10

# Check system load
top
```

**Solutions:**

**Use Webhooks:**
- Webhooks provide <1 second delivery
- Polling has 10-20 second delay
- Configure webhooks in Kick Developer Portal

**Reduce System Load:**
```bash
# Check CPU and memory usage
top

# Restart bot if needed
systemctl restart tzbot

# Optimize database queries
vacuumdb -U tzbot_user -d tzbot -z
```

---

## Performance Issues

### High Memory Usage

**Symptom:** Bot using excessive RAM (>512MB without AI)

**Possible Causes:**
1. Memory leak
2. Large message cache
3. Too many active giveaways
4. Database connection pool too large

**Diagnostic Steps:**

```bash
# Check memory usage
ps aux | grep node

# Check for memory leaks
node --inspect dist/index.js
# Then use Chrome DevTools to analyze heap

# Check active giveaways
psql -U tzbot_user -d tzbot -c "SELECT COUNT(*) FROM giveaways WHERE status = 'active';"
```

**Solutions:**

**Restart Bot:**
```bash
# Temporary fix
systemctl restart tzbot
```

**Reduce Cache:**
```bash
# Reduce Redis cache size
redis-cli CONFIG SET maxmemory 128mb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

**Optimize Database Pool:**
```bash
# In .env
echo "DATABASE_MAX_CONNECTIONS=10" >> .env
systemctl restart tzbot
```

---

### High CPU Usage

**Symptom:** Bot using excessive CPU (>25% of one core)

**Possible Causes:**
1. Infinite loop
2. Too many messages being processed
3. Inefficient database queries
4. AI responder overload

**Diagnostic Steps:**

```bash
# Check CPU usage
top -p $(pgrep -f "node.*tzbot")

# Check message processing rate
grep "message" logs/tzbot.log | wc -l

# Check slow queries
psql -U tzbot_user -d tzbot -c "SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

**Solutions:**

**Rate Limit Messages:**
```typescript
// Implement message queue with rate limiting
// Process max 100 messages per second
```

**Optimize Queries:**
```sql
-- Add indexes to frequently queried columns
CREATE INDEX idx_violations_user_timestamp ON violations(user_id, timestamp);
CREATE INDEX idx_chat_activity_timestamp ON chat_activity(timestamp);
```

**Disable AI Responder:**
```bash
# If AI is causing high CPU
echo "AI_ENABLED=false" >> .env
systemctl restart tzbot
```

---

### Slow Response Times

**Symptom:** Commands take >3 seconds to respond

**Possible Causes:**
1. Database slow queries
2. Network latency
3. Discord API rate limiting
4. System overload

**Diagnostic Steps:**

```bash
# Check command execution time
grep "Command executed" logs/tzbot.log | tail -20

# Check database query time
psql -U tzbot_user -d tzbot -c "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 5;"

# Check network latency
ping discord.com
```

**Solutions:**

**Optimize Database:**
```bash
# Vacuum and analyze
vacuumdb -U tzbot_user -d tzbot -z -v

# Add indexes
psql -U tzbot_user -d tzbot -c "CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);"
```

**Use Caching:**
```typescript
// Cache frequently accessed data in Redis
// Example: User roles, configuration
```

**Defer Long Operations:**
```typescript
// For commands that take >3 seconds
await interaction.deferReply();
// ... long operation ...
await interaction.editReply({ content: 'Done!' });
```

---

## Database Issues

### Database Connection Failed

**Symptom:** Bot can't connect to PostgreSQL

**Possible Causes:**
1. PostgreSQL not running
2. Wrong credentials
3. Database doesn't exist
4. Connection limit reached

**Diagnostic Steps:**

```bash
# Check PostgreSQL status
systemctl status postgresql

# Test connection
psql -U tzbot_user -d tzbot -c "SELECT 1;"

# Check connection limit
psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"
psql -U postgres -c "SHOW max_connections;"
```

**Solutions:**

**Start PostgreSQL:**
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Fix Credentials:**
```bash
# Reset password
sudo -u postgres psql -c "ALTER USER tzbot_user WITH PASSWORD 'new_password';"

# Update .env
nano .env
# Update DATABASE_URL with new password
```

**Create Database:**
```bash
sudo -u postgres psql -c "CREATE DATABASE tzbot;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE tzbot TO tzbot_user;"
```

**Increase Connection Limit:**
```bash
# Edit postgresql.conf
sudo nano /etc/postgresql/15/main/postgresql.conf
# Change: max_connections = 200

# Restart PostgreSQL
sudo systemctl restart postgresql
```

---

### Database Queries Slow

**Symptom:** Database operations take >1 second

**Possible Causes:**
1. Missing indexes
2. Large table size
3. Inefficient queries
4. Database not vacuumed

**Diagnostic Steps:**

```bash
# Check slow queries
psql -U tzbot_user -d tzbot -c "SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Check table sizes
psql -U tzbot_user -d tzbot -c "SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"

# Check for missing indexes
psql -U tzbot_user -d tzbot -c "SELECT schemaname, tablename, attname, n_distinct, correlation FROM pg_stats WHERE schemaname = 'public' ORDER BY abs(correlation) DESC;"
```

**Solutions:**

**Add Indexes:**
```sql
-- Common indexes
CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);
CREATE INDEX IF NOT EXISTS idx_users_kick_username ON users(kick_username);
CREATE INDEX IF NOT EXISTS idx_violations_user_timestamp ON violations(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_giveaways_status_ends ON giveaways(status, ends_at);
CREATE INDEX IF NOT EXISTS idx_chat_activity_timestamp ON chat_activity(timestamp);
```

**Vacuum Database:**
```bash
# Analyze and vacuum
vacuumdb -U tzbot_user -d tzbot -z -v

# Schedule regular vacuuming
echo "0 2 * * * vacuumdb -U tzbot_user -d tzbot -z" | crontab -
```

**Archive Old Data:**
```sql
-- Delete old violations (>30 days)
DELETE FROM violations WHERE timestamp < NOW() - INTERVAL '30 days';

-- Delete old chat activity (>7 days)
DELETE FROM chat_activity WHERE timestamp < NOW() - INTERVAL '7 days';
```

---

## Network Issues

### Webhook Not Receiving Events

**Symptom:** Kick webhooks not triggering

**Possible Causes:**
1. Webhook URL not accessible
2. HTTPS not configured
3. Firewall blocking
4. Webhook signature verification failing

**Diagnostic Steps:**

```bash
# Test webhook URL externally
curl https://yourdomain.com/webhooks/kick

# Check firewall
sudo ufw status

# Check webhook logs
grep "webhook" logs/tzbot.log | tail -20

# Check Nginx/Caddy logs
tail -50 /var/log/nginx/access.log
```

**Solutions:**

**Configure HTTPS:**
```bash
# Using Let's Encrypt with Certbot
sudo certbot --nginx -d yourdomain.com

# Or use Cloudflare Tunnel (no open ports needed)
cloudflared tunnel create tzbot
cloudflared tunnel route dns tzbot yourdomain.com
```

**Open Firewall:**
```bash
# Allow HTTPS
sudo ufw allow 443/tcp

# Reload firewall
sudo ufw reload
```

**Fix Signature Verification:**
```bash
# Verify webhook secret matches
grep "KICK_WEBHOOK_SECRET" .env

# Update if needed from Kick Developer Portal
```

---

### Discord API Rate Limited

**Symptom:** Bot stops responding, "Rate limited" in logs

**Possible Causes:**
1. Too many API requests
2. Sending messages too quickly
3. Command spam
4. Bug causing request loop

**Diagnostic Steps:**

```bash
# Check for rate limit errors
grep "rate limit" logs/tzbot.log

# Check request frequency
grep "API request" logs/tzbot.log | wc -l

# Check for request loops
grep "API request" logs/tzbot.log | sort | uniq -c | sort -rn | head -10
```

**Solutions:**

**Wait:**
- Rate limits typically last 10-60 minutes
- Bot will automatically retry after cooldown

**Implement Rate Limiting:**
```typescript
// Use rate limiter for API requests
import { RateLimiter } from '@/core/security/rate-limiter.js';

const limiter = new RateLimiter({
  maxRequests: 50,
  windowMs: 1000, // 50 requests per second
});
```

**Fix Request Loops:**
```bash
# Identify the source of excessive requests
grep "API request" logs/tzbot.log | tail -100

# Fix the code causing the loop
# Restart bot
systemctl restart tzbot
```

---

## Getting Additional Help

### Collecting Diagnostic Information

When reporting issues, collect:

```bash
# Bot version
cat package.json | grep version

# System information
uname -a
free -h
df -h

# Recent logs
tail -100 logs/tzbot.log > diagnostic.log

# Configuration (remove sensitive data!)
cat .env | grep -v "TOKEN\|SECRET\|PASSWORD\|KEY" > config.txt

# Database status
psql -U tzbot_user -d tzbot -c "SELECT version();" > db-info.txt

# Redis status
redis-cli INFO > redis-info.txt
```

### Where to Get Help

1. **Check Documentation:**
   - [User Guide](./USER_GUIDE.md)
   - [Deployment Guide](./DEPLOYMENT.md)
   - [Moderator Quick Reference](./MODERATOR_QUICK_REFERENCE.md)

2. **Review Logs:**
   - Application logs: `logs/tzbot.log`
   - System logs: `journalctl -u tzbot`
   - Database logs: `/var/log/postgresql/`

3. **Contact Support:**
   - Server moderators
   - Bot administrator
   - GitHub issues (if open source)

---

## Preventive Maintenance

### Daily Tasks

- [ ] Check bot is online
- [ ] Review error logs
- [ ] Monitor resource usage

### Weekly Tasks

- [ ] Review moderation logs
- [ ] Check database size
- [ ] Update phishing blocklist
- [ ] Test critical features

### Monthly Tasks

- [ ] Update dependencies
- [ ] Run security audit
- [ ] Archive old logs
- [ ] Test backup restoration
- [ ] Review performance metrics

### Quarterly Tasks

- [ ] Major dependency updates
- [ ] Security review
- [ ] Performance optimization
- [ ] Feature usage analysis
- [ ] Disaster recovery test

---

**Last Updated:** 2025-02-21
**Version:** 1.0.0

