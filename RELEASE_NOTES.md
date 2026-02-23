# Release Notes & CI/CD Documentation

## Branch Strategy

### Development Branch (`development`)
- **Purpose**: Active development and feature integration
- **Contains**: Source code, tests, dev configs, documentation
- **CI Triggers**: Every push and pull request
- **Quality Gates**: Lint, type check, security scan, tests must all pass
- **Promotion**: Auto-promotes to `release` branch only if all checks pass

### Release Branch (`release`)
- **Purpose**: Production-ready code ONLY
- **Contains**: Clean production build with zero dev artifacts
- **Restrictions**: 
  - No test files (*.test.*, *.spec.*)
  - No test configs (vitest.config.*, eslint.config.js)
  - No dev directories (tests/, .kiro/, coverage/)
  - No -dev version suffix
  - No .git, .github directories
- **CD Triggers**: Every push creates version tag and deploys to VPS
- **Versioning**: Automatic semantic versioning based on conventional commits

## Promotion Process

### Automated Promotion Flow

```
Development Push
    ↓
CI Pipeline (5-8 min)
    ├─ Lint & Type Check ✓
    ├─ Security Scan ✓
    ├─ Unit Tests ✓
    └─ Build Verification ✓
    ↓
Clean Production Build
    ├─ Remove ALL dev/test files
    ├─ Remove dev configs
    ├─ Remove documentation
    ├─ Verify production readiness
    └─ Upload artifact
    ↓
Auto-Promote to Release (with approval)
    ├─ Download clean artifact
    ├─ Replace release branch content
    ├─ Check for untracked dev files
    ├─ Clean version (remove -dev suffix)
    └─ Push to release branch
```

### Promotion Safety Mechanisms

1. **Quality Gates**: All tests, lint, and security scans must pass
2. **Clean Build**: Automated removal of all dev artifacts
3. **Untracked File Check**: Fails if any dev/test files remain
4. **Environment Approval**: Requires `release-promotion` environment approval
5. **Artifact-Based**: Uses upload/download artifacts (no direct file manipulation)
6. **Version Cleaning**: Automatically strips -dev suffix

### Manual Promotion Override

If automatic promotion fails, you can manually promote:

```bash
# 1. Ensure development branch is clean
git checkout development
git pull origin development

# 2. Run CI checks locally
npm run lint
npm run test:unit
npm audit --production

# 3. Build clean production artifact
npm run build

# 4. Manually promote (use with caution)
git checkout release
git merge development --no-ff -m "chore: manual promotion"
git push origin release
```

## Versioning Behavior

### Semantic Versioning Rules

The system uses **conventional commits** to determine version bumps:

| Commit Pattern | Version Bump | Example |
|----------------|--------------|---------|
| `feat!:` or `BREAKING CHANGE:` | **Major** | 1.0.0 → 2.0.0 |
| `feat:` or `feature:` | **Minor** | 1.0.0 → 1.1.0 |
| `fix:`, `perf:`, `refactor:` | **Patch** | 1.0.0 → 1.0.1 |
| Other commits | **Patch** (default) | 1.0.0 → 1.0.1 |

### Conventional Commit Examples

```bash
# Patch version bump
git commit -m "fix: resolve memory leak in cache"

# Minor version bump
git commit -m "feat: add new moderation command"

# Major version bump (breaking change)
git commit -m "feat!: redesign API endpoints"
# or
git commit -m "feat: redesign API

BREAKING CHANGE: API endpoints have changed"
```

### Version Tag Creation

1. **Automatic Analysis**: Analyzes commits since last tag
2. **Duplicate Prevention**: Checks if tag already exists before creating
3. **Tag Guard**: Uses conditional logic to skip if tag exists
4. **Git Tag**: Creates annotated tag with metadata
5. **GitHub Release**: Creates release with categorized changelog

### Changelog Generation

Automatically categorizes commits into:
- ⚠️ **BREAKING CHANGES**: Breaking changes
- ✨ **Features**: New features
- 🐛 **Bug Fixes**: Bug fixes
- 📝 **Other Changes**: Other improvements

## Deploy Directory & Symlink Strategy

### Directory Structure on VPS

```
/var/www/tzbot/
├── current → releases/v1.2.3/          # Symlink to active release
├── releases/
│   ├── v1.2.3/                         # Current release
│   ├── v1.2.2/                         # Previous release (for rollback)
│   ├── v1.2.1/                         # Older release
│   ├── v1.2.0/                         # Older release
│   └── v1.1.9/                         # Older release
├── shared/
│   └── .env                            # Shared environment file
└── logs/                               # Application logs
```

### Deployment Process

1. **Create Versioned Directory**: `/var/www/tzbot/releases/v1.2.3`
2. **Copy Files**: rsync files to versioned directory
3. **Install Dependencies**: `npm ci --production`
4. **Build Application**: `npm run build`
5. **Link Shared .env**: Symlink to shared environment file
6. **Atomic Symlink Switch**: 
   ```bash
   ln -sfn /var/www/tzbot/releases/v1.2.3 /var/www/tzbot/current.tmp
   mv -Tf /var/www/tzbot/current.tmp /var/www/tzbot/current
   ```
7. **Restart PM2**: `pm2 startOrReload ecosystem.config.cjs`
8. **Health Checks**: Verify application is running
9. **Prune Old Releases**: Keep last 5 releases, delete older

### Zero-Downtime Mechanism

- **Atomic Symlink**: Uses `ln -sfn` + `mv -Tf` for atomic operation
- **No Downtime**: Old version runs until new version is ready
- **Instant Switch**: Symlink switch is instantaneous
- **PM2 Reload**: Graceful restart without dropping connections

### Release Retention

- **Keep Last 5**: Automatically keeps last 5 releases
- **Automatic Pruning**: Deletes older releases after successful deployment
- **Rollback Ready**: Previous releases available for instant rollback

## Rollback Procedure

### Automatic Rollback

Automatic rollback triggers on:
- Deployment script failure
- Health check failure (after 3 retries with exponential backoff)
- SSH connection timeout
- Any job failure in deploy-to-vps

**Rollback Process**:
1. Detect failure
2. Stop PM2 service
3. Find previous release directory
4. Switch symlink to previous release
5. Start PM2 service
6. Send failure notification

### Manual Rollback

If you need to manually rollback:

```bash
# SSH to VPS
ssh deploy@your-vps.example.com

# List available releases
ls -lt /var/www/tzbot/releases/

# Rollback to specific version
cd /var/www/tzbot
sudo ln -sfn /var/www/tzbot/releases/v1.2.2 /var/www/tzbot/current.tmp
sudo mv -Tf /var/www/tzbot/current.tmp /var/www/tzbot/current

# Restart PM2
cd /var/www/tzbot/current
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

# Verify
pm2 status tzbot
pm2 logs tzbot --lines 50
```

### Rollback Verification

After rollback:
1. **Check PM2 Status**: `pm2 status tzbot`
2. **Check Logs**: `pm2 logs tzbot --lines 50`
3. **Verify Discord Bot**: Check bot is online in Discord
4. **Test Commands**: Test slash commands
5. **Monitor Errors**: Watch error logs for issues

### Rollback to Specific Version

```bash
# List all available releases
ls -lt /var/www/tzbot/releases/

# Rollback to specific version
cd /var/www/tzbot
sudo ln -sfn /var/www/tzbot/releases/v1.1.9 /var/www/tzbot/current.tmp
sudo mv -Tf /var/www/tzbot/current.tmp /var/www/tzbot/current
cd /var/www/tzbot/current
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
```

## Deployment Lock Mechanism

### Purpose
Prevents concurrent deployments that could cause race conditions and inconsistent state.

### Implementation

**Lock File**: `/var/lock/tzbot_deploy.lock`

**Lock Acquisition**:
1. Check if lock file exists
2. If exists and age < 30 minutes: Fail deployment
3. If exists and age >= 30 minutes: Remove stale lock
4. Create new lock file with run ID
5. Proceed with deployment

**Lock Release**:
- Always released in `if: always()` step
- Released on success or failure
- Released even if deployment is cancelled

### Stale Lock Handling

If a lock is older than 30 minutes (1800 seconds), it's considered stale and automatically removed. This prevents permanent lockouts from failed workflows.

## Health Checks

### Health Check Strategy

**Retry Logic**:
- **Max Attempts**: 3
- **Initial Delay**: 5 seconds
- **Backoff**: Exponential (5s, 10s, 20s)
- **Total Time**: ~35 seconds

**Checks Performed**:
1. **PM2 Process Check**: Verify process exists
2. **Status Check**: Verify status is "online"
3. **Liveness**: Process is running
4. **Readiness**: Process is accepting requests

### Health Check Implementation

```bash
MAX_ATTEMPTS=3
ATTEMPT=1
DELAY=5

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  if pm2 describe tzbot > /dev/null 2>&1; then
    STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="tzbot") | .pm2_env.status')
    if [ "$STATUS" = "online" ]; then
      echo "✅ Health check passed"
      exit 0
    fi
  fi
  
  if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
    sleep $DELAY
    DELAY=$((DELAY * 2))  # Exponential backoff
  fi
  ATTEMPT=$((ATTEMPT + 1))
done

echo "❌ Health checks failed"
exit 1
```

### Health Check Failure

If health checks fail after all retries:
1. **Trigger Rollback**: Automatic rollback to previous version
2. **Fail Workflow**: Mark deployment as failed
3. **Send Notification**: Discord notification with failure details
4. **Update Status**: GitHub deployment status set to failure

## Security Best Practices

### SSH Security

✅ **Implemented**:
- SSH key validation before use
- Host key verification (no `StrictHostKeyChecking=no`)
- Connection timeouts (10 seconds)
- Keep-alive settings
- SSH key cleanup in `always()` block

❌ **Not Used**:
- `StrictHostKeyChecking=no` (security vulnerability)
- Hardcoded SSH keys
- Unvalidated SSH keys

### Secret Management

✅ **Best Practices**:
- All secrets stored in GitHub Secrets
- Secrets written directly to file (not echoed)
- Environment file permissions set to 600
- No secrets in logs or output
- PAT_TOKEN used for better API limits

### Deployment Lock

✅ **Prevents**:
- Concurrent deployments
- Race conditions
- Inconsistent state
- Conflicting updates

## Monitoring & Notifications

### Discord Notifications

Sent for:
- ✅ **Promotion Success**: When code promoted to release
- 🎉 **Release Created**: When version tag and GitHub Release created
- 🚀 **Deployment Starting**: When deployment begins
- ✅ **Deployment Success**: When deployment completes successfully
- ❌ **Deployment Failed**: When deployment fails (with rollback info)

### GitHub Deployment Records

- **Environment**: production
- **Status**: pending → success/failure
- **URL**: https://your-vps.example.com
- **Description**: Version being deployed
- **History**: Full deployment history in GitHub

### Logs & Artifacts

**Uploaded on Failure**:
- Deployment logs
- SSH known_hosts
- Test results
- Security scan results
- Lint results

**Retention**: 7-30 days depending on artifact type

## Troubleshooting

### Common Issues

**1. Promotion Fails - Dev Files Detected**
```bash
# Check what files are in release branch
git checkout release
find . -name "*.test.*" -o -name "*.spec.*"
find . -name "vitest.config.*" -o -name "eslint.config.js"

# Solution: Re-run CI pipeline from development
git checkout development
git commit --allow-empty -m "chore: trigger CI pipeline"
git push origin development
```

**2. Version Tag Already Exists**
```bash
# Check existing tags
git tag -l

# Delete incorrect tag (if needed)
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3

# Re-run versioning workflow
```

**3. Deployment Lock Stuck**
```bash
# SSH to VPS
ssh deploy@vps

# Check lock file
ls -la /var/lock/tzbot_deploy.lock

# Remove stale lock (if older than 30 minutes)
sudo rm /var/lock/tzbot_deploy.lock

# Re-run deployment
```

**4. Health Checks Fail**
```bash
# SSH to VPS
ssh deploy@vps

# Check PM2 status
pm2 status tzbot
pm2 logs tzbot --err

# Check .env file
cat /var/www/tzbot/shared/.env

# Restart manually
cd /var/www/tzbot/current
pm2 restart tzbot
```

**5. SSH Connection Failed**
```bash
# Verify secrets in GitHub
# - VPS_HOSTNAME
# - VPS_USER
# - VPS_SSH_KEY
# - VPS_HOST_KEY (recommended)

# Test SSH manually
ssh -i ~/.ssh/key deploy@host

# Get host key
ssh-keyscan -H your-vps.example.com
```

## Summary

This CI/CD system provides:

✅ **Automated Quality Gates** - No bad code reaches production
✅ **Clean Releases** - Zero dev artifacts in production
✅ **Safe Versioning** - Semantic versioning with duplicate prevention
✅ **Zero-Downtime** - Atomic symlink switching
✅ **Automatic Rollback** - Instant recovery on failure
✅ **Deployment Locking** - Prevents concurrent deploys
✅ **SSH Security** - Proper host verification
✅ **Health Validation** - Retry logic with exponential backoff
✅ **Comprehensive Monitoring** - Discord notifications, GitHub deployments

The pipeline is fully automated from development push to production deployment, with safety mechanisms at every stage.

---

**Last Updated**: February 23, 2026
**Version**: 2.0.0
**Status**: Production-Ready
