# Discord Webhook Setup - Quick Start

## Problem: No CI/CD Notifications in Discord

**Cause**: `DISCORD_WEBHOOK_URL` secret not configured

---

## Quick Fix (5 minutes)

### 1. Create Discord Webhook

In Discord:
1. Right-click channel → **Edit Channel**
2. **Integrations** → **Webhooks** → **New Webhook**
3. Name it "TZBOT Deployments"
4. **Copy Webhook URL**

### 2. Add to GitHub Secrets

In GitHub:
1. Repository → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
3. Name: `DISCORD_WEBHOOK_URL`
4. Value: Paste webhook URL
5. **Add secret**

### 3. Test It

```bash
# Run setup script (interactive)
bash deployment/scripts/setup-webhook.sh

# Or test manually
export DISCORD_WEBHOOK_URL="your_webhook_url"
bash deployment/scripts/test-webhook.sh
```

---

## Verify It's Working

Trigger a workflow:
1. Go to **Actions** tab
2. Select **CI Pipeline**
3. **Run workflow**
4. Check Discord for notifications

---

## Expected Notifications

You should see messages for:
- 🚀 Deployment Started
- ✅ Deployment Success
- ❌ Deployment Failed
- 🔄 Branch Promotion
- ⚠️ Rollback Executed

---

## Troubleshooting

### No messages appearing?

**Check:**
- [ ] Webhook URL is correct format
- [ ] GitHub secret is named exactly `DISCORD_WEBHOOK_URL`
- [ ] Webhook exists in Discord (not deleted)
- [ ] Channel permissions allow webhooks

**Test webhook manually:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"content":"Test"}' \
  "YOUR_WEBHOOK_URL"
```

Expected: HTTP 204 response

### Still not working?

See detailed guide: [docs/WEBHOOK_TROUBLESHOOTING.md](docs/WEBHOOK_TROUBLESHOOTING.md)

---

## Webhook URL Format

✅ **Correct:**
```
https://discord.com/api/webhooks/1234567890123456789/AbCdEfGh...
```

❌ **Wrong:**
```
https://discordapp.com/...  (old domain)
https://discord.com/api/webhooks/123456789  (missing token)
```

---

## Security Note

⚠️ **Keep webhook URL secret!**
- Don't commit to repository
- Don't share publicly
- Store in GitHub Secrets only

---

## Quick Commands

```bash
# Interactive setup
bash deployment/scripts/setup-webhook.sh

# Test webhook
bash deployment/scripts/test-webhook.sh YOUR_WEBHOOK_URL

# Add secret via GitHub CLI
echo "YOUR_WEBHOOK_URL" | gh secret set DISCORD_WEBHOOK_URL

# Check if secret exists
gh secret list | grep DISCORD_WEBHOOK_URL
```

---

## Need Help?

- **Full Guide**: [docs/WEBHOOK_TROUBLESHOOTING.md](docs/WEBHOOK_TROUBLESHOOTING.md)
- **CI/CD Review**: [docs/CICD_REVIEW.md](docs/CICD_REVIEW.md)
- **Deployment Guide**: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

**Setup Time**: ~5 minutes  
**Difficulty**: Easy  
**Required**: Discord server admin, GitHub repo admin
