# Fully Automatic Deployment System

## Overview

Your TZBOT Discord bot now has a **100% automatic deployment system** with zero manual intervention required. Push code to Development, and everything else happens automatically.

## 🚀 Complete Automation Flow

```
Developer Pushes to Development
         ↓
    CI Tests Run
         ↓
  ✅ Tests Pass → Auto-Merge to Release
         ↓
  🚀 Deployment Starts (Discord Notification)
         ↓
  📦 Auto-Install Dependencies (npm install)
         ↓
  🔨 Auto-Build TypeScript (npm run build)
         ↓
  🔧 Auto-Resolve Path Aliases (tsc-alias)
         ↓
  🧹 Auto-Remove Dev Dependencies (npm prune)
         ↓
  🔄 Auto-Restart Bot (PM2)
         ↓
  🏥 Auto-Health Check
         ↓
  ✅ Success → Discord Notification
  ❌ Failure → Auto-Rollback + Notification
```

## 📱 Real-Time Discord Notifications

### Deployment Notifications

1. **New Release Received** (Start)
   - Commit hash
   - Author
   - Estimated time: ~2-3 minutes
   - Status: Installing dependencies

2. **Deployment Progress** (40%)
   - Installing dependencies & building
   - Progress bar: 🔵🔵⚪⚪⚪

3. **Restarting Service** (80%)
   - Restarting PM2 service
   - Progress bar: 🔵🔵🔵🔵⚪

4. **Deployment Successful** (100%)
   - Commit deployed
   - Status: 🟢 Working Normally
   - All systems operational

5. **Deployment Failed** (Error)
   - Status: 🔴 Rolling back
   - Previous version restored
   - Auto-rollback initiated

### Continuous Monitoring Notifications

1. **Bot Recovered**
   - Status: 🟢 Online
   - Uptime information
   - Total restarts count

2. **Bot Critical Failure**
   - Status: 🔴 Down
   - Consecutive failures
   - PM2 auto-restart initiated

3. **High Memory Usage**
   - Memory: XXX MB
   - Status: 🟡 Warning
   - Monitoring for memory leak

4. **Bot Process Missing**
   - Status: 🔴 Not Found
   - Manual intervention required

## 🔄 Auto-Recovery Features

### 1. PM2 Auto-Restart
- **Trigger**: Bot crashes
- **Action**: Automatic restart with exponential backoff
- **Max Restarts**: 10 attempts
- **Notification**: Sent after recovery

### 2. Cron Health Check
- **Frequency**: Every 5 minutes
- **Action**: Check if bot is running, restart if down
- **Log**: `/var/www/tzbot/shared/logs/health-check.log`

### 3. Real-Time Monitoring (Optional)
- **Service**: `tzbot-monitor` systemd service
- **Frequency**: Every 5 minutes
- **Features**:
  - Bot status monitoring
  - Memory usage alerts
  - Crash detection
  - Discord notifications

## 📦 Automatic Dependency Management

### What Gets Installed Automatically

1. **Production Dependencies**
   - All packages from `package.json`
   - Installed via `npm install`

2. **Build Tools**
   - TypeScript compiler (`tsc`)
   - Path alias resolver (`tsc-alias`)
   - All devDependencies needed for build

3. **Post-Build Cleanup**
   - Dev dependencies removed via `npm prune --production`
   - Only production packages remain

### Path Alias Resolution

The system automatically resolves TypeScript path aliases (`@/core`, `@/managers`, etc.) during build:

```bash
npm run build          # Compile TypeScript
npx tsc-alias          # Resolve path aliases
npm prune --production # Remove dev dependencies
```

## 🔙 Automatic Rollback

### When Rollback Happens

1. **Build Failure**
   - TypeScript compilation fails
   - Dependencies installation fails

2. **Health Check Failure**
   - Bot doesn't start within 60 seconds
   - Discord connection fails

3. **Service Restart Failure**
   - PM2 can't restart the service

### Rollback Process

1. Stop current (failed) version
2. Restore previous working version
3. Restart PM2 service
4. Verify health checks
5. Send Discord notification

## 🎯 Zero Manual Intervention

### What You DON'T Need to Do

❌ SSH into VPS  
❌ Run npm install  
❌ Run npm build  
❌ Restart PM2  
❌ Check if bot is running  
❌ Monitor for crashes  
❌ Handle rollbacks  
❌ Send notifications  

### What Happens Automatically

✅ Code deployment  
✅ Dependency installation  
✅ TypeScript compilation  
✅ Path alias resolution  
✅ Service restart  
✅ Health checks  
✅ Rollback on failure  
✅ Discord notifications  
✅ Crash recovery  
✅ Memory monitoring  

## 📊 Monitoring Setup (Optional)

To enable continuous real-time monitoring:

```bash
# On VPS
export DISCORD_WEBHOOK_URL="your_webhook_url"
bash /var/www/tzbot/deployment/scripts/setup-monitoring.sh
```

This creates a systemd service that:
- Monitors bot 24/7
- Sends alerts to Discord
- Detects crashes immediately
- Reports memory issues
- Tracks bot health

### View Monitoring Logs

```bash
# Real-time logs
journalctl -u tzbot-monitor -f

# Recent logs
journalctl -u tzbot-monitor -n 100

# Service status
systemctl status tzbot-monitor
```

## 🔧 Configuration

### Required GitHub Secrets

1. **VPS_HOSTNAME** - Your VPS hostname or IP
2. **VPS_USER** - SSH user (usually `root`)
3. **VPS_SSH_KEY** - Private SSH key for VPS access
4. **DISCORD_WEBHOOK_URL** - Discord webhook for notifications

### Setting Up Discord Webhook

1. Go to Discord Server Settings
2. Integrations → Webhooks
3. Create New Webhook
4. Copy Webhook URL
5. Add to GitHub Secrets as `DISCORD_WEBHOOK_URL`

## 📝 Deployment Logs

### GitHub Actions Logs
- View in GitHub Actions tab
- Shows full deployment process
- Includes all notifications sent

### VPS Logs

```bash
# PM2 logs
pm2 logs tzbot

# Deployment logs
cat /var/www/tzbot/shared/logs/deployment-*.log

# Health check logs
cat /var/www/tzbot/shared/logs/health-check.log

# System logs
journalctl -u tzbot-monitor -f
```

## 🎉 Summary

Your deployment system is now **fully automatic**:

1. **Push code** → Everything else is automatic
2. **Real-time notifications** → Know exactly what's happening
3. **Auto-recovery** → Bot restarts itself on crashes
4. **Auto-rollback** → Failed deployments revert automatically
5. **Zero downtime** → PM2 handles restarts gracefully
6. **Continuous monitoring** → 24/7 health tracking

**You literally do nothing except push code!** 🚀
