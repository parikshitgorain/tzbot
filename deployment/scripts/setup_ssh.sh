#!/bin/bash
# Setup SSH for secure VPS connection
# Usage: ./setup_ssh.sh <ssh_key> <vps_host>

set -e

SSH_KEY="${1}"
VPS_HOST="${2}"

if [ -z "$SSH_KEY" ] || [ -z "$VPS_HOST" ]; then
  echo "❌ Error: Missing required arguments"
  echo "Usage: $0 <ssh_key> <vps_host>"
  exit 1
fi

echo "🔐 Setting up SSH connection..."

# Create SSH directory
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Write SSH key
echo "$SSH_KEY" > ~/.ssh/deploy_key
chmod 600 ~/.ssh/deploy_key

# Resolve hostname and add to known_hosts
echo "🔍 Resolving hostname: $VPS_HOST"
if command -v dig &> /dev/null; then
  IP=$(dig +short "$VPS_HOST" | grep -E '^[0-9.]+$' | head -n1)
elif command -v nslookup &> /dev/null; then
  IP=$(nslookup "$VPS_HOST" | awk '/^Address: / { print $2 }' | grep -E '^[0-9.]+$' | head -n1)
else
  IP="$VPS_HOST"
fi

if [ -z "$IP" ]; then
  echo "❌ Failed to resolve hostname: $VPS_HOST"
  exit 1
fi

echo "✅ Resolved $VPS_HOST to $IP"

# Add host keys using ssh-keyscan (secure)
echo "🔑 Adding host keys to known_hosts..."
ssh-keyscan -H "$VPS_HOST" >> ~/.ssh/known_hosts 2>/dev/null || true
ssh-keyscan -H "$IP" >> ~/.ssh/known_hosts 2>/dev/null || true

echo "✅ SSH setup complete"
echo "VPS_IP=$IP" >> "$GITHUB_OUTPUT" 2>/dev/null || echo "VPS_IP=$IP"
