#!/bin/bash

# Generate SSH Deploy Key for GitHub Actions
# Run this script on your VPS to generate a new SSH key pair

set -e

echo "🔑 GitHub Actions Deploy Key Generator"
echo "========================================"
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  Warning: Not running as root"
    echo "   If you encounter permission issues, run with sudo"
    echo ""
fi

# Determine the user
if [ -n "$SUDO_USER" ]; then
    ACTUAL_USER="$SUDO_USER"
    USER_HOME=$(eval echo ~$SUDO_USER)
else
    ACTUAL_USER="$USER"
    USER_HOME="$HOME"
fi

echo "👤 User: $ACTUAL_USER"
echo "🏠 Home: $USER_HOME"
echo ""

# Create .ssh directory if it doesn't exist
SSH_DIR="$USER_HOME/.ssh"
mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

# Key file paths
PRIVATE_KEY="$SSH_DIR/github_deploy_key"
PUBLIC_KEY="$SSH_DIR/github_deploy_key.pub"

# Check if key already exists
if [ -f "$PRIVATE_KEY" ]; then
    echo "⚠️  Deploy key already exists at: $PRIVATE_KEY"
    read -p "Do you want to overwrite it? (yes/no): " OVERWRITE
    if [ "$OVERWRITE" != "yes" ]; then
        echo "❌ Aborted. Using existing key."
        echo ""
    else
        echo "🗑️  Removing old key..."
        rm -f "$PRIVATE_KEY" "$PUBLIC_KEY"
    fi
fi

# Generate new SSH key if needed
if [ ! -f "$PRIVATE_KEY" ]; then
    echo "🔐 Generating new ED25519 SSH key pair..."
    ssh-keygen -t ed25519 -C "github-actions-deploy-$(date +%Y%m%d)" -f "$PRIVATE_KEY" -N ""
    
    # Set correct permissions
    chmod 600 "$PRIVATE_KEY"
    chmod 644 "$PUBLIC_KEY"
    
    # Set correct ownership if running as sudo
    if [ -n "$SUDO_USER" ]; then
        chown "$SUDO_USER:$SUDO_USER" "$PRIVATE_KEY" "$PUBLIC_KEY"
    fi
    
    echo "✅ Key pair generated successfully!"
    echo ""
fi

# Add public key to authorized_keys
AUTHORIZED_KEYS="$SSH_DIR/authorized_keys"

echo "📝 Adding public key to authorized_keys..."

# Create authorized_keys if it doesn't exist
touch "$AUTHORIZED_KEYS"
chmod 600 "$AUTHORIZED_KEYS"

# Check if key already exists in authorized_keys
PUBLIC_KEY_CONTENT=$(cat "$PUBLIC_KEY")
if grep -qF "$PUBLIC_KEY_CONTENT" "$AUTHORIZED_KEYS" 2>/dev/null; then
    echo "✅ Public key already in authorized_keys"
else
    echo "$PUBLIC_KEY_CONTENT" >> "$AUTHORIZED_KEYS"
    echo "✅ Public key added to authorized_keys"
fi

# Set correct ownership if running as sudo
if [ -n "$SUDO_USER" ]; then
    chown "$SUDO_USER:$SUDO_USER" "$AUTHORIZED_KEYS"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SSH Key Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Display key information
KEY_INFO=$(ssh-keygen -l -f "$PRIVATE_KEY")
echo "🔐 Key Information:"
echo "   $KEY_INFO"
echo ""

# Display public key
echo "📋 Public Key (already added to authorized_keys):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat "$PUBLIC_KEY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Display private key for GitHub
echo "🔑 PRIVATE KEY - Copy this to GitHub Secret VPS_SSH_KEY:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat "$PRIVATE_KEY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Instructions
echo "📝 Next Steps:"
echo ""
echo "1. Copy the PRIVATE KEY above (including BEGIN/END lines)"
echo "2. Go to GitHub → Your Repository → Settings"
echo "3. Navigate to: Secrets and variables → Actions"
echo "4. Find or create secret: VPS_SSH_KEY"
echo "5. Paste the ENTIRE private key (all lines)"
echo "6. Click 'Add secret' or 'Update secret'"
echo ""
echo "⚠️  IMPORTANT:"
echo "   - Copy the COMPLETE private key including:"
echo "     -----BEGIN OPENSSH PRIVATE KEY-----"
echo "     (all the key data lines)"
echo "     -----END OPENSSH PRIVATE KEY-----"
echo ""
echo "   - Do NOT add extra spaces or newlines"
echo "   - The key should work immediately after adding to GitHub"
echo ""

# Test SSH connection
echo "🧪 Testing SSH Configuration:"
echo ""
echo "   SSH Directory: $SSH_DIR"
echo "   Permissions: $(ls -ld "$SSH_DIR" | awk '{print $1}')"
echo "   Authorized Keys: $(ls -l "$AUTHORIZED_KEYS" | awk '{print $1}')"
echo "   Key Count: $(wc -l < "$AUTHORIZED_KEYS") keys"
echo ""

# Verify SSH service
if systemctl is-active --quiet ssh || systemctl is-active --quiet sshd; then
    echo "✅ SSH service is running"
else
    echo "⚠️  SSH service may not be running"
    echo "   Run: sudo systemctl status ssh"
fi

echo ""
echo "🔒 Security Notes:"
echo "   - Private key location: $PRIVATE_KEY"
echo "   - Keep this private key secure"
echo "   - Never commit it to your repository"
echo "   - Only share it via GitHub Secrets"
echo ""
echo "✅ Setup complete! You can now deploy from GitHub Actions."
echo ""
