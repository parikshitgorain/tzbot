# Deployment Setup Checklist

This checklist helps you configure the CI/CD auto-deployment system.

## Prerequisites

- [ ] VPS with SSH access
- [ ] Dynamic DNS service configured (DuckDNS, No-IP, etc.)
- [ ] GitHub repository with Actions enabled
- [ ] Discord webhook for notifications

## VPS Configuration

### 1. Create Deployment User

```bash
# Create deployment user
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG sudo deploy

# Switch to deployment user
sudo su - deploy
```

### 2. Set Up SSH Key Authentication

```bash
# On your local machine, generate SSH key pair
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/deploy_key

# Copy public key to VPS
ssh-copy-id -i ~/.ssh/deploy_key.pub deploy@your-vps-ip

# Test SSH connection
ssh -i ~/.ssh/deploy_key deploy@your-vps-ip
```

### 3. Create Deployment Directory Structure

```bash
# On VPS as deploy user
sudo mkdir -p /opt/discord-bot/{releases,shared}
sudo chown -R deploy:deploy /opt/discord-bot
cd /opt/discord-bot

# Create shared directories
mkdir -p shared/logs
```

### 4. Install Node.js and PM2

```bash
# Install Node.js (using nvm recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install --lts

# Install PM2 globally
npm install -g pm2

# Configure PM2 to start on boot
pm2 startup
# Follow the instructions provided by the command
```

### 5. Clone Repository

```bash
cd /opt/discord-bot/releases
git clone https://github.com/your-username/your-repo.git initial
cd initial
npm ci
npm run build

# Create initial symlink
ln -s /opt/discord-bot/releases/initial /opt/discord-bot/current
```

### 6. Configure Environment Variables

```bash
# Copy .env file to shared directory
cp /opt/discord-bot/current/.env.example /opt/discord-bot/shared/.env
nano /opt/discord-bot/shared/.env
# Fill in your environment variables

# Create symlink from current to shared .env
ln -sf /opt/discord-bot/shared/.env /opt/discord-bot/current/.env
```

### 7. Start Application with PM2

```bash
cd /opt/discord-bot/current
pm2 start dist/index.js --name discord-bot
pm2 save
```

## GitHub Repository Configuration

### 1. Configure Repository Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add the following secrets:

- [ ] `SSH_PRIVATE_KEY`: Content of `~/.ssh/deploy_key` (private key)
- [ ] `SSH_USER`: `deploy` (or your deployment username)
- [ ] `DYNAMIC_DNS_HOSTNAME`: Your Dynamic DNS hostname (e.g., `mybot.ddns.net`)
- [ ] `DISCORD_WEBHOOK_URL`: Your Discord webhook URL for notifications

### 2. Update VPS Configuration

Edit `deployment/vps-config.json`:

```json
{
  "dynamicDnsHostname": "your-bot.ddns.net",
  "sshUser": "deploy",
  "sshPort": 22,
  "deploymentPath": "/opt/discord-bot",
  "serviceName": "discord-bot",
  ...
}
```

### 3. Configure Branch Protection (Optional)

- [ ] Enable branch protection for `main` or `release` branch
- [ ] Require pull request reviews
- [ ] Require status checks to pass

## Dynamic DNS Configuration

### Using DuckDNS (Free)

1. Sign up at https://www.duckdns.org/
2. Create a subdomain (e.g., `mybot.duckdns.org`)
3. Install DuckDNS client on VPS:

```bash
# Create update script
mkdir -p ~/duckdns
cd ~/duckdns
nano duck.sh
```

Add to `duck.sh`:
```bash
#!/bin/bash
echo url="https://www.duckdns.org/update?domains=YOUR_DOMAIN&token=YOUR_TOKEN&ip=" | curl -k -o ~/duckdns/duck.log -K -
```

```bash
chmod +x duck.sh

# Add to crontab (update every 5 minutes)
crontab -e
# Add line: */5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1
```

## Testing

### Test SSH Connection from GitHub Actions

Create a test workflow to verify SSH connection:

```yaml
name: Test SSH Connection
on: workflow_dispatch

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Test SSH
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.SSH_PRIVATE_KEY }}" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no ${{ secrets.SSH_USER }}@${{ secrets.DYNAMIC_DNS_HOSTNAME }} "echo 'SSH connection successful'"
```

### Test Deployment Manually

```bash
# On VPS
cd /opt/discord-bot/current
git pull origin main
npm ci
npm run build
pm2 restart discord-bot
pm2 logs discord-bot
```

## Troubleshooting

### SSH Connection Issues

- Verify SSH key permissions: `chmod 600 ~/.ssh/deploy_key`
- Check SSH service: `sudo systemctl status ssh`
- Check firewall: `sudo ufw status`
- Test DNS resolution: `nslookup your-bot.ddns.net`

### PM2 Issues

- Check PM2 status: `pm2 status`
- View logs: `pm2 logs discord-bot`
- Restart app: `pm2 restart discord-bot`
- Reset PM2: `pm2 delete all && pm2 save`

### Build Issues

- Check Node.js version: `node --version`
- Clear node_modules: `rm -rf node_modules && npm ci`
- Check disk space: `df -h`

## Security Recommendations

- [ ] Use non-standard SSH port
- [ ] Configure fail2ban for SSH protection
- [ ] Enable UFW firewall
- [ ] Keep system packages updated
- [ ] Use separate SSH keys for CI/CD (not personal keys)
- [ ] Regularly rotate SSH keys
- [ ] Monitor deployment logs for suspicious activity

## Next Steps

After completing this checklist:

1. Test the CI pipeline by pushing to development branch
2. Verify automatic promotion to release branch
3. Monitor the deployment workflow
4. Test rollback functionality
5. Verify health checks are working
6. Confirm notifications are being sent
