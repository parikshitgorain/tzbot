# Deployment Scripts and Configuration

This directory contains deployment scripts, configuration files, and documentation for the CI/CD auto-deployment system.

## Overview

The deployment system provides automated deployment to a VPS with:
- **DNS Resolution**: Dynamic DNS support with retry logic
- **SSH Deployment**: Secure deployment via SSH
- **Health Checks**: Automatic verification after deployment
- **Rollback**: Automatic rollback on failure
- **Notifications**: Discord webhook notifications
- **State Tracking**: Deployment history and state management

## Directory Structure

```
deployment/
├── scripts/              # Deployment automation scripts
│   ├── deploy.sh        # Main deployment script
│   ├── rollback.sh      # Rollback to previous version
│   ├── health-check.sh  # Health check verification
│   ├── resolve-dns.sh   # Dynamic DNS resolution
│   ├── ssh-connect.sh   # SSH connection utility
│   ├── service-manager.sh # Service management (PM2/systemd)
│   ├── secure-transfer.sh # Secure file transfer
│   ├── deployment-state.sh # Deployment state tracking
│   ├── notify.sh        # Discord notifications
│   └── README.md        # Script documentation
├── vps-config.json      # VPS configuration
├── vps-config.example.json # Configuration template
├── README.md            # This file
└── SETUP_CHECKLIST.md   # Setup checklist
```

## Configuration Files

### vps-config.json

Main configuration file for VPS settings. Copy from `vps-config.example.json` and customize:

```json
{
  "dynamicDnsHostname": "your-bot.ddns.net",
  "sshUser": "deploy",
  "sshPort": 22,
  "deploymentPath": "/var/www/tzbot",
  "serviceName": "tzbot",
  "serviceType": "pm2",
  "healthCheckEndpoint": "http://localhost:3000/health",
  "healthCheckTimeout": 60,
  "maxReleases": 10
}
```

**Configuration Options:**
- `dynamicDnsHostname`: Your Dynamic DNS hostname (e.g., from DuckDNS, No-IP)
- `sshUser`: SSH username for deployment
- `sshPort`: SSH port (default: 22)
- `deploymentPath`: Base path on VPS where the application is deployed
- `serviceName`: PM2 app name or systemd service name
- `serviceType`: Service manager type (`pm2` or `systemd`)
- `healthCheckEndpoint`: HTTP endpoint for health checks
- `healthCheckTimeout`: Timeout for health checks in seconds
- `maxReleases`: Maximum number of releases to keep (default: 10)

## Deployment Scripts

### deploy.sh
Main deployment script that:
- Creates timestamped release directory
- Clones code from release branch
- Installs dependencies with `npm ci`
- Builds TypeScript with `npm run build`
- Updates symlink atomically
- Provides zero-downtime deployments

**Usage:**
```bash
./scripts/deploy.sh <commit-hash> <release-id>
```

### rollback.sh
Rollback script that:
- Rolls back to previous or specific release
- Restarts service
- Runs health checks
- Handles critical failures

**Usage:**
```bash
# Rollback to previous release
./scripts/rollback.sh previous

# Rollback to specific commit
./scripts/rollback.sh <commit-hash>
```

### health-check.sh
Health check script that:
- Verifies process is running
- Checks Discord connection
- Validates HTTP endpoint (if configured)
- Retries with timeout

**Usage:**
```bash
./scripts/health-check.sh
```

### resolve-dns.sh
DNS resolution utility that:
- Resolves Dynamic DNS hostname to IP
- Implements exponential backoff retry
- Supports both `dig` and `nslookup`
- Logs all resolution attempts

**Usage:**
```bash
./scripts/resolve-dns.sh <hostname>
```

**Features:**
- 5 retry attempts with exponential backoff (1s, 2s, 4s, 8s, 16s)
- Automatic fallback from `dig` to `nslookup`
- Detailed logging
- Returns only IP address on success

### service-manager.sh
Service management script that:
- Manages PM2 or systemd services
- Starts, stops, restarts services
- Checks service status
- Handles startup delays

**Usage:**
```bash
./scripts/service-manager.sh start|stop|restart|status
```

### deployment-state.sh
Deployment state tracking that:
- Records deployment history
- Tracks last 10 deployments
- Stores metadata (commit, timestamp, user, status)
- Provides query interface

**Usage:**
```bash
# Record deployment
./scripts/deployment-state.sh record <commit> <status> <message>

# Get current deployment
./scripts/deployment-state.sh get-current

# Get deployment history
./scripts/deployment-state.sh get-history
```

### notify.sh
Discord notification script that:
- Sends deployment status to Discord webhook
- Color-coded embeds (blue=start, green=success, red=failure, yellow=rollback)
- Retry logic (3 attempts)
- Non-blocking (deployment continues if notifications fail)

**Usage:**
```bash
./scripts/notify.sh start|success|failure|rollback <message>
```

## GitHub Secrets Required

Configure these secrets in your GitHub repository (Settings → Secrets and variables → Actions):

| Secret Name | Description | Example |
|------------|-------------|---------|
| `VPS_HOSTNAME` | Dynamic DNS hostname or static IP | `mybot.ddns.net` |
| `VPS_USER` | SSH username on VPS | `ubuntu` or `deploy` |
| `VPS_SSH_KEY` | Private SSH key content | Contents of `~/.ssh/deploy_key` |
| `DISCORD_WEBHOOK_URL` | Discord webhook for notifications | `https://discord.com/api/webhooks/...` |

## VPS Setup

### Prerequisites
- Ubuntu 20.04+ or similar Linux distribution
- Node.js 18+
- PM2 or systemd
- SSH access
- Dynamic DNS service (optional)

### Quick Setup
```bash
# 1. Create deployment directory
sudo mkdir -p /var/www/tzbot/{releases,logs,shared}
sudo chown -R $USER:$USER /var/www/tzbot

# 2. Clone deployment scripts
cd /var/www/tzbot
git clone https://github.com/your-repo/tzbot.git temp
cp -r temp/deployment .
rm -rf temp

# 3. Make scripts executable
chmod +x deployment/scripts/*.sh

# 4. Install PM2
npm install -g pm2
pm2 startup
```

For detailed setup instructions, see [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md).

## Deployment Workflow

### Automatic Deployment
```
1. Push to development branch
   ↓
2. CI pipeline runs (tests, build, lint)
   ↓
3. Auto-merge to release (on CI success)
   ↓
4. CD pipeline triggered
   ↓
5. Resolve VPS IP (DNS)
   ↓
6. SSH to VPS
   ↓
7. Run deployment script
   ↓
8. Restart service
   ↓
9. Health checks
   ↓
10. Success or Rollback
```

### Manual Deployment
```bash
# SSH into VPS
ssh user@your-vps-ip

# Run deployment script
cd /var/www/tzbot
bash deployment/scripts/deploy.sh <commit-hash> $(date +%Y%m%d_%H%M%S)
```

## Monitoring

### Check Deployment Status
```bash
# View current deployment
bash deployment/scripts/deployment-state.sh get-current

# View deployment history
bash deployment/scripts/deployment-state.sh get-history

# Check service status
pm2 status
# or
systemctl status tzbot
```

### View Logs
```bash
# Deployment logs
ls -la /var/www/tzbot/logs/

# Application logs
pm2 logs tzbot
# or
journalctl -u tzbot -f
```

## Troubleshooting

### DNS Resolution Fails
```bash
# Test DNS resolution manually
bash deployment/scripts/resolve-dns.sh your-hostname.ddns.net

# Check Dynamic DNS service is running
# For DuckDNS: check ~/duckdns/duck.log
# For No-IP: check service status
```

### SSH Connection Fails
```bash
# Test SSH connection
ssh -i ~/.ssh/deploy_key user@vps-ip

# Check SSH key permissions
chmod 600 ~/.ssh/deploy_key

# Verify public key is in authorized_keys on VPS
cat ~/.ssh/authorized_keys
```

### Deployment Fails
```bash
# Check deployment logs
tail -100 /var/www/tzbot/logs/deployment_*.log

# Check service logs
pm2 logs tzbot --lines 100

# Manual rollback
bash deployment/scripts/rollback.sh previous
```

### Health Checks Fail
```bash
# Run health check manually
bash deployment/scripts/health-check.sh

# Check service status
pm2 status

# Check application logs
pm2 logs tzbot
```

## Security Best Practices

1. **SSH Keys**: Use dedicated SSH keys for CI/CD (not personal keys)
2. **Secrets**: Never commit secrets to repository
3. **Firewall**: Configure UFW to allow only necessary ports
4. **Updates**: Keep VPS system packages updated
5. **Monitoring**: Set up monitoring for unauthorized access
6. **Backups**: Regular backups of database and configuration

## Maintenance

### Regular Tasks
- Monitor disk space in `/var/www/tzbot/releases/`
- Review deployment logs periodically
- Rotate secrets every 90 days
- Update VPS system packages monthly
- Backup deployment history

### Cleanup Old Releases
```bash
# Automatic cleanup (keeps last 10)
cd /var/www/tzbot/releases
ls -t | tail -n +11 | xargs rm -rf

# Manual cleanup
rm -rf /var/www/tzbot/releases/old_release_dir
```

## Documentation

- **Setup Guide**: [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md)
- **Script Documentation**: [scripts/README.md](scripts/README.md)
- **CI/CD Guide**: [../docs/CICD_SETUP.md](../docs/CICD_SETUP.md)
- **Deployment Guide**: [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)

## Support

For issues or questions:
1. Check [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md)
2. Review [scripts/README.md](scripts/README.md)
3. Check GitHub Actions logs
4. Review VPS logs in `/var/www/tzbot/logs/`
5. Open an issue on GitHub

---

**Last Updated**: February 22, 2026
**Version**: 1.0.0

