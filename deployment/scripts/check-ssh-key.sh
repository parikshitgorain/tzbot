#!/bin/bash

# Check if SSH public key exists in authorized_keys
# Usage: bash check-ssh-key.sh "public-key-string"

set -e

echo "🔍 SSH Key Checker"
echo "=================="
echo ""

# The public key to check
PUBLIC_KEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAdLjW+EExPfTQ/ycKGLx+xuIq2Brhumk4Zh7lBMDW3f github-actions-deploy-20260222"

# Determine the user
if [ -n "$SUDO_USER" ]; then
    ACTUAL_USER="$SUDO_USER"
    USER_HOME=$(eval echo ~$SUDO_USER)
else
    ACTUAL_USER="$USER"
    USER_HOME="$HOME"
fi

AUTHORIZED_KEYS="$USER_HOME/.ssh/authorized_keys"

echo "👤 User: $ACTUAL_USER"
echo "🏠 Home: $USER_HOME"
echo "📁 Authorized Keys: $AUTHORIZED_KEYS"
echo ""

# Check if authorized_keys exists
if [ ! -f "$AUTHORIZED_KEYS" ]; then
    echo "❌ authorized_keys file not found!"
    echo ""
    echo "Creating authorized_keys file..."
    mkdir -p "$USER_HOME/.ssh"
    touch "$AUTHORIZED_KEYS"
    chmod 700 "$USER_HOME/.ssh"
    chmod 600 "$AUTHORIZED_KEYS"
    echo "✅ Created: $AUTHORIZED_KEYS"
    echo ""
fi

# Check if the key exists
echo "🔑 Checking for key:"
echo "   $PUBLIC_KEY"
echo ""

if grep -qF "$PUBLIC_KEY" "$AUTHORIZED_KEYS" 2>/dev/null; then
    echo "✅ KEY FOUND! This public key is already in authorized_keys"
    echo ""
    echo "📊 Key Details:"
    grep -F "$PUBLIC_KEY" "$AUTHORIZED_KEYS" | head -1
    echo ""
    echo "✅ GitHub Actions should be able to connect with this key"
else
    echo "❌ KEY NOT FOUND in authorized_keys"
    echo ""
    echo "Would you like to add it now? (yes/no)"
    read -r RESPONSE
    
    if [ "$RESPONSE" = "yes" ]; then
        echo ""
        echo "📝 Adding public key to authorized_keys..."
        echo "$PUBLIC_KEY" >> "$AUTHORIZED_KEYS"
        chmod 600 "$AUTHORIZED_KEYS"
        
        # Set correct ownership if running as sudo
        if [ -n "$SUDO_USER" ]; then
            chown "$SUDO_USER:$SUDO_USER" "$AUTHORIZED_KEYS"
        fi
        
        echo "✅ Public key added successfully!"
        echo ""
    else
        echo "❌ Key not added. Manual action required."
        echo ""
        echo "To add manually, run:"
        echo "  echo '$PUBLIC_KEY' >> $AUTHORIZED_KEYS"
        echo ""
    fi
fi

# Show current authorized_keys info
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Current Authorized Keys Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "File: $AUTHORIZED_KEYS"
echo "Permissions: $(ls -l "$AUTHORIZED_KEYS" | awk '{print $1}')"
echo "Total Keys: $(wc -l < "$AUTHORIZED_KEYS")"
echo ""
echo "Keys in file:"
while IFS= read -r line; do
    if [[ $line == ssh-* ]] || [[ $line == ecdsa-* ]] || [[ $line == rsa-* ]]; then
        KEY_TYPE=$(echo "$line" | awk '{print $1}')
        KEY_COMMENT=$(echo "$line" | awk '{print $NF}')
        if [ "$line" = "$PUBLIC_KEY" ]; then
            echo "  ✅ $KEY_TYPE ... $KEY_COMMENT (GITHUB DEPLOY KEY)"
        else
            echo "  🔑 $KEY_TYPE ... $KEY_COMMENT"
        fi
    fi
done < "$AUTHORIZED_KEYS"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check SSH service
echo "🔍 SSH Service Status:"
if systemctl is-active --quiet ssh 2>/dev/null; then
    echo "   ✅ SSH service is running"
elif systemctl is-active --quiet sshd 2>/dev/null; then
    echo "   ✅ SSHD service is running"
else
    echo "   ⚠️  SSH service status unknown"
    echo "   Check with: sudo systemctl status ssh"
fi
echo ""

# Check SSH directory permissions
echo "🔍 SSH Directory Permissions:"
echo "   ~/.ssh: $(ls -ld "$USER_HOME/.ssh" | awk '{print $1}')"
echo "   authorized_keys: $(ls -l "$AUTHORIZED_KEYS" | awk '{print $1}')"
echo ""

if [ "$(stat -c %a "$USER_HOME/.ssh")" = "700" ] && [ "$(stat -c %a "$AUTHORIZED_KEYS")" = "600" ]; then
    echo "   ✅ Permissions are correct"
else
    echo "   ⚠️  Permissions may need adjustment"
    echo "   Run: chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
fi
echo ""

echo "✅ Check complete!"
echo ""
