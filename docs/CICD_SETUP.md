# CI/CD Auto-Deployment System Setup Guide

This guide walks you through setting up the complete CI/CD auto-deployment system for TZBOT.

## Table of Contents

1. [Overview](#overview)
2. [VPS Setup](#vps-setup)
3. [GitHub Repository Setup](#github-repository-setup)
4. [Dynamic DNS Configuration](#dynamic-dns-configuration)
5. [Testing the Workflow](#testing-the-workflow)
6. [Troubleshooting](#troubleshooting)

## Overview

The CI/CD system consists of three main workflows:

- **CI Pipeline** (`ci.yml`): Runs tests on every push to `development` branch
- **Branch Promoter** (`promote.yml`): Auto-merges `development` to `release` on CI success
- **CD Release** (`cd-release.yml`): Deploys to VPS when `release` is updated

## VPS Setup

### 1. SSH Key Generation

On your local machine or GitHub Actions runner:

```bash
# Generate SSH key pair
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/tzbot_deploy_key

# Copy public key to VPS
ssh-copy-id -i ~/.ssh/tzbot_deploy_key.pub user@your-vps-ip
```

### 2. Directory Structure

On your VPS, create the deployment directory structure:

```bash
# Create base directories
sudo mkdir -p /var/www/tzbot/{releases,logs,shared}
sudo chown -R $USER:$USER /var/www/tzbot

# Clone deployment scripts
cd /var/www/tzbot
git clone https://github.com/parikshitgorain/tzbot.git temp
cp -r temp/deployment .
rm -rf temp

# Make scripts executable
chmod +x deployment/scripts/*.sh
```

### 3. PM2 Setup

Install and configure PM2 for process management:

```bash
# Install PM2 globally
npm install -g pm2

# Create ecosystem file
cat > /var/www/tzbot/ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'tzbot',
    script: './dist/index.js',
    cwd: '/var/www/tzbot/current',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
EOF

# Setup PM2 to start on boot
pm2 startup
pm2 save
```

### 4. Environment Variables

Create environment file on VPS:

```bash
# Copy .env.example to .env in shared directory
cp /var/www/tzbot/current/.env.example /var/www/tzbot/shared/.env

# Edit with your production values
nano /var/www/tzbot/shared/.env
```

Link the shared .env file to each deployment:

```bash
# This will be done automatically by deployment script
ln -s /var/www/tzbot/shared/.env /var/www/tzbot/current/.env
```

### 5. Firewall Configuration

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS if needed
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

### 6. Install Required Tools

```bash
# Install jq for JSON processing
sudo apt-get update
sudo apt-get install -y jq

# Install dig for DNS resolution
sudo apt-get install -y dnsutils

# Verify installations
jq --version
dig -v
pm2 --version
```

## GitHub Repository Setup

### 1. Required Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

Add the following secrets:

| Secret Name | Description | Example |
|------------|-------------|---------|
| `VPS_HOSTNAME` | Dynamic DNS hostname or static IP | `mybot.ddns.net` |
| `VPS_USER` | SSH username on VPS | `ubuntu` or `root` |
| `VPS_SSH_KEY` | Private SSH key content | Contents of `~/.ssh/tzbot_deploy_key` |
| `DISCORD_WEBHOOK_URL` | Discord webhook for notifications | `https://discord.com/api/webhooks/...` |

To get the SSH private key content:

```bash
cat ~/.ssh/tzbot_deploy_key
```

Copy the entire output including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`.

### 2. Branch Protection Rules

Configure branch protection for `development` and `release`:

1. Go to Settings → Branches → Add branch protection rule
2. For `development` branch:
   - Require pull request reviews before merging
   - Require status checks to pass (CI tests)
   - Require branches to be up to date
3. For `release` branch:
   - Require pull request reviews before merging
   - Do not allow force pushes
   - Do not allow deletions

### 3. Workflow Permissions

1. Go to Settings → Actions → General
2. Under "Workflow permissions":
   - Select "Read and write permissions"
   - Check "Allow GitHub Actions to create and approve pull requests"

## Dynamic DNS Configuration

### Option 1: Using No-IP

1. Sign up at [No-IP](https://www.noip.com/)
2. Create a hostname (e.g., `mybot.ddns.net`)
3. Install No-IP DUC on your VPS:

```bash
cd /usr/local/src
wget https://www.noip.com/client/linux/noip-duc-linux.tar.gz
tar xzf noip-duc-linux.tar.gz
cd noip-2.1.9-1
make
sudo make install

# Configure with your No-IP credentials
sudo /usr/local/bin/noip2 -C

# Start the service
sudo /usr/local/bin/noip2
```

### Option 2: Using DuckDNS

1. Sign up at [DuckDNS](https://www.duckdns.org/)
2. Create a subdomain (e.g., `mybot.duckdns.org`)
3. Create update script on VPS:

```bash
mkdir -p ~/duckdns
cd ~/duckdns
nano duck.sh
```

Add this content:

```bash
#!/bin/bash
echo url="https://www.duckdns.org/update?domains=mybot&token=YOUR_TOKEN&ip=" | curl -k -o ~/duckdns/duck.log -K -
```

Make it executable and add to cron:

```bash
chmod +x duck.sh
crontab -e
# Add this line:
*/5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1
```

### Option 3: Static IP

If you have a static IP, simply use the IP address directly in the `VPS_HOSTNAME` secret.

## Testing the Workflow

### 1. Test CI Pipeline

```bash
# Make a change and push to development
git checkout development
echo "# Test" >> README.md
git add README.md
git commit -m "test: CI pipeline"
git push origin development
```

Check GitHub Actions tab to see if CI runs successfully.

### 2. Test Branch Promotion

If CI passes, the promotion workflow should automatically:
- Merge `development` into `release`
- Trigger the deployment workflow

### 3. Test Deployment

Monitor the deployment in GitHub Actions:
- Check DNS resolution step
- Verify SSH connection
- Watch deployment progress
- Confirm health checks pass
- Check Discord for notifications

### 4. Test Rollback

To test rollback manually:

```bash
# SSH into VPS
ssh user@your-vps-ip

# Trigger rollback to previous version
cd /var/www/tzbot
bash deployment/scripts/rollback.sh previous
```

## Troubleshooting

### DNS Resolution Fails

**Symptoms**: Workflow fails at "Resolve VPS IP address" step

**Solutions**:
1. Verify Dynamic DNS service is running on VPS
2. Check hostname is correctly configured
3. Test DNS resolution locally:
   ```bash
   dig +short your-hostname.ddns.net
   ```
4. Ensure VPS has internet connectivity

### SSH Connection Fails

**Symptoms**: Workflow fails at SSH steps with "Permission denied" or "Connection refused"

**Solutions**:
1. Verify SSH key is correctly added to GitHub Secrets
2. Check public key is in VPS `~/.ssh/authorized_keys`
3. Verify SSH service is running on VPS:
   ```bash
   sudo systemctl status sshd
   ```
4. Check firewall allows SSH:
   ```bash
   sudo ufw status
   ```
5. Test SSH connection manually:
   ```bash
   ssh -i ~/.ssh/tzbot_deploy_key user@vps-ip
   ```

### Deployment Script Fails

**Symptoms**: Deployment starts but fails during build or install

**Solutions**:
1. Check VPS has enough disk space:
   ```bash
   df -h
   ```
2. Verify Node.js and npm are installed:
   ```bash
   node --version
   npm --version
   ```
3. Check deployment logs on VPS:
   ```bash
   ls -la /var/www/tzbot/logs/
   ```
4. Manually run deployment script:
   ```bash
   cd /var/www/tzbot
   bash deployment/scripts/deploy.sh <commit-hash> $(date +%Y%m%d_%H%M%S)
   ```

### Health Checks Fail

**Symptoms**: Deployment completes but health checks fail, triggering rollback

**Solutions**:
1. Check PM2 process status:
   ```bash
   pm2 list
   pm2 logs tzbot
   ```
2. Verify environment variables are set:
   ```bash
   cat /var/www/tzbot/shared/.env
   ```
3. Check Discord bot token is valid
4. Manually run health check:
   ```bash
   bash /var/www/tzbot/deployment/scripts/health-check.sh
   ```

### Notifications Not Received

**Symptoms**: Deployment works but no Discord notifications

**Solutions**:
1. Verify `DISCORD_WEBHOOK_URL` secret is set correctly
2. Test webhook manually:
   ```bash
   curl -X POST -H "Content-Type: application/json" \
     -d '{"content":"Test notification"}' \
     YOUR_WEBHOOK_URL
   ```
3. Check webhook URL hasn't expired
4. Notifications are non-blocking, so deployment continues even if they fail

### Rollback Fails

**Symptoms**: Deployment fails and rollback also fails

**Critical Actions**:
1. SSH into VPS immediately
2. Check available releases:
   ```bash
   ls -la /var/www/tzbot/releases/
   ```
3. Manually rollback to last known good version:
   ```bash
   cd /var/www/tzbot
   ln -sfn releases/GOOD_RELEASE_DIR current
   pm2 restart tzbot
   ```
4. Verify application is running:
   ```bash
   pm2 list
   pm2 logs tzbot --lines 50
   ```

### Viewing Deployment History

```bash
# SSH into VPS
ssh user@your-vps-ip

# View deployment history
cat /var/www/tzbot/deployment-history.json | jq '.'

# View current deployment
bash /var/www/tzbot/deployment/scripts/deployment-state.sh get-current
```

### Emergency Recovery

If everything fails and the bot is down:

```bash
# SSH into VPS
ssh user@your-vps-ip

# Stop current process
pm2 stop tzbot

# Clone fresh copy
cd /var/www/tzbot/releases
git clone -b release https://github.com/parikshitgorain/tzbot.git emergency_$(date +%Y%m%d_%H%M%S)
cd emergency_*

# Install and build
npm ci
npm run build

# Update symlink
ln -sfn $(pwd) /var/www/tzbot/current

# Start application
pm2 start tzbot
pm2 save
```

## Monitoring and Maintenance

### Regular Checks

1. **Disk Space**: Monitor `/var/www/tzbot/releases` directory
   ```bash
   du -sh /var/www/tzbot/releases/*
   ```

2. **Old Releases**: Deployment system keeps last 10 releases, but you can manually clean:
   ```bash
   cd /var/www/tzbot/releases
   ls -t | tail -n +11 | xargs rm -rf
   ```

3. **Logs**: Check deployment logs periodically
   ```bash
   ls -lh /var/www/tzbot/logs/
   ```

4. **PM2 Status**: Ensure bot is running
   ```bash
   pm2 status
   ```

### Updating Deployment Scripts

If you need to update deployment scripts:

```bash
# SSH into VPS
ssh user@your-vps-ip

# Pull latest scripts
cd /var/www/tzbot
git clone https://github.com/parikshitgorain/tzbot.git temp
cp -r temp/deployment/scripts/* deployment/scripts/
rm -rf temp

# Make executable
chmod +x deployment/scripts/*.sh
```

## Security Best Practices

1. **SSH Keys**: Never commit private keys to repository
2. **Secrets**: Rotate secrets periodically
3. **Firewall**: Keep firewall enabled and configured
4. **Updates**: Keep VPS system packages updated:
   ```bash
   sudo apt-get update && sudo apt-get upgrade
   ```
5. **Monitoring**: Set up monitoring for unauthorized access attempts
6. **Backups**: Regularly backup your database and configuration

## Support

For issues or questions:
1. Check GitHub Actions logs
2. Review VPS logs in `/var/www/tzbot/logs/`
3. Check PM2 logs: `pm2 logs tzbot`
4. Review this troubleshooting guide
5. Open an issue on GitHub repository
