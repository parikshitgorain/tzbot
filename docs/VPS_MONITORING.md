# VPS Runtime Monitoring

Comprehensive guide for the VPS runtime monitoring system that sends Discord alerts on critical production issues.

## Overview

The VPS monitoring system provides real-time alerts for critical production issues:

- **Process crashes** - Bot stops running
- **High restart frequency** - 3+ restarts in 5 minutes
- **Memory issues** - Usage above 1GB
- **Automatic recovery** - PM2 auto-restart on crash

All alerts are sent to Discord via webhook with detailed context including error logs, version, and timestamp.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     VPS Monitoring System                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐                     │
│  │   PM2 Bot    │      │ Cron Job     │                     │
│  │   Process    │      │ (every min)  │                     │
│  └──────┬───────┘      └──────┬───────┘                     │
│         │                     │                              │
│         │ monitors            │ executes                     │
│         ▼                     ▼                              │
│  ┌─────────────────────────────────────┐                    │
│  │   vps-monitor.sh                    │                    │
│  │   - Check process status            │                    │
│  │   - Track restart frequency         │                    │
│  │   - Monitor memory usage            │                    │
│  │   - Extract error logs              │                    │
│  └─────────────┬───────────────────────┘                    │
│                │                                             │
│                │ sends alerts                                │
│                ▼                                             │
│  ┌─────────────────────────────────────┐                    │
│  │   Discord Webhook                   │                    │
│  │   - Crash alerts                    │                    │
│  │   - Restart frequency warnings      │                    │
│  │   - Memory usage warnings           │                    │
│  └─────────────────────────────────────┘                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Monitoring Script (`vps-monitor.sh`)

Located at: `/var/www/tzbot/deployment/scripts/vps-monitor.sh`

**Features:**
- Checks PM2 process status every minute
- Tracks restart count and frequency
- Monitors memory usage
- Extracts error logs (last 20-50 lines)
- Sends Discord alerts with full context
- Alert throttling to prevent spam

**Alert Types:**

| Alert | Trigger | Color | Throttle |
|-------|---------|-------|----------|
| Process Crash | PM2 status != online | Red (15158332) | 5 minutes |
| High Restart Frequency | 3+ restarts in 5 min | Yellow (16776960) | Clears after alert |
| High Memory Usage | >1GB RAM | Yellow (16776960) | 15 minutes |

### 2. Setup Script (`setup-vps-monitoring.sh`)

Located at: `/var/www/tzbot/deployment/scripts/setup-vps-monitoring.sh`

**What it does:**
- Validates environment and webhook configuration
- Makes monitoring script executable
- Creates state directory for tracking
- Installs cron job (runs every minute)
- Creates log file with proper permissions
- Tests monitoring script

**Automatic Installation:**
- Runs automatically during deployment via GitHub Actions
- Can also be run manually on VPS

### 3. PM2 Configuration (`ecosystem.config.cjs`)

**Monitoring-Related Settings:**
```javascript
{
  autorestart: true,           // Auto-restart on crash
  max_restarts: 10,            // Max restarts before giving up
  min_uptime: '10s',           // Min uptime to avoid restart loop
  max_memory_restart: '1G',    // Restart if memory exceeds 1GB
  restart_delay: 4000,         // Delay between restarts
  exp_backoff_restart_delay: 100  // Exponential backoff
}
```

### 4. Cron Job

**Schedule:** `*/1 * * * *` (every minute)

**Command:**
```bash
/var/www/tzbot/deployment/scripts/vps-monitor.sh >> /var/log/tzbot-monitor.log 2>&1
```

## Setup

### Automatic Setup (Recommended)

Monitoring is automatically installed during deployment via GitHub Actions:

1. Push to `release` branch or create version tag
2. CD workflow runs
3. After PM2 restart, `setup-vps-monitoring.sh` runs automatically
4. Monitoring starts within 1 minute

### Manual Setup

If you need to set up monitoring manually on the VPS:

```bash
# SSH into VPS
ssh user@your-vps-hostname

# Navigate to deployment directory
cd /var/www/tzbot

# Run setup script
bash deployment/scripts/setup-vps-monitoring.sh
```

### Verify Installation

```bash
# Check cron job is installed
crontab -l | grep vps-monitor

# View monitoring logs
tail -f /var/log/tzbot-monitor.log

# Test monitoring script manually
bash /var/www/tzbot/deployment/scripts/vps-monitor.sh
```

## Configuration

### Discord Webhook URL

The monitoring system requires `DISCORD_WEBHOOK_URL` to be configured:

**GitHub Secrets (for deployment):**
```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

**VPS .env file:**
```bash
# /var/www/tzbot/shared/.env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

The deployment workflow automatically writes this to the VPS .env file.

### Monitoring Thresholds

Edit `vps-monitor.sh` to customize thresholds:

```bash
# Restart frequency threshold
RESTART_THRESHOLD=3        # Number of restarts
RESTART_WINDOW=300         # Time window (5 minutes)

# Memory threshold
MEMORY_THRESHOLD=1024      # MB (1GB)

# Alert throttling
CRASH_ALERT_COOLDOWN=300   # 5 minutes
MEMORY_ALERT_COOLDOWN=900  # 15 minutes
```

## Discord Alert Format

All alerts use Discord embeds with consistent formatting:

```json
{
  "embeds": [{
    "title": "🔴 Bot Process Crashed",
    "description": "The bot process has crashed and is not running.",
    "color": 15158332,
    "fields": [
      {"name": "Service", "value": "`tzbot`"},
      {"name": "VPS", "value": "`your-hostname`"},
      {"name": "Version", "value": "`v1.2.3`"},
      {"name": "Error Type", "value": "Process Crash"},
      {"name": "Timestamp", "value": "`2026-02-23T10:30:00Z`"},
      {"name": "Error Log", "value": "```\n[error logs]\n```"}
    ]
  }]
}
```

## Monitoring Logs

### View Real-Time Logs

```bash
# Monitor logs in real-time
tail -f /var/log/tzbot-monitor.log

# View last 50 lines
tail -n 50 /var/log/tzbot-monitor.log

# Search for specific alerts
grep "High restart frequency" /var/log/tzbot-monitor.log
```

### Log Rotation

Logs are automatically rotated by the system. To configure custom rotation:

```bash
# Create logrotate config
sudo nano /etc/logrotate.d/tzbot-monitor

# Add configuration:
/var/log/tzbot-monitor.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
```

## Troubleshooting

### No Alerts Received

**Check webhook URL:**
```bash
# Verify webhook URL is configured
grep DISCORD_WEBHOOK_URL /var/www/tzbot/shared/.env

# Test webhook manually
curl -H "Content-Type: application/json" -X POST \
  -d '{"content":"Test from VPS"}' \
  "YOUR_WEBHOOK_URL"
```

**Check cron job:**
```bash
# Verify cron job exists
crontab -l | grep vps-monitor

# Check cron service is running
sudo systemctl status cron
```

**Check monitoring logs:**
```bash
# View recent monitoring activity
tail -n 100 /var/log/tzbot-monitor.log

# Look for errors
grep -i error /var/log/tzbot-monitor.log
```

### Monitoring Script Not Running

**Check permissions:**
```bash
# Verify script is executable
ls -la /var/www/tzbot/deployment/scripts/vps-monitor.sh

# Make executable if needed
chmod +x /var/www/tzbot/deployment/scripts/vps-monitor.sh
```

**Check PM2:**
```bash
# Verify PM2 is installed
pm2 --version

# Check bot process
pm2 describe tzbot

# View PM2 logs
pm2 logs tzbot --lines 50
```

### Too Many Alerts (Spam)

The monitoring script has built-in throttling, but if you're still getting too many alerts:

**Increase throttle times:**
```bash
# Edit monitoring script
nano /var/www/tzbot/deployment/scripts/vps-monitor.sh

# Increase cooldown values:
CRASH_ALERT_COOLDOWN=600    # 10 minutes instead of 5
MEMORY_ALERT_COOLDOWN=1800  # 30 minutes instead of 15
```

**Reduce monitoring frequency:**
```bash
# Edit cron job
crontab -e

# Change from every minute to every 5 minutes:
*/5 * * * * /var/www/tzbot/deployment/scripts/vps-monitor.sh >> /var/log/tzbot-monitor.log 2>&1
```

### False Positive Alerts

**Memory alerts when usage is normal:**
```bash
# Check actual memory usage
pm2 monit

# Adjust threshold in vps-monitor.sh
MEMORY_THRESHOLD=2048  # Increase to 2GB
```

**Restart alerts during deployments:**
- This is expected behavior during deployments
- Alerts are throttled to prevent spam
- Consider adding deployment window detection to script

## Maintenance

### Disable Monitoring Temporarily

```bash
# Remove cron job
crontab -e
# Comment out or delete the vps-monitor line

# Or disable cron entirely
sudo systemctl stop cron
```

### Re-enable Monitoring

```bash
# Run setup script again
bash /var/www/tzbot/deployment/scripts/setup-vps-monitoring.sh

# Or manually add cron job
crontab -e
# Add: */1 * * * * /var/www/tzbot/deployment/scripts/vps-monitor.sh >> /var/log/tzbot-monitor.log 2>&1
```

### Update Monitoring Script

```bash
# Pull latest changes
cd /var/www/tzbot
git pull origin release

# Make executable
chmod +x deployment/scripts/vps-monitor.sh

# Test updated script
bash deployment/scripts/vps-monitor.sh
```

## Best Practices

1. **Keep webhook URL secure** - Never commit to repository
2. **Monitor the monitoring logs** - Check `/var/log/tzbot-monitor.log` periodically
3. **Test after changes** - Run monitoring script manually after configuration changes
4. **Set up log rotation** - Prevent log files from growing too large
5. **Document custom thresholds** - If you change defaults, document why
6. **Review alerts regularly** - Ensure alerts are actionable and not noisy

## Integration with CI/CD

The monitoring system integrates with the CI/CD pipeline:

1. **Deployment workflow** automatically installs monitoring
2. **Discord notifications** from both CI/CD and VPS monitoring
3. **Consistent alert format** across all notification sources
4. **Version tracking** in alerts helps correlate issues with deployments

## Future Enhancements

Potential improvements to consider:

- [ ] Health check endpoint monitoring (HTTP ping)
- [ ] Database connection failure detection
- [ ] Disk space monitoring
- [ ] CPU usage alerts
- [ ] Network connectivity checks
- [ ] Integration with external monitoring services (Datadog, New Relic)
- [ ] Alert aggregation and deduplication
- [ ] Slack/Teams webhook support
- [ ] PagerDuty integration for critical alerts

## Related Documentation

- [CI/CD Production Guide](./CICD_PRODUCTION_GUIDE.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Discord Webhook Setup](./DISCORD_WEBHOOK_SETUP.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
