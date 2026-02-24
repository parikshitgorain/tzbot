# GitHub Secrets Configuration Checklist

## ✅ Current Status
Based on your screenshot, you have these secrets configured:
- ✅ DATABASE_URL
- ✅ DEPLOY_KEY
- ✅ DISCORD_CLIENT_ID
- ✅ DISCORD_GUILD_ID
- ✅ DISCORD_TOKEN
- ✅ DISCORD_WEBHOOK_URL (for critical error notifications)
- ✅ MODERATOR_ROLE_ID
- ✅ NOTIFICATION_CHANNEL_ID
- ✅ PAT_TOKEN
- ✅ REDIS_URL
- ✅ VIP_ROLE_ID
- ✅ VPS_HOSTNAME
- ✅ VPS_SSH_KEY
- ✅ VPS_USER

## 📋 Additional Secrets Needed

Add these secrets to your GitHub repository:

### Discord Role IDs
```
SUBSCRIBER_ROLE_ID=<your_subscriber_role_id>
```

### Discord Channel IDs
```
FALLBACK_CHANNEL_ID=<your_fallback_channel_id>
MOD_LOG_CHANNEL_ID=<your_mod_log_channel_id>
```

## 🔄 How the Deployment Flow Works

### 1. GitHub Actions Workflow
When you push to `main` branch:
```
GitHub Actions → Reads Secrets → Creates .env file → Uploads to VPS
```

### 2. Environment Variables on VPS
The workflow creates `/var/www/tzbot/shared/.env` with:
- All Discord configuration
- Database URL
- Redis URL
- **DISCORD_WEBHOOK_URL** (for critical error notifications)

### 3. Bot Reads Configuration
```
Bot starts → Loads .env → Uses DISCORD_WEBHOOK_URL for error alerts
```

### 4. Critical Error Notifications
When errors occur on VPS:
```
Error happens → Bot catches it → Sends webhook to Discord → You get notified
```

## 🚀 What Happens Now

With the updated workflow:

1. **Bot Survives Errors**: Won't crash on uncaught exceptions
2. **Instant Notifications**: Critical errors send Discord webhooks
3. **Full Context**: Error messages include stack traces, version, hostname
4. **VPS Monitoring**: Existing VPS monitor script also uses webhook

## 📝 To Add Missing Secrets

1. Go to: `https://github.com/parikshitgorain/tzbot/settings/secrets/actions`
2. Click "New repository secret"
3. Add each missing secret from the list above
4. Next deployment will include all variables

## ✅ Verification

After next deployment, check:
```bash
# SSH to your VPS
ssh your_user@your_vps

# Check .env file has DISCORD_WEBHOOK_URL
grep DISCORD_WEBHOOK_URL /var/www/tzbot/shared/.env

# Should output:
# DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

## 🎯 Result

- ✅ Bot won't crash on errors
- ✅ You get instant Discord notifications for critical errors
- ✅ VPS monitoring sends alerts
- ✅ Full error context for debugging
