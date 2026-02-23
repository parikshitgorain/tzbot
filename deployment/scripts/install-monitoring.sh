#!/bin/bash
set -e

# Install VPS runtime monitoring script
NOTIFIER_SCRIPT="/usr/local/bin/tzbot-webhook-alert.sh"

cat > "$NOTIFIER_SCRIPT" <<'NOTIFIER_EOF'
#!/bin/bash
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
if command -v pm2 &> /dev/null; then
  PM2_STATUS=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name==\"$SERVICE_NAME\") | .pm2_env.status" 2>/dev/null || echo "unknown")
fi

curl -H "Content-Type: application/json" -X POST \
  -d "{
    \"embeds\": [{
      \"title\": \"🚨 Service Alert: $ERROR_TYPE\",
      \"description\": \"Service **$SERVICE_NAME** on **$HOSTNAME** has encountered an issue.\",
      \"color\": 15158332,
      \"fields\": [
        {\"name\": \"Service\", \"value\": \"\\\`$SERVICE_NAME\\\`\", \"inline\": true},
        {\"name\": \"Hostname\", \"value\": \"\\\`$HOSTNAME\\\`\", \"inline\": true},
        {\"name\": \"Error Type\", \"value\": \"\\\`$ERROR_TYPE\\\`\", \"inline\": true},
        {\"name\": \"PM2 Status\", \"value\": \"\\\`$PM2_STATUS\\\`\", \"inline\": true},
        {\"name\": \"Version\", \"value\": \"\\\`$VERSION\\\`\", \"inline\": true},
        {\"name\": \"Timestamp\", \"value\": \"\\\`$TIMESTAMP\\\`\", \"inline\": true},
        {\"name\": \"Recent Logs\", \"value\": \"\\\`\\\`\\\`\\\\n\${LOG_OUTPUT:0:1000}\\\\n\\\`\\\`\\\`\", \"inline\": false}
      ],
      \"timestamp\": \"$TIMESTAMP\"
    }]
  }" \
  "$DISCORD_WEBHOOK_URL" || echo "Failed to send Discord alert"

echo "Alert sent to Discord webhook"
NOTIFIER_EOF

chmod +x "$NOTIFIER_SCRIPT"
echo "✅ Runtime monitoring script installed at $NOTIFIER_SCRIPT"

if command -v pm2 &> /dev/null; then
  echo "Setting up PM2 event hooks..."
  pm2 install pm2-logrotate || true
fi

echo "✅ VPS monitoring configured"
