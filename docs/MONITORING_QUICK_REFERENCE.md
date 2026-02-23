# VPS Monitoring Quick Reference

Quick commands and troubleshooting for the VPS runtime monitoring system.

## Quick Commands

### Check Monitoring Status

```bash
# View cron job
crontab -l | grep vps-monitor

# View recent monitoring logs
tail -f /var/log/tzbot-monitor.log

# Check PM2 process
pm2 describe tzbot

# View PM2 logs
pm2 logs tzbot --lines 50
```

### Test Monitoring

```bash
# Run monitoring script manually
bash /var/www/tzbot/deployment/scripts/vps-monitor.sh

# Test Discord webhook
curl -H "Content-Type: application/json" -X POST \
  -d '{"content":"Test alert from VPS"}' \
  "$(grep DISCORD_WEBHOOK_URL /var/www/tzbot/shared/.env | cut -d'=' -f2)"
```

### Setup/Reinstall

```bash
# Run setup script
cd /var/www/tzbot
bash deployment/scripts/setup-vps-monitoring.sh

# Verify installation
crontab -l
tail /var/log/tzbot-monitor.log
```

## Alert Types

| Alert | Trigger | Action |
|-------|---------|--------|
| 🔴 Process Crash | Bot stopped | PM2 auto-restarts, check logs |
| ⚠️ High Restarts | 3+ in 5 min | Check error logs, may need fix |
| ⚠️ High Memory | >1GB RAM | Monitor, may need optimization |

## Troubleshooting

### No Alerts

```bash
# 1. Check webhook URL
grep DISCORD_WEBHOOK_URL /var/www/tzbot/shared/.env

# 2. Check cron is running
sudo systemctl status cron

# 3. Check monitoring logs
tail -n 50 /var/log/tzbot-monitor.log

# 4. Test webhook manually
curl -X POST -H "Content-Type: application/json" \
  -d '{"content":"test"}' YOUR_WEBHOOK_URL
```

### Too Many Alerts

```bash
# Check alert throttling state
ls -la /var/www/tzbot/data/state/

# Clear throttle state (forces new alerts)
rm -f /var/www/tzbot/data/state/*_alert_sent

# Increase throttle time (edit script)
nano /var/www/tzbot/deployment/scripts/vps-monitor.sh
```

### Disable Monitoring

```bash
# Remove cron job
crontab -e
# Delete or comment out the vps-monitor line
```

### Re-enable Monitoring

```bash
# Run setup script
bash /var/www/tzbot/deployment/scripts/setup-vps-monitoring.sh
```

## File Locations

| File | Location |
|------|----------|
| Monitoring Script | `/var/www/tzbot/deployment/scripts/vps-monitor.sh` |
| Setup Script | `/var/www/tzbot/deployment/scripts/setup-vps-monitoring.sh` |
| Environment File | `/var/www/tzbot/shared/.env` |
| Monitor Logs | `/var/log/tzbot-monitor.log` |
| State Directory | `/var/www/tzbot/data/state/` |
| PM2 Config | `/var/www/tzbot/current/ecosystem.config.cjs` |

## Configuration

### Webhook URL

```bash
# View current webhook (masked)
grep DISCORD_WEBHOOK_URL /var/www/tzbot/shared/.env | sed 's/\(.\{20\}\).*/\1.../'

# Update webhook URL
nano /var/www/tzbot/shared/.env
# Add: DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### Monitoring Thresholds

Edit `/var/www/tzbot/deployment/scripts/vps-monitor.sh`:

```bash
RESTART_THRESHOLD=3        # Restarts before alert
RESTART_WINDOW=300         # Time window (seconds)
MEMORY_THRESHOLD=1024      # Memory limit (MB)
```

## Common Issues

### "DISCORD_WEBHOOK_URL not found"

```bash
# Add to .env file
echo 'DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK' >> /var/www/tzbot/shared/.env
```

### "PM2 process not found"

```bash
# Start bot with PM2
cd /var/www/tzbot/current
pm2 start ecosystem.config.cjs
pm2 save
```

### "Permission denied"

```bash
# Fix script permissions
chmod +x /var/www/tzbot/deployment/scripts/vps-monitor.sh

# Fix log file permissions
sudo chmod 666 /var/log/tzbot-monitor.log
```

## Monitoring Logs

```bash
# Real-time monitoring
tail -f /var/log/tzbot-monitor.log

# Last 100 lines
tail -n 100 /var/log/tzbot-monitor.log

# Search for errors
grep -i error /var/log/tzbot-monitor.log

# Search for alerts sent
grep "Discord alert" /var/log/tzbot-monitor.log

# View specific date
grep "2026-02-23" /var/log/tzbot-monitor.log
```

## PM2 Commands

```bash
# View process status
pm2 status

# View detailed info
pm2 describe tzbot

# View logs
pm2 logs tzbot

# View monitoring dashboard
pm2 monit

# Restart process
pm2 restart tzbot

# Stop process
pm2 stop tzbot

# Start process
pm2 start ecosystem.config.cjs
```

## Emergency Procedures

### Bot Keeps Crashing

```bash
# 1. Check error logs
pm2 logs tzbot --err --lines 100

# 2. Check system resources
free -h
df -h

# 3. Try manual restart
pm2 restart tzbot

# 4. If still failing, rollback
cd /var/www/tzbot
ls -lt releases/
ln -sfn releases/v<previous-version> current
pm2 restart tzbot
```

### Monitoring Not Working

```bash
# 1. Reinstall monitoring
bash /var/www/tzbot/deployment/scripts/setup-vps-monitoring.sh

# 2. Check cron service
sudo systemctl status cron
sudo systemctl restart cron

# 3. Test manually
bash /var/www/tzbot/deployment/scripts/vps-monitor.sh
```

## Related Documentation

- [VPS Monitoring Guide](./VPS_MONITORING.md) - Full documentation
- [Deployment Guide](./DEPLOYMENT.md) - Deployment procedures
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - General troubleshooting
