#!/bin/bash

# SSH Key Validation and Formatting Helper
# This script helps validate and properly format SSH keys for GitHub Secrets

set -e

echo "🔑 SSH Key Validation Helper"
echo "================================"
echo ""

# Check if key file is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <path-to-private-key>"
    echo ""
    echo "Example:"
    echo "  $0 ~/.ssh/id_ed25519"
    echo "  $0 ~/.ssh/deploy_key"
    echo ""
    exit 1
fi

KEY_FILE="$1"

# Check if file exists
if [ ! -f "$KEY_FILE" ]; then
    echo "❌ Error: Key file not found: $KEY_FILE"
    exit 1
fi

echo "📁 Validating key file: $KEY_FILE"
echo ""

# Check file permissions
PERMS=$(stat -c %a "$KEY_FILE" 2>/dev/null || stat -f %A "$KEY_FILE" 2>/dev/null)
if [ "$PERMS" != "600" ] && [ "$PERMS" != "400" ]; then
    echo "⚠️  Warning: Key file permissions are $PERMS (should be 600 or 400)"
    echo "   Run: chmod 600 $KEY_FILE"
    echo ""
fi

# Validate key format
if ! ssh-keygen -l -f "$KEY_FILE" &>/dev/null; then
    echo "❌ Error: Invalid SSH key format"
    echo ""
    echo "The key file is not a valid SSH private key."
    echo "Please ensure you're using the PRIVATE key (not the .pub file)"
    exit 1
fi

# Get key info
KEY_INFO=$(ssh-keygen -l -f "$KEY_FILE")
echo "✅ Valid SSH key detected"
echo "   $KEY_INFO"
echo ""

# Check key type
if grep -q "BEGIN OPENSSH PRIVATE KEY" "$KEY_FILE"; then
    KEY_TYPE="OpenSSH"
elif grep -q "BEGIN RSA PRIVATE KEY" "$KEY_FILE"; then
    KEY_TYPE="RSA (PEM)"
elif grep -q "BEGIN EC PRIVATE KEY" "$KEY_FILE"; then
    KEY_TYPE="EC (PEM)"
else
    echo "⚠️  Warning: Unknown key format"
    KEY_TYPE="Unknown"
fi

echo "🔐 Key Type: $KEY_TYPE"
echo ""

# Display the key in proper format
echo "📋 Copy this EXACT content to GitHub Secret VPS_SSH_KEY:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat "$KEY_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Count lines
LINE_COUNT=$(wc -l < "$KEY_FILE")
echo "📊 Key Statistics:"
echo "   Lines: $LINE_COUNT"
echo "   Size: $(wc -c < "$KEY_FILE") bytes"
echo ""

# Check for common issues
echo "🔍 Checking for common issues..."

# Check for trailing whitespace
if grep -q '[[:space:]]$' "$KEY_FILE"; then
    echo "   ⚠️  Warning: Key has trailing whitespace on some lines"
fi

# Check for Windows line endings
if file "$KEY_FILE" | grep -q CRLF; then
    echo "   ⚠️  Warning: Key has Windows line endings (CRLF)"
    echo "      Run: dos2unix $KEY_FILE"
fi

# Check header and footer
if ! head -n 1 "$KEY_FILE" | grep -q "BEGIN.*PRIVATE KEY"; then
    echo "   ❌ Error: Missing proper header line"
fi

if ! tail -n 1 "$KEY_FILE" | grep -q "END.*PRIVATE KEY"; then
    echo "   ❌ Error: Missing proper footer line"
fi

echo ""
echo "✅ Validation complete!"
echo ""
echo "📝 Next Steps:"
echo "   1. Copy the key content shown above (including BEGIN/END lines)"
echo "   2. Go to GitHub → Settings → Secrets → Actions"
echo "   3. Edit or create VPS_SSH_KEY secret"
echo "   4. Paste the ENTIRE key content (no extra spaces or newlines)"
echo "   5. Save the secret"
echo ""
echo "🔒 Security Reminder:"
echo "   - Never share this private key"
echo "   - The corresponding public key should be in VPS ~/.ssh/authorized_keys"
echo "   - Keep permissions at 600 (chmod 600 $KEY_FILE)"
echo ""
