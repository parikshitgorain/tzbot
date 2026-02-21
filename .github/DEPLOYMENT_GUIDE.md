# Deployment Guide

## Overview

This guide covers the deployment process for TZBot Discord Bot using the CI/CD pipeline.

## Prerequisites

### Required Secrets

Configure these secrets in your GitHub repository settings:

#### Required for CI
- `CODECOV_TOKEN` - Code coverage reporting (optional)
- `SNYK_TOKEN` - Security scanning (optional)

#### Required for CD (Production)
- `RAILWAY_TOKEN` / `HEROKU_API_KEY` / `AWS_ACCESS_KEY_ID` - Deployment platform credentials
- `DATABASE_URL` - Production database connection string
- `DISCORD_TOKEN` - Discord bot token
- `DISCORD_CLIENT_ID` - Discord application client ID
- `DISCORD_GUILD_ID` - Discord server ID
- `REDIS_URL` - Redis connection string (if using Redis)

### Environment Setup

1. **Development Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your development credentials
   ```

2. **Production Environment**
   - Configure secrets in GitHub repository settings
   - Or configure in your hosting platform dashboard

## Deployment Workflow

### 1. Development to Staging (Development Branch)

```bash
# Ensure you're on Development branch
git checkout Development
git pull origin Development

# Make your changes
git add .
git commit -m "feat: your feature description"
git push origin Development
```

**What happens:**
- ✅ CI pipeline runs automatically
- ✅ Linting and type checking
- ✅ All tests execute
- ✅ Build verification
- ✅ Security scanning
- ❌ No deployment (development only)

### 2. Staging to Production (Release Branch)

```bash
# Ensure Development is stable
git checkout Development
git pull origin Development

# Switch to release branch
git checkout release
git pull origin release

# Merge Development into release
git merge Development

# Push to trigger production deployment
git push origin release
```

**What happens:**
- ✅ All CI checks run
- ✅ Production build created
- ✅ Deployment to production
- ✅ Post-deployment verification
- ✅ Health checks

### 3. Hotfix Deployment

```bash
# Create hotfix from release
git checkout release
git pull origin release
git checkout -b hotfix/critical-fix

# Make the fix
git add .
git commit -m "fix: critical issue description"

# Merge to release (production)
git checkout release
git merge hotfix/critical-fix
git push origin release

# Also merge to Development
git checkout Development
git merge hotfix/critical-fix
git push origin Development

# Clean up
git branch -d hotfix/critical-fix
```

## Manual Deployment

If you need to deploy manually:

### Build Locally

```bash
# Install dependencies
npm ci

# Run tests
npm run test:unit

# Build project
npm run build

# Verify build
ls -la dist/
```

### Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Deploy
railway up
```

### Deploy to Heroku

```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app (first time only)
heroku create tzbot-discord-bot

# Deploy
git push heroku release:main

# Run migrations
heroku run npm run migrate
```

### Deploy to AWS EC2

```bash
# SSH into EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Navigate to app directory
cd /var/www/tzbot

# Pull latest changes
git pull origin release

# Install dependencies
npm ci

# Build
npm run build

# Run migrations
npm run migrate

# Restart service
pm2 restart tzbot
```

## Database Migrations

### Automatic (Recommended)

Migrations run automatically on application startup.

### Manual

```bash
# Run migrations
npm run migrate

# Or using the script directly
tsx scripts/migrate.ts
```

### Rollback

If you need to rollback a migration:

```bash
# Connect to database
psql $DATABASE_URL

# Run the down migration
\i src/core/database/schema/XXX_migration_name_down.sql
```

## Environment Variables

### Required Variables

```bash
# Discord Configuration
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_guild_id

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Optional: Redis
REDIS_URL=redis://host:6379

# Optional: Kick.com Integration
KICK_USERNAME=your_kick_username
KICK_CHANNEL_ID=your_channel_id

# Optional: Google Safe Browsing
GOOGLE_SAFE_BROWSING_API_KEY=your_api_key

# Environment
NODE_ENV=production
LOG_LEVEL=info
```

### Setting Variables

#### GitHub Secrets
1. Go to repository Settings
2. Navigate to Secrets and variables → Actions
3. Click "New repository secret"
4. Add each variable

#### Railway
```bash
railway variables set DISCORD_TOKEN=your_token
railway variables set DATABASE_URL=your_db_url
```

#### Heroku
```bash
heroku config:set DISCORD_TOKEN=your_token
heroku config:set DATABASE_URL=your_db_url
```

## Health Checks

### Application Health

```bash
# Check if bot is online in Discord
# Look for green status indicator

# Check logs
npm run logs

# Or on hosting platform
railway logs
heroku logs --tail
```

### Database Health

```bash
# Connect to database
psql $DATABASE_URL

# Check tables
\dt

# Check recent activity
SELECT * FROM users LIMIT 5;
```

### Redis Health (if using)

```bash
# Connect to Redis
redis-cli -u $REDIS_URL

# Check connection
PING
# Should return: PONG

# Check keys
KEYS *
```

## Monitoring

### Application Logs

```bash
# View logs locally
tail -f logs/tzbot-*.log

# View error logs
tail -f logs/error-*.log

# View moderation logs
tail -f logs/moderation-*.log
```

### Production Logs

```bash
# Railway
railway logs

# Heroku
heroku logs --tail

# AWS CloudWatch
aws logs tail /aws/ec2/tzbot --follow
```

## Rollback Procedure

### Quick Rollback

```bash
# Find the last working commit
git log --oneline

# Revert to that commit
git revert <commit-hash>

# Push to trigger redeployment
git push origin release
```

### Full Rollback

```bash
# Reset to previous version
git reset --hard <previous-commit-hash>

# Force push (use with caution!)
git push origin release --force
```

## Troubleshooting

### Build Fails

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear TypeScript cache
rm -rf dist/
npm run build
```

### Tests Fail

```bash
# Run tests locally
npm run test:unit

# Check specific test
npm run test -- tests/unit/path/to/test.ts

# Update snapshots if needed
npm run test -- -u
```

### Deployment Fails

1. Check GitHub Actions logs
2. Verify all secrets are set correctly
3. Check hosting platform logs
4. Verify database connectivity
5. Check environment variables

### Database Connection Issues

```bash
# Test database connection
psql $DATABASE_URL

# Check if migrations ran
SELECT * FROM migrations ORDER BY id DESC LIMIT 5;

# Manually run migrations if needed
npm run migrate
```

## Post-Deployment Checklist

After each production deployment:

- [ ] Bot shows online in Discord
- [ ] Commands respond correctly
- [ ] Database queries working
- [ ] No errors in logs
- [ ] Monitoring dashboards green
- [ ] Team notified of deployment
- [ ] Documentation updated (if needed)

## Emergency Contacts

- **DevOps Lead**: [Contact Info]
- **Database Admin**: [Contact Info]
- **On-Call Engineer**: [Contact Info]

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Railway Documentation](https://docs.railway.app/)
- [Heroku Documentation](https://devcenter.heroku.com/)
- [Discord.js Guide](https://discordjs.guide/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
