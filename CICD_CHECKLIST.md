# CI/CD Quick Checklist

## Current Status: ✅ Production Ready (with improvements needed)

---

## ✅ What's Working Well

- [x] Comprehensive CI pipeline with lint, test, build, security scan
- [x] Automatic promotion from Development to release branch
- [x] Semantic versioning with conventional commits
- [x] Automatic deployment to production on release branch push
- [x] Discord notifications at each stage
- [x] Rollback capability for failed deployments
- [x] SSH key validation and security
- [x] Timestamped releases for easy rollback
- [x] Retry mechanisms for network operations
- [x] Proper secrets management

---

## 🔴 Critical Issues (Fix Before Next Release)

- [ ] **Database migrations are manual** - Need automation
- [ ] **Health checks don't verify Discord connection** - Bot might deploy without connecting
- [ ] **No database backup before deployment** - Can't rollback database changes
- [ ] **Health check timeout too short** (60s) - Discord connection needs more time

**Impact**: Deployments might succeed but bot might not work properly

---

## 🟡 High Priority Issues (Fix Soon)

- [ ] **No smoke tests** - Don't verify bot actually works after deployment
- [ ] **No deployment metrics** - Can't track success rate or duration
- [ ] **Rollback doesn't revert database** - Code/database version mismatch possible
- [ ] **Property-based tests failures ignored** - Quality gate not comprehensive

**Impact**: Harder to detect and diagnose issues

---

## 🟢 Medium Priority Improvements

- [ ] **No Docker containerization** - Builds could be faster and more consistent
- [ ] **No monitoring integration** - Limited visibility into production
- [ ] **Missing documentation** - No runbook or incident response plan
- [ ] **No old release cleanup** - Disk space will fill up over time

**Impact**: Operational efficiency and maintainability

---

## Quick Fixes (< 1 hour each)

### 1. Increase Health Check Timeout
```bash
# In deployment/scripts/health-check.sh
MAX_WAIT_TIME=180  # Change from 60 to 180
```

### 2. Make Property Tests Mandatory
```yaml
# In .github/workflows/ci.yml
- name: Run property-based tests
  run: npm run test:property
  # Remove: continue-on-error: true
```

### 3. Add Disk Space Check
```bash
# In deployment/scripts/deploy.sh
AVAILABLE_SPACE=$(df -BG /var/www | tail -1 | awk '{print $4}' | sed 's/G//')
if [ "$AVAILABLE_SPACE" -lt 5 ]; then
    log_error "Insufficient disk space: ${AVAILABLE_SPACE}GB available"
    exit 1
fi
```

---

## Before Next Deployment

### Pre-Deployment Checklist
- [ ] All CI checks passed
- [ ] Semantic version bumped correctly
- [ ] CHANGELOG.md updated
- [ ] Database migrations tested locally
- [ ] Environment variables verified
- [ ] Discord webhook URL working
- [ ] VPS SSH access confirmed
- [ ] Backup of current production state

### During Deployment
- [ ] Monitor GitHub Actions logs
- [ ] Watch Discord notifications
- [ ] Check VPS logs: `pm2 logs tzbot`
- [ ] Verify bot online in Discord
- [ ] Test critical commands

### Post-Deployment
- [ ] Health checks passed
- [ ] Bot responding to commands
- [ ] Database queries working
- [ ] No errors in logs
- [ ] Monitor for 30 minutes
- [ ] Update deployment log

---

## Emergency Procedures

### If Deployment Fails
1. Check GitHub Actions logs for error
2. Check VPS logs: `ssh user@vps "pm2 logs tzbot --err"`
3. Automatic rollback should trigger
4. If not, manual rollback: `bash deployment/scripts/rollback.sh previous`

### If Bot Not Responding
1. Check if process running: `pm2 list`
2. Check logs: `pm2 logs tzbot`
3. Verify environment variables: `cat /var/www/tzbot/current/.env`
4. Test Discord token: Check token validity
5. Restart: `pm2 restart tzbot`

### If Database Issues
1. Check connection: `psql $DATABASE_URL -c "SELECT 1"`
2. Check migrations: `npm run migrate`
3. Check logs for SQL errors
4. Verify DATABASE_URL secret is correct

---

## Workflow Triggers

### CI Pipeline (`ci.yml`)
- **Triggers**: Push or PR to `Development` or `release`
- **Duration**: 5-8 minutes
- **Auto-promotes**: Yes (if on Development and all tests pass)

### Promotion (`promote.yml`)
- **Triggers**: Workflow dispatch from CI
- **Duration**: 2-3 minutes
- **Auto-deploys**: Yes (triggers CD after success)

### Deployment (`cd-release.yml`)
- **Triggers**: Push to `release` or manual dispatch
- **Duration**: 3-5 minutes
- **Auto-rollback**: Yes (if health checks fail)

---

## Key Files Reference

### Workflows
- `.github/workflows/ci.yml` - CI pipeline
- `.github/workflows/promote.yml` - Branch promotion
- `.github/workflows/cd-release.yml` - Deployment

### Scripts
- `deployment/scripts/deploy.sh` - Main deployment
- `deployment/scripts/health-check.sh` - Health verification
- `deployment/scripts/rollback.sh` - Rollback procedure
- `deployment/scripts/service-manager.sh` - PM2 management

### Configuration
- `.releaserc.json` - Semantic release config
- `package.json` - Version and scripts
- `.env.example` - Environment template

### Documentation
- `docs/CICD_REVIEW.md` - Comprehensive review
- `docs/CICD_ACTION_PLAN.md` - Improvement plan
- `docs/DEPLOYMENT.md` - Deployment guide
- `.github/BRANCHING_STRATEGY.md` - Git workflow

---

## Secrets Required

### GitHub Secrets
- `DISCORD_TOKEN` - Bot token
- `DISCORD_CLIENT_ID` - Application ID
- `DISCORD_GUILD_ID` - Server ID
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection (optional)
- `VPS_HOSTNAME` - VPS domain/IP
- `VPS_USER` - SSH username
- `VPS_SSH_KEY` - SSH private key
- `DISCORD_WEBHOOK_URL` - Deployment notifications
- `MODERATOR_ROLE_ID` - Moderator role
- `NOTIFICATION_CHANNEL_ID` - Bot notifications
- `FALLBACK_CHANNEL_ID` - Fallback channel
- `PAT_TOKEN` - GitHub Personal Access Token (for workflow dispatch)

---

## Monitoring Commands

### Check Deployment Status
```bash
# GitHub Actions
gh run list --workflow=cd-release.yml --limit 5

# VPS Status
ssh user@vps "pm2 status"

# Recent Logs
ssh user@vps "pm2 logs tzbot --lines 50"
```

### Check Release History
```bash
# List releases
ssh user@vps "ls -lt /var/www/tzbot/releases | head -10"

# Current release
ssh user@vps "readlink /var/www/tzbot/current"
```

### Check Disk Space
```bash
ssh user@vps "df -h /var/www"
```

---

## Support Contacts

- **CI/CD Issues**: Check GitHub Actions logs
- **Deployment Issues**: Check VPS logs and Discord notifications
- **Bot Issues**: Check PM2 logs and Discord status
- **Database Issues**: Check PostgreSQL logs

---

## Next Review Date

**Scheduled**: 2026-03-22 (1 month from now)

**Review Items**:
- Deployment success rate
- Average deployment time
- Number of rollbacks
- Issues encountered
- Improvements implemented

---

**Last Updated**: 2026-02-22  
**Status**: Active  
**Version**: 1.0
