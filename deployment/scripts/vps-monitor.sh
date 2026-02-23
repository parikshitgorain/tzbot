#!/bin/bash
#
# VPS Runtime Monitoring Script
# Monitors the bot process and sends Discord alerts on failures
#
# Usage: ./vps-monitor.sh
# Setup: Add to crontab to run every minute
#        */1 * * * * /var/www/tzbot/deployment/scripts/vps-monitor.sh >> /var/log/tzbot-monitor.log 2>&1

set -e

# Configuration
APP_NAME="tzbot"
DEPLOY_BASE="/var/www/tzbot"
STATE_DIR="$DEPLOY_BASE/data/state"
RESTART_THRESHOLD=3
RESTART_WINDOW=300  # 5 minutes in seconds
WEBHOOK_URL_FILE="$DEPLOY_BASE/shared/.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging
log_info() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Load Discord webhook URL from .env
load_webhook_url() {
    if [ -f "$WEBHOOK_URL_FILE" ]; then
        DISCORD_WEBHOOK_URL=$(grep "^DISCORD_WEBHOOK_URL=" "$WEBHOOK_URL_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    fi
    
    if [ -z "$DISCORD_WEBHOOK_URL" ]; then
        log_warn "DISCORD_WEBHOOK_URL not found in $WEBHOOK_URL_FILE"
        return 1
    fi
    
    return 0
}

# Send Discord alert
send_discord_alert() {
    local title="$1"
    local description="$2"
    local color="$3"
    local error_type="$4"
    local error_log="$5"
    
    if ! load_webhook_url; then
        log_error "Cannot send Discord alert: webhook URL not configured"
        return 1
    fi
    
    # Get current version
    CURRENT_VERSION="unknown"
    if [ -f "$DEPLOY_BASE/current/package.json" ]; then
        CURRENT_VERSION=$(node -p "require('$DEPLOY_BASE/current/package.json').version" 2>/dev/null || echo "unknown")
    fi
    
    # Get hostname
    HOSTNAME=$(hostname)
    
    # Truncate error log if too long
    if [ ${#error_log} -gt 1000 ]; then
        error_log="${error_log:0:1000}...\n[truncated]"
    fi
    
    # Escape special characters for JSON
    description=$(echo "$description" | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')
    error_log=$(echo "$error_log" | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')
    
    # Send webhook
    curl -H "Content-Type: application/json" -X POST \
        -d "{
          \"embeds\": [{
            \"title\": \"$title\",
            \"description\": \"$description\",
            \"color\": $color,
            \"fields\": [
              {\"name\": \"Service\", \"value\": \"\`$APP_NAME\`\", \"inline\": true},
              {\"name\": \"VPS\", \"value\": \"\`$HOSTNAME\`\", \"inline\": true},
              {\"name\": \"Version\", \"value\": \"\`v$CURRENT_VERSION\`\", \"inline\": true},
              {\"name\": \"Error Type\", \"value\": \"$error_type\", \"inline\": true},
              {\"name\": \"Timestamp\", \"value\": \"\`$(date -u +%Y-%m-%dT%H:%M:%SZ)\`\", \"inline\": true},
              {\"name\": \"Error Log\", \"value\": \"\`\`\`\\n$error_log\\n\`\`\`\", \"inline\": false}
            ],
            \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
          }]
        }" \
        "$DISCORD_WEBHOOK_URL" 2>/dev/null || log_error "Failed to send Discord alert"
}

# Check if PM2 process is running
check_pm2_process() {
    if ! command -v pm2 &> /dev/null; then
        log_error "PM2 not installed"
        return 1
    fi
    
    if ! pm2 describe "$APP_NAME" > /dev/null 2>&1; then
        log_error "PM2 process '$APP_NAME' not found"
        return 1
    fi
    
    return 0
}

# Get PM2 process status
get_pm2_status() {
    pm2 jlist | jq -r ".[] | select(.name==\"$APP_NAME\") | .pm2_env.status" 2>/dev/null || echo "unknown"
}

# Get PM2 restart count
get_restart_count() {
    pm2 jlist | jq -r ".[] | select(.name==\"$APP_NAME\") | .pm2_env.restart_time" 2>/dev/null || echo "0"
}

# Get last error from PM2 logs
get_last_error() {
    pm2 logs "$APP_NAME" --err --lines 50 --nostream 2>/dev/null | tail -n 20 || echo "No error logs available"
}

# Track restart frequency
track_restarts() {
    mkdir -p "$STATE_DIR"
    RESTART_LOG="$STATE_DIR/restart_history.log"
    CURRENT_TIME=$(date +%s)
    
    # Add current restart to log
    echo "$CURRENT_TIME" >> "$RESTART_LOG"
    
    # Remove entries older than RESTART_WINDOW
    CUTOFF_TIME=$((CURRENT_TIME - RESTART_WINDOW))
    grep -v "^[0-9]*$" "$RESTART_LOG" > /dev/null 2>&1 || true
    awk -v cutoff="$CUTOFF_TIME" '$1 > cutoff' "$RESTART_LOG" > "$RESTART_LOG.tmp" 2>/dev/null || true
    mv "$RESTART_LOG.tmp" "$RESTART_LOG" 2>/dev/null || true
    
    # Count recent restarts
    RECENT_RESTARTS=$(wc -l < "$RESTART_LOG" 2>/dev/null || echo "0")
    echo "$RECENT_RESTARTS"
}

# Check for high restart frequency
check_restart_frequency() {
    STATUS=$(get_pm2_status)
    
    if [ "$STATUS" = "online" ]; then
        # Process is online, check if it was recently restarted
        RESTART_COUNT=$(get_restart_count)
        
        # Check if restart count increased
        LAST_RESTART_COUNT_FILE="$STATE_DIR/last_restart_count"
        LAST_RESTART_COUNT=0
        if [ -f "$LAST_RESTART_COUNT_FILE" ]; then
            LAST_RESTART_COUNT=$(cat "$LAST_RESTART_COUNT_FILE")
        fi
        
        if [ "$RESTART_COUNT" -gt "$LAST_RESTART_COUNT" ]; then
            # Restart detected
            echo "$RESTART_COUNT" > "$LAST_RESTART_COUNT_FILE"
            RECENT_RESTARTS=$(track_restarts)
            
            if [ "$RECENT_RESTARTS" -ge "$RESTART_THRESHOLD" ]; then
                log_warn "High restart frequency detected: $RECENT_RESTARTS restarts in last 5 minutes"
                ERROR_LOG=$(get_last_error)
                send_discord_alert \
                    "⚠️ High Restart Frequency Detected" \
                    "The bot has restarted $RECENT_RESTARTS times in the last 5 minutes. This may indicate a critical issue." \
                    "16776960" \
                    "High Restart Frequency" \
                    "$ERROR_LOG"
                
                # Clear restart history to avoid spam
                rm -f "$STATE_DIR/restart_history.log"
            fi
        else
            echo "$RESTART_COUNT" > "$LAST_RESTART_COUNT_FILE"
        fi
    fi
}

# Check for process crash
check_process_crash() {
    STATUS=$(get_pm2_status)
    
    if [ "$STATUS" != "online" ]; then
        log_error "Process is not online: $STATUS"
        ERROR_LOG=$(get_last_error)
        
        # Check if we already sent an alert recently
        ALERT_SENT_FILE="$STATE_DIR/crash_alert_sent"
        if [ -f "$ALERT_SENT_FILE" ]; then
            LAST_ALERT=$(cat "$ALERT_SENT_FILE")
            CURRENT_TIME=$(date +%s)
            TIME_DIFF=$((CURRENT_TIME - LAST_ALERT))
            
            # Only send alert if last alert was more than 5 minutes ago
            if [ "$TIME_DIFF" -lt 300 ]; then
                log_info "Crash alert already sent recently, skipping"
                return 0
            fi
        fi
        
        send_discord_alert \
            "🔴 Bot Process Crashed" \
            "The bot process has crashed and is not running. PM2 status: $STATUS" \
            "15158332" \
            "Process Crash" \
            "$ERROR_LOG"
        
        # Mark alert as sent
        date +%s > "$ALERT_SENT_FILE"
        
        # Try to restart
        log_info "Attempting to restart process..."
        pm2 restart "$APP_NAME" || log_error "Failed to restart process"
    else
        # Process is online, clear crash alert flag
        rm -f "$STATE_DIR/crash_alert_sent"
    fi
}

# Check for memory issues
check_memory_usage() {
    if ! check_pm2_process; then
        return 1
    fi
    
    MEMORY_MB=$(pm2 jlist | jq -r ".[] | select(.name==\"$APP_NAME\") | .monit.memory / 1024 / 1024" 2>/dev/null || echo "0")
    MEMORY_MB=${MEMORY_MB%.*}  # Convert to integer
    
    # Alert if memory usage is above 1GB
    if [ "$MEMORY_MB" -gt 1024 ]; then
        log_warn "High memory usage detected: ${MEMORY_MB}MB"
        
        # Check if we already sent an alert recently
        ALERT_SENT_FILE="$STATE_DIR/memory_alert_sent"
        if [ -f "$ALERT_SENT_FILE" ]; then
            LAST_ALERT=$(cat "$ALERT_SENT_FILE")
            CURRENT_TIME=$(date +%s)
            TIME_DIFF=$((CURRENT_TIME - LAST_ALERT))
            
            # Only send alert if last alert was more than 15 minutes ago
            if [ "$TIME_DIFF" -lt 900 ]; then
                return 0
            fi
        fi
        
        ERROR_LOG=$(pm2 logs "$APP_NAME" --lines 30 --nostream 2>/dev/null | tail -n 20 || echo "No logs available")
        
        send_discord_alert \
            "⚠️ High Memory Usage" \
            "The bot is using ${MEMORY_MB}MB of memory, which is above the threshold." \
            "16776960" \
            "High Memory Usage" \
            "$ERROR_LOG"
        
        date +%s > "$ALERT_SENT_FILE"
    else
        rm -f "$STATE_DIR/memory_alert_sent"
    fi
}

# Main monitoring loop
main() {
    log_info "Starting VPS monitoring check..."
    
    # Create state directory
    mkdir -p "$STATE_DIR"
    
    # Check if PM2 is available
    if ! check_pm2_process; then
        log_error "PM2 process check failed"
        return 1
    fi
    
    # Run checks
    check_process_crash
    check_restart_frequency
    check_memory_usage
    
    log_info "Monitoring check completed"
}

# Run main function
main

