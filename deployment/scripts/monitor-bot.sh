#!/bin/bash
# Real-time Bot Monitoring Script
# Reports bot health issues to Discord webhook

set -e

# Configuration
SERVICE_NAME="${SERVICE_NAME:-tzbot}"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL}"
CHECK_INTERVAL="${CHECK_INTERVAL:-600}" # 10 minutes
ALERT_FILE="/tmp/tzbot-last-alert"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# Send Discord notification
send_alert() {
    local status="$1"
    local title="$2"
    local description="$3"
    
    if [ -z "$DISCORD_WEBHOOK_URL" ]; then
        log_warn "DISCORD_WEBHOOK_URL not set, skipping notification"
        return 0
    fi
    
    # Determine color based on status
    local color
    case "$status" in
        critical) color="15158332" ;; # Red
        warning) color="16776960" ;; # Yellow
        recovered) color="3066993" ;; # Green
        *) color="9807270" ;; # Gray
    esac
    
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # Create embed payload
    local payload=$(cat <<EOF
{
  "embeds": [{
    "title": "$title",
    "description": "$description",
    "color": $color,
    "timestamp": "$timestamp",
    "footer": {
      "text": "TZBOT Monitoring System"
    }
  }]
}
EOF
)
    
    curl -H "Content-Type: application/json" \
         -X POST \
         -d "$payload" \
         "$DISCORD_WEBHOOK_URL" \
         --silent --output /dev/null
}

# Check if bot is running
check_bot_status() {
    if pm2 describe "$SERVICE_NAME" > /dev/null 2>&1; then
        local status=$(pm2 jlist | jq -r ".[] | select(.name==\"$SERVICE_NAME\") | .pm2_env.status")
        echo "$status"
    else
        echo "not_found"
    fi
}

# Get bot metrics
get_bot_metrics() {
    local metrics=$(pm2 jlist | jq -r ".[] | select(.name==\"$SERVICE_NAME\") | {
        cpu: .monit.cpu,
        memory: .monit.memory,
        restarts: .pm2_env.restart_time,
        uptime: .pm2_env.pm_uptime
    }")
    echo "$metrics"
}

# Check if we should send alert (avoid spam)
should_send_alert() {
    local alert_type="$1"
    
    if [ ! -f "$ALERT_FILE" ]; then
        return 0
    fi
    
    local last_alert=$(cat "$ALERT_FILE")
    local last_alert_time=$(echo "$last_alert" | cut -d'|' -f1)
    local last_alert_type=$(echo "$last_alert" | cut -d'|' -f2)
    local current_time=$(date +%s)
    local time_diff=$((current_time - last_alert_time))
    
    # Don't send same alert within 10 minutes
    if [ "$last_alert_type" = "$alert_type" ] && [ $time_diff -lt 600 ]; then
        return 1
    fi
    
    return 0
}

# Record alert
record_alert() {
    local alert_type="$1"
    echo "$(date +%s)|$alert_type" > "$ALERT_FILE"
}

# Main monitoring loop
monitor_bot() {
    log_info "Starting bot monitoring for: $SERVICE_NAME"
    
    local consecutive_failures=0
    local was_down=false
    
    while true; do
        local status=$(check_bot_status)
        
        case "$status" in
            online)
                log_info "Bot is online"
                
                # Check if bot just recovered
                if [ "$was_down" = true ]; then
                    if should_send_alert "recovered"; then
                        local metrics=$(get_bot_metrics)
                        local uptime=$(echo "$metrics" | jq -r '.uptime')
                        local restarts=$(echo "$metrics" | jq -r '.restarts')
                        
                        send_alert "recovered" \
                            "✅ Bot Recovered - Back Online" \
                            "**Status:** 🟢 Online\n**Uptime:** $(date -d @$((uptime/1000)) -u +%H:%M:%S)\n**Total Restarts:** $restarts\n\n✨ All systems operational!"
                        
                        record_alert "recovered"
                    fi
                    was_down=false
                fi
                
                consecutive_failures=0
                ;;
                
            stopped|errored|stopping)
                log_error "Bot is $status"
                consecutive_failures=$((consecutive_failures + 1))
                was_down=true
                
                if [ $consecutive_failures -ge 2 ] && should_send_alert "critical"; then
                    send_alert "critical" \
                        "🚨 Bot Critical Failure" \
                        "**Status:** 🔴 $status\n**Consecutive Failures:** $consecutive_failures\n**Action:** PM2 attempting auto-restart\n\n⚠️ Immediate attention required!"
                    
                    record_alert "critical"
                fi
                
                # Attempt restart
                log_info "Attempting to restart bot..."
                pm2 restart "$SERVICE_NAME" || log_error "Failed to restart bot"
                ;;
                
            not_found)
                log_error "Bot process not found in PM2"
                was_down=true
                
                # Emergency: send instant notification without dedup check
                send_alert "critical" \
                    "🚨 Bot Process Missing" \
                    "**Status:** 🔴 Not Found\n**Action:** Manual intervention required\n\n⚠️ Bot is not running in PM2!"
                
                record_alert "critical"
                ;;
                
            *)
                log_warn "Unknown bot status: $status"
                ;;
        esac
        
        # Check memory usage
        if [ "$status" = "online" ]; then
            local metrics=$(get_bot_metrics)
            local memory=$(echo "$metrics" | jq -r '.memory')
            local memory_mb=$((memory / 1024 / 1024))
            
            # Alert if memory > 500MB
            if [ $memory_mb -gt 500 ] && should_send_alert "memory_warning"; then
                send_alert "warning" \
                    "⚠️ High Memory Usage Detected" \
                    "**Memory:** ${memory_mb}MB\n**Status:** 🟡 Warning\n**Action:** Monitoring for memory leak\n\n📊 Consider investigating if this persists"
                
                record_alert "memory_warning"
            fi
        fi
        
        sleep "$CHECK_INTERVAL"
    done
}

# Run monitoring
if [ -z "$DISCORD_WEBHOOK_URL" ]; then
    log_error "DISCORD_WEBHOOK_URL environment variable is required"
    log_info "Set it in your environment or pass it as: DISCORD_WEBHOOK_URL=<url> $0"
    exit 1
fi

monitor_bot
