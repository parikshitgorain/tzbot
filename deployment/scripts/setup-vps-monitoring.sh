#!/bin/bash
#
# VPS Monitoring Setup Script
# Installs and configures runtime monitoring for the bot
#
# Usage: ./setup-vps-monitoring.sh
# Run this script on the VPS after deployment

set -e

# Configuration
APP_NAME="tzbot"
DEPLOY_BASE="/var/www/tzbot"
MONITOR_SCRIPT="$DEPLOY_BASE/deployment/scripts/vps-monitor.sh"
CRON_SCHEDULE="*/1 * * * *"  # Every minute
LOG_FILE="/var/log/tzbot-monitor.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if running on VPS
check_environment() {
    log_step "Checking environment..."
    
    if [ ! -d "$DEPLOY_BASE" ]; then
        log_error "Deployment directory not found: $DEPLOY_BASE"
        exit 1
    fi
    
    if [ ! -f "$MONITOR_SCRIPT" ]; then
        log_error "Monitoring script not found: $MONITOR_SCRIPT"
        exit 1
    fi
    
    log_info "Environment check passed"
}

# Validate Discord webhook URL is configured
check_webhook_config() {
    log_step "Checking Discord webhook configuration..."
    
    ENV_FILE="$DEPLOY_BASE/shared/.env"
    if [ ! -f "$ENV_FILE" ]; then
        log_error ".env file not found: $ENV_FILE"
        exit 1
    fi
    
    if ! grep -q "^DISCORD_WEBHOOK_URL=" "$ENV_FILE"; then
        log_error "DISCORD_WEBHOOK_URL not found in .env file"
        log_error "Please add DISCORD_WEBHOOK_URL to $ENV_FILE"
        exit 1
    fi
    
    WEBHOOK_URL=$(grep "^DISCORD_WEBHOOK_URL=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    if [ -z "$WEBHOOK_URL" ]; then
        log_error "DISCORD_WEBHOOK_URL is empty in .env file"
        exit 1
    fi
    
    log_info "Discord webhook URL configured"
}

# Make monitoring script executable
setup_script_permissions() {
    log_step "Setting up script permissions..."
    
    chmod +x "$MONITOR_SCRIPT"
    log_info "Monitoring script is executable"
}

# Install cron job
install_cron_job() {
    log_step "Installing cron job..."
    
    # Check if cron job already exists
    if crontab -l 2>/dev/null | grep -q "$MONITOR_SCRIPT"; then
        log_warn "Cron job already exists, updating..."
        # Remove old cron job
        crontab -l 2>/dev/null | grep -v "$MONITOR_SCRIPT" | crontab - || true
    fi
    
    # Add new cron job
    (crontab -l 2>/dev/null; echo "$CRON_SCHEDULE $MONITOR_SCRIPT >> $LOG_FILE 2>&1") | crontab -
    
    log_info "Cron job installed: $CRON_SCHEDULE"
}

# Create log file
setup_log_file() {
    log_step "Setting up log file..."
    
    sudo touch "$LOG_FILE" 2>/dev/null || touch "$LOG_FILE"
    sudo chmod 666 "$LOG_FILE" 2>/dev/null || chmod 666 "$LOG_FILE"
    
    log_info "Log file created: $LOG_FILE"
}

# Create state directory
setup_state_directory() {
    log_step "Setting up state directory..."
    
    STATE_DIR="$DEPLOY_BASE/data/state"
    mkdir -p "$STATE_DIR"
    
    log_info "State directory created: $STATE_DIR"
}

# Test monitoring script
test_monitoring_script() {
    log_step "Testing monitoring script..."
    
    if bash "$MONITOR_SCRIPT"; then
        log_info "Monitoring script test passed"
    else
        log_warn "Monitoring script test failed (this may be normal if PM2 is not running)"
    fi
}

# Display summary
display_summary() {
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  VPS Monitoring Setup Complete${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Configuration:"
    echo "  - Monitoring script: $MONITOR_SCRIPT"
    echo "  - Cron schedule: $CRON_SCHEDULE (every minute)"
    echo "  - Log file: $LOG_FILE"
    echo "  - State directory: $DEPLOY_BASE/data/state"
    echo ""
    echo "Monitoring features:"
    echo "  ✓ Process crash detection"
    echo "  ✓ High restart frequency alerts (3+ in 5 min)"
    echo "  ✓ Memory usage monitoring (>1GB)"
    echo "  ✓ Discord webhook notifications"
    echo "  ✓ Alert throttling (prevents spam)"
    echo ""
    echo "Commands:"
    echo "  - View cron jobs: crontab -l"
    echo "  - View monitor logs: tail -f $LOG_FILE"
    echo "  - Test monitoring: $MONITOR_SCRIPT"
    echo "  - Remove cron job: crontab -e (then delete the line)"
    echo ""
    echo -e "${YELLOW}Note: Monitoring will start automatically within 1 minute${NC}"
    echo ""
}

# Main setup function
main() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  VPS Monitoring Setup${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    
    check_environment
    check_webhook_config
    setup_script_permissions
    setup_state_directory
    setup_log_file
    install_cron_job
    test_monitoring_script
    display_summary
    
    log_info "Setup completed successfully!"
}

# Run main function
main
