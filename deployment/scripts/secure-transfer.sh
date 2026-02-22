#!/bin/bash
#
# Secure File Transfer Utility
# Uses rsync over SSH for encrypted file transfer
#
# Usage: ./secure-transfer.sh <source> <destination> <hostname>
#
# Requirements: 4.3

set -e

# Configuration
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/id_rsa}"
SSH_USER="${SSH_USER:-root}"
RSYNC_OPTS="-avz --progress --delete"

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
if [ $# -lt 3 ]; then
    log_error "Usage: $0 <source> <destination> <hostname>"
    exit 1
fi

SOURCE="$1"
DESTINATION="$2"
HOSTNAME="$3"

# Verify source exists
if [ ! -e "$SOURCE" ]; then
    log_error "Source does not exist: $SOURCE"
    exit 1
fi

# Verify SSH key exists
if [ ! -f "$SSH_KEY_PATH" ]; then
    log_error "SSH key not found at: $SSH_KEY_PATH"
    exit 1
fi

log_info "Starting secure file transfer..."
log_info "Source: $SOURCE"
log_info "Destination: $SSH_USER@$HOSTNAME:$DESTINATION"
log_info "Using encrypted SSH protocol"

# Execute rsync over SSH
if rsync $RSYNC_OPTS \
    -e "ssh -i $SSH_KEY_PATH -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR" \
    "$SOURCE" \
    "$SSH_USER@$HOSTNAME:$DESTINATION"; then
    log_info "File transfer completed successfully"
    exit 0
else
    log_error "File transfer failed"
    exit 1
fi
