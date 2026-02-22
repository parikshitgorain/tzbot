#!/bin/bash
#
# Health Check Script
# Verifies application is running and healthy
#
# Usage: ./health-check.sh [service_name]
#
# Requirements: 6.1, 6.2, 6.3, 6.4

set -e

# Configuration
SERVICE_NAME="${SERVICE_NAME:-tzbot}"
SERVICE_TYPE="${SERVICE_TYPE:-pm2}"
MAX_WAIT_TIME=60
CHECK_INTERVAL=5
CURRENT_DIR="/var/www/tzbot/current"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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

if [ $# -ge 1 ]; then
    SERVICE_NAME="$1"
fi

# Check if process is running
check_process_running() {
    log_info "Checking if application process is running..."
    
    case "$SERVICE_TYPE" in
        pm2)
            if pm2 describe "$SERVICE_NAME" > /dev/null 2>&1; then
                local status=$(pm2 jlist | jq -r ".[] | select(.name==\"$SERVICE_NAME\") | .pm2_env.status")
                if [ "$status" = "online" ]; then
                    log_info "PM2 process is online"
                    return 0
                else
                    log_error "PM2 process status: $status"
                    return 1
                fi
            else
                log_error "PM2 process not found"
                return 1
            fi
            ;;
        systemd)
            if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
                log_info "Systemd service is active"
                return 0
            else
                log_error "Systemd service is not active"
                return 1
            fi
            ;;
        *)
            log_error "Unknown service type: $SERVICE_TYPE"
            return 1
            ;;
    esac
}

# Check Discord connection (if health endpoint exists)
check_discord_connection() {
    log_info "Checking Discord bot connection..."
    
    # Check if health check utility exists
    if [ -f "$CURRENT_DIR/dist/utils/health-check.js" ]; then
        if node "$CURRENT_DIR/dist/utils/health-check.js" 2>/dev/null; then
            log_info "Discord connection is healthy"
            return 0
        else
            log_warn "Discord health check failed or not available"
            return 1
        fi
    else
        log_warn "Discord health check utility not found, skipping"
        return 0
    fi
}

# Main health check orchestration
run_health_checks() {
    local elapsed=0
    local all_checks_passed=false
    
    log_info "Starting health checks (max wait: ${MAX_WAIT_TIME}s)..."
    
    while [ $elapsed -lt $MAX_WAIT_TIME ]; do
        log_info "Health check attempt (${elapsed}s elapsed)..."
        
        # Check process
        if ! check_process_running; then
            log_warn "Process check failed, waiting ${CHECK_INTERVAL}s..."
            sleep $CHECK_INTERVAL
            elapsed=$((elapsed + CHECK_INTERVAL))
            continue
        fi
        
        # Check Discord connection
        if ! check_discord_connection; then
            log_warn "Discord check failed, waiting ${CHECK_INTERVAL}s..."
            sleep $CHECK_INTERVAL
            elapsed=$((elapsed + CHECK_INTERVAL))
            continue
        fi
        
        # All checks passed
        all_checks_passed=true
        break
    done
    
    if [ "$all_checks_passed" = true ]; then
        log_info "All health checks passed!"
        return 0
    else
        log_error "Health checks failed after ${MAX_WAIT_TIME}s"
        return 1
    fi
}

# Execute health checks
log_info "Running health checks for: $SERVICE_NAME"
log_info "Service type: $SERVICE_TYPE"

if run_health_checks; then
    log_info "Deployment health check: SUCCESS"
    exit 0
else
    log_error "Deployment health check: FAILED"
    exit 1
fi
