# TZBOT Discord Bot - Deployment Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Database Setup](#database-setup)
4. [Redis Setup](#redis-setup)
5. [Discord Bot Setup](#discord-bot-setup)
6. [Kick API Setup](#kick-api-setup)
7. [Google Safe Browsing API Setup](#google-safe-browsing-api-setup)
8. [Deployment Options](#deployment-options)
9. [Monitoring Setup](#monitoring-setup)
10. [Backup and Restore](#backup-and-restore)
11. [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying TZBOT, ensure you have:

- **Node.js**: Version 18.0.0 or higher
- **PostgreSQL**: Version 15 or higher
- **Redis**: Version 7 or higher
- **Operating System**: Linux (Ubuntu 20.04+ recommended), macOS, or Windows with WSL2
- **Memory**: Minimum 2GB RAM (4GB+ recommended)
- **Storage**: Minimum 10GB available disk space
- **Network**: Public IP address with HTTPS support (for webhooks)
- **Domain**: Optional but recommended for webhook endpoint

## Environment Variables

Create a `.env` file in the project root with the following variables:

### Required Variables

#### Discord Configuration
```bash
# Your Discord bot token from the Discord Developer Portal
DISCORD_TOKEN=your_discord_bot_token_here

# The ID of your Discord server (guild)
DISCORD_GUILD_ID=123456789012345678

# Your Discord application client ID
DISCORD_CLIENT_ID=123456789012345678
```

#### Discord Role IDs
```bash
# Role ID for Kick subscribers
SUBSCRIBER_ROLE_ID=123456789012345678

# Role ID for Kick VIPs
VIP_ROLE_ID=123456789012345678

# Role ID for server moderators
MODERATOR_ROLE_ID=123456789012345678
```

#### Discord Channel IDs
```bash
# Channel for live notifications from Kick
NOTIFICATION_CHANNEL_ID=123456789012345678

# Fallback channel if primary notification channel fails
FALLBACK_CHANNEL_ID=123456789012345678

# Private channel where moderators post announcements
PRIVATE_ANNOUNCEMENT_CHANNEL_ID=123456789012345678

# Comma-separated list of public channels for announcement relay
PUBLIC_ANNOUNCEMENT_CHANNEL_IDS=123456789012345678,987654321098765432
```

#### Kick.com Configuration
```bash
# Kick API key (obtain from Kick Developer Portal)
KICK_API_KEY=your_kick_api_key_here

# Your Kick channel ID
KICK_CHANNEL_ID=12345

# Secret for verifying webhook signatures
KICK_WEBHOOK_SECRET=your_webhook_secret_here

# OAuth 2.0 client ID from Kick Developer Portal
KICK_OAUTH_CLIENT_ID=your_oauth_client_id

# OAuth 2.0 client secret from Kick Developer Portal
KICK_OAUTH_CLIENT_SECRET=your_oauth_client_secret
```

#### Database Configuration
```bash
# PostgreSQL connection URL
DATABASE_URL=postgresql://username:password@localhost:5432/tzbot

# Maximum number of database connections in pool
DATABASE_MAX_CONNECTIONS=20
```

#### Redis Configuration
```bash
# Redis connection URL
REDIS_URL=redis://localhost:6379

# Redis password (leave empty if no password)
REDIS_PASSWORD=your_redis_password
```

#### Google Safe Browsing API
```bash
# API key from Google Cloud Console
GOOGLE_SAFE_BROWSING_API_KEY=your_google_api_key_here
```

### Optional Variables

#### AI Auto-Responder (Optional Feature)
```bash
# Enable or disable AI auto-responder
AI_ENABLED=false

# AI provider: 'local' (Ollama), 'openai', or 'anthropic'
AI_PROVIDER=openai

# API key for cloud AI providers (OpenAI/Anthropic)
AI_API_KEY=your_ai_api_key_here

# Model name (e.g., 'gpt-3.5-turbo', 'claude-3-sonnet', 'llama2')
AI_MODEL_NAME=gpt-3.5-turbo

# Comma-separated list of channel IDs where AI responds
AI_CHANNELS=123456789012345678,987654321098765432
```

#### Chat Rain Configuration
```bash
# Enable or disable chat rain feature
CHAT_RAIN_ENABLED=true

# Minimum delay between chat rain events (seconds)
CHAT_RAIN_MIN_DELAY=300

# Time window for active chatter tracking (seconds)
CHAT_RAIN_ACTIVE_WINDOW=600

# Minimum messages required to be considered active
CHAT_RAIN_MIN_MESSAGES=3
```

#### Webhook Server Configuration
```bash
# Port for webhook server
WEBHOOK_PORT=3000

# Host for webhook server
WEBHOOK_HOST=0.0.0.0
```

#### Logging Configuration
```bash
# Log level: 'error', 'warn', 'info', 'debug'
LOG_LEVEL=info

# Path to log file
LOG_FILE=logs/tzbot.log
```

#### Environment
```bash
# Environment: 'development', 'production', or 'test'
NODE_ENV=production
```

### How to Get IDs

**Discord Server (Guild) ID:**
1. Enable Developer Mode in Discord (User Settings → Advanced → Developer Mode)
2. Right-click your server icon → Copy Server ID

**Discord Channel IDs:**
1. Right-click a channel → Copy Channel ID

**Discord Role IDs:**
1. Server Settings → Roles → Right-click a role → Copy Role ID

**Discord Client ID:**
1. Visit [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application → Copy Application ID

## Database Setup

### PostgreSQL Installation

#### Ubuntu/Debian
```bash
# Update package list
sudo apt update

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### macOS (using Homebrew)
```bash
# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15
```

#### Windows
Download and install from [PostgreSQL Downloads](https://www.postgresql.org/download/windows/)

### Database Creation

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE tzbot;
CREATE USER tzbot_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE tzbot TO tzbot_user;

# Exit psql
\q
```

### Schema Setup

The bot automatically runs database migrations on startup. The schema includes:

- **users**: Discord and Kick user mappings
- **violations**: Moderation violation tracking
- **giveaways**: Giveaway state and entries
- **chat_activity**: Active chatter tracking for chat rain
- **config**: Bot configuration storage
- **moderation_logs**: Audit trail for moderation actions

To manually run migrations:

```bash
# Build the project first
npm run build

# Run migrations
npm run migrate
```

### Database Configuration

Edit PostgreSQL configuration for optimal performance:

```bash
# Edit postgresql.conf
sudo nano /etc/postgresql/15/main/postgresql.conf
```

Recommended settings:
```conf
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 2621kB
min_wal_size = 1GB
max_wal_size = 4GB
```

Restart PostgreSQL after changes:
```bash
sudo systemctl restart postgresql
```

## Redis Setup

### Redis Installation

#### Ubuntu/Debian
```bash
# Install Redis
sudo apt update
sudo apt install redis-server

# Start Redis service
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

#### macOS (using Homebrew)
```bash
# Install Redis
brew install redis

# Start Redis service
brew services start redis
```

#### Windows
Use [Redis for Windows](https://github.com/microsoftarchive/redis/releases) or WSL2

### Redis Configuration

Edit Redis configuration:
```bash
sudo nano /etc/redis/redis.conf
```

Recommended settings:
```conf
# Bind to localhost (or specific IP)
bind 127.0.0.1

# Set a password
requirepass your_secure_redis_password

# Enable persistence
save 900 1
save 300 10
save 60 10000

# Set max memory
maxmemory 256mb
maxmemory-policy allkeys-lru

# Enable AOF persistence
appendonly yes
appendfsync everysec
```

Restart Redis after changes:
```bash
sudo systemctl restart redis-server
```

### Verify Redis Connection

```bash
# Connect to Redis
redis-cli

# Authenticate (if password set)
AUTH your_secure_redis_password

# Test connection
PING
# Should return: PONG

# Exit
exit
```

## Discord Bot Setup

### Create Discord Application

1. Visit [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Enter application name (e.g., "TZBOT")
4. Click "Create"

### Configure Bot

1. Navigate to "Bot" section
2. Click "Add Bot" → "Yes, do it!"
3. Copy the bot token (save to `DISCORD_TOKEN` in `.env`)
4. Enable the following Privileged Gateway Intents:
   - ✅ Presence Intent
   - ✅ Server Members Intent
   - ✅ Message Content Intent

### Required Bot Permissions

The bot requires the following permissions (permission integer: `1099511627775`):

- **Manage Roles**: Assign/remove subscriber and VIP roles
- **Manage Messages**: Delete unauthorized messages
- **Ban Members**: Execute ban commands
- **Kick Members**: Execute kick commands
- **Moderate Members**: Apply timeouts
- **Send Messages**: Send notifications and responses
- **Embed Links**: Send rich embeds
- **Attach Files**: Send attachments in announcements
- **Read Message History**: Process message context
- **Add Reactions**: React to messages
- **Use Slash Commands**: Register and respond to commands

### Invite Bot to Server

Generate an invite URL:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=1099511627775&scope=bot%20applications.commands
```

Replace `YOUR_CLIENT_ID` with your Discord application client ID.

### Create Required Roles

In your Discord server, create the following roles:

1. **Subscriber** - For Kick subscribers
2. **VIP** - For Kick VIPs
3. **Moderator** - For bot moderators

**Important:** The bot's role must be positioned **above** the Subscriber and VIP roles in the role hierarchy for it to manage them.

### Create Required Channels

Create the following channels:

1. **#notifications** - For Kick live notifications (public)
2. **#announcements** - For public announcements (public)
3. **#mod-announcements** - For moderator announcement drafts (private)
4. **#bot-logs** - For bot logging (private, optional)

Copy the channel IDs and add them to your `.env` file.

## Kick API Setup

### Create Kick Developer Account

1. Visit [Kick Developer Portal](https://dev.kick.com) (if available)
2. Sign in with your Kick account
3. Apply for developer access
4. Wait for approval (may take several days)

**Note:** As of 2025, Kick's developer API may be in beta or limited access. Check their official documentation for current status.

### Create OAuth Application

1. In the Kick Developer Portal, create a new OAuth application
2. Set application name: "TZBOT"
3. Set redirect URI: `https://yourdomain.com/auth/callback`
4. Select required scopes:
   - `chat:read` - Read chat messages
   - `user:read` - Read user information
   - `channel:read` - Read channel information
5. Copy the Client ID and Client Secret to your `.env` file

### Configure Webhook

1. In your OAuth application settings, add webhook URL:
   ```
   https://yourdomain.com/webhooks/kick
   ```
2. Select events to receive:
   - Stream online/offline
   - New subscriber
   - New follower
   - Chat messages (for badge detection)
3. Copy the webhook secret to your `.env` file

### Webhook Requirements

- **HTTPS Required**: Kick webhooks require HTTPS
- **Public URL**: Must be accessible from the internet
- **Signature Verification**: Implement HMAC-SHA256 verification
- **Response Time**: Respond within 5 seconds

### Alternative: Polling Mode

If webhooks are unavailable, the bot will automatically fall back to polling mode:

- Polls Kick API every 10 seconds
- Checks for stream status changes
- Monitors chat for subscriber/VIP badges
- Higher latency than webhooks (10-20 seconds)

## Google Safe Browsing API Setup

### Create Google Cloud Project

1. Visit [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing project
3. Enable billing (free tier available)

### Enable Safe Browsing API

1. Navigate to "APIs & Services" → "Library"
2. Search for "Safe Browsing API"
3. Click "Enable"

### Create API Key

1. Navigate to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API Key"
3. Copy the API key to your `.env` file
4. (Recommended) Restrict the API key:
   - Application restrictions: IP addresses (add your server IP)
   - API restrictions: Safe Browsing API only

### API Limits

**Free Tier:**
- 10,000 queries per day
- Sufficient for small to medium servers

**Paid Tier:**
- Required for high-traffic servers (>10k messages/day)
- Pay per query beyond free tier

### Test API Key

```bash
curl "https://safebrowsing.googleapis.com/v4/threatMatches:find?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "client": {
      "clientId": "tzbot",
      "clientVersion": "1.0.0"
    },
    "threatInfo": {
      "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING"],
      "platformTypes": ["ANY_PLATFORM"],
      "threatEntryTypes": ["URL"],
      "threatEntries": [
        {"url": "http://malware.testing.google.test/testing/malware/"}
      ]
    }
  }'
```

Should return a threat match for the test URL.

## Deployment Options

### Option 1: VPS Deployment (Recommended)

#### Requirements
- Ubuntu 20.04+ or similar Linux distribution
- 2GB+ RAM
- 2+ CPU cores
- 20GB+ storage
- Public IP address
- Domain name (optional but recommended)

#### Setup Steps

1. **Update system:**
```bash
sudo apt update && sudo apt upgrade -y
```

2. **Install Node.js:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

3. **Install PostgreSQL and Redis:**
```bash
sudo apt install -y postgresql postgresql-contrib redis-server
```

4. **Clone repository:**
```bash
git clone https://github.com/yourusername/tzbot-discord-bot.git
cd tzbot-discord-bot
```

5. **Install dependencies:**
```bash
npm install
```

6. **Configure environment:**
```bash
cp .env.example .env
nano .env
# Fill in all required variables
```

7. **Build project:**
```bash
npm run build
```

8. **Run database migrations:**
```bash
npm run migrate
```

9. **Test bot:**
```bash
npm start
```

10. **Set up systemd service** (see below)

### Option 2: Docker Deployment

#### Create Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose webhook port
EXPOSE 3000

# Start bot
CMD ["npm", "start"]
```

#### Create docker-compose.yml

```yaml
version: '3.8'

services:
  bot:
    build: .
    restart: unless-stopped
    env_file: .env
    depends_on:
      - postgres
      - redis
    ports:
      - "3000:3000"
    volumes:
      - ./logs:/app/logs
      - ./data:/app/data

  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: tzbot
      POSTGRES_USER: tzbot_user
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

volumes:
  postgres_data:
  redis_data:
```

#### Deploy with Docker

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f bot

# Stop services
docker-compose down

# Restart bot only
docker-compose restart bot
```

### Option 3: systemd Service (Linux)

Create a systemd service file for automatic startup and restart:

#### Create Service File

```bash
sudo nano /etc/systemd/system/tzbot.service
```

Add the following content:

```ini
[Unit]
Description=TZBOT Discord Bot
After=network.target postgresql.service redis.service
Wants=postgresql.service redis.service

[Service]
Type=simple
User=tzbot
WorkingDirectory=/home/tzbot/tzbot-discord-bot
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /home/tzbot/tzbot-discord-bot/dist/index.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/tzbot/output.log
StandardError=append:/var/log/tzbot/error.log

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/home/tzbot/tzbot-discord-bot/logs /home/tzbot/tzbot-discord-bot/data

[Install]
WantedBy=multi-user.target
```

#### Create Bot User

```bash
# Create dedicated user for bot
sudo useradd -r -s /bin/bash -d /home/tzbot -m tzbot

# Create log directory
sudo mkdir -p /var/log/tzbot
sudo chown tzbot:tzbot /var/log/tzbot

# Set ownership
sudo chown -R tzbot:tzbot /home/tzbot/tzbot-discord-bot
```

#### Enable and Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service (start on boot)
sudo systemctl enable tzbot

# Start service
sudo systemctl start tzbot

# Check status
sudo systemctl status tzbot

# View logs
sudo journalctl -u tzbot -f
```

#### Service Management Commands

```bash
# Start bot
sudo systemctl start tzbot

# Stop bot
sudo systemctl stop tzbot

# Restart bot
sudo systemctl restart tzbot

# View status
sudo systemctl status tzbot

# View logs (last 100 lines)
sudo journalctl -u tzbot -n 100

# Follow logs in real-time
sudo journalctl -u tzbot -f
```

### HTTPS Setup for Webhooks

Kick webhooks require HTTPS. Choose one of these options:

#### Option A: Let's Encrypt with Nginx

1. **Install Nginx and Certbot:**
```bash
sudo apt install nginx certbot python3-certbot-nginx
```

2. **Configure Nginx:**
```bash
sudo nano /etc/nginx/sites-available/tzbot
```

Add configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location /webhooks/kick {
        proxy_pass http://localhost:3000/webhooks/kick;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /health {
        proxy_pass http://localhost:3000/health;
    }
}
```

3. **Enable site:**
```bash
sudo ln -s /etc/nginx/sites-available/tzbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

4. **Get SSL certificate:**
```bash
sudo certbot --nginx -d yourdomain.com
```

#### Option B: Cloudflare Tunnel

1. Install cloudflared
2. Authenticate with Cloudflare
3. Create tunnel to localhost:3000
4. No open ports required

#### Option C: Reverse Proxy (Caddy)

Caddy automatically handles HTTPS:

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# Configure Caddyfile
sudo nano /etc/caddy/Caddyfile
```

Add:
```
yourdomain.com {
    reverse_proxy /webhooks/kick localhost:3000
    reverse_proxy /health localhost:3000
}
```

```bash
# Restart Caddy
sudo systemctl restart caddy
```

## Monitoring Setup

### Health Checks

The bot exposes a health check endpoint at `/health`:

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "uptime": 3600,
  "checks": {
    "discord": "connected",
    "database": "connected",
    "redis": "connected",
    "kick": "connected"
  }
}
```

### Log Management

#### Log Rotation

Create logrotate configuration:

```bash
sudo nano /etc/logrotate.d/tzbot
```

Add:
```
/var/log/tzbot/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 tzbot tzbot
    sharedscripts
    postrotate
        systemctl reload tzbot > /dev/null 2>&1 || true
    endscript
}
```

#### Log Levels

Configure log level in `.env`:
- `error`: Only errors
- `warn`: Warnings and errors
- `info`: General information (recommended for production)
- `debug`: Detailed debugging information

### Monitoring Tools

#### Option 1: PM2 (Process Manager)

```bash
# Install PM2
npm install -g pm2

# Start bot with PM2
pm2 start dist/index.js --name tzbot

# Monitor
pm2 monit

# View logs
pm2 logs tzbot

# Auto-restart on reboot
pm2 startup
pm2 save
```

#### Option 2: Prometheus + Grafana

The bot can expose metrics for Prometheus:

1. Install Prometheus and Grafana
2. Configure Prometheus to scrape `/metrics` endpoint
3. Import Grafana dashboard for visualization

#### Option 3: Uptime Monitoring

Use external services to monitor bot uptime:
- UptimeRobot (free)
- Pingdom
- StatusCake

Configure to check `/health` endpoint every 5 minutes.

### Alert Configuration

#### Discord Webhook Alerts

Configure a Discord webhook for critical alerts:

```bash
# Add to .env
ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

The bot will send alerts for:
- Bot crashes and restarts
- Database connection failures
- Redis connection failures
- API rate limit exceeded
- Resource usage above 80%

#### Email Alerts

Configure SMTP for email alerts:

```bash
# Add to .env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
ALERT_EMAIL=admin@yourdomain.com
```

### Performance Monitoring

Monitor key metrics:

1. **Response Time**: Message processing latency
2. **Memory Usage**: RAM consumption
3. **CPU Usage**: Processor utilization
4. **Database Queries**: Query count and duration
5. **Redis Operations**: Cache hit/miss ratio
6. **API Calls**: Kick API and Discord API rate limits

View metrics:
```bash
# If using PM2
pm2 monit

# If using systemd
systemctl status tzbot
```

## Backup and Restore

### Database Backup

#### Automated Daily Backups

Create backup script:

```bash
sudo nano /usr/local/bin/backup-tzbot-db.sh
```

Add:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/tzbot"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="tzbot"
DB_USER="tzbot_user"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U $DB_USER -d $DB_NAME | gzip > $BACKUP_DIR/tzbot_$DATE.sql.gz

# Keep only last 30 days of backups
find $BACKUP_DIR -name "tzbot_*.sql.gz" -mtime +30 -delete

echo "Backup completed: tzbot_$DATE.sql.gz"
```

Make executable:
```bash
sudo chmod +x /usr/local/bin/backup-tzbot-db.sh
```

Schedule with cron:
```bash
sudo crontab -e
```

Add:
```
# Daily backup at 2 AM
0 2 * * * /usr/local/bin/backup-tzbot-db.sh >> /var/log/tzbot/backup.log 2>&1
```

#### Manual Backup

```bash
# Backup database
pg_dump -U tzbot_user -d tzbot > tzbot_backup.sql

# Backup with compression
pg_dump -U tzbot_user -d tzbot | gzip > tzbot_backup.sql.gz
```

### Database Restore

```bash
# Stop bot
sudo systemctl stop tzbot

# Restore from backup
gunzip < tzbot_backup.sql.gz | psql -U tzbot_user -d tzbot

# Or without compression
psql -U tzbot_user -d tzbot < tzbot_backup.sql

# Start bot
sudo systemctl start tzbot
```

### Redis Backup

Redis automatically saves to disk based on configuration. To manually backup:

```bash
# Trigger save
redis-cli SAVE

# Copy RDB file
sudo cp /var/lib/redis/dump.rdb /var/backups/tzbot/redis_backup_$(date +%Y%m%d).rdb
```

### Configuration Backup

Backup your `.env` file and any custom configuration:

```bash
# Create backup directory
mkdir -p ~/tzbot-backups

# Backup .env (contains sensitive data - keep secure!)
cp .env ~/tzbot-backups/.env.backup

# Backup entire project (excluding node_modules)
tar -czf ~/tzbot-backups/tzbot_$(date +%Y%m%d).tar.gz \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='logs' \
  ~/tzbot-discord-bot
```

### Disaster Recovery

#### Full System Restore

1. **Install dependencies** (Node.js, PostgreSQL, Redis)
2. **Restore database:**
   ```bash
   createdb -U postgres tzbot
   gunzip < tzbot_backup.sql.gz | psql -U tzbot_user -d tzbot
   ```
3. **Restore Redis** (if needed):
   ```bash
   sudo systemctl stop redis
   sudo cp redis_backup.rdb /var/lib/redis/dump.rdb
   sudo chown redis:redis /var/lib/redis/dump.rdb
   sudo systemctl start redis
   ```
4. **Restore configuration:**
   ```bash
   cp .env.backup .env
   ```
5. **Reinstall bot:**
   ```bash
   npm install
   npm run build
   ```
6. **Start bot:**
   ```bash
   sudo systemctl start tzbot
   ```

#### Backup to Cloud Storage

Use rclone to backup to cloud storage:

```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Configure cloud storage (e.g., AWS S3, Google Drive)
rclone config

# Sync backups to cloud
rclone sync /var/backups/tzbot remote:tzbot-backups
```

Add to backup script:
```bash
# At end of backup-tzbot-db.sh
rclone sync /var/backups/tzbot remote:tzbot-backups --log-file=/var/log/tzbot/rclone.log
```

## Troubleshooting

### Bot Won't Start

**Check logs:**
```bash
# If using systemd
sudo journalctl -u tzbot -n 50

# If using PM2
pm2 logs tzbot

# Check log files
tail -f logs/tzbot.log
```

**Common issues:**

1. **Missing environment variables:**
   ```
   Error: DISCORD_TOKEN is required
   ```
   Solution: Check `.env` file has all required variables

2. **Database connection failed:**
   ```
   Error: connect ECONNREFUSED 127.0.0.1:5432
   ```
   Solution: Ensure PostgreSQL is running:
   ```bash
   sudo systemctl status postgresql
   sudo systemctl start postgresql
   ```

3. **Redis connection failed:**
   ```
   Error: Redis connection refused
   ```
   Solution: Ensure Redis is running:
   ```bash
   sudo systemctl status redis
   sudo systemctl start redis
   ```

4. **Invalid Discord token:**
   ```
   Error: Invalid token
   ```
   Solution: Regenerate token in Discord Developer Portal

### Bot Crashes Frequently

**Check resource usage:**
```bash
# Memory usage
free -h

# CPU usage
top

# Disk space
df -h
```

**Increase memory limits:**

Edit systemd service:
```bash
sudo nano /etc/systemd/system/tzbot.service
```

Add under `[Service]`:
```ini
MemoryLimit=1G
```

**Check for memory leaks:**
```bash
# Monitor memory over time
watch -n 5 'ps aux | grep node'
```

### Webhooks Not Working

**Verify webhook URL is accessible:**
```bash
curl https://yourdomain.com/webhooks/kick
```

**Check webhook logs:**
```bash
grep "webhook" logs/tzbot.log
```

**Common issues:**

1. **HTTPS not configured:**
   - Kick requires HTTPS for webhooks
   - Set up SSL certificate (see HTTPS Setup section)

2. **Firewall blocking:**
   ```bash
   # Allow port 443
   sudo ufw allow 443/tcp
   ```

3. **Signature verification failing:**
   - Check `KICK_WEBHOOK_SECRET` matches Kick settings
   - Verify signature verification code is correct

### Commands Not Responding

**Verify bot has permissions:**
```bash
# Check bot role position in server
# Bot role must be above roles it manages
```

**Re-register slash commands:**
```bash
# Delete and re-register commands
npm run commands:register
```

**Check command logs:**
```bash
grep "command" logs/tzbot.log
```

### Role Sync Not Working

**Verify Kick API connection:**
```bash
# Check logs for Kick API errors
grep "kick" logs/tzbot.log
```

**Common issues:**

1. **User not linked:**
   - User must link their Kick account using `/link` command
   - User must chat on Kick to show badges

2. **Invalid API credentials:**
   - Check `KICK_API_KEY` and OAuth credentials
   - Regenerate credentials if needed

3. **Rate limiting:**
   - Kick API may rate limit requests
   - Bot will automatically retry with backoff

### High Memory Usage

**Check for memory leaks:**
```bash
# Get heap snapshot
node --inspect dist/index.js
```

**Optimize database queries:**
- Add indexes to frequently queried columns
- Clean up old data regularly

**Increase cache TTL:**
- Reduce Redis memory usage by increasing TTL
- Clear old cache entries

### Database Performance Issues

**Check slow queries:**
```sql
-- Enable slow query logging
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();

-- View slow queries
SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;
```

**Add indexes:**
```sql
-- Example: Index on user_id for violations table
CREATE INDEX idx_violations_user_id ON violations(user_id);
CREATE INDEX idx_violations_timestamp ON violations(timestamp);
```

**Vacuum database:**
```bash
# Analyze and optimize
vacuumdb -U tzbot_user -d tzbot -z -v
```

### Getting Help

**Check documentation:**
- [Project README](../README.md)
- [Project Structure](./project-structure.md)
- [Pusher Implementation](./pusher-client-implementation.md)

**Enable debug logging:**
```bash
# In .env
LOG_LEVEL=debug
```

**Collect diagnostic information:**
```bash
# System info
uname -a
node --version
npm --version

# Service status
sudo systemctl status tzbot
sudo systemctl status postgresql
sudo systemctl status redis

# Recent logs
sudo journalctl -u tzbot -n 100 > tzbot-logs.txt

# Resource usage
free -h > system-info.txt
df -h >> system-info.txt
top -b -n 1 >> system-info.txt
```

**Report issues:**
- Include diagnostic information
- Describe expected vs actual behavior
- Provide relevant log excerpts
- Mention any recent changes

## Security Best Practices

### Environment Variables

- **Never commit `.env` to version control**
- Use strong, unique passwords
- Rotate credentials regularly
- Use environment-specific `.env` files

### Database Security

```bash
# Restrict PostgreSQL to localhost
sudo nano /etc/postgresql/15/main/postgresql.conf
# Set: listen_addresses = 'localhost'

# Use strong password
ALTER USER tzbot_user WITH PASSWORD 'very_strong_random_password';

# Restrict database access
sudo nano /etc/postgresql/15/main/pg_hba.conf
# Add: local tzbot tzbot_user md5
```

### Redis Security

```bash
# Set strong password
requirepass very_strong_random_password

# Bind to localhost only
bind 127.0.0.1

# Disable dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""
```

### Firewall Configuration

```bash
# Enable firewall
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTPS (for webhooks)
sudo ufw allow 443/tcp

# Deny direct access to database and Redis
sudo ufw deny 5432/tcp
sudo ufw deny 6379/tcp

# Check status
sudo ufw status
```

### Regular Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Node.js dependencies
npm audit
npm update

# Update bot
git pull
npm install
npm run build
sudo systemctl restart tzbot
```

## Production Checklist

Before going live, verify:

- [ ] All environment variables configured
- [ ] Database created and migrations run
- [ ] Redis configured with password
- [ ] Discord bot invited with correct permissions
- [ ] Kick API credentials valid
- [ ] Google Safe Browsing API key valid
- [ ] HTTPS configured for webhooks
- [ ] Systemd service created and enabled
- [ ] Log rotation configured
- [ ] Backups scheduled
- [ ] Monitoring configured
- [ ] Firewall rules applied
- [ ] Health check endpoint accessible
- [ ] All slash commands registered
- [ ] Test moderation commands
- [ ] Test notification delivery
- [ ] Test giveaway creation
- [ ] Documentation reviewed
- [ ] Emergency contacts configured

## Performance Tuning

### Node.js Optimization

```bash
# Increase max memory (if needed)
NODE_OPTIONS="--max-old-space-size=2048" npm start
```

### PostgreSQL Tuning

```sql
-- Increase shared buffers
ALTER SYSTEM SET shared_buffers = '512MB';

-- Increase work memory
ALTER SYSTEM SET work_mem = '16MB';

-- Reload configuration
SELECT pg_reload_conf();
```

### Redis Tuning

```conf
# Increase max memory
maxmemory 512mb

# Use LRU eviction
maxmemory-policy allkeys-lru

# Disable persistence for cache-only usage (optional)
save ""
appendonly no
```

## Scaling Considerations

### Vertical Scaling

Increase server resources:
- 4GB+ RAM for large servers (10k+ members)
- 4+ CPU cores for high message volume
- SSD storage for database performance

### Horizontal Scaling

For very large deployments:
- Use PostgreSQL read replicas
- Use Redis Cluster for distributed caching
- Deploy multiple bot instances (requires coordination)
- Use message queue (RabbitMQ/Redis) for event processing

### Database Sharding

For massive scale (100k+ users):
- Shard by guild ID
- Use separate databases per region
- Implement connection pooling (PgBouncer)

---

## Quick Start Summary

1. Install Node.js, PostgreSQL, Redis
2. Clone repository and install dependencies
3. Create `.env` file with all required variables
4. Run database migrations
5. Build project: `npm run build`
6. Start bot: `npm start`
7. Set up systemd service for production
8. Configure HTTPS for webhooks
9. Set up monitoring and backups
10. Test all features

For detailed instructions, refer to the sections above.

---

**Last Updated:** 2025-01-15  
**Version:** 1.0.0
