#!/bin/bash
# Validate that all required GitHub secrets are set
# Usage: ./validate-secrets.sh

set -e

echo "🔍 Validating GitHub Secrets Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

MISSING_SECRETS=()
OPTIONAL_SECRETS=()

# Function to check if a secret is set
check_secret() {
  local secret_name=$1
  local is_required=$2
  local secret_value="${!secret_name}"
  
  if [ -z "$secret_value" ]; then
    if [ "$is_required" = "true" ]; then
      MISSING_SECRETS+=("$secret_name")
      echo "❌ MISSING (Required): $secret_name"
    else
      OPTIONAL_SECRETS+=("$secret_name")
      echo "⚠️  MISSING (Optional): $secret_name"
    fi
  else
    echo "✅ SET: $secret_name"
  fi
}

echo ""
echo "VPS Connection Secrets:"
check_secret "VPS_SSH_KEY" "true"
check_secret "VPS_HOSTNAME" "true"
check_secret "VPS_USER" "true"

echo ""
echo "Discord Configuration:"
check_secret "DISCORD_TOKEN" "true"
check_secret "DISCORD_CLIENT_ID" "true"
check_secret "DISCORD_GUILD_ID" "true"
check_secret "DISCORD_WEBHOOK_URL" "false"

echo ""
echo "Discord Roles:"
check_secret "SUBSCRIBER_ROLE_ID" "true"
check_secret "VIP_ROLE_ID" "true"
check_secret "MODERATOR_ROLE_ID" "true"

echo ""
echo "Discord Channels:"
check_secret "NOTIFICATION_CHANNEL_ID" "true"
check_secret "FALLBACK_CHANNEL_ID" "true"
check_secret "MOD_LOG_CHANNEL_ID" "true"
check_secret "PRIVATE_ANNOUNCEMENT_CHANNEL_ID" "false"
check_secret "PUBLIC_ANNOUNCEMENT_CHANNEL_IDS" "false"

echo ""
echo "Kick.com Configuration (Optional):"
check_secret "KICK_API_KEY" "false"
check_secret "KICK_CHANNEL_ID" "false"
check_secret "KICK_WEBHOOK_SECRET" "false"
check_secret "KICK_OAUTH_CLIENT_ID" "false"
check_secret "KICK_OAUTH_CLIENT_SECRET" "false"

echo ""
echo "Database Configuration:"
check_secret "DATABASE_URL" "true"
check_secret "DATABASE_MAX_CONNECTIONS" "false"

echo ""
echo "Redis Configuration (Optional):"
check_secret "REDIS_URL" "false"
check_secret "REDIS_PASSWORD" "false"

echo ""
echo "Security (Optional):"
check_secret "GOOGLE_SAFE_BROWSING_API_KEY" "false"

echo ""
echo "Rate Limiter (Optional):"
check_secret "RATE_LIMITER_RESTRICTED_CHANNELS" "false"
check_secret "RATE_LIMITER_WINDOW_MS" "false"
check_secret "RATE_LIMITER_VIOLATION_WINDOW_MS" "false"
check_secret "RATE_LIMITER_WARNING_DELETE_DELAY_MS" "false"
check_secret "RATE_LIMITER_CLEANUP_INTERVAL_MS" "false"

echo ""
echo "AI Configuration (Optional):"
check_secret "AI_ENABLED" "false"
check_secret "AI_PROVIDER" "false"
check_secret "AI_API_KEY" "false"
check_secret "AI_MODEL_NAME" "false"
check_secret "AI_BASE_URL" "false"
check_secret "AI_CHANNELS" "false"

echo ""
echo "AI Web Search (Optional):"
check_secret "AI_SEARCH_ENABLED" "false"
check_secret "AI_SEARCH_PROVIDER" "false"
check_secret "AI_SEARCH_SEARXNG_URL" "false"
check_secret "AI_SEARCH_GOOGLE_API_KEY" "false"
check_secret "AI_SEARCH_GOOGLE_ENGINE_ID" "false"

echo ""
echo "Image Search (Optional):"
check_secret "UNSPLASH_ACCESS_KEY" "false"

echo ""
echo "Chat Rain (Optional):"
check_secret "CHAT_RAIN_ENABLED" "false"
check_secret "CHAT_RAIN_MIN_DELAY" "false"
check_secret "CHAT_RAIN_ACTIVE_WINDOW" "false"
check_secret "CHAT_RAIN_MIN_MESSAGES" "false"

echo ""
echo "Webhook Server (Optional):"
check_secret "WEBHOOK_PORT" "false"
check_secret "WEBHOOK_HOST" "false"

echo ""
echo "Logging (Optional):"
check_secret "LOG_LEVEL" "false"
check_secret "LOG_FILE" "false"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Validation Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ${#MISSING_SECRETS[@]} -eq 0 ]; then
  echo "✅ All required secrets are configured!"
  
  if [ ${#OPTIONAL_SECRETS[@]} -gt 0 ]; then
    echo ""
    echo "ℹ️  ${#OPTIONAL_SECRETS[@]} optional secret(s) not configured:"
    for secret in "${OPTIONAL_SECRETS[@]}"; do
      echo "   - $secret"
    done
    echo ""
    echo "These are optional and won't affect basic functionality."
  fi
  
  exit 0
else
  echo "❌ ${#MISSING_SECRETS[@]} required secret(s) missing:"
  for secret in "${MISSING_SECRETS[@]}"; do
    echo "   - $secret"
  done
  echo ""
  echo "Please configure these secrets in GitHub:"
  echo "Settings → Secrets and variables → Actions → New repository secret"
  echo ""
  echo "For more information, see:"
  echo "  docs/GITHUB_SECRETS_SETUP.md"
  echo "  docs/GITHUB_SECRETS_REFERENCE.md"
  
  exit 1
fi
