#!/bin/bash
# Rollback to previous release
# Usage: ./rollback.sh [release_name]

set -e

APP_DIR="/var/www/tzbot"
RELEASES_DIR="$APP_DIR/releases"
CURRENT_LINK="$APP_DIR/current"

echo "🔄 Starting rollback..."

# Get target release
if [ -n "$1" ]; then
  TARGET_RELEASE="$1"
  TARGET_DIR="$RELEASES_DIR/$TARGET_RELEASE"
  
  if [ ! -d "$TARGET_DIR" ]; then
    echo "❌ Release not found: $TARGET_RELEASE"
    echo "Available releases:"
    ls -1 "$RELEASES_DIR"
    exit 1
  fi
else
  # Get previous release (second most recent)
  CURRENT_RELEASE=$(readlink "$CURRENT_LINK" | xargs basename)
  echo "Current release: $CURRENT_RELEASE"
  
  TARGET_RELEASE=$(ls -t "$RELEASES_DIR" | grep -v "^$CURRENT_RELEASE$" | head -n1)
  
  if [ -z "$TARGET_RELEASE" ]; then
    echo "❌ No previous release found for rollback"
    echo "Available releases:"
    ls -1 "$RELEASES_DIR"
    exit 1
  fi
  
  TARGET_DIR="$RELEASES_DIR/$TARGET_RELEASE"
fi

echo "Rolling back to: $TARGET_RELEASE"

# Verify target release
if [ ! -d "$TARGET_DIR" ]; then
  echo "❌ Target release directory not found: $TARGET_DIR"
  exit 1
fi

if [ ! -f "$TARGET_DIR/package.json" ]; then
  echo "❌ Invalid release: package.json not found"
  exit 1
fi

# Update current symlink
echo "🔗 Updating current symlink..."
ln -sfn "$TARGET_DIR" "$CURRENT_LINK"

# Restart application
echo "🔄 Restarting application..."
cd "$CURRENT_LINK"
if pm2 describe tzbot > /dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

echo "✅ Rollback completed successfully"
echo "Active release: $TARGET_RELEASE"

# Show release info
if [ -f "$TARGET_DIR/package.json" ]; then
  VERSION=$(node -p "require('$TARGET_DIR/package.json').version" 2>/dev/null || echo "unknown")
  echo "Version: $VERSION"
fi
