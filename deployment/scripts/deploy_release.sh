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

# Verify symlink was created
echo "� Verifying current symlink..."
if [ ! -L "$CURRENT_LINK" ]; then
  echo "❌ Current symlink was not created!"
  exit 1
fi

LINK_TARGET=$(readlink -f "$CURRENT_LINK")
if [ "$LINK_TARGET" != "$RELEASE_DIR" ]; then
  echo "❌ Current symlink points to wrong directory!"
  echo "Expected: $RELEASE_DIR"
  echo "Actual: $LINK_TARGET"
  exit 1
fi

echo "✅ Symlink verified: $CURRENT_LINK -> $RELEASE_DIR"

# Verify .env file exists
if [ ! -f "$SHARED_DIR/.env" ]; then
  echo "❌ ERROR: .env file not found in $SHARED_DIR"
  echo "Please create .env file in shared directory before deploying"
  exit 1
fi

echo "✅ .env file found in shared directory"

# Restart application with PM2
echo "🔄 Restarting application with PM2..."
cd "$CURRENT_LINK"

# Check if PM2 process exists
if pm2 describe tzbot > /dev/null 2>&1; then
  echo "Stopping existing PM2 process..."
  pm2 stop tzbot || true
  
  echo "Deleting existing PM2 process..."
  pm2 delete tzbot || true
  
  # Wait for process to fully terminate
  sleep 2
fi

# Clear PM2 logs before starting
echo "Clearing old PM2 logs..."
pm2 flush tzbot 2>/dev/null || true

# Start fresh PM2 process
echo "Starting fresh PM2 process..."
pm2 start ecosystem.config.cjs

# Save PM2 process list
pm2 save

echo "📊 PM2 Status:"
pm2 list

# Wait for application to initialize
echo "⏳ Waiting for application startup (30 seconds)..."
sleep 30

# Check PM2 status
echo "📊 PM2 Status after startup:"
pm2 list

# Check PM2 logs for errors
echo "📋 Recent PM2 logs:"
pm2 logs tzbot --lines 50 --nostream || true

# Check if process is running
if ! pm2 describe tzbot > /dev/null 2>&1; then
  echo "❌ PM2 process not found after startup!"
  exit 1
fi

# Get process status
STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="tzbot") | .pm2_env.status' 2>/dev/null || echo "unknown")
RESTARTS=$(pm2 jlist | jq -r '.[] | select(.name=="tzbot") | .pm2_env.restart_time' 2>/dev/null || echo "0")

echo "Process status: $STATUS"
echo "Restart count: $RESTARTS"

if [ "$STATUS" != "online" ]; then
  echo "❌ Process is not online! Status: $STATUS"
  echo "📋 Error logs:"
  pm2 logs tzbot --err --lines 100 --nostream || true
  exit 1
fi

if [ "$RESTARTS" -ge 3 ]; then
  echo "⚠️ WARNING: Process has restarted $RESTARTS times - may be unstable"
  echo "📋 Error logs:"
  pm2 logs tzbot --err --lines 100 --nostream || true
fi

# Clean old releases (keep last 5)
echo "🧹 Cleaning old releases (keeping last 5)..."
cd "$RELEASES_DIR"
ls -t | tail -n +6 | xargs -r rm -rf

echo "✅ Deployment completed successfully"
echo "Current release: $RELEASE_NAME"
