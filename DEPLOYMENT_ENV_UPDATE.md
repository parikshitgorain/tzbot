# Deployment Environment Variables Update

## Summary

Updated the CD production deployment workflow to include ALL environment variables from `.env.example` that should be fetched from GitHub secrets during VPS deployment.

## Changes Made

### 1. Updated `.github/workflows/cd-production.yml`

Added comprehensive environment variable mapping from GitHub secrets to the VPS `.env` file, including:

#### Core Discord Configuration
- DISCORD_TOKEN
- DISCORD_CLIENT_ID
- DISCORD_GUILD_ID
- DISCORD_WEBHOOK_URL

#### Discord Roles & Channels
- SUBSCRIBER_ROLE_ID, VIP_ROLE_ID, MODERATOR_ROLE_ID
- NOTIFICATION_CHANNEL_ID, FALLBACK_CHANNEL_ID, MOD_LOG_CHANNEL_ID
- PRIVATE_ANNOUNCEMENT_CHANNEL_ID
- PUBLIC_ANNOUNCEMENT_CHANNEL_IDS

#### Kick.com Integration
- KICK_API_KEY
- KICK_CHANNEL_ID
- KICK_WEBHOOK_SECRET
- KICK_OAUTH_CLIENT_ID
- KICK_OAUTH_CLIENT_SECRET

#### Database & Cache
- DATABASE_URL
- DATABASE_MAX_CONNECTIONS
- REDIS_URL
- REDIS_PASSWORD

#### Security
- GOOGLE_SAFE_BROWSING_API_KEY

#### Rate Limiter
- RATE_LIMITER_RESTRICTED_CHANNELS
- RATE_LIMITER_WINDOW_MS
- RATE_LIMITER_VIOLATION_WINDOW_MS
- RATE_LIMITER_WARNING_DELETE_DELAY_MS
- RATE_LIMITER_CLEANUP_INTERVAL_MS

#### AI Configuration
- AI_ENABLED
- AI_PROVIDER
- AI_API_KEY
- AI_MODEL_NAME
- AI_BASE_URL
- AI_CHANNELS

#### AI Web Search
- AI_SEARCH_ENABLED
- AI_SEARCH_PROVIDER
- AI_SEARCH_SEARXNG_URL
- AI_SEARCH_GOOGLE_API_KEY
- AI_SEARCH_GOOGLE_ENGINE_ID

#### Image Search
- UNSPLASH_ACCESS_KEY

#### Chat Rain Detection
- CHAT_RAIN_ENABLED
- CHAT_RAIN_MIN_DELAY
- CHAT_RAIN_ACTIVE_WINDOW
- CHAT_RAIN_MIN_MESSAGES

#### Webhook Server
- WEBHOOK_PORT
- WEBHOOK_HOST

#### Logging
- LOG_LEVEL
- LOG_FILE

### 2. Created New Documentation

#### `docs/GITHUB_SECRETS_REFERENCE.md`
Comprehensive reference document listing:
- All available GitHub secrets
- Description of each secret
- Default values where applicable
- Required vs optional secrets
- Setup instructions via web UI and CLI
- Security best practices
- Troubleshooting guide

#### `deployment/scripts/validate-secrets.sh`
Validation script that:
- Checks if required secrets are set
- Identifies missing optional secrets
- Provides clear error messages
- Exits with appropriate status codes
- Can be run locally or in CI/CD

### 3. Updated Existing Documentation

#### `docs/GITHUB_SECRETS_SETUP.md`
- Added reference to comprehensive secrets list
- Added quick setup script using GitHub CLI
- Clarified required vs optional secrets
- Improved verification section

#### `deployment/AI_DEPLOYMENT_CHECKLIST.md`
- Added documentation references section
- Links to secrets reference and setup guides

### 4. Added Validation Step to Workflow

Added a validation step in the CD workflow that:
- Runs before deployment starts
- Checks all required secrets are configured
- Fails fast if secrets are missing
- Provides clear error messages with documentation links

## How to Use

### For New Deployments

1. Review the complete secrets list:
   ```bash
   cat docs/GITHUB_SECRETS_REFERENCE.md
   ```

2. Set up required secrets in GitHub:
   - Via Web UI: Settings → Secrets and variables → Actions
   - Via CLI: Use the script in `docs/GITHUB_SECRETS_SETUP.md`

3. Validate secrets locally (optional):
   ```bash
   # Export your secrets as environment variables
   export DISCORD_TOKEN="your-token"
   export DATABASE_URL="your-db-url"
   # ... etc
   
   # Run validation
   bash deployment/scripts/validate-secrets.sh
   ```

4. Deploy - the workflow will validate secrets automatically

### For Existing Deployments

1. Check which new secrets you need:
   ```bash
   cat docs/GITHUB_SECRETS_REFERENCE.md
   ```

2. Add any missing secrets to GitHub

3. Next deployment will automatically use all configured secrets

### Quick Setup with GitHub CLI

```bash
# Install GitHub CLI: https://cli.github.com/
gh auth login

# Set secrets from your .env file
while IFS='=' read -r key value; do
  [[ $key =~ ^#.*$ ]] && continue
  [[ -z $key ]] && continue
  value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//')
  echo "Setting $key..."
  echo "$value" | gh secret set "$key"
done < .env
```

## Benefits

1. **Complete Coverage**: All environment variables from `.env.example` are now supported
2. **Validation**: Automatic validation prevents deployment failures due to missing secrets
3. **Documentation**: Comprehensive docs make setup easier for new contributors
4. **Flexibility**: Optional secrets allow gradual feature adoption
5. **Security**: Secrets are properly managed through GitHub's secure system
6. **Maintainability**: Clear reference makes it easy to add new secrets in the future

## Testing

To test the changes:

1. Ensure all required secrets are set in GitHub
2. Push a tag to trigger deployment: `git tag v1.0.0 && git push --tags`
3. Watch the workflow run - validation step should pass
4. Deployment should create `.env` with all configured secrets on VPS

## Rollback

If issues occur, the workflow includes automatic rollback:
- Health checks run after deployment
- Failed health checks trigger automatic rollback
- Previous version is restored
- Discord notification sent with rollback details

## Related Files

- `.github/workflows/cd-production.yml` - Main deployment workflow
- `docs/GITHUB_SECRETS_REFERENCE.md` - Complete secrets reference
- `docs/GITHUB_SECRETS_SETUP.md` - Setup guide
- `deployment/scripts/validate-secrets.sh` - Validation script
- `.env.example` - Environment variable template

## Next Steps

1. Review and set all required secrets in GitHub
2. Optionally set optional secrets for additional features
3. Test deployment to ensure all secrets are properly transferred
4. Monitor first deployment for any issues
5. Update team documentation with new secrets process
