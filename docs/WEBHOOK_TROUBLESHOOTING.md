# Discord Webhook Troubleshooting Guide

## Issue: No Notifications from CI/CD Webhook

### Symptoms
- GitHub Actions workflows complete successfully
- No messages appear in Discord channel
- Deployment notifications missing

---

## Root Cause

The `DISCORD_WEBHOOK_URL` secret is not configured in GitHub repository secrets.

---

## Solution

### Step 1: Create Discord Webhook

1. **Open Discord Server**
   - Go to your Discord server where you want notifications

2. **Navigate to Channel Settings**
   - Right-click the channel (e.g., `#deployments` or `#bot-logs`)
   - Click "Edit Channel"

3. **Create Webhook**
   - Go to "Integrations" tab
   - Click "Webhooks" → "New Webhook"
   - Give it a name (e.g., "TZBOT Deployments")
   - Optionally set an avatar

4. **Copy Webhook URL**
   - Click "Copy Webhook URL"
   - URL format: `https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN`
   - **Keep this URL secret!**

### Step 2: Add to GitHub Secrets

1. **Go to Repository Settings**
   - Navigate to your GitHub repository
   - Click "Settings" → "Secrets and variables" → "Actions"

2. **Add New Secret**
   - Click "New repository secret"
   - Name: `DISCORD_WEBHOOK_URL`
   - Value: Paste the webhook URL you copied
   - Click "Add secret"

### Step 3: Verify Configuration

Run the test script to verify webhook is working:

```bash
# On your local machine or VPS
export DISCORD_WEBHOOK_URL="your_webhook_url_here"
bash deployment/scripts/test-webhook.sh
```

You should see 3 test messages in your Discord channel:
1. Basic text message
2. Embed message with fields
3. Deployment notification

---

## Common Issues

### Issue 1: Webhook URL Invalid

**Symptoms:**
- HTTP 404 errors in logs
- "Unknown Webhook" error

**Solution:**
- Verify webhook URL is correct
- Check if webhook was deleted in Discord
- Recreate webhook if necessary

**Test:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"content":"Test"}' \
  "YOUR_WEBHOOK_URL"
```

Expected response: HTTP 204 (No Content)

---

### Issue 2: Webhook Rate Limited

**Symptoms:**
- HTTP 429 errors
- Some notifications missing

**Solution:**
- Discord webhooks have rate limits (30 requests per minute)
- Reduce notification frequency
- Add delays between notifications

**Current Implementation:**
- Notifications already have retry logic with delays
- Should not hit rate limits under normal use

---

### Issue 3: Secret Not Available in Workflow

**Symptoms:**
- Workflow logs show empty webhook URL
- `DISCORD_WEBHOOK_URL` is blank

**Solution:**
1. Verify secret is added to repository (not organization)
2. Check secret name matches exactly: `DISCORD_WEBHOOK_URL`
3. Re-run workflow after adding secret

**Debug:**
```yaml
# Add to workflow for debugging (remove after)
- name: Debug webhook
  run: |
    if [ -z "${{ secrets.DISCORD_WEBHOOK_URL }}" ]; then
      echo "❌ DISCORD_WEBHOOK_URL is not set"
    else
      echo "✅ DISCORD_WEBHOOK_URL is set"
    fi
```

---

### Issue 4: Webhook Deleted or Expired

**Symptoms:**
- Worked before, stopped working
- HTTP 404 errors

**Solution:**
1. Check if webhook still exists in Discord
2. Recreate webhook if deleted
3. Update GitHub secret with new URL

---

### Issue 5: Wrong Channel Permissions

**Symptoms:**
- Webhook created but no messages appear
- No errors in logs

**Solution:**
1. Verify webhook has permission to post in channel
2. Check channel permissions for "Webhooks"
3. Ensure channel is not archived or deleted

---

## Testing Checklist

Use this checklist to verify webhook is working:

- [ ] Webhook created in Discord
- [ ] Webhook URL copied correctly
- [ ] GitHub secret `DISCORD_WEBHOOK_URL` added
- [ ] Secret value is complete webhook URL
- [ ] Test script runs successfully
- [ ] Test messages appear in Discord
- [ ] CI/CD workflow triggered
- [ ] Deployment notifications received

---

## Manual Testing

### Test from Command Line

```bash
# Set webhook URL
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN"

# Test basic message
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"content":"🧪 Manual Test"}' \
  "$DISCORD_WEBHOOK_URL"

# Test with script
bash deployment/scripts/notify.sh start "Test Deployment" "Testing webhook"
```

### Test from GitHub Actions

Trigger a workflow manually:
1. Go to "Actions" tab
2. Select "CI Pipeline" workflow
3. Click "Run workflow"
4. Select branch and run
5. Check Discord for notifications

---

## Webhook URL Format

**Correct Format:**
```
https://discord.com/api/webhooks/1234567890123456789/AbCdEfGhIjKlMnOpQrStUvWxYz1234567890AbCdEfGhIjKlMnOpQrStUvWxYz
```

**Components:**
- Base URL: `https://discord.com/api/webhooks/`
- Webhook ID: `1234567890123456789` (numeric)
- Webhook Token: `AbCdEfGh...` (alphanumeric string)

**Invalid Formats:**
- ❌ Missing token: `https://discord.com/api/webhooks/1234567890123456789`
- ❌ Wrong domain: `https://discordapp.com/api/webhooks/...`
- ❌ Extra parameters: `https://discord.com/api/webhooks/.../...?wait=true`

---

## Security Best Practices

### ✅ Do:
- Store webhook URL in GitHub Secrets
- Use separate webhooks for different environments
- Rotate webhook URLs periodically
- Limit webhook to specific channel

### ❌ Don't:
- Commit webhook URL to repository
- Share webhook URL publicly
- Use same webhook for multiple projects
- Log full webhook URL in plaintext

---

## Notification Types

The system sends these notification types:

### 1. Deployment Started
- **Trigger**: CD workflow begins
- **Color**: Blue
- **Icon**: 🚀

### 2. Deployment Success
- **Trigger**: Deployment completes successfully
- **Color**: Green
- **Icon**: ✅

### 3. Deployment Failed
- **Trigger**: Deployment fails
- **Color**: Red
- **Icon**: ❌

### 4. Rollback Executed
- **Trigger**: Automatic rollback triggered
- **Color**: Yellow
- **Icon**: ⚠️

### 5. Branch Promotion
- **Trigger**: Code promoted from Development to release
- **Color**: Blue
- **Icon**: 🔄

---

## Monitoring Webhook Health

### Check Webhook Status

```bash
# Get webhook info (requires bot token)
curl -H "Authorization: Bot YOUR_BOT_TOKEN" \
  https://discord.com/api/v10/webhooks/WEBHOOK_ID
```

### Monitor Notification Success Rate

Check GitHub Actions logs for:
- `Notification sent successfully` - Success
- `Failed to send notification` - Failure
- `Notification failed, but continuing` - Non-blocking failure

---

## Alternative Solutions

If webhook notifications are not critical:

### Option 1: Disable Notifications
Remove or comment out notification steps in workflows:
```yaml
# - name: Send notification
#   run: bash deployment/scripts/notify.sh ...
#   continue-on-error: true
```

### Option 2: Use Different Notification Service
Replace Discord webhook with:
- Slack webhook
- Email notifications
- SMS alerts
- Custom HTTP endpoint

### Option 3: GitHub Notifications Only
Rely on GitHub's built-in notifications:
- Email on workflow failure
- GitHub mobile app notifications
- Repository watch settings

---

## Support

If webhook still not working after following this guide:

1. **Check GitHub Actions Logs**
   - Look for webhook-related errors
   - Check if `DISCORD_WEBHOOK_URL` is set

2. **Test Webhook Manually**
   - Use curl to test webhook directly
   - Verify webhook exists in Discord

3. **Verify Permissions**
   - Check GitHub repository access
   - Verify Discord channel permissions

4. **Review Recent Changes**
   - Check if webhook was deleted
   - Verify no recent Discord server changes

---

## Quick Fix Commands

```bash
# Test webhook from command line
export DISCORD_WEBHOOK_URL="your_url_here"
bash deployment/scripts/test-webhook.sh

# Test notification script
bash deployment/scripts/notify.sh start "Test" "Testing webhook"

# Check if secret is set in GitHub (requires gh CLI)
gh secret list | grep DISCORD_WEBHOOK_URL

# Set secret via gh CLI
gh secret set DISCORD_WEBHOOK_URL < webhook_url.txt
```

---

## Related Documentation

- [Discord Webhook Setup Guide](DISCORD_WEBHOOK_SETUP.md)
- [CI/CD Pipeline Review](CICD_REVIEW.md)
- [Deployment Guide](DEPLOYMENT.md)
- [GitHub Secrets Setup](GITHUB_SECRETS_SETUP.md)

---

**Last Updated**: 2026-02-22  
**Status**: Active  
**Version**: 1.0
