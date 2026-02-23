# CI/CD Quick Reference

## 🚀 Quick Start

### For Developers

```bash
# 1. Create feature branch
git checkout development
git pull origin development
git checkout -b feature/my-feature

# 2. Make changes and test
npm run lint
npm run test:unit
npm run build

# 3. Commit with conventional format
git commit -m "feat: add new feature"

# 4. Push to development
git push origin feature/my-feature

# 5. Create PR to development
# → CI runs automatically
# → After merge: auto-promotes to release
# → Auto-deploys to VPS
```

---

## 📊 Pipeline Overview

```
development → CI → Clean Build → release → Versioning → CD → VPS
   (push)    (test)  (remove dev)  (auto)   (tag+release) (deploy)
```

**Total Time:** ~10-15 minutes from push to production

---

## 🔄 Workflows

### 1. CI Workflow (Development)
**Trigger:** Push/PR to `development`  
**Duration:** 5-10 minutes  
**File:** `.github/workflows/ci-development.yml`

**Stages:**
1. ✅ Lint & Type Check
2. ✅ Security Scan (npm audit)
3. ✅ Tests (unit + property-based)
4. ✅ Build Verification
5. ✅ Prepare Clean Build (remove dev files)
6. ✅ Auto-Promote to Release

**Output:** Clean production code in `release` branch

---

### 2. Release Workflow (Versioning)
**Trigger:** Push to `release`  
**Duration:** 1-2 minutes  
**File:** `.github/workflows/release-versioning.yml`

**Stages:**
1. ✅ Validate Release Branch
2. ✅ Semantic Version Bump
3. ✅ Create Git Tag
4. ✅ Create GitHub Release

**Output:** Git tag (v1.2.3) + GitHub Release

---

### 3. CD Workflow (Deployment)
**Trigger:** Push to `release` or new release  
**Duration:** 2-3 minutes  
**File:** `.github/workflows/cd-production.yml`

**Stages:**
1. ✅ Validate Deployment
2. ✅ Prepare Deployment
3. ✅ Deploy to VPS
4. ✅ Health Checks
5. ✅ Success or Rollback

**Output:** Live application on VPS

---

## 📝 Commit Message Format

### Conventional Commits

```
<type>(<scope>): <description>
```

### Types & Version Bumps

| Type | Description | Version Bump | Example |
|------|-------------|--------------|---------|
| `feat:` | New feature | Minor (1.0.0 → 1.1.0) | `feat: add user auth` |
| `fix:` | Bug fix | Patch (1.0.0 → 1.0.1) | `fix: resolve timeout` |
| `perf:` | Performance | Patch (1.0.0 → 1.0.1) | `perf: optimize queries` |
| `refactor:` | Refactoring | Patch (1.0.0 → 1.0.1) | `refactor: clean code` |
| `feat!:` | Breaking change | Major (1.0.0 → 2.0.0) | `feat!: redesign API` |
| `docs:` | Documentation | None | `docs: update guide` |
| `chore:` | Maintenance | None | `chore: update deps` |
| `test:` | Tests | None | `test: add unit tests` |

### Examples

```bash
# Minor version bump (new feature)
git commit -m "feat: add Discord slash commands"
git commit -m "feat(auth): implement OAuth login"

# Patch version bump (bug fix)
git commit -m "fix: resolve database connection timeout"
git commit -m "fix(api): handle null responses"

# Major version bump (breaking change)
git commit -m "feat!: redesign API endpoints"
git commit -m "BREAKING CHANGE: remove legacy endpoints"

# No version bump
git commit -m "docs: update deployment guide"
git commit -m "chore: update dependencies"
```

---

## 🌿 Branch Strategy

### Development Branch
- **Purpose:** Active development
- **Contains:** Source code, tests, dev configs
- **Push:** Triggers CI pipeline
- **Protection:** Require PR reviews (recommended)

### Release Branch
- **Purpose:** Production-ready code only
- **Contains:** Built code, no dev files
- **Push:** Triggers versioning + deployment
- **Protection:** No direct pushes (CI only)

---

## 🔐 Required Secrets

### VPS Connection
```
VPS_HOSTNAME
VPS_USER
VPS_SSH_KEY
```

### Discord
```
DISCORD_TOKEN
DISCORD_CLIENT_ID
DISCORD_GUILD_ID
DISCORD_WEBHOOK_URL
SUBSCRIBER_ROLE_ID
VIP_ROLE_ID
MODERATOR_ROLE_ID
NOTIFICATION_CHANNEL_ID
FALLBACK_CHANNEL_ID
PRIVATE_ANNOUNCEMENT_CHANNEL_ID
PUBLIC_ANNOUNCEMENT_CHANNEL_IDS
```

### Database & Cache
```
DATABASE_URL
REDIS_URL
REDIS_PASSWORD (optional)
```

### CI/CD
```
PAT_TOKEN (repo + workflow scopes)
CODECOV_TOKEN (optional)
```

---

## 🔄 Rollback

### Automatic Rollback
- **Trigger:** Health checks fail after deployment
- **Action:** Restores previous version automatically
- **Time:** ~40 seconds
- **Notification:** Discord alert sent

### Manual Rollback

```bash
# SSH into VPS
ssh user@vps-hostname

# Rollback to previous version
cd /var/www/tzbot
export APP_NAME=tzbot
export DEPLOY_BASE=/var/www/tzbot
export SERVICE_NAME=tzbot
bash deployment/scripts/rollback.sh previous

# Rollback to specific commit
bash deployment/scripts/rollback.sh abc1234

# Verify
pm2 status
pm2 logs tzbot --lines 50
```

---

## 🐛 Troubleshooting

### CI Pipeline Fails

**Tests failing:**
```bash
npm run test:unit
# Fix issues and push again
```

**Security scan failing:**
```bash
npm audit
npm audit fix
# Push updated package-lock.json
```

**Build failing:**
```bash
npm run build
npx tsc --noEmit
# Fix TypeScript errors
```

---

### Deployment Fails

**SSH connection failed:**
1. Check `VPS_HOSTNAME` secret
2. Check `VPS_SSH_KEY` includes full key with headers
3. Test manually: `ssh -i key user@host`

**Health checks failing:**
```bash
ssh user@vps
pm2 logs tzbot --err
tail -f /var/www/tzbot/current/logs/tzbot.log
# Fix issues and re-deploy
```

**Environment variables missing:**
1. Check all secrets are set in GitHub
2. Verify: `cat /var/www/tzbot/shared/.env`
3. Re-run deployment

---

### Bot Offline

```bash
# SSH into VPS
ssh user@vps

# Check PM2 status
pm2 status

# Check logs
pm2 logs tzbot --lines 50

# Restart if needed
pm2 restart tzbot

# Check .env exists
cat /var/www/tzbot/shared/.env

# Check database connectivity
psql $DATABASE_URL -c "SELECT 1"
```

---

## 📊 Monitoring

### GitHub Actions
- Go to **Actions** tab
- Monitor workflow progress
- Check logs for failures

### Discord Notifications
- 🚀 Deployment starting
- ✅ Deployment successful
- ❌ Deployment failed (with rollback)
- 🎉 New release created

### VPS Status
```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs tzbot

# View recent logs
pm2 logs tzbot --lines 100

# Monitor in real-time
pm2 logs tzbot --lines 0
```

---

## ⚡ Common Commands

### Local Development
```bash
# Install dependencies
npm install

# Run linter
npm run lint

# Fix lint issues
npm run lint:fix

# Run tests
npm run test:unit

# Run all tests
npm test

# Build
npm run build

# Type check
npm run typecheck

# Run locally
npm run dev
```

### Git Operations
```bash
# Update development
git checkout development
git pull origin development

# Create feature branch
git checkout -b feature/my-feature

# Commit with conventional format
git commit -m "feat: add feature"

# Push
git push origin feature/my-feature

# View commit history
git log --oneline --graph

# View tags
git tag -l
```

### VPS Operations
```bash
# SSH into VPS
ssh user@vps-hostname

# Check PM2 status
pm2 status

# View logs
pm2 logs tzbot

# Restart bot
pm2 restart tzbot

# Stop bot
pm2 stop tzbot

# Start bot
pm2 start tzbot

# View releases
ls -la /var/www/tzbot/releases/

# Check current release
ls -la /var/www/tzbot/current

# View environment
cat /var/www/tzbot/shared/.env
```

---

## 📈 Success Metrics

### CI Pipeline
- ✅ All tests pass
- ✅ No security vulnerabilities
- ✅ Build successful
- ✅ Clean build created
- ✅ Auto-promoted to release

### Deployment
- ✅ SSH connection successful
- ✅ Deployment script completed
- ✅ PM2 process running
- ✅ Health checks passed
- ✅ Discord notification sent

### Application
- ✅ Bot online in Discord
- ✅ Commands responding
- ✅ No errors in logs
- ✅ Database connected
- ✅ Redis connected

---

## 🆘 Emergency Procedures

### Stop All Deployments
1. Go to GitHub Actions
2. Click on running workflow
3. Click "Cancel workflow"

### Emergency Rollback
```bash
ssh user@vps
cd /var/www/tzbot
bash deployment/scripts/rollback.sh previous
```

### Emergency Bot Restart
```bash
ssh user@vps
pm2 restart tzbot
```

### Check System Health
```bash
ssh user@vps
pm2 status
pm2 logs tzbot --err --lines 50
df -h  # Check disk space
free -h  # Check memory
top  # Check CPU usage
```

---

## 📚 Documentation

- **Complete Guide:** `docs/CICD_COMPLETE_GUIDE.md`
- **Quick Reference:** `docs/CICD_QUICK_REFERENCE.md` (this file)
- **Deployment Guide:** `docs/DEPLOYMENT.md`
- **Troubleshooting:** `docs/TROUBLESHOOTING.md`

---

## 🎯 Key Takeaways

1. **Push to `development`** → Everything else is automatic
2. **Use conventional commits** → Automatic versioning
3. **CI validates everything** → Only clean code reaches production
4. **Automatic rollback** → Failed deployments revert automatically
5. **Discord notifications** → Stay informed of all deployments
6. **Zero manual steps** → Fully automated pipeline

---

**Last Updated:** 2024  
**Version:** 1.0.0
