# Deployment Scripts

This directory contains utility scripts for VPS setup, monitoring, and manual operations.

## Active Scripts

### vps-monitor.sh

**Purpose:** Runtime monitoring script that sends Discord alerts on critical production issues.

**Features:**
- Monitors PM2 process status (crash detection)
- Tracks restart frequency (alerts on 3+ restarts in 5 minutes)
- Monitors memory usage (alerts above 1GB)
- Extracts error logs (last 20-50 lines)
- Sends Discord webhook alerts with rich embeds
- Alert throttling to prevent spam

**Usage:**
```bash
# Run manually (for testing)
./vps-monitor.sh

# Installed automatically via cron during deployment
# Runs every minute: */1 * * * * /var/www/tzbot/deployment/scripts/vps-monitor.sh
```

**Requirements:**
- PM2 installed and running
- `DISCORD_WEBHOOK_URL` configured in `/var/www/tzbot/shared/.env`
- `jq` installed for JSON parsing

**Documentation:** See [VPS Monitoring Guide](../../docs/VPS_MONITORING.md)

---

### setup-vps-monitoring.sh

**Purpose:** Automated setup script for VPS runtime monitoring system.

**Features:**
- Validates environment and webhook configuration
- Makes monitoring script executable
- Creates state directory for tracking
- Installs cron job (runs every minute)
- Creates log file with proper permissions
- Tests monitoring script

**Usage:**
```bash
# Run on VPS (automatically called by CD workflow)
./setup-vps-monitoring.sh

# Or run manually after deployment
ssh user@vps
cd /var/www/tzbot
bash deployment/scripts/setup-vps-monitoring.sh
```

**What it does:**
1. Checks environment and webhook URL
2. Sets up monitoring script permissions
3. Creates state directory
4. Installs cron job
5. Creates log file
6. Tests monitoring

**Documentation:** See [VPS Monitoring Guide](../../docs/VPS_MONITORING.md)

---

### setup-webhook.sh

**Purpose:** Interactive setup script for configuring Discord webhooks on VPS.

**Features:**
- Interactive prompts for webhook URL
- Validates webhook connectivity
- Configures environment variables
- Tests webhook with sample message

**Usage:**
```bash
# Run interactively on VPS
ssh user@vps
cd /var/www/tzbot
sudo bash deployment/scripts/setup-webhook.sh

# Or provide webhook URL directly
sudo DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..." \
  bash deployment/scripts/setup-webhook.sh
```

**Use Cases:**
- Initial VPS setup
- Updating webhook URL
- Troubleshooting webhook configuration

**Documentation:** See [Discord Webhook Setup](../../docs/DISCORD_WEBHOOK_SETUP.md)

---

### test-webhook.sh

**Purpose:** Test Discord webhook connectivity and message formatting.

**Features:**
- Sends test message to Discord webhook
- Validates webhook URL format
- Tests embed formatting
- Provides immediate feedback

**Usage:**
```bash
# Test with webhook URL
./test-webhook.sh "https://discord.com/api/webhooks/..."

# Or use environment variable
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
./test-webhook.sh
```

**Example Output:**
```
Testing Discord webhook...
✅ Webhook test successful!
Check your Discord channel for the test message.
```

**Use Cases:**
- Verify webhook URL is correct
- Test webhook after configuration changes
- Troubleshoot notification issues

---

### vps-setup.sh

**Purpose:** Initial VPS setup and configuration script.

**Features:**
- Installs required system packages
- Configures Node.js and PM2
- Sets up PostgreSQL
- Configures firewall rules
- Creates deployment directories
- Sets up systemd services

**Usage:**
```bash
# Run on fresh VPS
ssh user@vps
cd /var/www/tzbot
sudo bash deployment/scripts/vps-setup.sh
```

**What it installs:**
- Node.js 20.x
- PM2 (process manager)
- PostgreSQL 15+
- Git
- Build tools (gcc, make, etc.)
- Firewall configuration

**Use Cases:**
- Initial VPS setup
- Rebuilding VPS from scratch
- Setting up development/staging environment

**Documentation:** See [Deployment Guide](../../docs/DEPLOYMENT.md)

---

## Script Organization

### Active Monitoring (Automated)
- `vps-monitor.sh` - Runtime monitoring (runs via cron)
- `setup-vps-monitoring.sh` - Monitoring installation (runs via CD workflow)

### Manual Utilities
- `setup-webhook.sh` - Webhook configuration
- `test-webhook.sh` - Webhook testing
- `vps-setup.sh` - Initial VPS setup

## CI/CD Integration

The CI/CD workflow (`.github/workflows/cd-production.yml`) handles all deployment logic inline. These scripts are for:

1. **Automated monitoring** - Installed automatically during deployment
2. **Manual operations** - VPS setup, webhook configuration, testing

## Removed Scripts

The following scripts were removed as their functionality is now implemented inline in the GitHub Actions workflow:

- `deploy.sh` - Deployment logic is inline in workflow
- `rollback.sh` - Rollback logic is inline in workflow
- `health-check.sh` - Health checks are inline in workflow
- `service-manager.sh` - PM2 commands are inline in workflow
- `resolve-dns.sh` - DNS resolution is inline in workflow
- `retry-wrapper.sh` - Retry logic is inline in workflow
- `deployment-state.sh` - State tracking not needed
- `check-ssh-key.sh` - SSH validation is inline in workflow
- `validate-ssh-key.sh` - SSH validation is inline in workflow
- `ssh-connect.sh` - SSH commands are inline in workflow
- `secure-transfer.sh` - Using git clone instead
- `generate-deploy-key.sh` - One-time manual setup
- `notify.sh` - Discord notifications are inline in workflow
- `monitor-bot.sh` - Replaced by `vps-monitor.sh`
- `setup-monitoring.sh` - Replaced by `setup-vps-monitoring.sh`

## File Locations

| File | Location |
|------|----------|
| Monitoring Script | `/var/www/tzbot/deployment/scripts/vps-monitor.sh` |
| Setup Script | `/var/www/tzbot/deployment/scripts/setup-vps-monitoring.sh` |
| Environment File | `/var/www/tzbot/shared/.env` |
| Monitor Logs | `/var/log/tzbot-monitor.log` |
| State Directory | `/var/www/tzbot/data/state/` |
| PM2 Config | `/var/www/tzbot/current/ecosystem.config.cjs` |

## Related Documentation

- [VPS Monitoring Guide](../../docs/VPS_MONITORING.md) - Complete monitoring documentation
- [Monitoring Quick Reference](../../docs/MONITORING_QUICK_REFERENCE.md) - Quick commands
- [CI/CD Production Guide](../../docs/CICD_PRODUCTION_GUIDE.md) - Deployment pipeline
- [Deployment Guide](../../docs/DEPLOYMENT.md) - VPS setup and configuration
- [Discord Webhook Setup](../../docs/DISCORD_WEBHOOK_SETUP.md) - Webhook configuration
- [Troubleshooting Guide](../../docs/TROUBLESHOOTING.md) - Common issues

## Support

For issues or questions:
1. Check the [Troubleshooting Guide](../../docs/TROUBLESHOOTING.md)
2. Review [VPS Monitoring Guide](../../docs/VPS_MONITORING.md)
3. Check monitoring logs: `tail -f /var/log/tzbot-monitor.log`
4. Check PM2 logs: `pm2 logs tzbot`
