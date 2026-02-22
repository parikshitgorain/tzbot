# Discord Webhook Setup Guide

Complete guide to set up Discord notifications for deployment and real-time monitoring.

## Step 1: Create Discord Webhook (One Time)

1. Open your Discord server
2. Go to **Server Settings** → **Integrations** → **Webhooks**
3. Click **"New Webhook"**
4. Configure:
   - **Name:** TZBOT Notifications
   - **Channel:** Select where you want notifications
5. Click **"Copy Webhook URL"**
   - It looks like: `https://discord.com/api/webhooks/123456789/abcdefg...`

## Step 2: Add to GitHub Secrets (For Deployment Notifications)

1. Go to: `https://github.com/YOUR_USERNAME/tzbot/settings/secrets/actions`
2. Click **"New repository secret"**
3. **Name:** `DISCORD_WEBHOOK_URL`
4. **Value:** Paste the webhook URL
5. Click **"Add secret"**

This enables deployment notifications:
- 🚀 New release starting
- ⚙️ Installing dependencies (40%)
- 🔄 Restarting bot (80%)
- ✅ Deployment successful
- ❌ Deployment failed

## Step 3: Add to VPS (For Real-Time Monitoring)

### Option A: Automatic Setup (Recommended)

SSH into your VPS and run:

```bash
# Set the webhook URL
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/YOUR_WEBHOOK_URL"

# Run the monitoring setup script
cd /var/www/tzbot
bash deployment/scripts/setup-monitoring.sh
```

The script will:
- Create systemd service file with webhook
- Start the monitoring service
- Enable auto-start on boot

### Option B: Manual Setup

1. SSH into your VPS:
```bash
ssh your-user@your-vps
```

2. Create environment file:
```bash
sudo nano /etc/systemd/system/tzbot-monitor.env
```

3. Add this line (replace with your webhook URL):
```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_URL
```

4. Save and exit (Ctrl+X, Y, Enter)

5. Create the systemd service:
```bash
sudo nano /etc/systemd/system/tzbot-monitor.service
```

6. Paste this content:
```ini
[Unit]
Description=TZBOT Real-time Monitoring Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/tzbot
EnvironmentFile=/etc/systemd/system/tzbot-monitor.env
ExecStart=/bin/bash /var/www/tzbot/deployment/scripts/monitor-bot.sh
Restart=always
RestartSec=10
StandardOutput=append:/var/www/tzbot/logs/monitor.log
StandardError=append:/var/www/tzbot/logs/monitor-error.log

[Install]
WantedBy=multi-user.target
```

7. Save and exit

8. Start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable tzbot-monitor
sudo systemctl start tzbot-monitor
```

9. Check status:
```bash
sudo systemctl status tzbot-monitor
```

## Step 4: Verify Setup

### Test Deployment Notifications
Push a commit to trigger deployment and check Discord for notifications.

### Test Monitoring Notifications
The monitoring service checks every 5 minutes. To test immediately:

```bash
# SSH into VPS
ssh your-user@your-vps

# Stop the bot (will trigger alert)
pm2 stop tzbot

# Wait 10 seconds, then check Discord for crash alert

# Start the bot (will trigger recovery alert)
pm2 start tzbot

# Check Discord for recovery notification
```

## What Notifications You'll Receive

### Deployment Notifications (from GitHub Actions)
- 🚀 **New Release** - When deployment starts
- ⚙️ **Progress 40%** - Installing dependencies
- 🔄 **Progress 80%** - Restarting service
- ✅ **Success** - Deployment completed
- ❌ **Failed** - Deployment failed (with auto-rollback)

### Real-Time Monitoring (from VPS)
- 🚨 **Bot Crashed** - When bot stops/errors
- ✅ **Bot Recovered** - When bot comes back online
- ⚠️ **High Memory** - When memory usage > 500MB
- 🚨 **Process Missing** - When bot not found in PM2

## Troubleshooting

### No notifications from GitHub Actions
- Verify `DISCORD_WEBHOOK_URL` is in GitHub Secrets
- Check webhook URL is correct
- Ensure webhook channel still exists

### No notifications from VPS monitoring
```bash
# Check if service is running
sudo systemctl status tzbot-monitor

# Check logs
tail -f /var/www/tzbot/logs/monitor.log
tail -f /var/www/tzbot/logs/monitor-error.log

# Restart service
sudo systemctl restart tzbot-monitor
```

### Webhook rate limiting
Discord webhooks are limited to:
- 30 requests per minute
- 5 requests per second

The monitoring system has built-in throttling (same alert not sent within 15 minutes).

## Managing the Monitoring Service

```bash
# Start monitoring
sudo systemctl start tzbot-monitor

# Stop monitoring
sudo systemctl stop tzbot-monitor

# Restart monitoring
sudo systemctl restart tzbot-monitor

# Check status
sudo systemctl status tzbot-monitor

# View logs
sudo journalctl -u tzbot-monitor -f

# Disable auto-start
sudo systemctl disable tzbot-monitor

# Enable auto-start
sudo systemctl enable tzbot-monitor
```

## Security Notes

- Webhook URLs are sensitive - treat them like passwords
- Don't commit webhook URLs to git
- Rotate webhooks if compromised
- Monitor webhook usage in Discord server settings

## Next Steps

After setup:
1. Both systems will send notifications automatically
2. No manual intervention needed
3. Check Discord for all deployment and health updates
4. Monitoring runs 24/7 in the background

---

**Need Help?** Check the troubleshooting section or review logs on your VPS.
