#!/bin/bash
#
# Service Management Script
# Manages application service (PM2 or systemd)
#
# Usage: ./service-manager.sh <action> [service_name]
# Actions: stop, start, restart, status
#
# Requirements: 5.4, 5.5

set -e

# Load retry wrapper
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/retry-wrapper.sh"

# Configuration
SERVICE_NAME="${SERVICE_NAME:-tzbot}"
SERVICE_TYPE="${SERVICE_TYPE:-pm2}" # pm2 or systemd
DEPLOY_BASE="${DEPLOY_BASE:-/var/www/tzbot}"
STARTUP_DELAY="${STARTUP_DELAY:-5}"

# Retry configuration
export MAX_RETRIES=3
export INITIAL_DELAY=2

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate inputs
if [ $# -lt 1 ]; then
    log_error "Usage: $0 <action> [service_name]"
    log_error "Actions: stop, start, restart, status"
    exit 1
fi

ACTION="$1"
if [ $# -ge 2 ]; then
    SERVICE_NAME="$2"
fi

# PM2 service management
pm2_stop() {
    log_info "Stopping PM2 service: $SERVICE_NAME"
    if pm2 describe "$SERVICE_NAME" > /dev/null 2>&1; then
        pm2 stop "$SERVICE_NAME"
        log_info "Service stopped"
    else
        log_warn "Service not found in PM2"
    fi
}

pm2_start() {
    log_info "Starting PM2 service: $SERVICE_NAME"
    cd "$DEPLOY_BASE/current" || cd "$DEPLOY_BASE"
    if pm2 describe "$SERVICE_NAME" > /dev/null 2>&1; then
        pm2 start "$SERVICE_NAME"
    else
        log_warn "Service not found, starting from ecosystem file"
        if [ -f "$DEPLOY_BASE/ecosystem.config.cjs" ]; then
            pm2 start "$DEPLOY_BASE/ecosystem.config.cjs"
        elif [ -f "$DEPLOY_BASE/ecosystem.config.js" ]; then
            pm2 start "$DEPLOY_BASE/ecosystem.config.js"
        else
            pm2 start dist/index.js --name "$SERVICE_NAME"
        fi
    fi
    pm2 save
    log_info "Waiting ${STARTUP_DELAY}s for service initialization..."
    sleep "$STARTUP_DELAY"
    log_info "Service started"
}

pm2_restart() {
    log_info "Restarting PM2 service: $SERVICE_NAME"
    cd "$DEPLOY_BASE/current" || cd "$DEPLOY_BASE"
    
    # Check if process exists
    if pm2 describe "$SERVICE_NAME" > /dev/null 2>&1; then
        log_info "Process exists, restarting..."
        retry_command "Restart PM2 process" "pm2 restart '$SERVICE_NAME'"
    else
        log_warn "Process not found, starting fresh..."
        if [ -f "$DEPLOY_BASE/ecosystem.config.cjs" ]; then
            retry_command "Start PM2 from ecosystem" "pm2 start '$DEPLOY_BASE/ecosystem.config.cjs'"
        elif [ -f "$DEPLOY_BASE/ecosystem.config.js" ]; then
            retry_command "Start PM2 from ecosystem" "pm2 start '$DEPLOY_BASE/ecosystem.config.js'"
        elif [ -f "ecosystem.config.cjs" ]; then
            retry_command "Start PM2 from local ecosystem" "pm2 start ecosystem.config.cjs"
        elif [ -f "ecosystem.config.js" ]; then
            retry_command "Start PM2 from local ecosystem" "pm2 start ecosystem.config.js"
        else
            log_info "Starting from dist/index.js..."
            retry_command "Start PM2 from index" "pm2 start dist/index.js --name '$SERVICE_NAME'"
        fi
        retry_command "Save PM2 config" "pm2 save"
    fi
    
    log_info "Waiting ${STARTUP_DELAY}s for service initialization..."
    sleep "$STARTUP_DELAY"
    log_info "Service ready"
}

pm2_status() {
    pm2 describe "$SERVICE_NAME"
}

# Systemd service management
systemd_stop() {
    log_info "Stopping systemd service: $SERVICE_NAME"
    sudo systemctl stop "$SERVICE_NAME"
    log_info "Service stopped"
}

systemd_start() {
    log_info "Starting systemd service: $SERVICE_NAME"
    sudo systemctl start "$SERVICE_NAME"
    log_info "Waiting ${STARTUP_DELAY}s for service initialization..."
    sleep "$STARTUP_DELAY"
    log_info "Service started"
}

systemd_restart() {
    log_info "Restarting systemd service: $SERVICE_NAME"
    sudo systemctl restart "$SERVICE_NAME"
    log_info "Waiting ${STARTUP_DELAY}s for service initialization..."
    sleep "$STARTUP_DELAY"
    log_info "Service restarted"
}

systemd_status() {
    sudo systemctl status "$SERVICE_NAME"
}

# Execute action based on service type
case "$SERVICE_TYPE" in
    pm2)
        case "$ACTION" in
            stop)
                pm2_stop
                ;;
            start)
                pm2_start
                ;;
            restart)
                pm2_restart
                ;;
            status)
                pm2_status
                ;;
            *)
                log_error "Unknown action: $ACTION"
                exit 1
                ;;
        esac
        ;;
    systemd)
        case "$ACTION" in
            stop)
                systemd_stop
                ;;
            start)
                systemd_start
                ;;
            restart)
                systemd_restart
                ;;
            status)
                systemd_status
                ;;
            *)
                log_error "Unknown action: $ACTION"
                exit 1
                ;;
        esac
        ;;
    *)
        log_error "Unknown service type: $SERVICE_TYPE"
        log_error "Supported types: pm2, systemd"
        exit 1
        ;;
esac

exit 0
