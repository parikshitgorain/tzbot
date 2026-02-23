#!/bin/bash
# Setup continuous bot monitoring as a systemd service

set -e

SERVICE_NAME="tzbot-monitor"
DEPLOY_BASE="${DEPLOY_BASE:-/var/www/tzbot}"
SCRIPT_PATH="$DEPLOY_BASE/deployment/scripts/monitor-bot.sh"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

echo ""
log_info "🔧 Setting up TZBOT Real-time Monitoring Service"
echo ""

# Check if script exists
if [ ! -f "$SCRIPT_PATH" ]; then
    log_error "Monitor script not found at: $SCRIPT_PATH"
    exit 1
fi

# Make script executable
chmod +x "$SCRIPT_PATH"

# Check if webhook URL is provided
if [ -z "$DISCORD_WEBHOOK_URL" ]; then
    log_warn "⚠️  DISCORD_WEBHOOK_URL not provided"
    log_warn "Monitoring will run but Discord notifications will be disabled"
    echo ""
    log_info "To enable notifications later:"
    log_info "1. Get your Discord webhook URL"
    log_info "2. Run: export DISCORD_WEBHOOK_URL='your-webhook-url'"
    log_info "3. Run: bash $0"
    echo ""
    read -p "Continue without webhook? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Setup cancelled. Please set DISCORD_WEBHOOK_URL and try again."
        exit 0
    fi
fi

# Create environment file
log_step "Creating environment file..."
cat > /etc/systemd/system/tzbot-monitor.env <<EOF
SERVICE_NAME=tzbot
DISCORD_WEBHOOK_URL=$DISCORD_WEBHOOK_URL
CHECK_INTERVAL=600
EOF

log_info "✓ Environment file created"

# Create systemd service file
log_step "Creating systemd service file..."
cat > /etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=TZBOT Real-time Monitoring Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$DEPLOY_BASE
EnvironmentFile=/etc/systemd/system/tzbot-monitor.env
ExecStart=/bin/bash ${SCRIPT_PATH}
Restart=always
RestartSec=10
StandardOutput=append:$DEPLOY_BASE/logs/monitor.log
StandardError=append:$DEPLOY_BASE/logs/monitor-error.log

[Install]
WantedBy=multi-user.target
EOF

log_info "✓ Service file created"

# Create log directory
mkdir -p "$DEPLOY_BASE/logs"

# Reload systemd
log_step "Reloading systemd daemon..."
systemctl daemon-reload
log_info "✓ Systemd reloaded"

# Enable service
log_step "Enabling service to start on boot..."
systemctl enable ${SERVICE_NAME}
log_info "✓ Service enabled"

# Start service
log_step "Starting monitoring service..."
systemctl restart ${SERVICE_NAME}
log_info "✓ Service started"

echo ""
log_info "✅ Monitoring service installed and running!"
echo ""

# Show status
log_info "Service Status:"
systemctl status ${SERVICE_NAME} --no-pager || true

echo ""
log_info "📋 Useful Commands:"
echo "  View logs:    journalctl -u ${SERVICE_NAME} -f"
echo "  View file:    tail -f $DEPLOY_BASE/logs/monitor.log"
echo "  Stop:         systemctl stop ${SERVICE_NAME}"
echo "  Restart:      systemctl restart ${SERVICE_NAME}"
echo "  Status:       systemctl status ${SERVICE_NAME}"
echo ""

if [ -n "$DISCORD_WEBHOOK_URL" ]; then
    log_info "🔔 Discord notifications: ENABLED"
    log_info "You will receive alerts for:"
    echo "  - 🚨 Bot crashes"
    echo "  - ✅ Bot recovery"
    echo "  - ⚠️  High memory usage"
    echo "  - 🚨 Process missing"
else
    log_warn "🔕 Discord notifications: DISABLED"
    log_warn "To enable, set DISCORD_WEBHOOK_URL and re-run this script"
fi

echo ""
log_info "✨ Setup complete!"
echo ""

