# CI/CD Testing Checklist

Complete end-to-end testing guide for the three-workflow CI/CD system.

## Prerequisites

Before testing, ensure you have:

- [ ] GitHub repository with `development` and `release` branches
- [ ] GitHub Secrets configured:
  - `VPS_SSH_KEY` - SSH private key for VPS access
  - `VPS_HOST` - VPS hostname (supports dynamic DNS)
  - `VPS_USER` - VPS username (e.g., `ubuntu`, `root`)
  - `DISCORD_WEBHOOK_URL` - Discord webhook for notifications
  - `PAT_TOKEN` (optional) - Personal Access Token for releases
  - `CODECOV_TOKEN` (optional) - Codecov token for coverage
- [ ] VPS setup completed (see `deployment/scripts/vps-setup.sh`)
- [ ] `.env` file in `/var/www/tzbot/shared/.env` on VPS

## Workflow 1: CI Development Pipeline

**File:** `.github/workflows/ci-development.yml`

**Triggers:** Push or PR to `development` branch

### Test 1.1: Lint Failure

**Purpose:** Verify pipeline fails on linting errors

```bash
# 1. Create a branch with lint errors
git checkout development
git checkout -b test/lint-failure

# 2. Add a file with lint errors
echo "const x = 'unused variable'" > src/test-lint.ts

# 3. Commit and push
git add src/test-lint.ts
git commit -m "test: add lint error"
git push origin test/lint-failure

# 4. Create PR to development
# Expected: Lint job fails, pipeline stops
```

**Expected Results:**
- ❌ Lint job fails
- ⏸️ Subsequent jobs skipped
- 🔔 Discord notification shows failure

**Cleanup:**
```bash
git checkout development
git branch -D test/lint-failure
git push origin --delete test/lint-failure
```

---

### Test 1.2: Security Scan Failure

**Purpose:** Verify pipeline fails on critical vulnerabilities

```bash
# 1. Create a branch with vulnerable dependency
git checkout development
git checkout -b test/security-failure

# 2. Add a vulnerable package (example)
npm install lodash@4.17.0  # Known vulnerable version

# 3. Commit and push
git add package.json package-lock.json
git commit -m "test: add vulnerable dependency"
git push origin test/security-failure

# 4. Create PR to development
# Expected: Security scan fails
```

**Expected Results:**
- ❌ Security job fails on high/critical vulnerabilities
- ⏸️ Subsequent jobs skipped
- 🔔 Discord notification shows failure

**Cleanup:**
```bash
npm install lodash@latest  # Fix vulnerability
git checkout development
git branch -D test/security-failure
```

---

### Test 1.3: Test Failure

**Purpose:** Verify pipeline fails on test failures

```bash
# 1. Create a branch with failing test
git checkout development
git checkout -b test/test-failure

# 2. Add a failing test
cat > tests/unit/test-failure.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';

describe('Test Failure', () => {
  it('should fail', () => {
    expect(true).toBe(false);
  });
});
EOF

# 3. Commit and push
git add tests/unit/test-failure.test.ts
git commit -m "test: add failing test"
git push origin test/test-failure

# 4. Create PR to development
# Expected: Test job fails
```

**Expected Results:**
- ❌ Test job fails
- ⏸️ Subsequent jobs skipped
- 🔔 Discord notification shows failure

**Cleanup:**
```bash
rm tests/unit/test-failure.test.ts
git checkout development
git branch -D test/test-failure
```

---

### Test 1.4: Successful CI Pipeline

**Purpose:** Verify complete CI pipeline with auto-promotion

```bash
# 1. Create a feature branch
git checkout development
git checkout -b feature/test-ci-success

# 2. Make a valid change
echo "// Test change" >> src/index.ts

# 3. Commit and push
git add src/index.ts
git commit -m "feat: test CI pipeline"
git push origin feature/test-ci-success

# 4. Create and merge PR to development
# 5. Push to development triggers full pipeline
git checkout development
git pull origin development
```

**Expected Results:**
- ✅ Lint job passes
- ✅ Security job passes
- ✅ Test job passes
- ✅ Build job passes
- ✅ Prepare release job creates clean build
- ✅ Auto-promote job pushes to release branch
- 🔔 Discord notifications for success and promotion
- 📦 Artifact uploaded: `production-clean-build-<sha>`

**Verification:**
```bash
# Check release branch has clean build
git checkout release
git pull origin release

# Verify no dev artifacts
[ ! -d "tests/" ] && echo "✅ No tests/ directory"
[ ! -f "vitest.config.ts" ] && echo "✅ No vitest config"
[ ! -f "eslint.config.js" ] && echo "✅ No eslint config"
find . -name "*.test.*" | wc -l  # Should be 0
```

---

## Workflow 2: Release Versioning

**File:** `.github/workflows/release-versioning.yml`

**Triggers:** Push to `release` branch

### Test 2.1: First Release (No Previous Tags)

**Purpose:** Verify first release creation

```bash
# 1. Ensure no tags exist (or delete all tags for testing)
git tag -l  # List tags
# git tag -d $(git tag -l)  # Delete all local tags (careful!)
# git push origin --delete $(git tag -l)  # Delete remote tags (careful!)

# 2. Push to release branch (should be done by CI)
git checkout release
git pull origin release

# 3. Workflow triggers automatically
# Expected: Creates v1.0.0 (or bumps from package.json version)
```

**Expected Results:**
- ✅ Validation passes
- ✅ Version bumped (patch by default)
- ✅ Git tag created (e.g., `v1.0.0`)
- ✅ GitHub Release created with changelog
- 🔔 Discord notification with release details

---

### Test 2.2: Patch Release

**Purpose:** Verify patch version bump

```bash
# 1. Make a fix commit on development
git checkout development
echo "// Bug fix" >> src/index.ts
git add src/index.ts
git commit -m "fix: resolve critical bug"
git push origin development

# 2. Wait for CI to promote to release
# 3. Release workflow triggers automatically
# Expected: Version bumps from v1.0.0 to v1.0.1
```

**Expected Results:**
- ✅ Detects "fix:" commit
- ✅ Bumps patch version (v1.0.0 → v1.0.1)
- ✅ Creates tag and release
- 🔔 Discord notification

---

### Test 2.3: Minor Release (Feature)

**Purpose:** Verify minor version bump

```bash
# 1. Make a feature commit on development
git checkout development
echo "// New feature" >> src/index.ts
git add src/index.ts
git commit -m "feat: add new feature"
git push origin development

# 2. Wait for CI to promote to release
# Expected: Version bumps from v1.0.1 to v1.1.0
```

**Expected Results:**
- ✅ Detects "feat:" commit
- ✅ Bumps minor version (v1.0.1 → v1.1.0)
- ✅ Creates tag and release
- 🔔 Discord notification

---

### Test 2.4: Major Release (Breaking Change)

**Purpose:** Verify major version bump

```bash
# 1. Make a breaking change commit on development
git checkout development
echo "// Breaking change" >> src/index.ts
git add src/index.ts
git commit -m "feat!: breaking API change"
git push origin development

# 2. Wait for CI to promote to release
# Expected: Version bumps from v1.1.0 to v2.0.0
```

**Expected Results:**
- ✅ Detects "feat!" or "BREAKING CHANGE:" commit
- ✅ Bumps major version (v1.1.0 → v2.0.0)
- ✅ Creates tag and release
- 🔔 Discord notification with breaking change warning

---

### Test 2.5: Skip Release (No Changes)

**Purpose:** Verify release skipped when no new commits

```bash
# 1. Manually trigger release workflow
# Go to Actions → Release Versioning → Run workflow

# Expected: Workflow detects no new commits and skips release
```

**Expected Results:**
- ℹ️ "Skip Release (No Changes)" job runs
- ⏸️ No version bump
- ⏸️ No tag created

---

## Workflow 3: CD Production Deployment

**File:** `.github/workflows/cd-production.yml`

**Triggers:** Push to `release` branch or tag `v*`

### Test 3.1: Successful Deployment

**Purpose:** Verify complete deployment to VPS

```bash
# 1. Ensure release branch has latest changes
git checkout release
git pull origin release

# 2. Workflow triggers automatically after release versioning
# Or manually trigger: Actions → CD Production → Run workflow

# Expected: Deploys to VPS successfully
```

**Expected Results:**
- ✅ Validation passes
- ✅ Deployment record created
- ✅ SSH connection established
- ✅ Package uploaded to VPS
- ✅ Deployment script executed
- ✅ Monitoring installed/updated
- ✅ Health checks pass
- 🔔 Discord notification: "Deployment Successful"

**Verification on VPS:**
```bash
# SSH to VPS
ssh user@vps-host

# Check PM2 status
pm2 list
pm2 logs tzbot --lines 50

# Check current release
ls -la /var/www/tzbot/current
cat /var/www/tzbot/current/package.json | grep version

# Check releases
ls -lt /var/www/tzbot/releases/

# Check monitoring
crontab -l | grep vps-monitor
```

---

### Test 3.2: Health Check Failure & Rollback

**Purpose:** Verify automatic rollback on health check failure

```bash
# 1. Introduce a bug that causes crash on startup
git checkout development
git checkout -b test/crash-on-startup

# 2. Add code that crashes immediately
cat > src/crash-test.ts << 'EOF'
// This will crash the app
throw new Error('Intentional crash for testing rollback');
EOF

# 3. Import in main file
echo "import './crash-test';" >> src/index.ts

# 4. Commit and push
git add src/crash-test.ts src/index.ts
git commit -m "test: add crash for rollback testing"
git push origin test/crash-on-startup

# 5. Merge to development, wait for promotion to release
# Expected: Deployment fails, automatic rollback occurs
```

**Expected Results:**
- ✅ Deployment executes
- ❌ Health check fails (process crashes)
- 🔄 Automatic rollback triggered
- ✅ Previous release restored
- 🔔 Discord notifications: "Deployment Failed" + "Automatic Rollback"

**Verification on VPS:**
```bash
# Check PM2 status (should be running previous version)
pm2 list

# Check current symlink points to previous release
ls -la /var/www/tzbot/current
```

**Cleanup:**
```bash
# Remove crash code
git checkout development
git revert HEAD
git push origin development
```

---

### Test 3.3: SSH Connection Failure

**Purpose:** Verify proper error handling on SSH failure

```bash
# 1. Temporarily change VPS_HOST secret to invalid hostname
# Go to Settings → Secrets → VPS_HOST → Update to "invalid-host.example.com"

# 2. Trigger deployment
# Expected: Deployment fails with clear error message
```

**Expected Results:**
- ❌ SSH setup fails
- ❌ Deployment stops
- 🔔 Discord notification: "Deployment Failed"
- 📋 Logs show DNS resolution failure

**Cleanup:**
```bash
# Restore correct VPS_HOST secret
```

---

### Test 3.4: Manual Rollback

**Purpose:** Verify manual rollback capability

```bash
# 1. SSH to VPS
ssh user@vps-host

# 2. List available releases
ls -lt /var/www/tzbot/releases/

# 3. Rollback to previous release
cd /var/www/tzbot
bash deployment/scripts/rollback.sh

# 4. Verify rollback
pm2 list
cat current/package.json | grep version
```

**Expected Results:**
- ✅ Rollback script executes
- ✅ Symlink updated to previous release
- ✅ PM2 reloaded
- ✅ Application running previous version

---

## End-to-End Test: Complete Flow

**Purpose:** Test entire flow from development to production

```bash
# 1. Create feature branch
git checkout development
git checkout -b feature/e2e-test

# 2. Make changes
echo "// E2E test feature" >> src/index.ts

# 3. Commit with conventional commit
git add src/index.ts
git commit -m "feat: add E2E test feature"

# 4. Push and create PR
git push origin feature/e2e-test
# Create PR to development on GitHub

# 5. Merge PR
# Expected: CI pipeline runs

# 6. Wait for auto-promotion to release
# Expected: Release versioning runs

# 7. Wait for deployment
# Expected: CD pipeline deploys to VPS

# 8. Verify on VPS
ssh user@vps-host
pm2 logs tzbot --lines 20
```

**Expected Timeline:**
1. PR merged → CI pipeline (5-10 min)
2. Auto-promote → Release branch updated (1 min)
3. Release versioning → Tag created (2 min)
4. CD deployment → VPS updated (3-5 min)

**Total:** ~10-15 minutes from merge to production

---

## Monitoring & Alerts

### Discord Notifications

Verify you receive Discord notifications for:

- ✅ CI pipeline success/failure
- ✅ Promotion to release
- ✅ New release created
- ✅ Deployment success/failure
- ✅ Automatic rollback

### VPS Monitoring

Verify VPS monitoring is working:

```bash
# Check monitoring script
ls -la /usr/local/bin/tzbot-webhook-alert.sh

# Check cron job
crontab -l | grep vps-monitor

# Check monitoring logs
tail -f /var/log/tzbot-monitor.log

# Manually trigger monitoring
/var/www/tzbot/deployment/scripts/vps-monitor.sh
```

---

## Troubleshooting

### CI Pipeline Issues

**Problem:** Lint job fails unexpectedly
```bash
# Run locally
npm run lint
npm run typecheck
```

**Problem:** Tests fail in CI but pass locally
```bash
# Run tests in CI mode
npm run test:unit
npm run test:coverage
```

**Problem:** Security scan fails
```bash
# Check vulnerabilities
npm audit
npm audit --production
```

### Release Issues

**Problem:** Version not bumping
```bash
# Check commit messages follow conventional commits
git log --oneline -10

# Manually trigger release workflow
# Actions → Release Versioning → Run workflow
```

**Problem:** Tag already exists
```bash
# List tags
git tag -l

# Delete duplicate tag (if needed)
git tag -d v1.0.0
git push origin --delete v1.0.0
```

### Deployment Issues

**Problem:** SSH connection fails
```bash
# Test SSH locally
ssh -i ~/.ssh/deploy_key user@vps-host

# Check DNS resolution
dig vps-host
nslookup vps-host
```

**Problem:** Health check fails
```bash
# SSH to VPS and check manually
ssh user@vps-host
pm2 list
pm2 logs tzbot --lines 50
pm2 describe tzbot
```

**Problem:** Deployment package too large
```bash
# Check package size
du -sh deployment-package.tar.gz

# Verify node_modules excluded
tar -tzf deployment-package.tar.gz | grep node_modules
```

---

## Success Criteria

All tests pass when:

- ✅ CI pipeline catches lint, security, and test failures
- ✅ Clean builds are created without dev artifacts
- ✅ Auto-promotion to release works
- ✅ Semantic versioning works correctly
- ✅ Deployments succeed with health checks
- ✅ Automatic rollback works on failure
- ✅ Discord notifications are sent
- ✅ VPS monitoring is installed and working
- ✅ Manual rollback capability works

---

## Next Steps

After successful testing:

1. Document any issues found
2. Update secrets if needed
3. Configure branch protection rules
4. Set up monitoring dashboards
5. Train team on workflow usage
6. Create runbooks for common scenarios

---

## Support

For issues:
- Check workflow logs in GitHub Actions
- Review [CI/CD Architecture](./CICD_ARCHITECTURE.md)
- See [Troubleshooting Guide](./TROUBLESHOOTING.md)
- Check [VPS Monitoring Guide](./VPS_MONITORING.md)
