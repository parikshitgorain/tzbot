#!/bin/bash
# Test Discord webhook connectivity

set -e

WEBHOOK_URL="${1:-$DISCORD_WEBHOOK_URL}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[✓]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          Discord Webhook Connectivity Test                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if webhook URL is provided
if [ -z "$WEBHOOK_URL" ]; then
    log_error "No webhook URL provided"
    echo ""
    echo "Usage:"
    echo "  $0 <webhook_url>"
    echo "  or"
    echo "  DISCORD_WEBHOOK_URL=<url> $0"
    echo ""
    exit 1
fi

# Validate webhook URL format
if [[ ! "$WEBHOOK_URL" =~ ^https://discord\.com/api/webhooks/ ]]; then
    log_error "Invalid webhook URL format"
    echo "  Expected: https://discord.com/api/webhooks/..."
    echo "  Got: $WEBHOOK_URL"
    exit 1
fi

log_info "Webhook URL format is valid"

# Test webhook connectivity
echo ""
echo "Sending test message to Discord..."
echo ""

PAYLOAD=$(cat <<EOF
{
  "embeds": [{
    "title": "🧪 Webhook Test",
    "description": "This is a test message from your TZBOT deployment system.",
    "color": 3447003,
    "fields": [
      {
        "name": "Test Status",
        "value": "✅ Connection Successful"
      },
      {
        "name": "Timestamp",
        "value": "$(date -u +"%Y-%m-%d %H:%M:%S UTC")"
      }
    ],
    "footer": {
      "text": "TZBOT Webhook Test"
    }
  }]
}
EOF
)

if curl -X POST \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    "$WEBHOOK_URL" \
    --silent \
    --show-error \
    --fail \
    --max-time 10; then
    echo ""
    log_info "Test message sent successfully!"
    echo ""
    log_info "Check your Discord channel for the test message"
    echo ""
    exit 0
else
    echo ""
    log_error "Failed to send test message"
    echo ""
    echo "Possible issues:"
    echo "  1. Webhook URL is incorrect"
    echo "  2. Webhook was deleted in Discord"
    echo "  3. Network connectivity issues"
    echo "  4. Discord API is down"
    echo ""
    exit 1
fi

