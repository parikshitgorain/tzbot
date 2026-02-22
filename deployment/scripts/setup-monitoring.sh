#!/bin/bash
# Setup continuous bot monitoring as a systemd service

set -e

SERVICE_NAME="tzbot-monitor"
SCRIPT_PATH="/var/www/tzbot/deployment/scripts/monitor-bot.sh"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL}"

echo "🔧 Setting up bot monitoring service..."

# Create systemd service file
cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=TZBOT Real-time Monitoring Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/tzbot
Environment="SERVICE_NAME=tzbot"
Environment="DISCORD_WEBHOOK_URL=${DISCORD_WEBHOOK_URL}"
Environment="CHECK_INTERVAL=300"
ExecStart=/bin/bash ${SCRIPT_PATH}
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
systemctl daemon-reload

# Enable and start service
systemctl enable ${SERVICE_NAME}
systemctl restart ${SERVICE_NAME}

echo "✅ Monitoring service installed and started"
echo ""
echo "Service status:"
systemctl status ${SERVICE_NAME} --no-pager || true
echo ""
echo "To view logs: journalctl -u ${SERVICE_NAME} -f"
echo "To stop: systemctl stop ${SERVICE_NAME}"
echo "To restart: systemctl restart ${SERVICE_NAME}"
