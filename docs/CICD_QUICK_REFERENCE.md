# CI/CD Quick Reference

Quick commands and workflows for the CI/CD system.

## Workflows Overview

| Workflow | Trigger | Purpose | Duration |
|----------|---------|---------|----------|
| `ci-development.yml` | Push/PR to `development` | Quality gates + **manual approval** for promotion | 5-10 min |
| `release-versioning.yml` | Push to `release` | Create version tag + release | 2-3 min |
| `cd-production.yml` | Push to `release` or tag `v*` | Deploy to VPS | 3-5 min |

> **⚠️ Important:** Promotion to Release now requires manual approval. See [Release Approval Setup](./RELEASE_APPROVAL_SETUP.md)

## Common Tasks

### Deploy a Feature

```bash
# 1. Create feature branch
git checkout development
git checkout -b feature/my-feature

# 2. Make changes
# ... edit files ...

# 3. Commit with conventional commit
git add .
git commit -m "feat: add my feature"

# 4. Push and create PR
git push origin feature/my-feature
# Create PR on GitHub

# 5. Merge PR
# CI runs automatically

# 6. **APPROVE PROMOTION** (NEW STEP)
# Go to Actions → Review deployments → Approve

# 7. Wait for deployment
# CD deploys to VPS automatically

# Total time: ~10-15 minutes (+ approval time)
```

### Check Deployment Status

```bash
# View GitHub Actions
# Go to: https://github.com/YOUR_REPO/actions

# Check Discord notifications
# Look for deployment status messages

# SSH to VPS
ssh user@vps-host
pm2 list
pm2 logs tzbot --lines 20
```

### Manual Rollback

```bash
# SSH to VPS
ssh user@vps-host

# List releases
ls -lt /var/www/tzbot/releases/

# Rollback to previous
cd /var/www/tzbot
bash deployment/scripts/rollback.sh

# Or rollback to specific release
bash deployment/scripts/rollback.sh release-20260224-120000

# Verify
pm2 list
cat current/package.json | grep version
```

### View Logs

```bash
# SSH to VPS
ssh user@vps-host

# PM2 logs
pm2 logs tzbot
pm2 logs tzbot --lines 100
pm2 logs tzbot --err  # Errors only

# Application logs
tail -f /var/www/tzbot/current/logs/error.log
tail -f /var/www/tzbot/current/logs/tzbot-*.log

# Monitoring logs
tail -f /var/log/tzbot-monitor.log
```

### Check Health

```bash
# SSH to VPS
ssh user@vps-host

# PM2 status
pm2 list
pm2 describe tzbot

# Manual health check
cd /var/www/tzbot
bash deployment/scripts/health_check.sh

# Check monitoring
crontab -l | grep vps-monitor
```

## Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Patch version bump (v1.0.0 → v1.0.1)
git commit -m "fix: resolve login bug"
git commit -m "perf: improve query performance"

# Minor version bump (v1.0.0 → v1.1.0)
git commit -m "feat: add new feature"

# Major version bump (v1.0.0 → v2.0.0)
git commit -m "feat!: breaking API change"
git commit -m "feat: breaking change

BREAKING CHANGE: API endpoint changed"

# No version bump
git commit -m "docs: update README"
git commit -m "chore: update dependencies"
```

## Workflow Commands

### Trigger Workflows Manually

```bash
# Go to GitHub Actions
# Select workflow
# Click "Run workflow"
# Choose branch
# Click "Run workflow"
```

### Cancel Running Workflow

```bash
# Go to GitHub Actions
# Click on running workflow
# Click "Cancel workflow"
```

### Re-run Failed Workflow

```bash
# Go to GitHub Actions
# Click on failed workflow
# Click "Re-run jobs"
# Select "Re-run failed jobs" or "Re-run all jobs"
```

## Scripts Reference

### CI Scripts

```bash
# Prepare clean release (local testing)
deployment/scripts/prepare_clean_release.sh /tmp/clean-build

# Promote to release (local testing)
deployment/scripts/promote_to_release.sh /tmp/clean-build abc1234
```

### Deployment Scripts

```bash
# Setup SSH (called by workflow)
deployment/scripts/setup_ssh.sh "$SSH_KEY" "$VPS_HOST"

# Deploy release (runs on VPS)
deployment/scripts/deploy_release.sh

# Health check (runs on VPS)
deployment/scripts/health_check.sh 5 5  # 5 attempts, 5s initial delay

# Rollback (runs on VPS)
deployment/scripts/rollback.sh  # Previous release
deployment/scripts/rollback.sh release-20260224-120000  # Specific release
```

## Troubleshooting

### CI Pipeline Fails

```bash
# Check workflow logs
# Go to: https://github.com/YOUR_REPO/actions

# Run checks locally
npm run lint
npm run typecheck
npm run test:unit
npm audit

# Fix issues and push again
```

### Deployment Fails

```bash
# Check workflow logs
# Go to: https://github.com/YOUR_REPO/actions

# SSH to VPS and check
ssh user@vps-host
pm2 list
pm2 logs tzbot --err --lines 50

# Manual rollback if needed
cd /var/www/tzbot
bash deployment/scripts/rollback.sh
```

### Health Check Fails

```bash
# SSH to VPS
ssh user@vps-host

# Check PM2 status
pm2 list
pm2 describe tzbot

# Check logs
pm2 logs tzbot --err --lines 100

# Restart if needed
pm2 restart tzbot

# Or rollback
cd /var/www/tzbot
bash deployment/scripts/rollback.sh
```

## Monitoring

### Check Monitoring Status

```bash
# SSH to VPS
ssh user@vps-host

# Check cron job
crontab -l | grep vps-monitor

# Check monitoring script
ls -la /var/www/tzbot/deployment/scripts/vps-monitor.sh

# View monitoring logs
tail -f /var/log/tzbot-monitor.log

# Test monitoring
/var/www/tzbot/deployment/scripts/vps-monitor.sh
```

### Discord Notifications

Expected notifications:

- ✅ CI pipeline success/failure
- ✅ Promotion to release
- ✅ New release created (with version + changelog)
- ✅ Deployment start
- ✅ Deployment success/failure
- ✅ Automatic rollback (if health check fails)
- ✅ VPS monitoring alerts (crashes, high restarts, memory)

## VPS Management

### Check Current Release

```bash
ssh user@vps-host
ls -la /var/www/tzbot/current
cat /var/www/tzbot/current/package.json | grep version
```

### List All Releases

```bash
ssh user@vps-host
ls -lt /var/www/tzbot/releases/
```

### Clean Old Releases

```bash
# Automatic: Keeps last 5 releases
# Manual cleanup:
ssh user@vps-host
cd /var/www/tzbot/releases
ls -t | tail -n +6 | xargs rm -rf
```

### Update Environment Variables

```bash
ssh user@vps-host
nano /var/www/tzbot/shared/.env
# Edit variables
# Save and exit

# Restart application
pm2 restart tzbot
```

## Secrets Management

### Required Secrets

Configure in GitHub Settings → Secrets:

- `VPS_SSH_KEY` - SSH private key
- `VPS_HOST` - VPS hostname
- `VPS_USER` - VPS username
- `DISCORD_WEBHOOK_URL` - Discord webhook
- `PAT_TOKEN` (optional) - GitHub PAT
- `CODECOV_TOKEN` (optional) - Codecov token

### Update Secrets

```bash
# Go to GitHub repository
# Settings → Secrets and variables → Actions
# Click on secret name
# Click "Update secret"
# Enter new value
# Click "Update secret"
```

## Branch Protection

### Recommended Settings

```bash
# Go to: Settings → Branches → Add rule
# Branch name pattern: development

# Enable:
☑ Require pull request reviews (1 approval)
☑ Require status checks to pass
  ☑ lint
  ☑ security
  ☑ test
  ☑ build
☑ Require branches to be up to date
☑ Require conversation resolution
☑ Do not allow bypassing the above settings
```

## Performance

### Workflow Durations

| Stage | Duration | Can Fail |
|-------|----------|----------|
| Lint & Type Check | 1-2 min | Yes |
| Security Scan | 1-2 min | Yes |
| Tests | 2-3 min | Yes |
| Build | 1-2 min | Yes |
| Prepare Release | 1 min | No |
| Auto-Promote | 1 min | No |
| Release Versioning | 2 min | No |
| Deployment | 3-5 min | Yes (with rollback) |

### Optimization Tips

```bash
# Use npm ci instead of npm install (faster, deterministic)
npm ci

# Cache dependencies (already configured in workflows)
# uses: actions/setup-node@v4
#   with:
#     cache: 'npm'

# Run tests in parallel (already configured)
# vitest runs tests in parallel by default
```

## Support

### Documentation

- [CI/CD Testing Checklist](./CICD_TESTING_CHECKLIST.md)
- [CI/CD Architecture](./CICD_ARCHITECTURE.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [VPS Monitoring](./VPS_MONITORING.md)

### Getting Help

1. Check workflow logs in GitHub Actions
2. Check Discord notifications
3. SSH to VPS and check PM2 logs
4. Review documentation
5. Open GitHub issue

---

**Quick Links:**
- [GitHub Actions](https://github.com/YOUR_REPO/actions)
- [Releases](https://github.com/YOUR_REPO/releases)
- [Deployments](https://github.com/YOUR_REPO/deployments)
