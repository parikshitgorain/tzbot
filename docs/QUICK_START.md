# TZBOT Quick Start Guide

Get TZBOT up and running in 15 minutes!

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 15+ installed and running
- Redis 7+ installed and running
- Discord bot created (see below)

## Step 1: Create Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" → Name it "TZBOT"
3. Go to "Bot" section → Click "Add Bot"
4. Copy the bot token (you'll need this)
5. Enable these Privileged Gateway Intents:
   - ✅ Presence Intent
   - ✅ Server Members Intent
   - ✅ Message Content Intent
6. Go to OAuth2 → URL Generator
7. Select scopes: `bot` and `applications.commands`
8. Select permissions: Administrator (or specific permissions from deployment guide)
9. Copy the generated URL and open it to invite bot to your server

## Step 2: Clone and Install

```bash
# Clone repository
git clone https://github.com/yourusername/tzbot-discord-bot.git
cd tzbot-discord-bot

# Install dependencies
npm install
```

## Step 3: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env file
nano .env
```

**Minimum required variables:**
```bash
DISCORD_TOKEN=your_bot_token_from_step_1
DISCORD_GUILD_ID=your_server_id
DISCORD_CLIENT_ID=your_application_id
SUBSCRIBER_ROLE_ID=role_id_for_subscribers
VIP_ROLE_ID=role_id_for_vips
MODERATOR_ROLE_ID=role_id_for_moderators
NOTIFICATION_CHANNEL_ID=channel_id_for_notifications
DATABASE_URL=postgresql://postgres:password@localhost:5432/tzbot
REDIS_URL=redis://localhost:6379
```

**How to get IDs:**
1. Enable Developer Mode in Discord (Settings → Advanced → Developer Mode)
2. Right-click server/channel/role → Copy ID

## Step 4: Set Up Database

```bash
# Create database
sudo -u postgres psql -c "CREATE DATABASE tzbot;"

# Build project (compiles TypeScript)
npm run build

# Run migrations (creates tables)
npm run migrate
```

## Step 5: Start Bot

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

You should see:
```
[INFO] Bot is starting...
[INFO] Database connected
[INFO] Redis connected
[INFO] Discord client ready
[INFO] Bot is online as TZBOT#1234
```

## Step 6: Test Bot

In your Discord server, try:

```
/ping
```

Bot should respond with "Pong!" and latency information.

## Next Steps

### Configure Kick Integration (Optional)

1. Apply for Kick Developer access at [dev.kick.com](https://dev.kick.com)
2. Create OAuth application
3. Add credentials to `.env`:
   ```bash
   KICK_API_KEY=your_key
   KICK_CHANNEL_ID=your_channel_id
   KICK_OAUTH_CLIENT_ID=your_client_id
   KICK_OAUTH_CLIENT_SECRET=your_client_secret
   ```

### Set Up Google Safe Browsing (Recommended)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create project and enable Safe Browsing API
3. Create API key
4. Add to `.env`:
   ```bash
   GOOGLE_SAFE_BROWSING_API_KEY=your_api_key
   ```

### Production Deployment

For production, set up:
- systemd service (auto-restart)
- HTTPS for webhooks
- Log rotation
- Automated backups

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## Common Issues

### Bot won't start

**Error: "Invalid token"**
- Check `DISCORD_TOKEN` in `.env`
- Regenerate token in Discord Developer Portal

**Error: "Database connection failed"**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Start if not running
sudo systemctl start postgresql
```

**Error: "Redis connection refused"**
```bash
# Check Redis is running
sudo systemctl status redis

# Start if not running
sudo systemctl start redis
```

### Bot is online but commands don't work

**Commands not showing up:**
- Wait 1 hour for Discord to sync commands globally
- Or kick bot and re-invite to force sync

**Permission errors:**
- Check bot role is above roles it needs to manage
- Verify bot has required permissions

### Need Help?

- Read [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed setup
- Check logs: `tail -f logs/tzbot.log`
- Enable debug logging: `LOG_LEVEL=debug` in `.env`

## Minimal Working Configuration

For testing, you only need:

```bash
# .env minimal
DISCORD_TOKEN=your_token
DISCORD_GUILD_ID=your_server_id
DISCORD_CLIENT_ID=your_client_id
SUBSCRIBER_ROLE_ID=any_role_id
VIP_ROLE_ID=any_role_id
MODERATOR_ROLE_ID=any_role_id
NOTIFICATION_CHANNEL_ID=any_channel_id
DATABASE_URL=postgresql://postgres:password@localhost:5432/tzbot
REDIS_URL=redis://localhost:6379
```

This will start the bot with basic functionality. Add other features as needed.

---

**Ready to deploy?** See [DEPLOYMENT.md](./DEPLOYMENT.md) for production setup.
