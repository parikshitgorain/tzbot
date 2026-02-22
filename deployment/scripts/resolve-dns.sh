#!/bin/bash

# DNS Resolution Script with Exponential Backoff
# Resolves a dynamic DNS hostname to an IP address with retry logic
# Requirements: 3.1, 3.2, 3.3, 3.4

set -euo pipefail

# Configuration
HOSTNAME="${1:-}"
MAX_ATTEMPTS=5
RETRY_DELAYS=(1 2 4 8 16)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Usage information
usage() {
    cat << EOF
Usage: $0 <hostname>

Resolves a dynamic DNS hostname to an IP address with retry logic.

Arguments:
  hostname    The DNS hostname to resolve (e.g., mybot.ddns.net)

Example:
  $0 mybot.ddns.net

Exit codes:
  0 - Success (IP address resolved)
  1 - Invalid arguments
  2 - DNS resolution failed after all retries (deployment aborted)

Error Handling:
  - Implements exponential backoff retry (5 attempts: 1s, 2s, 4s, 8s, 16s)
  - Logs each retry attempt with detailed failure information
  - Aborts deployment on exhausted retries with exit code 2
  - Provides actionable error messages for administrators
EOF
    exit 1
}

# Validate arguments
if [ -z "$HOSTNAME" ]; then
    log_error "Hostname is required"
    usage
fi

# Check if dig is available, fallback to nslookup
resolve_dns() {
    local hostname="$1"
    local ip=""
    
    if command -v dig &> /dev/null; then
        # Use dig for DNS resolution, suppress errors and extract IPv4 address
        ip=$(dig +short "$hostname" A 2>&1 | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -n1 || echo "")
    elif command -v nslookup &> /dev/null; then
        # Fallback to nslookup, suppress errors and extract IPv4 address
        ip=$(nslookup "$hostname" 2>&1 | awk '/^Address: / { print $2 }' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -n1 || echo "")
    else
        log_error "Neither 'dig' nor 'nslookup' command found. Please install dnsutils or bind-utils."
        log_error "DEPLOYMENT ABORTED: DNS resolution tools not available"
        exit 2
    fi
    
    echo "$ip"
}

# Validate IP address format
is_valid_ip() {
    local ip="$1"
    if [[ $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        return 0
    else
        return 1
    fi
}

# Main resolution logic with retry
log "Starting DNS resolution for hostname: $HOSTNAME"

for attempt in $(seq 1 $MAX_ATTEMPTS); do
    log "Attempt $attempt/$MAX_ATTEMPTS: Resolving $HOSTNAME..."
    
    # Attempt DNS resolution
    IP_ADDRESS=$(resolve_dns "$HOSTNAME" || echo "")
    
    # Check if we got a valid IP address
    if [ -n "$IP_ADDRESS" ] && is_valid_ip "$IP_ADDRESS"; then
        log_success "DNS resolution successful: $HOSTNAME -> $IP_ADDRESS"
        echo "$IP_ADDRESS"
        exit 0
    else
        # Provide detailed failure information
        if [ -z "$IP_ADDRESS" ]; then
            log_warning "DNS resolution failed for $HOSTNAME (attempt $attempt/$MAX_ATTEMPTS): No IP address returned"
            log_warning "Possible causes: DNS service unavailable, hostname not configured, network connectivity issues"
        else
            log_warning "DNS resolution failed for $HOSTNAME (attempt $attempt/$MAX_ATTEMPTS): Invalid IP format: $IP_ADDRESS"
            log_warning "Possible causes: DNS misconfiguration, CNAME without A record, non-IPv4 response"
        fi
        
        # If not the last attempt, wait before retrying
        if [ $attempt -lt $MAX_ATTEMPTS ]; then
            delay=${RETRY_DELAYS[$((attempt-1))]}
            log "Waiting ${delay}s before retry (exponential backoff)..."
            sleep "$delay"
        fi
    fi
done

# All attempts exhausted - abort deployment
log_error "=========================================="
log_error "DNS RESOLUTION FAILED - DEPLOYMENT ABORTED"
log_error "=========================================="
log_error "Failed to resolve hostname: $HOSTNAME"
log_error "Attempts made: $MAX_ATTEMPTS"
log_error "Total retry time: 31 seconds (1+2+4+8+16)"
log_error ""
log_error "DEPLOYMENT CANNOT PROCEED without valid VPS IP address"
log_error ""
log_error "Required Actions:"
log_error "  1. Verify Dynamic DNS service is operational"
log_error "  2. Confirm hostname '$HOSTNAME' is correctly configured"
log_error "  3. Check network connectivity to DNS servers"
log_error "  4. Review Dynamic DNS client logs on VPS"
log_error "  5. Verify VPS is online and updating DNS records"
log_error ""
log_error "For immediate assistance, contact system administrators"
log_error "=========================================="
exit 2
