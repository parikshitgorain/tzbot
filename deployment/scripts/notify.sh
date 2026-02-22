#!/bin/bash
#
# Notification Utility
# Sends deployment notifications via Discord webhook
#
# Usage: ./notify.sh <type> <message> [details]
# Types: start, success, failure, rollback
#
# Requirements: 9.1, 9.2, 9.3, 9.4, 9.5

set -e

# Configuration
WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"
MAX_RETRIES=3
RETRY_DELAY=2

# Colors for embeds
COLOR_START=3447003    # Blue
COLOR_SUCCESS=3066993  # Green
COLOR_FAILURE=15158332 # Red
COLOR_ROLLBACK=16776960 # Yellow
COLOR_INFO=9807270     # Gray

# Logging functions
log_info() {
    echo "[INFO] $1"
}

log_warn() {
    echo "[WARN] $1"
}

log_error() {
    echo "[ERROR] $1"
}

# Validate inputs
if [ $# -lt 2 ]; then
    log_error "Usage: $0 <type> <message> [details]"
    exit 1
fi

TYPE="$1"
MESSAGE="$2"
DETAILS="${3:-}"

# Check if webhook URL is configured
if [ -z "$WEBHOOK_URL" ]; then
    log_warn "Discord webhook URL not configured, skipping notification"
    exit 0
fi

# Determine color based on type
case "$TYPE" in
    start)
        COLOR=$COLOR_START
        TITLE="🚀 Deployment Started"
        ;;
    success)
        COLOR=$COLOR_SUCCESS
        TITLE="✅ Deployment Successful"
        ;;
    failure)
        COLOR=$COLOR_FAILURE
        TITLE="❌ Deployment Failed"
        ;;
    rollback)
        COLOR=$COLOR_ROLLBACK
        TITLE="⚠️ Rollback Executed"
        ;;
    info)
        COLOR=$COLOR_INFO
        TITLE="ℹ️ Deployment Update"
        ;;
    *)
        log_error "Unknown notification type: $TYPE"
        exit 1
        ;;
esac

# Build JSON payload
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if [ -n "$DETAILS" ]; then
    PAYLOAD=$(cat <<EOF
{
  "embeds": [{
    "title": "$TITLE",
    "description": "$MESSAGE",
    "color": $COLOR,
    "fields": [{
      "name": "Details",
      "value": "$DETAILS"
    }],
    "timestamp": "$TIMESTAMP",
    "footer": {
      "text": "TZBOT Deployment System"
    }
  }]
}
EOF
)
else
    PAYLOAD=$(cat <<EOF
{
  "embeds": [{
    "title": "$TITLE",
    "description": "$MESSAGE",
    "color": $COLOR,
    "timestamp": "$TIMESTAMP",
    "footer": {
      "text": "TZBOT Deployment System"
    }
  }]
}
EOF
)
fi

# Send notification with retry logic
send_notification() {
    local attempt=1
    
    while [ $attempt -le $MAX_RETRIES ]; do
        log_info "Sending notification (attempt $attempt/$MAX_RETRIES)..."
        
        if curl -X POST \
            -H "Content-Type: application/json" \
            -d "$PAYLOAD" \
            "$WEBHOOK_URL" \
            --silent \
            --show-error \
            --fail \
            --max-time 10; then
            log_info "Notification sent successfully"
            return 0
        fi
        
        log_warn "Notification attempt $attempt failed"
        
        if [ $attempt -lt $MAX_RETRIES ]; then
            log_info "Retrying in $RETRY_DELAY seconds..."
            sleep $RETRY_DELAY
        fi
        
        attempt=$((attempt + 1))
    done
    
    log_error "Failed to send notification after $MAX_RETRIES attempts"
    return 1
}

# Send notification (don't fail deployment on notification failure)
if send_notification; then
    exit 0
else
    log_warn "Notification failed, but continuing deployment"
    exit 0
fi
