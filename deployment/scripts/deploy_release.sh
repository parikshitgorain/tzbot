#!/bin/bash
# Deploy release to VPS with atomic deployment
# Usage: ./deploy_release.sh

set -e

APP_DIR="/var/www/tzbot"
RELEASES_DIR="$APP_DIR/releases"
SHARED_DIR="$APP_DIR/shared"
CURRENT_LINK="$APP_DIR/current"
RELEASE_NAME="release-$(date +%Y%m%d-%H%M%S)"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_NAME"

echo "🚀 Starting deployment..."
echo "Release: $RELEASE_NAME"

# Create directories
echo "📁 Creating release directory: $RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
mkdir -p "$SHARED_DIR"
mkdir -p "$SHARED_DIR/logs"
mkdir -p "$SHARED_DIR/data/state"

# Extract deployment package
echo "📦 Extracting deployment package..."
if [ ! -f "/tmp/deployment-package.tar.gz" ]; then
  echo "❌ Deployment package not found at /tmp/deployment-package.tar.gz"
  exit 1
fi

tar -xzf /tmp/deployment-package.tar.gz -C "$RELEASE_DIR"
rm /tmp/deployment-package.tar.gz

# Create symlinks to shared resources
echo "🔗 Creating symlinks to shared resources..."
rm -rf "$RELEASE_DIR/logs"
ln -sf "$SHARED_DIR/logs" "$RELEASE_DIR/logs"

# Ensure data directory exists before creating symlink
mkdir -p "$RELEASE_DIR/data"
rm -rf "$RELEASE_DIR/data/state"
ln -sf "$SHARED_DIR/data/state" "$RELEASE_DIR/data/state"

if [ -f "$SHARED_DIR/.env" ]; then
  ln -sf "$SHARED_DIR/.env" "$RELEASE_DIR/.env"
else
  echo "⚠️ Warning: .env file not found in shared directory"
fi

# Install dependencies
echo "📦 Installing production dependencies..."
cd "$RELEASE_DIR"
npm ci --production --no-audit --prefer-offline

# Update current symlink (atomic switch)
echo "🔄 Updating current symlink..."
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

# Restart application with PM2
echo "🔄 Restarting application with PM2..."
cd "$CURRENT_LINK"
if pm2 describe tzbot > /dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

# Clean old releases (keep last 5)
echo "🧹 Cleaning old releases (keeping last 5)..."
cd "$RELEASES_DIR"
ls -t | tail -n +6 | xargs -r rm -rf

echo "✅ Deployment completed successfully"
echo "Current release: $RELEASE_NAME"
