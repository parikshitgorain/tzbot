#!/bin/bash
#
# tzbot-webhook-alert.sh - VPS Runtime Monitoring Alert Script
# 
# This script sends Discord webhook alerts when the tzbot service encounters issues.
# It reads the DISCORD_WEBHOOK_URL from the shared .env file and posts detailed
# error information including logs, service status, and version information.
#
# Usage:
#   tzbot-webhook-alert.sh [service_name] [error_type] [log_lines]
#
# Arguments:
#   service_name - Name of the PM2 service (default: tzbot)
#   error_type   - Type of error (default: crash)
#   log_lines    - Number of log lines to include (default: 50)
#
# Examples:
#   tzbot-webhook-alert.sh tzbot crash 50
#   tzbot-webhook-alert.sh tzbot restart 100
#
# Installation:
#   This script is automatically installed to /usr/local/bin/tzbot-webhook-alert.sh
#   during deployment by the cd-production.yml workflow.
#
# PM2 Integration:
#   Can be called from PM2 event hooks or systemd OnFailure directives.
#

set -e

SERVICE_NAME="${1:-tzbot}"
ERROR_TYPE="${2:-crash}"
LOG_LINES="${3:-50}"

ENV_FILE="/var/www/tzbot/shared/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found at $ENV_FILE"
  exit 1
fi

source "$ENV_FILE"

if [ -z "$DISCORD_WEBHOOK_URL" ]; then
  echo "Error: DISCORD_WEBHOOK_URL not set in .env"
  exit 1
fi

HOSTNAME=$(hostname)
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

VERSION="unknown"
if [ -L "/var/www/tzbot/current" ]; then
  CURRENT_RELEASE=$(readlink /var/www/tzbot/current)
  VERSION=$(basename "$CURRENT_RELEASE")
fi

LOG_OUTPUT=""
if [ -f "/var/www/tzbot/current/logs/error.log" ]; then
  LOG_OUTPUT=$(tail -n "$LOG_LINES" /var/www/tzbot/current/logs/error.log | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')
fi

if [ -z "$LOG_OUTPUT" ]; then
  LOG_OUTPUT="No recent error logs available"
fi

PM2_STATUS="unknown"
PM2_RESTARTS="unknown"
if command -v pm2 &> /dev/null; then
  PM2_STATUS=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name==\"$SERVICE_NAME\") | .pm2_env.status" 2>/dev/null || echo "unknown")
  PM2_RESTARTS=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name==\"$SERVICE_NAME\") | .pm2_env.restart_time" 2>/dev/null || echo "unknown")
fi

UPTIME="unknown"
if [ "$PM2_STATUS" = "online" ]; then
  UPTIME=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name==\"$SERVICE_NAME\") | .pm2_env.pm_uptime" 2>/dev/null || echo "unknown")
  if [ "$UPTIME" != "unknown" ]; then
    UPTIME_SECONDS=$(( ($(date +%s) - $UPTIME / 1000) ))
    UPTIME="${UPTIME_SECONDS}s"
  fi
fi

curl -H "Content-Type: application/json" -X POST \
  -d "{
    \"embeds\": [{
      \"title\": \"🚨 Service Alert: $ERROR_TYPE\",
      \"description\": \"Service **$SERVICE_NAME** on **$HOSTNAME** has encountered an issue.\",
      \"color\": 15158332,
      \"fields\": [
        {\"name\": \"Service\", \"value\": \"\`$SERVICE_NAME\`\", \"inline\": true},
        {\"name\": \"Hostname\", \"value\": \"\`$HOSTNAME\`\", \"inline\": true},
        {\"name\": \"Error Type\", \"value\": \"\`$ERROR_TYPE\`\", \"inline\": true},
        {\"name\": \"PM2 Status\", \"value\": \"\`$PM2_STATUS\`\", \"inline\": true},
        {\"name\": \"Restarts\", \"value\": \"\`$PM2_RESTARTS\`\", \"inline\": true},
        {\"name\": \"Uptime\", \"value\": \"\`$UPTIME\`\", \"inline\": true},
        {\"name\": \"Version\", \"value\": \"\`$VERSION\`\", \"inline\": false},
        {\"name\": \"Recent Error Logs\", \"value\": \"\`\`\`\\n${LOG_OUTPUT:0:1000}\\n\`\`\`\", \"inline\": false}
      ],
      \"timestamp\": \"$TIMESTAMP\"
    }]
  }" \
  "$DISCORD_WEBHOOK_URL" || echo "Failed to send Discord alert"

echo "Alert sent to Discord webhook at $TIMESTAMP"
