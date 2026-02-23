# GitHub CI/CD Workflow to VPS Deployment - Complete Flow Report

## Executive Summary

This document provides a comprehensive analysis of the current GitHub Actions CI/CD pipeline that automatically deploys the TZBOT Discord bot from GitHub to a VPS (Virtual Private Server). The system is designed for zero-manual-intervention deployment with automatic rollback capabilities.

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GITHUB ACTIONS WORKFLOWS                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  1. CI Pipeline (ci.yml)                                                 │
│     ├─ Triggered: Push to Development branch                            │
│     ├─ Lint & Type Check                                                │
│     ├─ Run Tests (unit + property-based)                                │
│     ├─ Build TypeScript                                                 │
│     ├─ Security Scan                                                    │
│     └─ Auto-trigger Branch Promotion on success                         │
│                                                                           │
│  2. Branch Promotion (promote.yml)                                       │
│     ├─ Triggered: CI success on Development                             │
│     ├─ Merge Development → release (with --no-ff)                       │
│     ├─ Clean dev-only files from release branch                         │
│     ├─ Run semantic versioning (auto-bump version)                      │
│     └─ Trigger CD Deployment                                            │
│                                                                           │
│  3. CD Release (cd-release.yml)                                          │
│     ├─ Triggered: Push to release branch                                │
│     ├─ Resolve VPS IP via DNS                                           │
│     ├─ SSH to VPS and deploy                                            │
│     ├─ Run health checks                                                │
│     └─ Auto-rollback on failure                                         │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ SSH Connection
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              VPS SERVER                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Deployment Directory: /var/www/tzbot/                                   │
│  ├─ releases/                  (timestamped releases)                    │
│  ├─ current → releases/latest  (symlink to active release)              │
│  ├─ shared/                    (persistent data)                         │
│  │   ├─ .env                   (environment variables)                   │
│  │   └─ logs/                  (application logs)                        │
│  └─ deployment/scripts/        (deployment automation scripts)           │
│                                                                           │
│  Process Manager: PM2                                                    │
│  ├─ Auto-restart on crash                                               │
│  ├─ Exponential backoff                                                 │
│  └─ Health monitoring                                                   │
│                                                                           │
│  Auto-Recovery Systems:                                                  │
│  ├─ PM2 auto-restart (on crash)                                         │
│  ├─ Cron health check (every 5 minutes)                                 │
│  └─ Optional: systemd monitoring service                                │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘


## Detailed Workflow Breakdown

### Phase 1: Continuous Integration (ci.yml)

**Trigger:** Push or Pull Request to `Development` or `release` branches

**Jobs Sequence:**

1. **Lint & Type Check**
   - Checkout code
   - Setup Node.js 20
   - Install dependencies (`npm install`)
   - Run ESLint (`npm run lint`)
   - Run TypeScript type check (`npx tsc --noEmit`)

2. **Test** (depends on lint-and-typecheck)
   - Run unit tests (`npm run test:unit`)
   - Run property-based tests (`npm run test:property`)
   - Generate coverage report (`npm run test:coverage`)
   - Upload coverage to Codecov (optional)

3. **Build** (depends on test)
   - Build TypeScript (`npm run build`)
   - Verify dist/ directory exists
   - Upload build artifacts (retention: 7 days)

4. **Security Scan** (depends on lint-and-typecheck)
   - Run npm audit on production dependencies
   - Fail on high-severity vulnerabilities

5. **Quality Gate** (depends on all previous jobs)
   - Verify all checks passed
   - Output test results summary

6. **Trigger Promotion** (conditional: Development branch + all tests passed)
   - Check promotion eligibility
   - Trigger `promote.yml` workflow via workflow_dispatch
   - Retry up to 3 times with 30s delay (handles GitHub API cache issues)
   - Pass commit SHA, author, and branch information

**Key Features:**
- Parallel execution where possible (security scan runs alongside tests)
- Automatic artifact retention
- Graceful handling of GitHub API cache issues
- Non-blocking promotion trigger (CI always succeeds)

---

### Phase 2: Branch Promotion (promote.yml)

**Trigger:** workflow_dispatch from CI Pipeline (or manual trigger)

**Inputs:**
- `source_branch`: Development (default)
- `target_branch`: release (default)
- `commit_sha`: Commit being promoted
- `commit_author`: Original commit author

**Jobs Sequence:**

1. **Validate & Merge**
   - Send Discord notification (promotion started)
   - Checkout repository with full history
   - Configure Git with github-actions[bot] credentials
   - Verify source commit exists
   - Safety check: prevent same-branch merge, protect Development
   - Checkout target branch (release)
   - Attempt merge with `--no-ff` (preserves commit history)
   - Auto-resolve conflicts:
     - Remove dev-only files (tests/, .kiro/specs/, .agents/)
     - Remove dev config files (vitest.config.*, tsconfig.test.*, eslint.config.js)
     - Prefer Development version for production files
   - Verify commit history preservation

2. **Clean Release Branch**
   - Remove test files (*.test.ts, *.test.js)
   - Remove dev directories (tests/, .kiro/specs/, .agents/)
   - Remove dev config files
   - Remove example files (*.example.ts, *.example.js)
   - Commit cleanup changes with [skip ci]

3. **Verify Release Branch**
   - Check no test files exist
   - Check no dev directories exist
   - Check no dev config files exist
   - Check no example files exist
   - Send Discord notification (verification success)

4. **Semantic Versioning**
   - Setup Node.js 20
   - Install semantic-release and plugins
   - Reset pre-release versions (e.g., 1.0.0-dev.5 → 1.0.0)
   - Create initial tag if no release tags exist
   - Restrict semantic-release to release branch only
   - Run semantic-release with debug output
   - Auto-bump version based on commit messages:
     - `feat:` → minor version bump
     - `fix:` → patch version bump
     - `BREAKING CHANGE:` → major version bump
   - Update package.json, package-lock.json, CHANGELOG.md
   - Create Git tag (e.g., v1.2.3)
   - Push changes and tag to release branch

5. **Trigger Deployment**
   - Trigger `cd-release.yml` workflow via workflow_dispatch
   - Pass commit information (SHA, author, source branch, timestamp)
   - Send Discord notification (promotion complete)

**Key Features:**
- Preserves commit history with --no-ff merge
- Automatic conflict resolution for dev-only files
- Semantic versioning based on conventional commits
- Clean release branch (no dev files)
- Discord notifications at each stage
- Creates GitHub issue on merge conflict

---

### Phase 3: CD Release Deployment (cd-release.yml)

**Trigger:** Push to `release` branch or workflow_dispatch

**Inputs (optional):**
- `environment`: production (default) or staging
- `commit_sha`: Commit being deployed
- `commit_author`: Original commit author
- `source_branch`: Source branch that was promoted
- `promoted_at`: Timestamp when promotion occurred

**Jobs Sequence:**

1. **Validate Deployment Request**
   - Verify branch is `release`
   - Verify source branch is Development (if provided)
   - Log deployment request details
   - Output validation status

2. **Deploy to VPS** (depends on validate)
   - Display deployment information
   - Checkout code
   - Get version from package.json
   - Setup deployment scripts (chmod +x)
   - **Resolve VPS IP Address:**
     - Run `resolve-dns.sh` script
     - Resolve dynamic DNS hostname to IP
     - Output resolved IP for SSH connection
   - **Setup SSH Key:**
     - Create ~/.ssh directory
     - Write VPS_SSH_KEY secret to file
     - Set permissions (chmod 600)
     - Validate SSH key format
     - Add VPS host to known_hosts
   - **Initialize VPS Deployment Directory:**
     - SSH to VPS
     - Create /var/www/tzbot directory
     - Check if Git repository exists
     - Clone or update repository from release branch
     - Make deployment scripts executable
   - **Send Deployment Start Notification** (Discord)
   - **Record Deployment Start:**
     - Generate timestamp
     - Record deployment metadata
   - **Setup Environment Variables:**
     - SSH to VPS
     - Create /var/www/tzbot/shared/.env
     - Write all secrets to .env file:
       - Discord configuration
       - Database URL
       - Redis URL
       - Channel IDs
       - Role IDs
       - Kick integration
       - Environment settings
     - Set file permissions (chmod 600)
   - **Execute Deployment on VPS:**
     - Send progress notification (40% - installing dependencies)
     - SSH to VPS
     - Run `deploy.sh` script with commit SHA and timestamp
   - **Restart Application Service:**
     - Send progress notification (80% - restarting service)
     - SSH to VPS
     - Run `service-manager.sh restart`
   - **Run Health Checks:**
     - SSH to VPS
     - Run `health-check.sh` script
     - Wait up to 60 seconds for bot to be healthy
   - **Record Deployment Success** (if successful)
   - **Send Success Notification** (Discord)
   - **Rollback on Failure** (if health checks fail):
     - SSH to VPS
     - Run `rollback.sh previous`
     - Restore previous working version
   - **Record Deployment Failure** (if failed)
   - **Send Failure Notification** (Discord)
   - **Cleanup SSH Key** (always)

**Key Features:**
- Dynamic DNS resolution
- SSH key validation
- Automatic environment variable setup
- Progress notifications to Discord
- Health check verification
- Automatic rollback on failure
- Deployment state tracking

---

## VPS Deployment Scripts

### 1. deploy.sh

**Purpose:** Main deployment script that deploys application to VPS

**Process:**
1. Create timestamped release directory: `/var/www/tzbot/releases/YYYYMMDD_HHMMSS_<commit>`
2. Clone repository from release branch
3. Verify commit hash matches
4. Clean dev-only files (tests/, .kiro/specs/, .agents/, *.test.ts, etc.)
5. Install dependencies: `npm install` (includes devDependencies for build)
6. Build TypeScript: `npm run build`
7. Resolve path aliases: `npx tsc-alias -p tsconfig.json`
   - Converts TypeScript path aliases (@/core, @/managers, etc.) to relative paths
   - Fallback: manual sed replacement if tsc-alias fails
8. Remove dev dependencies: `npm prune --production`
9. Copy .env from shared location: `/var/www/tzbot/shared/.env`
10. Update symlink: `/var/www/tzbot/current` → new release directory
11. Atomic symlink update (create temp, then move)

**Retry Logic:**
- Max retries: 3
- Initial delay: 3 seconds
- Max delay: 30 seconds
- Exponential backoff

**Key Features:**
- Timestamped releases (easy rollback)
- Automatic path alias resolution
- Shared .env file (persistent across deployments)
- Atomic symlink update (zero downtime)
- Retry logic for network operations

---

### 2. service-manager.sh

**Purpose:** Manage application service (PM2 or systemd)

**Actions:**
- `stop`: Stop the service
- `start`: Start the service
- `restart`: Restart the service
- `status`: Check service status

**PM2 Mode:**
- Uses `pm2 startOrReload` with ecosystem config (picks up new release)
- Fallback: `pm2 restart` (uses saved config, may use old release)
- Saves PM2 configuration after changes
- Waits 5 seconds for service initialization

**Systemd Mode:**
- Uses `systemctl stop/start/restart/status`
- Requires sudo permissions
- Waits 5 seconds for service initialization

**Key Features:**
- Supports both PM2 and systemd
- Prefers ecosystem config reload (ensures new release is loaded)
- Retry logic for PM2 operations
- Configurable startup delay

---

### 3. health-check.sh

**Purpose:** Verify application is running and healthy

**Checks:**
1. **Process Running:**
   - PM2: Check process status is "online"
   - Systemd: Check service is "active"
2. **Discord Connection (optional):**
   - Run health-check utility if available
   - Non-blocking (doesn't fail deployment)

**Retry Logic:**
- Max wait time: 60 seconds
- Check interval: 5 seconds
- Retries until process is online or timeout

**Exit Codes:**
- 0: All checks passed
- 1: Health checks failed

**Key Features:**
- Waits for bot to start (up to 60 seconds)
- Non-blocking Discord check
- Detailed logging
- Configurable timeouts

---

### 4. rollback.sh

**Purpose:** Rollback to previous working version

**Process:**
1. Stop current service
2. Identify previous release directory
3. Update symlink to previous release
4. Restart service
5. Run health checks
6. Record rollback in deployment history

**Rollback Targets:**
- `previous`: Last successful deployment
- `<release_name>`: Specific release directory

**Key Features:**
- Automatic previous version detection
- Health check verification after rollback
- Deployment history tracking
- Service restart with verification

---

### 5. resolve-dns.sh

**Purpose:** Resolve dynamic DNS hostname to IP address

**Process:**
1. Check if input is already an IP address
2. Use `dig +short` to resolve hostname
3. Validate resolved IP format
4. Output IP address

**Supported DNS Services:**
- No-IP
- DuckDNS
- Any standard DNS hostname
- Static IP addresses

**Key Features:**
- Handles both hostnames and IPs
- Validates IP format
- Fallback to hostname if resolution fails
- Detailed error messages

---

### 6. deployment-state.sh

**Purpose:** Track deployment history and state

**Actions:**
- `record-start`: Record deployment start
- `record-complete`: Record deployment completion
- `get-current`: Get current deployment info
- `get-history`: Get deployment history

**Data Stored:**
- Commit SHA
- Timestamp
- Author
- Status (success/failed)
- Message

**Storage:**
- File: `/var/www/tzbot/deployment-history.json`
- Format: JSON

**Key Features:**
- Deployment audit trail
- Current deployment tracking
- History retrieval
- JSON format for easy parsing

---

## Auto-Recovery Systems

### 1. PM2 Auto-Restart

**Configuration:** ecosystem.config.cjs

```javascript
{
  autorestart: true,
  max_restarts: 10,
  restart_delay: 4000,
  exp_backoff_restart_delay: 100,
  min_uptime: '10s'
}
```

**Behavior:**
- Automatically restarts on crash
- Exponential backoff (prevents restart loops)
- Max 10 restarts before giving up
- Requires 10s uptime to reset restart counter

---

### 2. Cron Health Check

**Schedule:** Every 5 minutes

**Script:** health-check-cron.sh

**Process:**
1. Check if PM2 process is online
2. If not online, attempt restart
3. Wait 5 seconds
4. Verify restart success
5. Log results to `/var/www/tzbot/shared/logs/health-check.log`

**Key Features:**
- Automatic recovery from crashes
- Logging for audit trail
- Non-intrusive (only acts if bot is down)

---

### 3. Optional: systemd Monitoring Service

**Service:** tzbot-monitor

**Schedule:** Every 5 minutes

**Features:**
- Bot status monitoring
- Memory usage alerts
- Crash detection
- Discord notifications

**Setup:** Run `setup-monitoring.sh` script

---

## Discord Notifications

### Notification Types

1. **Deployment Start**
   - Title: "🚀 New Release vX.X.X - Deployment Starting"
   - Info: Version, commit, branch, author, estimated time
   - Color: Blue (3447003)

2. **Deployment Progress (40%)**
   - Title: "⚙️ Deployment In Progress"
   - Info: Installing dependencies & building
   - Progress bar: 🔵🔵⚪⚪⚪

3. **Deployment Progress (80%)**
   - Title: "🔄 Restarting Bot Service"
   - Info: Restarting PM2 service
   - Progress bar: 🔵🔵🔵🔵⚪

4. **Deployment Success**
   - Title: "✅ vX.X.X Deployed Successfully"
   - Info: Version, commit, status
   - Color: Green (3066993)

5. **Deployment Failure**
   - Title: "❌ Deployment Failed - Auto-Rollback Initiated"
   - Info: Commit, status, rollback message
   - Color: Red (15158332)

6. **Branch Promotion Started**
   - Title: "🔄 Branch Promotion Started"
   - Info: Source, target, commit, author
   - Color: Blue (3447003)

7. **Merge Successful**
   - Title: "✅ Merge Successful"
   - Info: Branch, commit
   - Color: Green (3066993)

8. **Version Updated**
   - Title: "🔢 Version Updated"
   - Info: Old version → new version
   - Color: Green (3066993)

9. **Promotion Complete**
   - Title: "✅ Branch Promotion Complete"
   - Info: Version, source, target, commit, author
   - Color: Green (3066993)

10. **Promotion Failed**
    - Title: "❌ Branch Promotion Failed"
    - Info: Reason, source, target, commit
    - Color: Red (15158332)

---

## GitHub Secrets Required

### VPS Connection
- `VPS_HOSTNAME`: Dynamic DNS hostname or static IP
- `VPS_USER`: SSH username (e.g., root, ubuntu)
- `VPS_SSH_KEY`: Private SSH key content (full key including headers)

### Discord Configuration
- `DISCORD_TOKEN`: Bot token from Discord Developer Portal
- `DISCORD_CLIENT_ID`: Application client ID
- `DISCORD_GUILD_ID`: Server (guild) ID
- `DISCORD_WEBHOOK_URL`: Webhook URL for deployment notifications

### Discord Channels
- `NOTIFICATION_CHANNEL_ID`: Live notifications channel
- `FALLBACK_CHANNEL_ID`: Fallback notification channel

### Discord Roles
- `MODERATOR_ROLE_ID`: Moderator role ID

### Database & Cache
- `DATABASE_URL`: PostgreSQL connection URL
- `REDIS_URL`: Redis connection URL (optional)

### Kick Integration (Optional)
- `KICK_CHANNEL_ID`: Kick channel ID
- `KICK_WEBHOOK_SECRET`: Webhook secret for signature verification

### GitHub
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions
- `PAT_TOKEN`: Personal Access Token (optional, for workflow_dispatch)

---

## Deployment Flow Timeline

**Total Time:** ~2-3 minutes (typical)

```
0:00 - Developer pushes to Development
0:05 - CI Pipeline starts (lint, test, build, security)
0:30 - CI Pipeline completes successfully
0:31 - Branch Promotion triggered
0:32 - Merge Development → release
0:33 - Clean dev files from release
0:34 - Semantic versioning (auto-bump version)
0:35 - Push to release branch
0:36 - CD Release triggered
0:37 - Resolve VPS IP, setup SSH
0:38 - Initialize VPS directory
0:39 - Setup environment variables
0:40 - Deploy script starts (clone, install, build)
1:30 - Build complete, restart service
1:35 - Health checks start
1:40 - Health checks pass
1:41 - Deployment complete, success notification
```

**Failure Scenario:**
```
1:35 - Health checks start
2:35 - Health checks timeout (60s)
2:36 - Rollback initiated
2:40 - Previous version restored
2:41 - Service restarted
2:45 - Failure notification sent
```

---

## Key Design Decisions

### 1. Timestamped Releases
- Each deployment creates a new directory with timestamp
- Easy rollback to any previous version
- Keeps last 10 releases (configurable)
- Atomic symlink update ensures zero downtime

### 2. Shared .env File
- Environment variables stored in `/var/www/tzbot/shared/.env`
- Persists across deployments
- Automatically linked to each release
- Secrets managed via GitHub Secrets

### 3. Path Alias Resolution
- TypeScript path aliases (@/core, @/managers) resolved during build
- Uses tsc-alias for automatic resolution
- Fallback to manual sed replacement
- Ensures production code has correct imports

### 4. Dev File Cleanup
- Dev-only files removed from release branch
- Prevents deployment of test files, dev configs
- Reduces deployment size
- Cleaner production environment

### 5. Semantic Versioning
- Automatic version bumping based on commit messages
- Follows Conventional Commits specification
- Creates Git tags for each release
- Updates CHANGELOG.md automatically

### 6. Auto-Rollback
- Health checks verify deployment success
- Automatic rollback on failure
- Restores previous working version
- Minimizes downtime

### 7. Discord Notifications
- Real-time deployment status
- Progress updates during deployment
- Success/failure notifications
- Non-blocking (doesn't fail deployment)

### 8. Retry Logic
- Network operations retry up to 3 times
- Exponential backoff prevents hammering
- Handles transient failures gracefully
- Detailed error logging

---

## Potential Issues & Solutions

### Issue 1: SSH Connection Fails
**Symptoms:** Deployment fails at SSH steps
**Causes:**
- Invalid SSH key format
- VPS firewall blocking SSH
- Incorrect VPS hostname/IP
- SSH service not running

**Solutions:**
- Verify SSH key includes BEGIN/END headers
- Check VPS firewall allows port 22
- Test DNS resolution manually
- Verify SSH service is running on VPS

---

### Issue 2: Health Checks Timeout
**Symptoms:** Deployment completes but health checks fail
**Causes:**
- Bot takes too long to start
- Discord token invalid
- Database connection fails
- Missing environment variables

**Solutions:**
- Increase health check timeout (default 60s)
- Verify Discord token is valid
- Check database is accessible from VPS
- Verify all required secrets are set

---

### Issue 3: Path Aliases Not Resolved
**Symptoms:** Bot crashes with "Cannot find module" errors
**Causes:**
- tsc-alias failed during build
- tsconfig.json paths not configured
- Manual sed replacement failed

**Solutions:**
- Check tsc-alias output in deployment logs
- Verify tsconfig.json has paths configured
- Manually run tsc-alias on VPS
- Check dist/ files have correct imports

---

### Issue 4: PM2 Not Loading New Release
**Symptoms:** Bot runs old code after deployment
**Causes:**
- PM2 restart uses saved script path
- Symlink not updated
- PM2 not reloading from ecosystem config

**Solutions:**
- Use `pm2 startOrReload` with ecosystem config
- Verify symlink points to new release
- Delete PM2 saved config and restart
- Check PM2 logs for errors

---

### Issue 5: Semantic Release Not Bumping Version
**Symptoms:** Version stays the same after deployment
**Causes:**
- Commit messages don't follow Conventional Commits
- No feat/fix/BREAKING CHANGE commits
- Semantic release configuration issue

**Solutions:**
- Use conventional commit messages (feat:, fix:, etc.)
- Check semantic-release logs for errors
- Verify .releaserc.json configuration
- Manually bump version if needed

---

## Monitoring & Maintenance

### Daily Checks
- Review deployment logs in GitHub Actions
- Check Discord notifications for failures
- Monitor VPS disk space usage
- Review PM2 logs for errors

### Weekly Checks
- Clean old releases (keep last 10)
- Review deployment history
- Check health check logs
- Verify auto-recovery is working

### Monthly Checks
- Update dependencies (npm update)
- Review and rotate secrets
- Check VPS system updates
- Review and optimize deployment scripts

---

## Emergency Procedures

### Bot is Down and Won't Restart
1. SSH to VPS
2. Check PM2 status: `pm2 list`
3. Check PM2 logs: `pm2 logs tzbot --lines 100`
4. Check disk space: `df -h`
5. Check memory: `free -h`
6. Manually restart: `pm2 restart tzbot`
7. If still failing, rollback: `bash /var/www/tzbot/deployment/scripts/rollback.sh previous`

### Deployment Stuck
1. Check GitHub Actions logs
2. Cancel workflow if stuck
3. SSH to VPS and check processes
4. Kill any stuck processes
5. Manually run deployment script
6. Verify health checks pass

### Rollback Failed
1. SSH to VPS
2. List available releases: `ls -la /var/www/tzbot/releases/`
3. Manually update symlink: `ln -sfn /var/www/tzbot/releases/<good_release> /var/www/tzbot/current`
4. Restart service: `pm2 restart tzbot`
5. Verify bot is running: `pm2 list`

---

## Conclusion

The current GitHub CI/CD workflow provides a robust, fully automated deployment system with the following key features:

✅ Zero-manual-intervention deployment
✅ Automatic testing and quality checks
✅ Semantic versioning
✅ Clean release branch (no dev files)
✅ Timestamped releases for easy rollback
✅ Automatic rollback on failure
✅ Real-time Discord notifications
✅ Auto-recovery systems (PM2, cron, monitoring)
✅ Comprehensive health checks
✅ Deployment audit trail

The system is production-ready and handles most failure scenarios automatically. The main areas for potential improvement are:

1. Add staging environment for pre-production testing
2. Implement blue-green deployment for zero-downtime
3. Add automated database migrations
4. Implement canary deployments
5. Add performance monitoring and alerting
6. Implement automated backup before deployment

---

## Contact & Support

For issues or questions:
- Check GitHub Actions logs
- Review VPS logs: `/var/www/tzbot/shared/logs/`
- Check PM2 logs: `pm2 logs tzbot`
- Review deployment history: `cat /var/www/tzbot/deployment-history.json | jq '.'`
- Open GitHub issue with logs and error messages

---

**Report Generated:** 2026-02-23
**System Version:** Current as of report date
**Workflow Files:** ci.yml, promote.yml, cd-release.yml
**Deployment Scripts:** deploy.sh, service-manager.sh, health-check.sh, rollback.sh
