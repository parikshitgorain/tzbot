# Discord Webhook Setup - Command Reference

## Quick Commands

### 1. Create Discord Webhook
```
Discord App → Your Server → Server Settings → Integrations → Webhooks → New Webhook
Copy the URL (looks like: https://discord.com/api/webhooks/123456789/abc...)
```

### 2. Add to GitHub (for deployment notifications)
```
Go to: https://github.com/YOUR_USERNAME/tzbot/settings/secrets/actions
Click: "New repository secret"
Name: DISCORD_WEBHOOK_URL
Value: Paste your webhook URL
Click: "Add secret"
```

### 3. Add to VPS (for real-time monitoring)

**Option A: Interactive (Easiest)**
```bash
ssh your-user@your-vps
sudo bash /var/www/tzbot/deployment/scripts/setup-webhook.sh
```

**Option B: One Command**
```bash
ssh your-user@your-vps
sudo DISCORD_WEBHOOK_URL="YOUR_WEBHOOK_URL" bash /var/www/tzbot/deployment/scripts/setup-monitoring.sh
```

**Option C: Manual**
```bash
# SSH into VPS
ssh your-user@your-vps

# Create environment file
sudo nano /etc/systemd/system/tzbot-monitor.env

# Add this line (replace with your URL):
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_URL
SERVICE_NAME=tzbot
CHECK_INTERVAL=300

# Save and exit (Ctrl+X, Y, Enter)

# Run setup
sudo bash /var/www/tzbot/deployment/scripts/setup-monitoring.sh
```

## Test Commands

### Test Deployment Notifications
```bash
# Make a test commit
git checkout Development
git commit --allow-empty -m "feat: test deployment notifications"
git push origin Development

# Merge to Release and watch Discord
```

### Test VPS Monitoring
```bash
# SSH into VPS
ssh your-user@your-vps

# Stop bot (triggers crash alert)
pm2 stop tzbot

# Wait 10 seconds, check Discord

# Start bot (triggers recovery alert)
pm2 start tzbot

# Check Discord for recovery notification
```

## Management Commands

### Check Monitoring Service Status
```bash
sudo systemctl status tzbot-monitor
```

### View Live Logs
```bash
# Systemd logs
sudo journalctl -u tzbot-monitor -f

# File logs
tail -f /var/www/tzbot/logs/monitor.log
```

### Restart Service
```bash
sudo systemctl restart tzbot-monitor
```

### Stop Service
```bash
sudo systemctl stop tzbot-monitor
```

### Start Service
```bash
sudo systemctl start tzbot-monitor
```

### Update Webhook URL
```bash
# Edit environment file
sudo nano /etc/systemd/system/tzbot-monitor.env

# Update the DISCORD_WEBHOOK_URL line
# Save and exit

# Restart service
sudo systemctl restart tzbot-monitor
```

## Verification Commands

### Check if webhook is configured on GitHub
```bash
# Go to: https://github.com/YOUR_USERNAME/tzbot/settings/secrets/actions
# Look for: DISCORD_WEBHOOK_URL
```

### Check if webhook is configured on VPS
```bash
sudo cat /etc/systemd/system/tzbot-monitor.env | grep DISCORD_WEBHOOK_URL
```

### Test webhook manually
```bash
# Replace YOUR_WEBHOOK_URL with your actual URL
curl -H "Content-Type: application/json" \
     -X POST \
     -d '{"content":"✅ Test notification from VPS"}' \
     YOUR_WEBHOOK_URL
```

## Troubleshooting Commands

### Service not running
```bash
# Check status
sudo systemctl status tzbot-monitor

# Check logs for errors
sudo journalctl -u tzbot-monitor -n 50

# Restart service
sudo systemctl restart tzbot-monitor
```

### No notifications
```bash
# Verify webhook URL is set
sudo cat /etc/systemd/system/tzbot-monitor.env

# Check if service is running
sudo systemctl status tzbot-monitor

# Check logs
tail -f /var/www/tzbot/logs/monitor.log

# Test webhook manually
curl -X POST -H "Content-Type: application/json" \
     -d '{"content":"Test"}' \
     YOUR_WEBHOOK_URL
```

### Service won't start
```bash
# Check for errors
sudo journalctl -u tzbot-monitor -n 50

# Verify script exists
ls -la /var/www/tzbot/deployment/scripts/monitor-bot.sh

# Make script executable
sudo chmod +x /var/www/tzbot/deployment/scripts/monitor-bot.sh

# Restart service
sudo systemctl restart tzbot-monitor
```

## Complete Setup Script

Copy and paste this entire block (replace YOUR_WEBHOOK_URL):

```bash
# SSH into VPS
ssh your-user@your-vps

# Set webhook URL
export DISCORD_WEBHOOK_URL="YOUR_WEBHOOK_URL"

# Run setup
sudo -E bash /var/www/tzbot/deployment/scripts/setup-monitoring.sh

# Verify it's running
sudo systemctl status tzbot-monitor

# Test it
pm2 stop tzbot && sleep 10 && pm2 start tzbot
```

## That's It!

After running these commands:
- ✅ GitHub will send deployment notifications
- ✅ VPS will send real-time health alerts
- ✅ Everything runs automatically
- ✅ No manual intervention needed

For detailed explanations, see:
- `docs/WEBHOOK_QUICK_START.md`
- `docs/DISCORD_WEBHOOK_SETUP.md`
- `docs/WEBHOOK_ARCHITECTURE.md`
