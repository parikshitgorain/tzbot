#!/bin/bash
#
# Deployment State Management
# Records and manages deployment history
#
# Usage: ./deployment-state.sh <action> [args...]
# Actions: record-start, record-complete, get-current, get-history
#
# Requirements: 8.1, 8.2, 8.3, 8.4, 8.5

set -e

# Configuration
APP_NAME="${APP_NAME:-tzbot}"
DEPLOY_BASE="${DEPLOY_BASE:-/var/www/$APP_NAME}"
HISTORY_FILE="$DEPLOY_BASE/deployment-history.json"
MAX_HISTORY=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Initialize history file if it doesn't exist
init_history() {
    if [ ! -f "$HISTORY_FILE" ]; then
        echo "[]" > "$HISTORY_FILE"
    else
        # Validate JSON format
        if ! jq empty "$HISTORY_FILE" 2>/dev/null; then
            log_error "Corrupted history file detected, resetting..."
            echo "[]" > "$HISTORY_FILE"
        fi
        
        # Ensure it's an array
        local content=$(cat "$HISTORY_FILE")
        if ! echo "$content" | jq -e 'type == "array"' >/dev/null 2>&1; then
            log_error "History file is not an array, resetting..."
            echo "[]" > "$HISTORY_FILE"
        fi
    fi
}

# Record deployment start
record_start() {
    local commit_hash="$1"
    local timestamp="$2"
    local user="${3:-github-actions}"
    
    init_history
    
    local record=$(cat <<EOF
{
  "commit_hash": "$commit_hash",
  "timestamp": "$timestamp",
  "user": "$user",
  "status": "in_progress",
  "started_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
)
    
    # Append to history safely
    local history=$(cat "$HISTORY_FILE")
    if [ "$history" = "[]" ] || [ -z "$history" ]; then
        echo "[$record]" > "$HISTORY_FILE"
    else
        echo "$history" | jq --argjson new "$record" '. += [$new]' > "$HISTORY_FILE.tmp" && mv "$HISTORY_FILE.tmp" "$HISTORY_FILE"
    fi
    
    log_info "Deployment start recorded"
}

# Record deployment complete
record_complete() {
    local commit_hash="$1"
    local status="$2"
    local message="${3:-}"
    
    init_history
    
    # Update the last record with matching commit hash
    local history=$(cat "$HISTORY_FILE")
    echo "$history" | jq --arg hash "$commit_hash" --arg status "$status" --arg msg "$message" --arg completed "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
        'map(if .commit_hash == $hash and .status == "in_progress" then . + {"status": $status, "completed_at": $completed, "message": $msg} else . end)' \
        > "$HISTORY_FILE.tmp" && mv "$HISTORY_FILE.tmp" "$HISTORY_FILE"
    
    # Prune old deployments
    prune_history
    
    log_info "Deployment completion recorded: $status"
}

# Prune deployment history
prune_history() {
    local history=$(cat "$HISTORY_FILE")
    local count=$(echo "$history" | jq 'length')
    
    if [ "$count" -gt "$MAX_HISTORY" ]; then
        log_info "Pruning deployment history (keeping last $MAX_HISTORY)"
        echo "$history" | jq ".[-$MAX_HISTORY:]" > "$HISTORY_FILE"
    fi
}

# Get current deployment
get_current() {
    local current_link="$DEPLOY_BASE/current"
    
    if [ ! -L "$current_link" ]; then
        echo "{\"error\": \"No current deployment\"}"
        return 1
    fi
    
    local release_dir=$(readlink "$current_link")
    local release_name=$(basename "$release_dir")
    
    # Extract timestamp and commit from directory name
    local timestamp=$(echo "$release_name" | cut -d'_' -f1)
    local commit_hash=$(echo "$release_name" | cut -d'_' -f2)
    
    cat <<EOF
{
  "release_name": "$release_name",
  "release_dir": "$release_dir",
  "timestamp": "$timestamp",
  "commit_hash": "$commit_hash"
}
EOF
}

# Get deployment history
get_history() {
    init_history
    cat "$HISTORY_FILE"
}

# Main
if [ $# -lt 1 ]; then
    log_error "Usage: $0 <action> [args...]"
    log_error "Actions: record-start, record-complete, get-current, get-history"
    exit 1
fi

ACTION="$1"
shift

case "$ACTION" in
    record-start)
        if [ $# -lt 2 ]; then
            log_error "Usage: $0 record-start <commit_hash> <timestamp> [user]"
            exit 1
        fi
        record_start "$@"
        ;;
    record-complete)
        if [ $# -lt 2 ]; then
            log_error "Usage: $0 record-complete <commit_hash> <status> [message]"
            exit 1
        fi
        record_complete "$@"
        ;;
    get-current)
        get_current
        ;;
    get-history)
        get_history
        ;;
    *)
        log_error "Unknown action: $ACTION"
        exit 1
        ;;
esac

exit 0
