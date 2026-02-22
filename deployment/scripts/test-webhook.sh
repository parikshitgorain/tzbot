#!/bin/bash
#
# Test Discord Webhook
# Tests if Discord webhook is working correctly
#
# Usage: ./test-webhook.sh [webhook_url]

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Get webhook URL from argument or environment
WEBHOOK_URL="${1:-$DISCORD_WEBHOOK_URL}"

if [ -z "$WEBHOOK_URL" ]; then
    log_error "No webhook URL provided"
    echo ""
    echo "Usage:"
    echo "  $0 <webhook_url>"
    echo "  or set DISCORD_WEBHOOK_URL environment variable"
    echo ""
    echo "To create a Discord webhook:"
    echo "  1. Go to your Discord server"
    echo "  2. Right-click the channel → Edit Channel"
    echo "  3. Go to Integrations → Webhooks"
    echo "  4. Click 'New Webhook'"
    echo "  5. Copy the webhook URL"
    exit 1
fi

log_info "Testing Discord webhook..."
log_info "URL: ${WEBHOOK_URL:0:50}..."

# Test 1: Basic connectivity
log_info "Test 1: Basic connectivity test..."
RESPONSE=$(curl -X POST \
    -H "Content-Type: application/json" \
    -d '{"content":"🧪 Webhook Test - Basic Message"}' \
    "$WEBHOOK_URL" \
    --silent \
    --write-out "\n%{http_code}" \
    --max-time 10)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "204" ] || [ "$HTTP_CODE" = "200" ]; then
    log_info "✅ Basic connectivity: SUCCESS"
else
    log_error "❌ Basic connectivity: FAILED (HTTP $HTTP_CODE)"
    echo "Response: $BODY"
    exit 1
fi

sleep 2

# Test 2: Embed message
log_info "Test 2: Embed message test..."
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PAYLOAD=$(cat <<EOF
{
  "embeds": [{
    "title": "🧪 Webhook Test - Embed Message",
    "description": "This is a test of the Discord webhook embed functionality.",
    "color": 3447003,
    "fields": [
      {
        "name": "Status",
        "value": "Testing",
        "inline": true
      },
      {
        "name": "Timestamp",
        "value": "$TIMESTAMP",
        "inline": true
      }
    ],
    "footer": {
      "text": "TZBOT Deployment System Test"
    }
  }]
}
EOF
)

RESPONSE=$(curl -X POST \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    "$WEBHOOK_URL" \
    --silent \
    --write-out "\n%{http_code}" \
    --max-time 10)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "204" ] || [ "$HTTP_CODE" = "200" ]; then
    log_info "✅ Embed message: SUCCESS"
else
    log_error "❌ Embed message: FAILED (HTTP $HTTP_CODE)"
    exit 1
fi

sleep 2

# Test 3: Deployment notification format
log_info "Test 3: Deployment notification format test..."
bash "$(dirname "$0")/notify.sh" start \
    "🧪 Test Deployment Started" \
    "**Version:** \`v1.0.0-test\`\n**Commit:** \`abc1234\`\n**Branch:** \`test\`\n**Author:** Test User\n\n⏳ This is a test notification"

if [ $? -eq 0 ]; then
    log_info "✅ Deployment notification: SUCCESS"
else
    log_error "❌ Deployment notification: FAILED"
    exit 1
fi

echo ""
log_info "================================================"
log_info "All webhook tests passed! ✅"
log_info "================================================"
echo ""
log_info "Check your Discord channel for 3 test messages:"
log_info "  1. Basic text message"
log_info "  2. Embed message with fields"
log_info "  3. Deployment notification"
echo ""
log_info "If you see all 3 messages, your webhook is working correctly!"

exit 0
