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

# Fetch latest branches
git fetch origin

# Get the source branch name (Development or development)
SOURCE_BRANCH=$(git branch -r --contains "$SOURCE_SHA" | grep -E 'origin/(Development|development)' | head -1 | sed 's/.*origin\///')
if [ -z "$SOURCE_BRANCH" ]; then
  SOURCE_BRANCH="Development"
fi

echo "📝 Source branch: $SOURCE_BRANCH"
echo "📝 Source commit: $SOURCE_SHA"

# Checkout or create release branch
if git show-ref --verify --quiet refs/remotes/origin/release; then
  echo "📥 Checking out existing release branch..."
  git checkout -B release origin/release
else
  echo "🆕 Creating new release branch..."
  git checkout -b release
fi

# Merge Development into release
echo "🔀 Merging $SOURCE_BRANCH into release..."
MERGE_SUCCESS=false
if git merge "origin/$SOURCE_BRANCH" -X theirs --no-ff -m "chore: sync with $SOURCE_BRANCH

Syncing release branch with Development commits.
Using theirs strategy to prefer Development changes.

Source commit: ${SOURCE_SHA:0:7}"; then
  MERGE_SUCCESS=true
  echo "✅ Merge successful"
else
  echo "❌ Merge failed, using clean build..."
  git merge --abort 2>/dev/null || true
  
  # Fallback: Replace with clean build
  find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
  cp -r "$CLEAN_BUILD_DIR"/* .
  cp -r "$CLEAN_BUILD_DIR"/.[!.]* . 2>/dev/null || true
  git add -A
fi

# Remove dev artifacts
echo "🧹 Removing dev artifacts from release..."
rm -rf tests/ coverage/ .github/workflows/ci-development.yml
rm -f vitest.config.ts eslint.config.js .eslintrc* tsconfig.json
find . -name "*.test.*" -o -name "*.spec.*" | xargs rm -f 2>/dev/null || true

# Copy production build artifacts from clean build
if [ "$MERGE_SUCCESS" = true ]; then
  echo "📦 Copying production build from clean build..."
  if [ -d "$CLEAN_BUILD_DIR/dist" ]; then
    rm -rf dist/
    cp -r "$CLEAN_BUILD_DIR/dist" .
    echo "✅ Copied dist/ directory"
  else
    echo "❌ dist/ not found in clean build!"
    exit 1
  fi
fi

# Stage all changes
git add -A

# Safety checks
echo "🔍 Running safety checks..."

if [ -d "tests/" ]; then
  echo "❌ tests/ directory found!"
  exit 1
fi

TEST_FILES=$(find . -name "*.test.*" -o -name "*.spec.*" 2>/dev/null | wc -l)
if [ "$TEST_FILES" -gt 0 ]; then
  echo "❌ Found $TEST_FILES test files!"
  exit 1
fi

echo "✅ All safety checks passed"

# Clean version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

CLEAN_VERSION=$(echo "$CURRENT_VERSION" | sed 's/-dev\..*//')

if [ "$CURRENT_VERSION" != "$CLEAN_VERSION" ]; then
  echo "Cleaning version: $CURRENT_VERSION → $CLEAN_VERSION"
  npm version "$CLEAN_VERSION" --no-git-tag-version --allow-same-version
  git add package.json package-lock.json
fi

# Commit cleanup
if git diff --cached --quiet; then
  echo "ℹ️ No changes to commit"
else
  git commit -m "chore: clean dev artifacts from release

- Removed: tests/, coverage/, dev configs
- Source commit: ${SOURCE_SHA:0:7}
- Version: $CLEAN_VERSION

[skip ci]"
fi

# Push to release
echo "📤 Pushing to release branch..."
git push origin release

if [ $? -eq 0 ]; then
  echo "✅ Release branch updated"
  echo "🔄 Release versioning workflow should trigger"
else
  echo "❌ Failed to push"
  exit 1
fi
