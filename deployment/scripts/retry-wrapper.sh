#!/bin/bash
#
# Retry Wrapper - Intelligent retry logic with exponential backoff
# Provides crash protection for deployment operations
#

# Configuration
MAX_RETRIES="${MAX_RETRIES:-3}"
INITIAL_DELAY="${INITIAL_DELAY:-2}"
MAX_DELAY="${MAX_DELAY:-30}"
BACKOFF_MULTIPLIER="${BACKOFF_MULTIPLIER:-2}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log_info() {
    echo -e "${GREEN}[RETRY]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[RETRY]${NC} $1"
}

log_error() {
    echo -e "${RED}[RETRY]${NC} $1"
}

log_debug() {
    echo -e "${BLUE}[RETRY]${NC} $1"
}

#
# Execute command with retry logic
# Usage: retry_command "description" command [args...]
#
retry_command() {
    local description="$1"
    shift
    local command="$@"
    
    local attempt=1
    local delay=$INITIAL_DELAY
    local exit_code=0
    
    log_info "Starting: $description"
    
    while [ $attempt -le $MAX_RETRIES ]; do
        log_debug "Attempt $attempt/$MAX_RETRIES: $description"
        
        # Execute command
        if eval "$command"; then
            log_info "✅ Success: $description (attempt $attempt)"
            return 0
        else
            exit_code=$?
            log_warn "❌ Failed: $description (attempt $attempt, exit code: $exit_code)"
            
            # Check if we should retry
            if [ $attempt -lt $MAX_RETRIES ]; then
                log_info "⏳ Retrying in ${delay}s..."
                sleep $delay
                
                # Exponential backoff
                delay=$((delay * BACKOFF_MULTIPLIER))
                if [ $delay -gt $MAX_DELAY ]; then
                    delay=$MAX_DELAY
                fi
                
                attempt=$((attempt + 1))
            else
                log_error "💥 All retries exhausted for: $description"
                return $exit_code
            fi
        fi
    done
    
    return $exit_code
}

#
# Execute command with retry and fallback
# Usage: retry_with_fallback "description" "primary_command" "fallback_command"
#
retry_with_fallback() {
    local description="$1"
    local primary_command="$2"
    local fallback_command="$3"
    
    log_info "Attempting: $description"
    
    if retry_command "$description (primary)" "$primary_command"; then
        return 0
    fi
    
    if [ -n "$fallback_command" ]; then
        log_warn "Primary failed, trying fallback for: $description"
        if retry_command "$description (fallback)" "$fallback_command"; then
            return 0
        fi
    fi
    
    log_error "Both primary and fallback failed for: $description"
    return 1
}

#
# Execute critical command (no retries, just fail fast)
# Usage: critical_command "description" command [args...]
#
critical_command() {
    local description="$1"
    shift
    local command="$@"
    
    log_info "Critical operation: $description"
    
    if eval "$command"; then
        log_info "✅ Success: $description"
        return 0
    else
        local exit_code=$?
        log_error "💥 Critical failure: $description (exit code: $exit_code)"
        return $exit_code
    fi
}

# Export functions for use in other scripts
export -f retry_command
export -f retry_with_fallback
export -f critical_command
export -f log_info
export -f log_warn
export -f log_error
export -f log_debug
