#!/bin/bash
#
# Rollback Script
# Rolls back to a previous deployment
#
# Usage: ./rollback.sh [commit_hash|previous]
#
# Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6

set -e

# Configuration
APP_NAME="${APP_NAME:-tzbot}"
DEPLOY_BASE="${DEPLOY_BASE:-/var/www/$APP_NAME}"
RELEASES_DIR="$DEPLOY_BASE/releases"
CURRENT_LINK="$DEPLOY_BASE/current"
SERVICE_NAME="${SERVICE_NAME:-tzbot}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Get current release
get_current_release() {
    if [ -L "$CURRENT_LINK" ]; then
        readlink "$CURRENT_LINK"
    else
        echo ""
    fi
}

# Get previous release
get_previous_release() {
    local current=$(get_current_release)
    local current_name=$(basename "$current")
    
    # List releases sorted by timestamp (newest first)
    local releases=$(ls -t "$RELEASES_DIR" 2>/dev/null || echo "")
    
    # Find the release before current
    local found_current=false
    for release in $releases; do
        if [ "$found_current" = true ]; then
            echo "$RELEASES_DIR/$release"
            return 0
        fi
        if [ "$release" = "$current_name" ]; then
            found_current=true
        fi
    done
    
    echo ""
}

# Find release by commit hash
find_release_by_commit() {
    local commit_hash="$1"
    local short_hash="${commit_hash:0:7}"
    
    for release_dir in "$RELEASES_DIR"/*; do
        if [[ "$(basename "$release_dir")" == *"$short_hash"* ]]; then
            echo "$release_dir"
            return 0
        fi
    done
    
    echo ""
}

# Validate inputs
TARGET="${1:-previous}"

log_info "Starting rollback process..."
log_info "Target: $TARGET"

# Determine target release
if [ "$TARGET" = "previous" ]; then
    log_step "Finding previous release..."
    TARGET_RELEASE=$(get_previous_release)
    if [ -z "$TARGET_RELEASE" ]; then
        log_error "No previous release found"
        exit 1
    fi
else
    log_step "Finding release for commit: $TARGET"
    TARGET_RELEASE=$(find_release_by_commit "$TARGET")
    if [ -z "$TARGET_RELEASE" ]; then
        log_error "Release not found for commit: $TARGET"
        exit 1
    fi
fi

log_info "Target release: $TARGET_RELEASE"

# Verify target release exists
if [ ! -d "$TARGET_RELEASE" ]; then
    log_error "Target release directory does not exist: $TARGET_RELEASE"
    exit 1
fi

# Get current release for logging
CURRENT_RELEASE=$(get_current_release)
log_info "Current release: $CURRENT_RELEASE"

# Stop service
log_step "Stopping application service..."
if ! bash "$(dirname "$0")/service-manager.sh" stop "$SERVICE_NAME"; then
    log_error "Failed to stop service"
    exit 1
fi

# Update symlink
log_step "Updating current symlink to target release..."
ln -sfn "$TARGET_RELEASE" "$CURRENT_LINK.tmp"
mv -Tf "$CURRENT_LINK.tmp" "$CURRENT_LINK"

# Start service
log_step "Starting application service..."
if ! bash "$(dirname "$0")/service-manager.sh" start "$SERVICE_NAME"; then
    log_error "Failed to start service after rollback"
    log_error "CRITICAL: Manual intervention required!"
    exit 1
fi

# Run health checks
log_step "Running health checks on rolled back version..."
if bash "$(dirname "$0")/health-check.sh" "$SERVICE_NAME"; then
    log_info "Rollback completed successfully!"
    log_info "Rolled back from: $CURRENT_RELEASE"
    log_info "Rolled back to: $TARGET_RELEASE"
    exit 0
else
    log_error "Health checks failed after rollback"
    log_error "CRITICAL: Application may be in unstable state!"
    log_error "Manual intervention required!"
    exit 1
fi
