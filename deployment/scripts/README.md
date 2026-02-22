# Deployment Scripts

This directory contains utility scripts for the CI/CD deployment system.

## Scripts

### resolve-dns.sh

Resolves a dynamic DNS hostname to an IP address with retry logic and exponential backoff.

**Features:**
- Automatic retry with exponential backoff (5 attempts: 1s, 2s, 4s, 8s, 16s)
- Supports both `dig` and `nslookup` (with automatic fallback)
- Detailed logging of each resolution attempt
- Returns only the IP address on success for easy parsing

**Usage:**

```bash
./resolve-dns.sh <hostname>
```

**Example:**

```bash
# Resolve a dynamic DNS hostname
./resolve-dns.sh mybot.ddns.net

# Output (last line is the IP address):
# [2024-01-17 10:30:00] Starting DNS resolution for hostname: mybot.ddns.net
# [2024-01-17 10:30:00] Attempt 1/5: Resolving mybot.ddns.net...
# [SUCCESS] DNS resolution successful: mybot.ddns.net -> 192.168.1.100
# 192.168.1.100
```

**Exit Codes:**
- `0` - Success (IP address resolved)
- `1` - Invalid arguments (no hostname provided)
- `2` - DNS resolution failed after all retries

**Integration Example:**

```bash
# In a GitHub Actions workflow or deployment script
VPS_IP=$(./deployment/scripts/resolve-dns.sh "$DYNAMIC_DNS_HOSTNAME")

if [ $? -eq 0 ]; then
  echo "Resolved VPS IP: $VPS_IP"
  # Proceed with SSH connection
  ssh -i "$SSH_KEY" "$SSH_USER@$VPS_IP" "cd /opt/discord-bot && ./deploy.sh"
else
  echo "Failed to resolve VPS IP address"
  exit 1
fi
```

**Requirements Satisfied:**
- Requirement 3.1: DNS resolution using Dynamic DNS service
- Requirement 3.2: Query DNS service for current VPS address
- Requirement 3.3: Retry with exponential backoff (5 attempts)
- Requirement 3.4: Abort deployment on DNS failure

## Testing

Unit tests for the DNS resolution script are located in `tests/unit/deployment/dns-resolution.test.ts`.

Run tests with:

```bash
npm test -- tests/unit/deployment/dns-resolution.test.ts
```
