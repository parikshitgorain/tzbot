# Production-Grade CI/CD Pipeline Guide

This guide explains the complete CI/CD pipeline for automated testing, versioning, and zero-downtime deployment to VPS.

## Table of Contents

- [Overview](#overview)
- [Pipeline Architecture](#pipeline-architecture)
- [Branch Strategy](#branch-strategy)
- [Workflow Details](#workflow-details)
- [Setup Instructions](#setup-instructions)
- [Security Configuration](#security-configuration)
- [Rollback Procedures](#rollback-procedures)
- [Troubleshooting](#troubleshooting)

## Overview

The CI/CD pipeline provides:

- **Automated Quality Gates**: Lint, type check, security scan, tests
- **Clean Production Builds**: Automatic removal of dev/test files
- **Semantic Versioning**: Auto-bump based on conventional commits
- **Zero-Downtime Deployment**: Versioned releases with symlink switching
- **Automatic Rollback**: Instant recovery on deployment failure
- **Deployment Locking**: Prevents concurrent deployments
- **Health Validation**: Post-deployment health checks

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT BRANCH                            │
│  (All development work happens here)                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ git push
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              CI PIPELINE (ci-development.yml)                    │
├─────────────────────────────────────────────────────────────────┤
│  Stage 1: Code Quality & Security                               │
│    ✓ ESLint                                                      │
│    ✓ TypeScript type check                                      │
│    ✓ npm audit (production & dev dependencies)                  │
│                                                                  │
│  Stage 2: Testing                                               │
│    ✓ Unit tests                                                 │
│    ✓ Property-based tests                                       │
│    ✓ Coverage report                                            │
│                                                                  │
│  Stage 3: Build Verification                                    │
│    ✓ TypeScript build                                           │
│    ✓ Build output verification                                  │
│                                                                  │
│  Stage 4: Clean Production Build                                │
│    ✓ Remove ALL dev/test files                                  │
│    ✓ Remove test configs (vitest, eslint, etc.)                 │
│    ✓ Remove .kiro, .agents, coverage, tests/                    │
│    ✓ Remove dev documentation                                   │
│    ✓ Remove .git, .github                                       │
│    ✓ Verify production readiness                                │
│                                                                  │
│  Stage 5: Auto-Promote to Release                               │
│    ✓ Replace release branch with clean build                    │
│    ✓ Strip -dev suffix from version                             │
│    ✓ Force push to release branch                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ auto-promote
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    RELEASE BRANCH                                │
│  (Production-ready code ONLY, no dev files)                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ git push
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│         VERSIONING PIPELINE (release-versioning.yml)             │
├─────────────────────────────────────────────────────────────────┤
│  Stage 1: Validate Release Branch                               │
│    ✓ Check for dev artifacts                                    │
│    ✓ Verify clean version (no -dev suffix)                      │
│    ✓ Check for [skip ci] in commit message                      │
│                                                                  │
│  Stage 2: Semantic Versioning                                   │
│    ✓ Analyze commit messages                                    │
│    ✓ Determine bump type (major/minor/patch)                    │
│    ✓ Bump version in package.json                               │
│    ✓ Check for duplicate tags                                   │
│                                                                  │
│  Stage 3: Create Release                                        │
│    ✓ Create Git tag (vX.Y.Z)                                    │
│    ✓ Generate changelog                                         │
│    ✓ Create GitHub Release                                      │
│    ✓ Send Discord notification                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ tag created
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│         DEPLOYMENT PIPELINE (cd-production.yml)                  │
├─────────────────────────────────────────────────────────────────┤
│  Stage 1: Deployment Lock                                       │
│    ✓ Acquire deployment lock                                    │
│    ✓ Prevent concurrent deployments                             │
│                                                                  │
│  Stage 2: Pre-Deployment Validation                             │
│    ✓ Validate source (release branch or tag)                    │
│    ✓ Verify production readiness                                │
│    ✓ Check required files exist                                 │
│                                                                  │
│  Stage 3: Create Deployment Record                              │
│    ✓ Create GitHub deployment                                   │
│    ✓ Set environment (production)                               │
│                                                                  │
│  Stage 4: Deploy to VPS (Zero-Downtime)                         │
│    ✓ Resolve VPS IP                                             │
│    ✓ Setup SSH with host verification                           │
│    ✓ Test SSH connection                                        │
│    ✓ Check disk space                                           │
│    ✓ Clone/update repository                                    │
│    ✓ Setup environment variables                                │
│    ✓ Create versioned release (/releases/vX.Y.Z)                │
│    ✓ Install dependencies & build                               │
│    ✓ Switch symlink to new release                              │
│    ✓ Restart PM2 gracefully                                     │
│    ✓ Wait for startup                                           │
│    ✓ Run health checks                                          │
│                                                                  │
│  Stage 5: Post-Deployment                                       │
│    ✓ Update deployment status                                   │
│    ✓ Send success notification                                  │
│                                                                  │
│  Stage 6: Rollback (on failure)                                 │
│    ✓ Detect deployment failure                                  │
│    ✓ Switch symlink to previous release                         │
│    ✓ Restart PM2                                                │
│    ✓ Verify rollback health                                     │
│    ✓ Send failure notification                                  │
│                                                                  │
│  Stage 7: Release Lock                                          │
│    ✓ Release deployment lock                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ deployment complete
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    PRODUCTION (VPS)                              │
│  /var/www/tzbot/current → /var/www/tzbot/releases/vX.Y.Z        │
└─────────────────────────────────────────────────────────────────┘
```

## Branch Strategy

### Development Branch

- **Purpose**: All development work
- **Contains**: Source code, tests, dev configs, documentation
- **CI Triggers**: Every push runs full CI pipeline
- **Promotion**: Auto-promotes to release if all checks pass

### Release Branch

- **Purpose**: Production-ready code ONLY
- **Contains**: Clean production build, no dev artifacts
- **Restrictions**: 
  - No test files (*.test.ts, *.spec.ts)
  - No test configs (vitest.config.*, eslint.config.js)
  - No dev directories (tests/, .kiro/, coverage/)
  - No -dev version suffix
- **CD Triggers**: Every push creates version tag and deploys

### Version Tags

- **Format**: `vX.Y.Z` (semantic versioning)
- **Creation**: Automatic based on conventional commits
- **Purpose**: Immutable release markers
- **Deployment**: Each tag triggers VPS deployment

## Workflow Details

### 1. CI Pipeline (ci-development.yml)

**Trigger**: Push to `development` branch

**Jobs**:

1. **lint-and-typecheck**
   - Runs ESLint
   - Runs TypeScript type check
   - Uploads lint results on failure

2. **security-scan**
   - npm audit for production dependencies
   - npm audit for all dependencies
   - Checks for outdated packages
   - Uploads security scan results on failure

3. **test**
   - Runs unit tests
   - Runs property-based tests
   - Generates coverage report
   - Uploads to Codecov
   - Uploads test results on failure

4. **build**
   - Builds TypeScript
   - Verifies build output
   - Uploads build artifacts

5. **prepare-release**
   - Creates clean production build
   - Removes ALL dev/test files:
     - Test files: *.test.*, *.spec.*, *.example.*
     - Test directories: tests/, .kiro/, .agents/, coverage/
     - Dev configs: vitest.config.*, eslint.config.js, .prettierrc*
     - Dev docs: CICD_*.md, *_SUMMARY.md
     - Git files: .git/, .github/, .gitignore
   - Verifies production readiness
   - Uploads clean artifact

6. **auto-promote**
   - Downloads clean production build
   - Checks out release branch
   - Replaces entire branch with clean build
   - Strips -dev suffix from version
   - Force pushes to release branch
   - Sends Discord notification

**Success Criteria**: All jobs must pass for promotion

### 2. Versioning Pipeline (release-versioning.yml)

**Trigger**: Push to `release` branch

**Jobs**:

1. **validate-release**
   - Checks branch is `release`
   - Verifies no -dev suffix in version
   - Checks for dev artifacts (warning only)
   - Skips if commit contains [skip ci]

2. **semantic-version**
   - Gets last tag
   - Checks for commits since last tag
   - Analyzes commit messages:
     - `feat!:` or `BREAKING CHANGE:` → major
     - `feat:` → minor
     - `fix:`, `perf:`, `refactor:` → patch
   - Bumps version using npm
   - Checks for duplicate tags
   - Commits and pushes version bump

3. **create-release**
   - Pulls latest changes
   - Double-checks tag uniqueness
   - Creates annotated Git tag
   - Generates categorized changelog:
     - Breaking changes
     - Features
     - Bug fixes
     - Other changes
   - Creates GitHub Release
   - Sends Discord notification

**Conventional Commits**:
- `feat:` New feature (minor bump)
- `fix:` Bug fix (patch bump)
- `feat!:` Breaking change (major bump)
- `BREAKING CHANGE:` in body (major bump)

### 3. Deployment Pipeline (cd-production.yml)

**Trigger**: Push to `release` branch or version tag

**Jobs**:

1. **acquire-lock**
   - Prevents concurrent deployments
   - Creates unique lock ID
   - In production, use Redis/DynamoDB for distributed locking

2. **validate-deployment**
   - Validates source (release branch or tag)
   - Gets version from package.json
   - Determines environment (production)
   - Verifies required files exist
   - Checks for dev artifacts (warning only)

3. **create-deployment**
   - Creates GitHub deployment record
   - Sets environment to production
   - Returns deployment ID for status updates

4. **deploy-to-vps**
   - **Environment**: Requires `production` environment approval
   - **Timeout**: 10 minutes
   - **Steps**:
     1. Resolve VPS IP from hostname
     2. Setup SSH with proper host verification
     3. Test SSH connection
     4. Check VPS disk space
     5. Initialize/update git repository
     6. Setup environment variables from secrets
     7. Execute deployment script:
        - Clone to versioned directory (/releases/TIMESTAMP_COMMIT)
        - Install dependencies
        - Build TypeScript
        - Remove dev dependencies
        - Copy .env from shared location
        - Switch symlink atomically
     8. Restart PM2 gracefully
     9. Wait for startup (15 seconds)
     10. Run health checks

5. **verify-deployment**
   - Updates deployment status to success
   - Sends Discord success notification
   - Creates deployment summary

6. **rollback** (on failure)
   - Detects deployment failure
   - Executes rollback script:
     - Stops service
     - Switches symlink to previous release
     - Starts service
     - Runs health checks
   - Updates deployment status to failure
   - Sends Discord failure notification
   - Creates failure summary

7. **release-lock**
   - Always runs
   - Releases deployment lock

**Zero-Downtime Strategy**:
1. New release deployed to `/var/www/tzbot/releases/TIMESTAMP_COMMIT`
2. Previous release remains at `/var/www/tzbot/releases/PREVIOUS`
3. Symlink `/var/www/tzbot/current` points to active release
4. Atomic symlink switch: `ln -sfn NEW current.tmp && mv -Tf current.tmp current`
5. PM2 restart picks up new code from symlink
6. If health checks fail, symlink switches back to previous

## Setup Instructions

### 1. GitHub Secrets

Configure the following secrets in your GitHub repository:

**Required Secrets**:

```bash
# VPS Access
VPS_HOSTNAME=your-vps.example.com
VPS_USER=deploy
VPS_SSH_KEY=<private SSH key>
VPS_HOST_KEY=<SSH host key from ssh-keyscan>

# Discord Bot
DISCORD_TOKEN=<bot token>
DISCORD_CLIENT_ID=<client id>
DISCORD_GUILD_ID=<guild id>

# Discord Roles
SUBSCRIBER_ROLE_ID=<role id>
VIP_ROLE_ID=<role id>
MODERATOR_ROLE_ID=<role id>

# Discord Channels
NOTIFICATION_CHANNEL_ID=<channel id>
FALLBACK_CHANNEL_ID=<channel id>
PRIVATE_ANNOUNCEMENT_CHANNEL_ID=<channel id>
PUBLIC_ANNOUNCEMENT_CHANNEL_IDS=<comma-separated channel ids>

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Redis (optional)
REDIS_URL=redis://host:6379
REDIS_PASSWORD=<password>

# Kick Integration (optional)
KICK_API_KEY=<api key>
KICK_CHANNEL_ID=<channel id>
KICK_WEBHOOK_SECRET=<secret>
KICK_OAUTH_CLIENT_ID=<client id>
KICK_OAUTH_CLIENT_SECRET=<client secret>

# Google Safe Browsing (optional)
GOOGLE_SAFE_BROWSING_API_KEY=<api key>

# Notifications
DISCORD_WEBHOOK_URL=<webhook url for deployment notifications>

# GitHub (optional, for better API limits)
PAT_TOKEN=<personal access token with repo scope>
```

### 2. GitHub Environment

Create a `production` environment in GitHub:

1. Go to repository Settings → Environments
2. Click "New environment"
3. Name: `production`
4. Configure protection rules:
   - ✓ Required reviewers (optional, for manual approval)
   - ✓ Wait timer (optional, e.g., 5 minutes)
   - ✓ Deployment branches: Only `release` branch

### 3. VPS Setup

**SSH Key Setup**:

```bash
# On your local machine, generate deploy key
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/github_deploy_key

# Copy public key to VPS
ssh-copy-id -i ~/.ssh/github_deploy_key.pub deploy@your-vps.example.com

# Get host key for VPS_HOST_KEY secret
ssh-keyscan -H your-vps.example.com

# Add private key to GitHub secret VPS_SSH_KEY
cat ~/.ssh/github_deploy_key
```

**VPS Directory Structure**:

```bash
/var/www/tzbot/
├── current -> releases/20260223_abc1234/  # Symlink to active release
├── releases/
│   ├── 20260223_abc1234/                  # Versioned release
│   ├── 20260222_def5678/                  # Previous release (for rollback)
│   └── 20260221_ghi9012/                  # Older release
├── shared/
│   └── .env                               # Shared environment file
└── logs/                                  # Application logs
```

**PM2 Setup**:

```bash
# Install PM2 globally
npm install -g pm2

# Setup PM2 startup script
pm2 startup

# The bot will be managed by ecosystem.config.cjs
```

### 4. Deployment Scripts

Ensure deployment scripts are executable:

```bash
chmod +x deployment/scripts/*.sh
```

Required scripts:
- `deploy.sh` - Main deployment script
- `rollback.sh` - Rollback to previous version
- `health-check.sh` - Health check validation
- `service-manager.sh` - PM2 service management
- `resolve-dns.sh` - DNS resolution
- `retry-wrapper.sh` - Retry logic for network operations

## Security Configuration

### SSH Security

**DO NOT** use `StrictHostKeyChecking=no` in production!

**Proper SSH Configuration**:

1. **Store Host Key**: Add VPS host key to `VPS_HOST_KEY` secret
   ```bash
   ssh-keyscan -H your-vps.example.com
   ```

2. **Use Known Hosts**: Workflow adds host key to `~/.ssh/known_hosts`

3. **Key Validation**: Workflow validates SSH key format before use

4. **Connection Timeout**: SSH connections have 10-second timeout

5. **Keep-Alive**: ServerAliveInterval=5, ServerAliveCountMax=3

### Secrets Management

- **Never commit secrets** to repository
- **Use GitHub Secrets** for all sensitive data
- **Rotate keys regularly** (SSH keys, API keys, tokens)
- **Limit secret access** to necessary workflows only
- **Use environment-specific secrets** for staging vs production

### Deployment Lock

Prevents concurrent deployments that could cause race conditions:

- Lock acquired at start of deployment
- Lock released at end (success or failure)
- In production, use distributed lock (Redis, DynamoDB)
- Current implementation is simplified for GitHub Actions

## Rollback Procedures

### Automatic Rollback

Automatic rollback triggers on:
- Deployment script failure
- Health check failure
- SSH connection timeout
- Any job failure in deploy-to-vps

**Rollback Process**:
1. Detect failure
2. Stop PM2 service
3. Switch symlink to previous release
4. Start PM2 service
5. Run health checks
6. Send failure notification

### Manual Rollback

If you need to manually rollback:

```bash
# SSH to VPS
ssh deploy@your-vps.example.com

# List available releases
ls -la /var/www/tzbot/releases/

# Rollback to previous version
cd /var/www/tzbot
export APP_NAME=tzbot
export DEPLOY_BASE=/var/www/tzbot
export SERVICE_NAME=tzbot
bash deployment/scripts/rollback.sh previous

# Or rollback to specific commit
bash deployment/scripts/rollback.sh abc1234
```

### Rollback Verification

After rollback:
1. Check PM2 status: `pm2 status tzbot`
2. Check logs: `pm2 logs tzbot --lines 50`
3. Verify Discord bot is online
4. Test slash commands
5. Monitor error logs

## Troubleshooting

### Deployment Fails at SSH Connection

**Symptoms**: "SSH connection failed" error

**Solutions**:
1. Verify VPS_HOSTNAME is correct
2. Check VPS_SSH_KEY is valid private key
3. Verify VPS_USER has SSH access
4. Check VPS firewall allows SSH (port 22)
5. Test SSH manually: `ssh -i key deploy@host`

### Health Checks Fail

**Symptoms**: "Health checks failed" error, automatic rollback

**Solutions**:
1. Check PM2 logs: `pm2 logs tzbot`
2. Verify .env file exists and is correct
3. Check database connection
4. Verify Discord token is valid
5. Check for missing dependencies

### Version Tag Already Exists

**Symptoms**: "Tag vX.Y.Z already exists" error

**Solutions**:
1. Check if release was already created
2. Verify commit has changes since last tag
3. Add [skip ci] to commit message if no release needed
4. Manually delete tag if it's incorrect:
   ```bash
   git tag -d vX.Y.Z
   git push origin :refs/tags/vX.Y.Z
   ```

### Dev Files in Release Branch

**Symptoms**: Warning about dev artifacts in release

**Solutions**:
1. Check ci-development.yml prepare-release job
2. Verify cleanup commands are working
3. Manually clean release branch:
   ```bash
   git checkout release
   rm -rf tests/ .kiro/ coverage/
   rm -f vitest.config.* eslint.config.js
   git add -A
   git commit -m "chore: clean dev files [skip ci]"
   git push origin release
   ```

### Deployment Lock Timeout

**Symptoms**: Deployment waits indefinitely

**Solutions**:
1. Check for stuck workflows in GitHub Actions
2. Cancel stuck workflows
3. Re-run deployment
4. In production, implement proper distributed locking

### PM2 Process Not Starting

**Symptoms**: PM2 shows "errored" or "stopped" status

**Solutions**:
1. Check PM2 logs: `pm2 logs tzbot --err`
2. Verify ecosystem.config.cjs is correct
3. Check Node.js version: `node --version`
4. Verify build output exists: `ls -la /var/www/tzbot/current/dist/`
5. Test manually: `cd /var/www/tzbot/current && node dist/index.js`

### Disk Space Issues

**Symptoms**: "No space left on device" error

**Solutions**:
1. Check disk usage: `df -h`
2. Clean old releases:
   ```bash
   cd /var/www/tzbot/releases
   # Keep last 5 releases, delete older
   ls -t | tail -n +6 | xargs rm -rf
   ```
3. Clean PM2 logs: `pm2 flush`
4. Clean application logs: `rm -f /var/www/tzbot/logs/*.log`

## Best Practices

### Commit Messages

Use conventional commits for automatic versioning:

```bash
# Patch version bump (1.0.0 → 1.0.1)
git commit -m "fix: resolve memory leak in cache"

# Minor version bump (1.0.0 → 1.1.0)
git commit -m "feat: add new moderation command"

# Major version bump (1.0.0 → 2.0.0)
git commit -m "feat!: redesign API endpoints"
# or
git commit -m "feat: redesign API

BREAKING CHANGE: API endpoints have changed"
```

### Development Workflow

1. **Create feature branch** from `development`
2. **Make changes** and commit with conventional commits
3. **Run tests locally**: `npm run validate`
4. **Push to feature branch**
5. **Create PR** to `development`
6. **Merge PR** after review
7. **CI pipeline runs** automatically
8. **Auto-promotes** to `release` if all checks pass
9. **Versioning** creates tag and GitHub Release
10. **Deployment** to VPS happens automatically

### Monitoring

Monitor deployments:
1. **GitHub Actions**: Check workflow runs
2. **Discord**: Deployment notifications
3. **PM2**: `pm2 monit` for real-time monitoring
4. **Logs**: `pm2 logs tzbot` for application logs
5. **Health**: Regular health check endpoint calls

### Maintenance

Regular maintenance tasks:
1. **Clean old releases**: Keep last 5-10 releases
2. **Rotate logs**: Use log rotation for application logs
3. **Update dependencies**: Regular security updates
4. **Backup database**: Regular database backups
5. **Monitor disk space**: Set up alerts for low disk space

## Summary

This production-grade CI/CD pipeline provides:

✅ **Automated Quality Gates** - No bad code reaches production
✅ **Clean Releases** - Zero dev artifacts in production
✅ **Safe Versioning** - Semantic versioning with duplicate prevention
✅ **Zero-Downtime** - Seamless deployments with instant rollback
✅ **Security** - Proper SSH, no hardcoded secrets
✅ **Reliability** - Health checks, deployment locking, error handling
✅ **Visibility** - Discord notifications, GitHub deployment records

The pipeline is fully automated from development push to production deployment, with safety mechanisms at every stage.
