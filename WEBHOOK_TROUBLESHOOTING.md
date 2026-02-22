# Discord Webhook Troubleshooting Guide

## Issue: Not Getting Notifications During GitHub Workflow

### Checklist

#### 1. Verify Discord Webhook Exists
- [ ] Open Discord → Your Server
- [ ] Go to: Server Settings → Integrations → Webhooks
- [ ] Confirm your webhook is listed and not deleted
- [ ] Copy the webhook URL

#### 2. Verify GitHub Secret is Set
- [ ] Go to: `https://github.com/parikshitgorain/tzbot/settings/secrets/actions`
- [ ] Look for secret named: `DISCORD_WEBHOOK_URL`
- [ ] If missing, click "New repository secret"
- [ ] Name: `DISCORD_WEBHOOK_URL`
- [ ] Value: Paste your webhook URL
- [ ] Click "Add secret"

#### 3. Test Webhook from Local Machine
```bash
# Test the webhook URL
bash deployment/scripts/test-webhook.sh "YOUR_WEBHOOK_URL"
```

If this works, the webhook is valid.

#### 4. Test Webhook from VPS
```bash
# SSH into VPS
ssh your-user@your-vps

# Test from VPS
bash /var/www/tzbot/current/deployment/scripts/test-webhook.sh "YOUR_WEBHOOK_URL"
```

If this works, VPS can reach Discord.

#### 5. Check GitHub Actions Logs
- [ ] Go to: `https://github.com/parikshitgorain/tzbot/actions`
- [ ] Click on the latest deployment workflow
- [ ] Look for step: "Send deployment start notification"
- [ ] Check if there are any errors

Common errors:
- `DISCORD_WEBHOOK_URL not configured` → Secret not set
- `curl: (6) Could not resolve host` → Network issue
- `curl: (22) HTTP 404` → Webhook deleted or invalid

#### 6. Verify Workflow Has Access to Secret
The workflow needs the secret to be available. Check if:
- [ ] Secret name is exactly: `DISCORD_WEBHOOK_URL` (case-sensitive)
- [ ] Secret is in "Repository secrets" not "Environment secrets"
- [ ] You have permission to add secrets (repo admin/owner)

---

## Quick Fix Commands

### Test Webhook Manually
```bash
# Replace with your actual webhook URL
WEBHOOK_URL="https://discord.com/api/webhooks/YOUR_WEBHOOK_URL"

curl -H "Content-Type: application/json" \
     -X POST \
     -d '{"content":"✅ Test from command line"}' \
     "$WEBHOOK_URL"
```

If you see a message in Discord, the webhook works!

### Check if Secret is Set (from GitHub Actions)
Add this temporary step to your workflow to debug:
```yaml
- name: Debug webhook
  run: |
    if [ -z "${{ secrets.DISCORD_WEBHOOK_URL }}" ]; then
      echo "❌ DISCORD_WEBHOOK_URL secret is NOT set"
    else
      echo "✅ DISCORD_WEBHOOK_URL secret is set"
      echo "Length: ${#DISCORD_WEBHOOK_URL}"
    fi
  env:
    DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
```

---

## Common Issues & Solutions

### Issue 1: "Webhook URL not configured"
**Cause:** `DISCORD_WEBHOOK_URL` secret not set in GitHub

**Solution:**
1. Go to: `https://github.com/parikshitgorain/tzbot/settings/secrets/actions`
2. Add secret: `DISCORD_WEBHOOK_URL`
3. Value: Your Discord webhook URL

### Issue 2: Webhook works locally but not in GitHub Actions
**Cause:** Secret not accessible to workflow

**Solution:**
- Verify secret name is exactly `DISCORD_WEBHOOK_URL`
- Check workflow has `secrets.DISCORD_WEBHOOK_URL` in env
- Ensure you're repo owner/admin

### Issue 3: "HTTP 404 Not Found"
**Cause:** Webhook was deleted in Discord

**Solution:**
1. Create new webhook in Discord
2. Update GitHub secret with new URL
3. Update VPS env file with new URL

### Issue 4: Notifications work for deployment but not monitoring
**Cause:** VPS monitoring service not configured

**Solution:**
```bash
# SSH into VPS
ssh your-user@your-vps

# Check if env file exists
sudo cat /etc/systemd/system/tzbot-monitor.env

# If missing or wrong, create/update it
sudo nano /etc/systemd/system/tzbot-monitor.env

# Add:
SERVICE_NAME=tzbot
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_URL
CHECK_INTERVAL=300

# Restart service
sudo systemctl restart tzbot-monitor
```

### Issue 5: Monitoring works but deployment doesn't
**Cause:** GitHub secret not set

**Solution:** Add `DISCORD_WEBHOOK_URL` to GitHub Secrets (see Issue 1)

---

## Verification Steps

### 1. Test Webhook URL
```bash
bash deployment/scripts/test-webhook.sh "YOUR_WEBHOOK_URL"
```

Expected: Message appears in Discord

### 2. Check GitHub Secret
```bash
# Go to GitHub repo → Settings → Secrets → Actions
# Verify DISCORD_WEBHOOK_URL exists
```

### 3. Check VPS Monitoring
```bash
# SSH into VPS
sudo systemctl status tzbot-monitor

# Check logs
sudo journalctl -u tzbot-monitor -n 20

# Test by stopping bot
pm2 stop tzbot
# Wait 10 seconds
# Check Discord for alert
pm2 start tzbot
```

### 4. Trigger Test Deployment
```bash
# Make empty commit
git commit --allow-empty -m "test: trigger deployment notification test"
git push origin Development

# Merge to Release
# Watch GitHub Actions
# Check Discord
```

---

## Expected Notifications

### From GitHub Actions (Deployments)
- 🚀 Deployment Starting (when release branch updated)
- ⚙️ Progress 40% (installing dependencies)
- 🔄 Progress 80% (restarting service)
- ✅ Success (deployment complete)
- ❌ Failed (if deployment fails)

### From VPS Monitoring (24/7)
- 🚨 Bot Crashed (when bot stops)
- ✅ Bot Recovered (when bot restarts)
- ⚠️ High Memory (when memory > 500MB)
- 🚨 Process Missing (when bot not in PM2)

---

## Still Not Working?

### Debug Checklist
1. [ ] Webhook URL is valid (test with curl)
2. [ ] GitHub secret `DISCORD_WEBHOOK_URL` is set
3. [ ] VPS env file `/etc/systemd/system/tzbot-monitor.env` has webhook
4. [ ] Monitoring service is running: `systemctl status tzbot-monitor`
5. [ ] GitHub Actions logs show no errors
6. [ ] Discord channel exists and webhook has permissions

### Get Help
If still not working, check:
1. GitHub Actions logs for the deployment workflow
2. VPS monitoring logs: `journalctl -u tzbot-monitor -f`
3. Test webhook manually with curl command above

---

## Summary

**Two separate systems need the webhook:**

1. **GitHub Actions** (for deployment notifications)
   - Location: GitHub Secrets
   - Name: `DISCORD_WEBHOOK_URL`
   - Setup: GitHub repo → Settings → Secrets → Actions

2. **VPS Monitoring** (for bot health alerts)
   - Location: `/etc/systemd/system/tzbot-monitor.env`
   - Setup: SSH into VPS and create/edit file

Both use the same webhook URL but are configured separately.
