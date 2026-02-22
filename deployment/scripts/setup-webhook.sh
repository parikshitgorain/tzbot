#!/bin/bash
# Quick setup script for Discord webhook on VPS

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

clear
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     TZBOT Discord Webhook Setup for VPS Monitoring        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if running on VPS
if [ ! -d "/var/www/tzbot" ]; then
    log_error "This script must be run on your VPS server"
    log_error "Directory /var/www/tzbot not found"
    exit 1
fi

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "This script must be run as root"
    log_error "Please run: sudo bash $0"
    exit 1
fi

echo ""
log_info "This script will set up real-time bot monitoring with Discord notifications"
echo ""
log_warn "You need a Discord webhook URL to continue"
echo ""
log_info "To get a webhook URL:"
echo "  1. Open your Discord server"
echo "  2. Go to: Server Settings → Integrations → Webhooks"
echo "  3. Click 'New Webhook'"
echo "  4. Copy the webhook URL"
echo ""

# Prompt for webhook URL
read -p "Enter your Discord webhook URL (or press Enter to skip): " WEBHOOK_URL

if [ -z "$WEBHOOK_URL" ]; then
    log_warn "No webhook URL provided"
    log_warn "Monitoring will run but notifications will be disabled"
    echo ""
    read -p "Continue without notifications? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Setup cancelled"
        exit 0
    fi
fi

# Validate webhook URL format
if [ -n "$WEBHOOK_URL" ]; then
    if [[ ! "$WEBHOOK_URL" =~ ^https://discord\.com/api/webhooks/ ]]; then
        log_error "Invalid webhook URL format"
        log_error "URL should start with: https://discord.com/api/webhooks/"
        exit 1
    fi
    log_info "✓ Webhook URL validated"
fi

echo ""
log_step "Setting up monitoring service..."
echo ""

# Export webhook URL and run setup
export DISCORD_WEBHOOK_URL="$WEBHOOK_URL"
export DEPLOY_BASE="/var/www/tzbot"

# Run the monitoring setup script
bash /var/www/tzbot/deployment/scripts/setup-monitoring.sh

echo ""
log_info "═══════════════════════════════════════════════════════════"
log_info "✅ Setup Complete!"
log_info "═══════════════════════════════════════════════════════════"
echo ""

if [ -n "$WEBHOOK_URL" ]; then
    log_info "🔔 Discord notifications are ENABLED"
    log_info "You will receive alerts in Discord for:"
    echo "  • Bot crashes and recovery"
    echo "  • High memory usage warnings"
    echo "  • Process missing alerts"
    echo ""
    log_info "💡 Test the notifications:"
    echo "  pm2 stop tzbot    # Will trigger crash alert"
    echo "  pm2 start tzbot   # Will trigger recovery alert"
else
    log_warn "🔕 Discord notifications are DISABLED"
    log_warn "To enable later, run this script again with a webhook URL"
fi

echo ""
log_info "📊 Monitor the service:"
echo "  systemctl status tzbot-monitor"
echo "  journalctl -u tzbot-monitor -f"
echo "  tail -f /var/www/tzbot/logs/monitor.log"
echo ""

