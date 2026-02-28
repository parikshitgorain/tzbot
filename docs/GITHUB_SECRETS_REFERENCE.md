# GitHub Secrets Reference

This document lists all GitHub secrets required for VPS deployment via the CD pipeline.

## Required Secrets

### VPS Connection
- `VPS_SSH_KEY` - SSH private key for VPS access
- `VPS_HOSTNAME` - VPS hostname or IP address
- `VPS_USER` - SSH username for VPS (typically `root` or deployment user)

### Discord Configuration
- `DISCORD_TOKEN` - Discord bot token
- `DISCORD_CLIENT_ID` - Discord application client ID
- `DISCORD_GUILD_ID` - Discord server (guild) ID
- `DISCORD_WEBHOOK_URL` - Discord webhook URL for deployment notifications

### Discord Role IDs
- `SUBSCRIBER_ROLE_ID` - Role ID for subscribers
- `VIP_ROLE_ID` - Role ID for VIP members
- `MODERATOR_ROLE_ID` - Role ID for moderators

### Discord Channel IDs
- `NOTIFICATION_CHANNEL_ID` - Channel for general notifications
- `FALLBACK_CHANNEL_ID` - Fallback channel for notifications
- `MOD_LOG_CHANNEL_ID` - Channel for moderation logs
- `PRIVATE_ANNOUNCEMENT_CHANNEL_ID` - Private announcement channel
- `PUBLIC_ANNOUNCEMENT_CHANNEL_IDS` - Comma-separated list of public announcement channels

### Kick.com Configuration
- `KICK_API_KEY` - Kick.com API key
- `KICK_CHANNEL_ID` - Kick.com channel ID
- `KICK_WEBHOOK_SECRET` - Kick.com webhook secret
- `KICK_OAUTH_CLIENT_ID` - Kick.com OAuth client ID
- `KICK_OAUTH_CLIENT_SECRET` - Kick.com OAuth client secret

### Database Configuration
- `DATABASE_URL` - PostgreSQL connection string (format: `postgresql://user:password@host:port/database`)
- `DATABASE_MAX_CONNECTIONS` - Maximum database connections (optional, default: 20)

### Redis Configuration
- `REDIS_URL` - Redis connection URL (optional, format: `redis://host:port`)
- `REDIS_PASSWORD` - Redis password (optional)

### Security
- `GOOGLE_SAFE_BROWSING_API_KEY` - Google Safe Browsing API key (optional)

### Rate Limiter Configuration (Optional)
- `RATE_LIMITER_RESTRICTED_CHANNELS` - Restricted channel mappings (format: `channelId1:redirectId1,channelId2:redirectId2`)
- `RATE_LIMITER_WINDOW_MS` - Rate limit window in milliseconds (default: 60000)
- `RATE_LIMITER_VIOLATION_WINDOW_MS` - Violation tracking window (default: 300000)
- `RATE_LIMITER_WARNING_DELETE_DELAY_MS` - Warning message delete delay (default: 10000)
- `RATE_LIMITER_CLEANUP_INTERVAL_MS` - Cleanup interval (default: 60000)

### AI Configuration (Optional)
- `AI_ENABLED` - Enable AI features (true/false, default: false)
- `AI_PROVIDER` - AI provider (groq, ollama, openai, anthropic)
- `AI_API_KEY` - AI provider API key
- `AI_MODEL_NAME` - AI model name (e.g., llama-3.1-8b-instant)
- `AI_BASE_URL` - AI base URL (for Ollama, default: http://localhost:11434)
- `AI_CHANNELS` - Comma-separated list of channel IDs where AI is enabled

### AI Web Search Configuration (Optional)
- `AI_SEARCH_ENABLED` - Enable AI web search (true/false, default: false)
- `AI_SEARCH_PROVIDER` - Search provider (duckduckgo, searxng, google)
- `AI_SEARCH_SEARXNG_URL` - SearXNG instance URL (if using searxng)
- `AI_SEARCH_GOOGLE_API_KEY` - Google Custom Search API key (if using google)
- `AI_SEARCH_GOOGLE_ENGINE_ID` - Google Custom Search Engine ID (if using google)

### Image Search (Optional)
- `UNSPLASH_ACCESS_KEY` - Unsplash API access key

### Chat Rain Configuration (Optional)
- `CHAT_RAIN_ENABLED` - Enable chat rain detection (true/false, default: true)
- `CHAT_RAIN_MIN_DELAY` - Minimum delay between messages (default: 300)
- `CHAT_RAIN_ACTIVE_WINDOW` - Active window for detection (default: 600)
- `CHAT_RAIN_MIN_MESSAGES` - Minimum messages to trigger (default: 3)

### Webhook Server Configuration (Optional)
- `WEBHOOK_PORT` - Webhook server port (default: 3000)
- `WEBHOOK_HOST` - Webhook server host (default: 0.0.0.0)

### Logging Configuration (Optional)
- `LOG_LEVEL` - Logging level (debug, info, warn, error, default: info)
- `LOG_FILE` - Log file path (default: logs/tzbot.log)

## Setting Up Secrets

### Via GitHub Web Interface
1. Go to your repository on GitHub
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret with its name and value

### Via GitHub CLI
```bash
# Set a single secret
gh secret set SECRET_NAME

# Set from a file
gh secret set VPS_SSH_KEY < ~/.ssh/deploy_key

# Set multiple secrets from .env file
while IFS='=' read -r key value; do
  [[ $key =~ ^#.*$ ]] && continue
  [[ -z $key ]] && continue
  echo "$value" | gh secret set "$key"
done < .env
```

## Validation

The deployment workflow will validate that required secrets are set before attempting deployment. Missing secrets will cause the deployment to fail with a clear error message.

## Security Best Practices

1. **Never commit secrets to the repository**
2. **Use strong, unique values for all secrets**
3. **Rotate secrets regularly** (especially API keys and tokens)
4. **Limit secret access** to only necessary workflows
5. **Use environment-specific secrets** for staging vs production
6. **Audit secret usage** regularly through GitHub's audit log

## Troubleshooting

### Secret Not Found Error
If you see "secret is not set or empty" errors:
1. Verify the secret name matches exactly (case-sensitive)
2. Check that the secret has a value (not empty)
3. Ensure you're setting secrets in the correct repository
4. For organization repos, check organization-level secrets

### Secret Value Issues
If deployment fails with authentication errors:
1. Verify the secret value is correct (no extra spaces/newlines)
2. For multiline secrets (like SSH keys), ensure proper formatting
3. Test the secret value locally before adding to GitHub
4. Check for special characters that might need escaping

## Related Documentation
- [GitHub Secrets Setup Guide](./GITHUB_SECRETS_SETUP.md)
- [VPS Deployment Guide](../deployment/AI_VPS_DEPLOYMENT.md)
- [Environment Configuration](./.env.example)
