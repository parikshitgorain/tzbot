#!/bin/bash
#
# Main Deployment Script for VPS
# Deploys application to VPS with timestamped releases
#
# Usage: ./deploy.sh <commit_hash> <timestamp>
#
# Requirements: 5.1, 5.2, 5.3, 5.4, 5.5

set -e

# Configuration
APP_NAME="${APP_NAME:-tzbot}"
DEPLOY_BASE="${DEPLOY_BASE:-/var/www/tzbot}"
RELEASES_DIR="$DEPLOY_BASE/releases"
CURRENT_LINK="$DEPLOY_BASE/current"
REPO_URL="${REPO_URL:-https://github.com/parikshitgorain/tzbot.git}"
BRANCH="${BRANCH:-release}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Validate inputs
if [ $# -lt 2 ]; then
    log_error "Usage: $0 <commit_hash> <timestamp>"
    exit 1
fi

COMMIT_HASH="$1"
TIMESTAMP="$2"
RELEASE_NAME="${TIMESTAMP}_${COMMIT_HASH:0:7}"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_NAME"

log_info "Starting deployment..."
log_info "Commit: $COMMIT_HASH"
log_info "Timestamp: $TIMESTAMP"
log_info "Release: $RELEASE_NAME"

# Create directories if they don't exist
log_step "Creating directory structure..."
mkdir -p "$RELEASES_DIR"
mkdir -p "$DEPLOY_BASE/logs"
mkdir -p "$DEPLOY_BASE/shared"

# Create timestamped release directory
log_step "Creating release directory: $RELEASE_DIR"
if [ -d "$RELEASE_DIR" ]; then
    log_warn "Release directory already exists, removing..."
    rm -rf "$RELEASE_DIR"
fi
mkdir -p "$RELEASE_DIR"

# Clone repository
log_step "Cloning repository from $BRANCH branch..."
if ! git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$RELEASE_DIR"; then
    log_error "Failed to clone repository"
    rm -rf "$RELEASE_DIR"
    exit 1
fi

# Verify commit hash
log_step "Verifying commit hash..."
cd "$RELEASE_DIR"
ACTUAL_COMMIT=$(git rev-parse HEAD)
if [ "$ACTUAL_COMMIT" != "$COMMIT_HASH" ]; then
    log_warn "Commit hash mismatch: expected $COMMIT_HASH, got $ACTUAL_COMMIT"
fi

# Remove any dev-only files that might have slipped through
log_step "Cleaning dev-only files from deployment..."
rm -rf tests/ .kiro/specs/ .agents/ || true
rm -f vitest.config.* tsconfig.test.* .eslintrc.* .prettierrc eslint.config.js skills-lock.json || true
find . -name "*.test.ts" -o -name "*.test.js" -o -name "*.example.ts" -o -name "*.example.js" | grep -v node_modules | xargs rm -f || true
log_info "✓ Dev files cleaned"

# Install dependencies (with all devDependencies for build)
log_step "Installing dependencies..."
if ! npm install; then
    log_error "Failed to install dependencies"
    exit 1
fi

# Build application
log_step "Building TypeScript application..."
if ! npm run build; then
    log_error "Failed to build application"
    exit 1
fi

# Resolve path aliases
log_step "Resolving TypeScript path aliases..."
if ! npx tsc-alias --project tsconfig.json; then
    log_warn "Failed to resolve path aliases, continuing anyway..."
fi

# Remove dev dependencies after build
log_step "Removing dev dependencies..."
npm prune --production || log_warn "Failed to prune dev dependencies"

# Create/update symlink to new release
log_step "Updating current symlink..."
if [ -L "$CURRENT_LINK" ]; then
    PREVIOUS_RELEASE=$(readlink "$CURRENT_LINK")
    log_info "Previous release: $PREVIOUS_RELEASE"
fi

# Atomic symlink update
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK.tmp"
mv -Tf "$CURRENT_LINK.tmp" "$CURRENT_LINK"

log_info "Deployment completed successfully"
log_info "Release directory: $RELEASE_DIR"
log_info "Current symlink: $CURRENT_LINK -> $RELEASE_DIR"

exit 0
