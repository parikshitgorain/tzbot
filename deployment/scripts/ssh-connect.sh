#!/bin/bash
#
# SSH Connection Utility
# Establishes SSH connection with key authentication and retry logic
#
# Usage: ./ssh-connect.sh <hostname> <command>
#
# Requirements: 4.1

set -e

# Configuration
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/id_rsa}"
SSH_USER="${SSH_USER:-root}"
SSH_TIMEOUT=30
MAX_RETRIES=3
RETRY_DELAY=5

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
    log_error "Usage: $0 <hostname> [command]"
    exit 1
fi

HOSTNAME="$1"
COMMAND="${2:-echo 'Connection successful'}"

# Verify SSH key exists
if [ ! -f "$SSH_KEY_PATH" ]; then
    log_error "SSH key not found at: $SSH_KEY_PATH"
    log_error "Set SSH_KEY_PATH environment variable or place key at default location"
    exit 1
fi

# Verify SSH key permissions
KEY_PERMS=$(stat -c %a "$SSH_KEY_PATH" 2>/dev/null || stat -f %A "$SSH_KEY_PATH" 2>/dev/null)
if [ "$KEY_PERMS" != "600" ] && [ "$KEY_PERMS" != "400" ]; then
    log_warn "SSH key has insecure permissions: $KEY_PERMS"
    log_info "Setting secure permissions (600)..."
    chmod 600 "$SSH_KEY_PATH"
fi

# SSH connection function with retry logic
ssh_connect() {
    local attempt=1
    
    while [ $attempt -le $MAX_RETRIES ]; do
        log_info "SSH connection attempt $attempt/$MAX_RETRIES to $SSH_USER@$HOSTNAME"
        
        # Attempt SSH connection
        if ssh -i "$SSH_KEY_PATH" \
               -o ConnectTimeout=$SSH_TIMEOUT \
               -o StrictHostKeyChecking=no \
               -o UserKnownHostsFile=/dev/null \
               -o LogLevel=ERROR \
               "$SSH_USER@$HOSTNAME" \
               "$COMMAND" 2>&1; then
            log_info "SSH connection successful"
            return 0
        fi
        
        local exit_code=$?
        log_warn "SSH connection attempt $attempt failed with exit code: $exit_code"
        
        if [ $attempt -lt $MAX_RETRIES ]; then
            log_info "Retrying in $RETRY_DELAY seconds..."
            sleep $RETRY_DELAY
        fi
        
        attempt=$((attempt + 1))
    done
    
    log_error "Failed to establish SSH connection after $MAX_RETRIES attempts"
    return 1
}

# Execute SSH connection
log_info "Establishing SSH connection..."
log_info "Target: $SSH_USER@$HOSTNAME"
log_info "Key: $SSH_KEY_PATH"
log_info "Timeout: ${SSH_TIMEOUT}s"

if ssh_connect; then
    log_info "SSH operation completed successfully"
    exit 0
else
    log_error "SSH operation failed"
    exit 1
fi
