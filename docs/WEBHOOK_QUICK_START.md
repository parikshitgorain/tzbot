# Discord Webhook Quick Start

## What You Need
1. A Discord webhook URL (takes 2 minutes to create)
2. SSH access to your VPS

---

## Part 1: Create Discord Webhook (2 minutes)

1. Open Discord → Your Server
2. Click Server Settings (gear icon)
3. Go to: **Integrations** → **Webhooks**
4. Click **"New Webhook"**
5. Name it: `TZBOT Notifications`
6. Choose a channel for notifications
7. Click **"Copy Webhook URL"**

You'll get something like:
```
https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz
```

---

## Part 2: Setup on GitHub (1 minute)

For deployment notifications:

1. Go to: `https://github.com/YOUR_USERNAME/tzbot/settings/secrets/actions`
2. Click **"New repository secret"**
3. Name: `DISCORD_WEBHOOK_URL`
4. Value: Paste your webhook URL
5. Click **"Add secret"**

✅ Done! Deployment notifications are now active.

---

## Part 3: Setup on VPS (2 minutes)

For real-time bot monitoring:

### Option A: Interactive Setup (Easiest)

```bash
# SSH into your VPS
ssh your-user@your-vps

# Run the setup script
sudo bash /var/www/tzbot/deployment/scripts/setup-webhook.sh
```

The script will ask for your webhook URL and set everything up automatically.

### Option B: One-Line Setup

```bash
# SSH into your VPS
ssh your-user@your-vps

# Run with webhook URL
sudo DISCORD_WEBHOOK_URL="YOUR_WEBHOOK_URL_HERE" bash /var/www/tzbot/deployment/scripts/setup-monitoring.sh
```

Replace `YOUR_WEBHOOK_URL_HERE` with your actual webhook URL.

---

## Test It Works

### Test Deployment Notifications
Push any commit to trigger a deployment and watch Discord.

### Test VPS Monitoring
```bash
# SSH into VPS
ssh your-user@your-vps

# Stop bot (triggers crash alert)
pm2 stop tzbot

# Wait 10 seconds, check Discord for alert

# Start bot (triggers recovery alert)
pm2 start tzbot

# Check Discord for recovery notification
```

---

## What Notifications You'll Get

### From GitHub (Deployments)
- 🚀 New release starting
- ⚙️ Installing dependencies (40%)
- 🔄 Restarting bot (80%)
- ✅ Deployment successful
- ❌ Deployment failed

### From VPS (24/7 Monitoring)
- 🚨 Bot crashed
- ✅ Bot recovered
- ⚠️ High memory usage (>500MB)
- 🚨 Process missing

---

## Manage Monitoring Service

```bash
# Check status
sudo systemctl status tzbot-monitor

# View live logs
sudo journalctl -u tzbot-monitor -f

# Restart service
sudo systemctl restart tzbot-monitor

# Stop service
sudo systemctl stop tzbot-monitor

# Start service
sudo systemctl start tzbot-monitor
```

---

## Troubleshooting

### No notifications from GitHub
- Check webhook URL is in GitHub Secrets
- Verify webhook still exists in Discord
- Check GitHub Actions logs

### No notifications from VPS
```bash
# Check if service is running
sudo systemctl status tzbot-monitor

# Check logs
tail -f /var/www/tzbot/logs/monitor.log

# Restart service
sudo systemctl restart tzbot-monitor
```

### Update webhook URL
```bash
# Edit environment file
sudo nano /etc/systemd/system/tzbot-monitor.env

# Update the DISCORD_WEBHOOK_URL line
# Save and exit (Ctrl+X, Y, Enter)

# Restart service
sudo systemctl restart tzbot-monitor
```

---

## That's It!

You now have:
- ✅ Deployment notifications from GitHub Actions
- ✅ Real-time bot health monitoring from VPS
- ✅ All alerts sent to Discord automatically
- ✅ Zero manual intervention needed

Everything runs automatically in the background!
