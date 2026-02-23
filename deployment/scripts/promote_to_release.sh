#!/bin/bash
# Promote clean build to release branch
# Usage: ./promote_to_release.sh <clean_build_dir> <source_sha>

set -e

CLEAN_BUILD_DIR="${1}"
SOURCE_SHA="${2}"

if [ -z "$CLEAN_BUILD_DIR" ] || [ -z "$SOURCE_SHA" ]; then
  echo "❌ Error: Missing required arguments"
  echo "Usage: $0 <clean_build_dir> <source_sha>"
  exit 1
fi

if [ ! -d "$CLEAN_BUILD_DIR" ]; then
  echo "❌ Error: Clean build directory not found: $CLEAN_BUILD_DIR"
  exit 1
fi

echo "🔄 Promoting clean build to release branch..."

# Configure Git
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"

# Checkout or create release branch
git fetch origin release:release 2>/dev/null || git checkout -b release
git checkout release

# Replace with clean production build
echo "🔄 Replacing release branch content with clean build..."
find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -r "$CLEAN_BUILD_DIR"/* .
cp -r "$CLEAN_BUILD_DIR"/.[!.]* . 2>/dev/null || true

git add -A

# Safety check for dev artifacts
echo "🔍 Running safety checks on release branch content..."

UNTRACKED=$(git ls-files --others --exclude-standard)
if [ -n "$UNTRACKED" ]; then
  echo "❌ Untracked files found:"
  echo "$UNTRACKED"
  exit 1
fi
echo "✅ No untracked files"

if git grep -nE 'TODO|DEBUG|FIXME|console\.log' -- '*.js' '*.ts' ':!node_modules' ':!dist' 2>/dev/null | head -10; then
  echo "⚠️ Warning: Found debug statements (review recommended, but not blocking)"
fi

if [ -d "tests/" ]; then
  echo "❌ tests/ directory found in release branch!"
  exit 1
fi

TEST_FILES=$(find . -name "*.test.*" -o -name "*.spec.*" 2>/dev/null | wc -l)
if [ "$TEST_FILES" -gt 0 ]; then
  echo "❌ Found $TEST_FILES test files in release branch!"
  find . -name "*.test.*" -o -name "*.spec.*"
  exit 1
fi

echo "✅ All safety checks passed"

# Clean version for release
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

CLEAN_VERSION=$(echo "$CURRENT_VERSION" | sed 's/-dev\..*//')

if [ "$CURRENT_VERSION" != "$CLEAN_VERSION" ]; then
  echo "Cleaning version: $CURRENT_VERSION → $CLEAN_VERSION"
  npm version "$CLEAN_VERSION" --no-git-tag-version --allow-same-version
  git add package.json package-lock.json
else
  echo "Version already clean: $CLEAN_VERSION"
fi

echo "RELEASE_VERSION=$CLEAN_VERSION" >> "$GITHUB_ENV" 2>/dev/null || echo "RELEASE_VERSION=$CLEAN_VERSION"

# Commit clean production build
if git diff --cached --quiet; then
  echo "No changes to commit"
else
  SHORT_SHA="${SOURCE_SHA:0:7}"
  git commit -m "chore: promote clean build to release

- Source commit: $SHORT_SHA
- Version: $CLEAN_VERSION
- Build date: $(date -u +%Y-%m-%dT%H:%M:%SZ)

[skip ci]"
fi

# Push to release branch
git push origin release
echo "✅ Clean production build pushed to release branch"
