# GitHub Secrets Quick Reference

Quick reference card for setting up GitHub secrets for deployment.

## 🚨 Minimum Required Secrets (Must Have)

These secrets are **required** for the bot to deploy and function:

```bash
# VPS Connection
VPS_SSH_KEY=<your-ssh-private-key>
VPS_HOSTNAME=<your-vps-hostname-or-ip>
VPS_USER=<ssh-username>

# Discord Bot
DISCORD_TOKEN=<bot-token>
DISCORD_CLIENT_ID=<client-id>
DISCORD_GUILD_ID=<server-id>

# Discord Roles
SUBSCRIBER_ROLE_ID=<role-id>
VIP_ROLE_ID=<role-id>
MODERATOR_ROLE_ID=<role-id>

# Discord Channels
NOTIFICATION_CHANNEL_ID=<channel-id>
FALLBACK_CHANNEL_ID=<channel-id>
MOD_LOG_CHANNEL_ID=<channel-id>

# Database
DATABASE_URL=postgresql://user:pass@host:port/db
```

## ⚙️ Recommended Secrets

Highly recommended for production use:

```bash
# Deployment Notifications
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Database Performance
DATABASE_MAX_CONNECTIONS=20

# Logging
LOG_LEVEL=info
LOG_FILE=logs/tzbot.log
```

## 🎯 Optional Feature Secrets

### AI Auto-Reply
```bash
AI_ENABLED=true
AI_PROVIDER=groq
AI_API_KEY=<groq-api-key>
AI_MODEL_NAME=llama-3.1-8b-instant
AI_CHANNELS=<channel-id-1>,<channel-id-2>
```

### AI Web Search
```bash
AI_SEARCH_ENABLED=true
AI_SEARCH_PROVIDER=duckduckgo
```

### Kick.com Integration
```bash
KICK_API_KEY=<api-key>
KICK_CHANNEL_ID=<channel-id>
KICK_WEBHOOK_SECRET=<secret>
KICK_OAUTH_CLIENT_ID=<client-id>
KICK_OAUTH_CLIENT_SECRET=<client-secret>
```

### Redis Caching
```bash
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=<password>
```

### Image Search
```bash
UNSPLASH_ACCESS_KEY=<access-key>
```

### Announcements
```bash
PRIVATE_ANNOUNCEMENT_CHANNEL_ID=<channel-id>
PUBLIC_ANNOUNCEMENT_CHANNEL_IDS=<id1>,<id2>,<id3>
```

## 🔧 Quick Setup Commands

### Using GitHub Web UI
1. Go to: `Settings` → `Secrets and variables` → `Actions`
2. Click: `New repository secret`
3. Add each secret with name and value

### Using GitHub CLI
```bash
# Install: https://cli.github.com/
gh auth login

# Set a single secret
gh secret set SECRET_NAME

# Set from file
gh secret set VPS_SSH_KEY < ~/.ssh/deploy_key

# Bulk set from .env
while IFS='=' read -r key value; do
  [[ $key =~ ^#.*$ ]] && continue
  [[ -z $key ]] && continue
  value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//')
  echo "$value" | gh secret set "$key"
done < .env
```

## ✅ Validation

### Check Secrets Are Set
```bash
# Via GitHub CLI
gh secret list

# Via Web UI
Settings → Secrets and variables → Actions
```

### Validate Before Deploy
```bash
# Export secrets as env vars
export DISCORD_TOKEN="..."
export DATABASE_URL="..."
# ... etc

# Run validation script
bash deployment/scripts/validate-secrets.sh
```

## 📚 Full Documentation

- **Complete List**: [GitHub Secrets Reference](./GITHUB_SECRETS_REFERENCE.md)
- **Setup Guide**: [GitHub Secrets Setup](./GITHUB_SECRETS_SETUP.md)
- **Deployment**: [VPS Deployment Guide](../deployment/AI_VPS_DEPLOYMENT.md)

## 🆘 Common Issues

### "Secret not set or empty"
- Check secret name is exact (case-sensitive)
- Verify secret has a value (not empty)
- Ensure you're in the correct repository

### SSH Connection Fails
- Verify VPS_SSH_KEY includes full private key
- Check public key is in VPS `~/.ssh/authorized_keys`
- Confirm VPS_USER has correct permissions

### Bot Won't Start
- Verify DISCORD_TOKEN is valid
- Check DATABASE_URL connection string format
- Ensure all required channel/role IDs exist

## 🔐 Security Reminders

- ✅ Never commit secrets to repository
- ✅ Use strong, unique values
- ✅ Rotate secrets regularly (every 90 days)
- ✅ Use dedicated deployment SSH keys
- ✅ Monitor secret usage in audit logs
- ❌ Don't share secrets in chat/email
- ❌ Don't reuse personal credentials

## 🚀 Deployment Flow

1. Set secrets in GitHub
2. Push code to `development` branch
3. CI runs tests
4. On success, auto-merge to `release`
5. CD validates secrets
6. CD deploys to VPS with all secrets
7. Health checks verify deployment
8. Discord notification sent

---

**Need Help?** Check the [troubleshooting guide](./TROUBLESHOOTING.md) or [full documentation](./GITHUB_SECRETS_REFERENCE.md).
