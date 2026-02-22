# Discord Webhook Architecture

## Overview

The Discord webhook system has TWO independent notification sources:

```
┌─────────────────────────────────────────────────────────────────┐
│                     DISCORD WEBHOOK URL                         │
│              (Created once in Discord Server)                   │
└────────────┬────────────────────────────────┬───────────────────┘
             │                                │
             │                                │
    ┌────────▼────────┐              ┌───────▼────────┐
    │  GitHub Actions │              │   VPS Server   │
    │   (Cloud CI/CD) │              │  (Your Server) │
    └────────┬────────┘              └───────┬────────┘
             │                                │
             │                                │
    ┌────────▼────────────────┐     ┌────────▼─────────────────┐
    │ Deployment Notifications│     │ Real-time Bot Monitoring │
    │                         │     │                          │
    │ • Release starting      │     │ • Bot crashes            │
    │ • Progress updates      │     │ • Bot recovery           │
    │ • Success/failure       │     │ • High memory            │
    │ • Rollback alerts       │     │ • Process missing        │
    └─────────────────────────┘     └──────────────────────────┘
```

## How It Works

### 1. GitHub Actions (Deployment Notifications)

**Location:** GitHub Secrets  
**Runs:** Only during deployments  
**Triggered by:** Push to Release branch

```
Developer pushes code
    ↓
GitHub Actions starts
    ↓
Reads DISCORD_WEBHOOK_URL from secrets
    ↓
Sends notifications during deployment:
    • 🚀 Starting (0%)
    • ⚙️ Installing (40%)
    • 🔄 Restarting (80%)
    • ✅ Success (100%)
    • ❌ Failed (with rollback)
```

**Setup:**
```bash
# Add to GitHub Secrets
Name: DISCORD_WEBHOOK_URL
Value: https://discord.com/api/webhooks/...
```

### 2. VPS Monitoring Service (Real-time Health)

**Location:** VPS systemd service  
**Runs:** 24/7 continuously  
**Triggered by:** Every 5 minutes (automatic)

```
Systemd service starts on boot
    ↓
Reads DISCORD_WEBHOOK_URL from environment file
    ↓
Checks bot status every 5 minutes
    ↓
Sends alerts when issues detected:
    • 🚨 Bot crashed
    • ✅ Bot recovered
    • ⚠️ Memory > 500MB
    • 🚨 Process missing
```

**Setup:**
```bash
# On VPS
sudo bash /var/www/tzbot/deployment/scripts/setup-webhook.sh
```

## Data Flow

### Deployment Flow
```
┌──────────────┐
│   Developer  │
└──────┬───────┘
       │ git push
       ▼
┌──────────────┐
│    GitHub    │
└──────┬───────┘
       │ triggers
       ▼
┌──────────────────┐
│ GitHub Actions   │
│ (CD Workflow)    │
└──────┬───────────┘
       │ reads secret
       ▼
┌──────────────────┐
│ DISCORD_WEBHOOK  │
│ (from secrets)   │
└──────┬───────────┘
       │ sends HTTP POST
       ▼
┌──────────────────┐
│ Discord Server   │
│ (Your Channel)   │
└──────────────────┘
```

### Monitoring Flow
```
┌──────────────────┐
│  VPS Boot/Start  │
└──────┬───────────┘
       │ starts
       ▼
┌──────────────────┐
│ systemd service  │
│ (tzbot-monitor)  │
└──────┬───────────┘
       │ reads env file
       ▼
┌──────────────────┐
│ DISCORD_WEBHOOK  │
│ (from env file)  │
└──────┬───────────┘
       │ checks every 5min
       ▼
┌──────────────────┐
│   PM2 Status     │
│   (bot health)   │
└──────┬───────────┘
       │ if issue detected
       ▼
┌──────────────────┐
│ Discord Server   │
│ (Your Channel)   │
└──────────────────┘
```

## File Locations

### GitHub Actions
```
Repository:
  .github/workflows/cd-release.yml
    ↓ uses secret
  GitHub Secrets:
    DISCORD_WEBHOOK_URL
```

### VPS Monitoring
```
VPS Server:
  /etc/systemd/system/tzbot-monitor.service
    ↓ reads
  /etc/systemd/system/tzbot-monitor.env
    ↓ contains
  DISCORD_WEBHOOK_URL=https://...
    ↓ used by
  /var/www/tzbot/deployment/scripts/monitor-bot.sh
```

## Security

### Webhook URL Protection
- ✅ Stored in GitHub Secrets (encrypted)
- ✅ Stored in VPS env file (root-only access)
- ✅ Never committed to git
- ✅ Never logged in plain text

### Access Control
```
GitHub Secrets:
  • Only accessible by GitHub Actions
  • Encrypted at rest
  • Not visible in logs

VPS Environment File:
  • Owner: root
  • Permissions: 600 (read/write owner only)
  • Location: /etc/systemd/system/
```

## Notification Throttling

### GitHub Actions
- No throttling needed
- Only runs during deployments
- Typically 4-5 notifications per deployment

### VPS Monitoring
- Built-in throttling
- Same alert not sent within 15 minutes
- Prevents spam from repeated failures
- Tracked in: `/tmp/tzbot-last-alert`

## Testing

### Test Deployment Notifications
```bash
# Push a commit to trigger deployment
git commit -m "feat: test deployment"
git push origin Development
# Merge to Release
# Watch Discord for notifications
```

### Test Monitoring Notifications
```bash
# SSH into VPS
ssh your-user@your-vps

# Trigger crash alert
pm2 stop tzbot
# Wait 10 seconds
# Check Discord

# Trigger recovery alert
pm2 start tzbot
# Wait 10 seconds
# Check Discord
```

## Troubleshooting

### No notifications from GitHub
```bash
# Check if secret exists
# GitHub → Settings → Secrets → Actions
# Look for: DISCORD_WEBHOOK_URL

# Check workflow logs
# GitHub → Actions → Latest workflow
# Look for: "Send deployment start notification"
```

### No notifications from VPS
```bash
# Check if service is running
sudo systemctl status tzbot-monitor

# Check environment file
sudo cat /etc/systemd/system/tzbot-monitor.env

# Check logs
tail -f /var/www/tzbot/logs/monitor.log

# Test webhook manually
curl -H "Content-Type: application/json" \
     -X POST \
     -d '{"content":"Test from VPS"}' \
     YOUR_WEBHOOK_URL
```

## Rate Limits

Discord webhook rate limits:
- **30 requests per minute**
- **5 requests per second**

Our usage:
- Deployment: ~5 notifications per deployment
- Monitoring: ~1 notification per 15 minutes (max)
- Well within limits ✅

## Summary

| Feature | GitHub Actions | VPS Monitoring |
|---------|---------------|----------------|
| **Setup Location** | GitHub Secrets | VPS env file |
| **Runs** | During deployments | 24/7 continuous |
| **Frequency** | Per deployment | Every 5 minutes |
| **Notifications** | Deployment status | Bot health |
| **Throttling** | Not needed | 15-minute cooldown |
| **Auto-start** | On push to Release | On VPS boot |

Both systems are independent and work together to provide complete visibility into your bot's deployment and health status.
