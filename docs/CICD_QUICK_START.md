# CI/CD Quick Start Guide

Quick reference for setting up and using the production-grade CI/CD pipeline.

## 🚀 Quick Setup (5 Minutes)

### 1. Configure GitHub Secrets

Go to repository Settings → Secrets and variables → Actions → New repository secret

**Minimum Required Secrets**:
```
VPS_HOSTNAME=your-vps.example.com
VPS_USER=deploy
VPS_SSH_KEY=<paste private SSH key>
DISCORD_TOKEN=<bot token>
DISCORD_CLIENT_ID=<client id>
DISCORD_GUILD_ID=<guild id>
DATABASE_URL=postgresql://user:pass@host:5432/db
DISCORD_WEBHOOK_URL=<webhook for notifications>
```

### 2. Create Production Environment

Settings → Environments → New environment → Name: `production`

### 3. Setup VPS

```bash
# Generate SSH key
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy_key

# Copy to VPS
ssh-copy-id -i ~/.ssh/github_deploy_key.pub deploy@your-vps.example.com

# Get host key
ssh-keyscan -H your-vps.example.com

# Add private key to VPS_SSH_KEY secret
# Add host key to VPS_HOST_KEY secret (optional but recommended)
```

### 4. Test the Pipeline

```bash
# Make a change
git checkout development
echo "test" >> README.md
git add README.md
git commit -m "feat: test CI/CD pipeline"
git push origin development

# Watch GitHub Actions
# CI runs → Auto-promotes to release → Creates version tag → Deploys to VPS
```

## 📋 Daily Workflow

### Making Changes

```bash
# 1. Work on development branch
git checkout development
git pull origin development

# 2. Make your changes
# ... edit files ...

# 3. Commit with conventional commit message
git commit -m "feat: add new feature"
# or
git commit -m "fix: resolve bug"

# 4. Push to development
git push origin development

# 5. CI/CD handles the rest automatically!
```

### Commit Message Format

```bash
# Patch version (1.0.0 → 1.0.1)
git commit -m "fix: bug description"

# Minor version (1.0.0 → 1.1.0)
git commit -m "feat: new feature description"

# Major version (1.0.0 → 2.0.0)
git commit -m "feat!: breaking change description"
```

## 🔄 Pipeline Flow

```
Push to development
    ↓
✓ Lint & Type Check
✓ Security Scan
✓ Tests
✓ Build
    ↓
Clean Production Build (removes dev files)
    ↓
Auto-Promote to release
    ↓
Semantic Version Bump
Create Git Tag (vX.Y.Z)
Create GitHub Release
    ↓
Deploy to VPS
    ↓
✓ Success → Live
✗ Failure → Automatic Rollback
```

## 🎯 Key Features

- ✅ **Automated Testing** - Every push runs full test suite
- ✅ **Clean Releases** - No dev files in production
- ✅ **Auto Versioning** - Based on commit messages
- ✅ **Zero-Downtime** - Seamless deployments
- ✅ **Auto Rollback** - Instant recovery on failure
- ✅ **Discord Alerts** - Real-time notifications

## 🔧 Common Tasks

### Skip CI/CD

```bash
git commit -m "docs: update README [skip ci]"
```

### Manual Rollback

```bash
ssh deploy@your-vps.example.com
cd /var/www/tzbot
bash deployment/scripts/rollback.sh previous
```

### Check Deployment Status

```bash
ssh deploy@your-vps.example.com
pm2 status tzbot
pm2 logs tzbot --lines 50
```

### View Available Releases

```bash
ssh deploy@your-vps.example.com
ls -la /var/www/tzbot/releases/
```

## 🐛 Quick Troubleshooting

### Deployment Failed

1. Check GitHub Actions logs
2. Check Discord notification for error
3. SSH to VPS: `pm2 logs tzbot --err`
4. Rollback if needed: `bash deployment/scripts/rollback.sh previous`

### Health Checks Failed

1. Check PM2 status: `pm2 status tzbot`
2. Check logs: `pm2 logs tzbot`
3. Verify .env file: `cat /var/www/tzbot/shared/.env`
4. Test manually: `cd /var/www/tzbot/current && node dist/index.js`

### SSH Connection Failed

1. Verify VPS_HOSTNAME secret
2. Verify VPS_SSH_KEY secret (must be private key)
3. Test SSH manually: `ssh -i key deploy@host`
4. Check VPS firewall allows SSH

## 📚 Full Documentation

- [Production Guide](./CICD_PRODUCTION_GUIDE.md) - Complete documentation
- [Troubleshooting](./TROUBLESHOOTING.md) - Detailed troubleshooting
- [Deployment Guide](./DEPLOYMENT.md) - VPS setup guide

## 🎉 That's It!

Your CI/CD pipeline is now fully automated. Just push to `development` and everything else happens automatically!

**Questions?** Check the [Production Guide](./CICD_PRODUCTION_GUIDE.md) for detailed information.
