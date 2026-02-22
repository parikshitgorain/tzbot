# GitHub Secrets Setup Guide

This guide explains how to configure the required GitHub secrets for the CI/CD deployment system.

## Required Secrets

The following secrets must be configured in your GitHub repository for the deployment workflows to function:

### 1. VPS_HOSTNAME
**Description:** The hostname or dynamic DNS address of your VPS server.

**Example values:**
- `myserver.duckdns.org` (if using DuckDNS)
- `myapp.ddns.net` (if using No-IP)
- `123.45.67.89` (direct IP address, not recommended for dynamic IPs)

**How to get it:**
- If using dynamic DNS, this is your configured hostname
- If using static IP, this is your server's IP address

### 2. VPS_SSH_KEY
**Description:** The private SSH key used to authenticate with your VPS.

**How to generate:**
```bash
# On your local machine or GitHub Actions runner
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/deploy_key -N ""

# This creates two files:
# - deploy_key (private key - add this to GitHub secrets)
# - deploy_key.pub (public key - add this to VPS ~/.ssh/authorized_keys)
```

**How to add to VPS:**
```bash
# Copy the public key content
cat ~/.ssh/deploy_key.pub

# SSH into your VPS and add it to authorized_keys
ssh your-user@your-vps
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "paste-public-key-here" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

**How to add to GitHub:**
- Copy the entire content of the private key file (including `-----BEGIN` and `-----END` lines)
- Paste it as the secret value

### 3. VPS_USER
**Description:** The username to use when connecting to the VPS via SSH.

**Example values:**
- `root`
- `ubuntu`
- `deploy`
- Your custom username

**How to determine:**
- This is the user you normally use to SSH into your server
- Must have permissions to:
  - Write to `/var/www/tzbot` directory
  - Restart PM2 or systemd services
  - Execute deployment scripts

### 4. DISCORD_WEBHOOK_URL
**Description:** Discord webhook URL for sending deployment notifications.

**How to create:**
1. Open Discord and go to your server
2. Go to Server Settings → Integrations → Webhooks
3. Click "New Webhook"
4. Configure the webhook:
   - Name: "Deployment Notifications"
   - Channel: Select the channel for notifications
5. Click "Copy Webhook URL"
6. Paste this URL as the secret value

**Optional:** If you don't want Discord notifications, you can skip this secret. The workflow will continue without it (notifications are set to `continue-on-error: true`).

## How to Add Secrets to GitHub

1. Go to your GitHub repository
2. Click on **Settings** (top menu)
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Enter the secret name (exactly as shown above)
6. Paste the secret value
7. Click **Add secret**
8. Repeat for all required secrets

## Verification

After adding all secrets, you can verify they're configured correctly:

1. Go to Settings → Secrets and variables → Actions
2. You should see all four secrets listed:
   - VPS_HOSTNAME
   - VPS_SSH_KEY
   - VPS_USER
   - DISCORD_WEBHOOK_URL

## Security Best Practices

- **Never commit secrets to your repository**
- **Rotate SSH keys periodically** (every 90 days recommended)
- **Use dedicated deployment keys** (don't reuse personal SSH keys)
- **Limit VPS user permissions** (use a dedicated deploy user if possible)
- **Monitor webhook usage** (Discord webhooks can be rate-limited)

## Troubleshooting

### "Hostname is required" error
- Check that VPS_HOSTNAME secret is set and not empty
- Verify the secret name is exactly `VPS_HOSTNAME` (case-sensitive)

### SSH connection failures
- Verify VPS_SSH_KEY contains the complete private key
- Ensure the corresponding public key is in VPS `~/.ssh/authorized_keys`
- Check VPS_USER has correct permissions
- Verify VPS firewall allows SSH connections (port 22)

### Discord notifications not working
- Verify DISCORD_WEBHOOK_URL is correct
- Check the webhook hasn't been deleted in Discord
- Ensure the bot has permissions to post in the channel
- Note: Notification failures won't stop deployments

## Next Steps

After configuring secrets:
1. Push a commit to the Development branch
2. CI workflow will run tests
3. On success, promotion workflow will merge to release branch
4. CD workflow will deploy to your VPS
5. Check Discord for deployment notifications

For more information, see:
- [CI/CD Setup Guide](./CICD_SETUP.md)
- [Deployment Troubleshooting](./TROUBLESHOOTING.md)
