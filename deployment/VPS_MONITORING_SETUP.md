# VPS Runtime Monitoring Setup Guide

## Overview

The VPS runtime monitoring system sends Discord alerts when the tzbot service encounters issues like crashes, restarts, or failures. The monitoring script is automatically installed during deployment.

## Automatic Installation

The monitoring script is automatically installed to `/usr/local/bin/tzbot-webhook-alert.sh` during every deployment by the `cd-production.yml` workflow. No manual installation is required.

## Manual Installation (If Needed)

If you need to install or update the script manually:

```bash
# SSH to your VPS
ssh user@your-vps-hostname

# Copy the script
sudo cp /var/www/tzbot/current/deployment/scripts/tzbot-webhook-alert.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/tzbot-webhook-alert.sh

# Test the script
/usr/local/bin/tzbot-webhook-alert.sh tzbot test 50
```

## Configuration

The script reads configuration from `/var/www/tzbot/shared/.env`:

```bash
# Required in .env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

This is automatically configured during deployment. No manual setup needed.

## Usage

### Basic Usage

```bash
# Send alert with defaults (service: tzbot, type: crash, logs: 50 lines)
/usr/local/bin/tzbot-webhook-alert.sh

# Custom parameters
/usr/local/bin/tzbot-webhook-alert.sh [service_name] [error_type] [log_lines]
```

### Examples

```bash
# Alert for crash with 50 log lines
/usr/local/bin/tzbot-webhook-alert.sh tzbot crash 50

# Alert for restart with 100 log lines
/usr/local/bin/tzbot-webhook-alert.sh tzbot restart 100

# Test alert
/usr/local/bin/tzbot-webhook-alert.sh tzbot test 25
```

## Integration Options

### Option 1: PM2 Ecosystem Config (Already Configured)

Your `ecosystem.config.js` already has restart limits:

```javascript
{
  max_restarts: 10,
  restart_delay: 4000,
  exp_backoff_restart_delay: 100,
  min_uptime: '10s'
}
```

PM2 will automatically restart the service, and you can monitor restart counts via PM2 logs.

### Option 2: Cron Watchdog (Recommended)

Create a simple watchdog that checks service health every 5 minutes:

```bash
# Create watchdog script
sudo tee /usr/local/bin/tzbot-watchdog.sh > /dev/null << 'EOF'
#!/bin/bash
set -e

if ! pm2 describe tzbot > /dev/null 2>&1; then
  /usr/local/bin/tzbot-webhook-alert.sh tzbot "not-found" 50
  exit 1
fi

STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="tzbot") | .pm2_env.status')
RESTARTS=$(pm2 jlist | jq -r '.[] | select(.name=="tzbot") | .pm2_env.restart_time')

if [ "$STATUS" != "online" ]; then
  /usr/local/bin/tzbot-webhook-alert.sh tzbot "status-$STATUS" 50
  exit 1
fi

if [ "$RESTARTS" -gt 5 ]; then
  /usr/local/bin/tzbot-webhook-alert.sh tzbot "high-restarts" 100
fi
EOF

sudo chmod +x /usr/local/bin/tzbot-watchdog.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/tzbot-watchdog.sh >> /var/log/tzbot-watchdog.log 2>&1") | crontab -
```

### Option 3: Systemd Service (Advanced)

If you're using systemd instead of PM2:

```bash
# Create systemd service file
sudo tee /etc/systemd/system/tzbot.service > /dev/null << 'EOF'
[Unit]
Description=TZBot Discord Bot
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/var/www/tzbot/current
ExecStart=/usr/bin/node /var/www/tzbot/current/dist/index.js
Restart=always
RestartSec=10
StandardOutput=append:/var/www/tzbot/shared/logs/tzbot.log
StandardError=append:/var/www/tzbot/shared/logs/error.log
OnFailure=tzbot-alert.service

[Install]
WantedBy=multi-user.target
EOF

# Create alert service
sudo tee /etc/systemd/system/tzbot-alert.service > /dev/null << 'EOF'
[Unit]
Description=TZBot Alert Service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/tzbot-webhook-alert.sh tzbot systemd-failure 100
EOF

# Reload and enable
sudo systemctl daemon-reload
sudo systemctl enable tzbot.service
sudo systemctl start tzbot.service
```

### Option 4: PM2 Event Listener (Advanced)

Create a custom PM2 event listener:

```bash
# Create event listener script
tee ~/pm2-event-listener.js > /dev/null << 'EOF'
const pm2 = require('pm2');
const { exec } = require('child_process');

pm2.connect((err) => {
  if (err) {
    console.error(err);
    process.exit(2);
  }

  pm2.launchBus((err, bus) => {
    if (err) {
      console.error(err);
      return;
    }

    bus.on('process:event', (data) => {
      if (data.process.name === 'tzbot') {
        if (data.event === 'exit' || data.event === 'restart') {
          exec('/usr/local/bin/tzbot-webhook-alert.sh tzbot ' + data.event + ' 50', (error) => {
            if (error) {
              console.error('Alert failed:', error);
            }
          });
        }
      }
    });
  });
});
EOF

# Run as PM2 process
pm2 start ~/pm2-event-listener.js --name tzbot-monitor
pm2 save
```

## Alert Information

The Discord alert includes:

- **Service Name**: The PM2 process name (tzbot)
- **Hostname**: VPS hostname
- **Error Type**: crash, restart, high-restarts, etc.
- **PM2 Status**: online, stopping, stopped, errored
- **Restart Count**: Number of times PM2 has restarted the service
- **Uptime**: How long the current process has been running
- **Version**: Current deployed version (from release directory name)
- **Recent Logs**: Last N lines from error.log (default 50)
- **Timestamp**: When the alert was sent

## Testing

### Test the Alert Script

```bash
# SSH to VPS
ssh user@your-vps-hostname

# Send test alert
/usr/local/bin/tzbot-webhook-alert.sh tzbot test-alert 50
```

You should receive a Discord message with service status and logs.

### Test PM2 Restart

```bash
# Restart the service and check if monitoring works
pm2 restart tzbot

# Check PM2 status
pm2 status
pm2 logs tzbot --lines 50
```

### Test Crash Scenario

```bash
# Simulate a crash (be careful!)
pm2 stop tzbot
sleep 5
pm2 start tzbot

# Or trigger an error in the code temporarily
```

## Monitoring Dashboard

You can view PM2 status anytime:

```bash
# SSH to VPS
ssh user@your-vps-hostname

# View PM2 status
pm2 status

# View logs
pm2 logs tzbot

# View detailed info
pm2 describe tzbot

# View monitoring
pm2 monit
```

## Troubleshooting

### Alert Script Not Working

```bash
# Check if script exists
ls -la /usr/local/bin/tzbot-webhook-alert.sh

# Check if executable
chmod +x /usr/local/bin/tzbot-webhook-alert.sh

# Check .env file
cat /var/www/tzbot/shared/.env | grep DISCORD_WEBHOOK_URL

# Test manually
/usr/local/bin/tzbot-webhook-alert.sh tzbot test 10
```

### Discord Webhook Not Receiving

```bash
# Test webhook directly
curl -H "Content-Type: application/json" -X POST \
  -d '{"content":"Test from VPS"}' \
  "YOUR_DISCORD_WEBHOOK_URL"

# Check if DISCORD_WEBHOOK_URL is set
source /var/www/tzbot/shared/.env
echo $DISCORD_WEBHOOK_URL
```

### PM2 Not Found

```bash
# Install PM2 globally
npm install -g pm2

# Or use npx
npx pm2 status
```

### Logs Not Available

```bash
# Check log directory
ls -la /var/www/tzbot/current/logs/

# Check log file permissions
chmod 644 /var/www/tzbot/current/logs/error.log

# Check if logs are being written
tail -f /var/www/tzbot/current/logs/error.log
```

## Best Practices

1. **Test Alerts Regularly**: Run test alerts monthly to ensure monitoring works
2. **Monitor Restart Counts**: High restart counts indicate underlying issues
3. **Review Logs**: Check error logs when alerts are received
4. **Keep Script Updated**: The script is auto-updated during deployments
5. **Set Up Watchdog**: Use cron watchdog for proactive monitoring
6. **Monitor Disk Space**: Ensure logs don't fill up disk
7. **Rotate Logs**: Use PM2 log rotation or logrotate

## Log Rotation

PM2 has built-in log rotation:

```bash
# Install PM2 log rotation module
pm2 install pm2-logrotate

# Configure rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

## Maintenance

The monitoring script requires no maintenance. It is automatically updated during each deployment. However, you should:

1. **Review Alerts**: Check Discord alerts regularly
2. **Monitor Trends**: Track restart counts over time
3. **Update Thresholds**: Adjust alert thresholds if needed
4. **Test Periodically**: Run test alerts monthly

## Support

If you encounter issues:

1. Check the deployment logs in GitHub Actions
2. Review VPS logs: `/var/www/tzbot/current/logs/`
3. Check PM2 status: `pm2 status`
4. Test alert script manually
5. Verify .env configuration

## Summary

The VPS runtime monitoring system is:
- ✅ Automatically installed during deployment
- ✅ Configured via shared .env file
- ✅ Sends Discord alerts for crashes and issues
- ✅ Includes service status, logs, and version info
- ✅ No secrets printed to stdout
- ✅ Easy to test and troubleshoot

No manual setup required - just deploy and monitor!
