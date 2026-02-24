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

# Checkout or create release branch
if git show-ref --verify --quiet refs/remotes/origin/release; then
  echo "📥 Checking out existing release branch..."
  git checkout -B release origin/release
else
  echo "🆕 Creating new release branch..."
  git checkout -b release
fi

# Get the source branch name (Development or development)
SOURCE_BRANCH=$(git branch -r --contains "$SOURCE_SHA" | grep -E 'origin/(Development|development)' | head -1 | sed 's/.*origin\///')
if [ -z "$SOURCE_BRANCH" ]; then
  SOURCE_BRANCH="Development"
fi

echo "📝 Source branch: $SOURCE_BRANCH"
echo "📝 Source commit: $SOURCE_SHA"

# Reset release to match Development (preserving commit history)
echo "🔄 Resetting release to match $SOURCE_BRANCH..."
git reset --hard "origin/$SOURCE_BRANCH"

# Now remove dev artifacts (this will be a new commit)
echo "🧹 Removing dev artifacts from release..."

# Remove dev-only files and directories
rm -rf tests/ coverage/ .github/workflows/ci-development.yml
rm -f vitest.config.ts eslint.config.js .eslintrc* tsconfig.json
find . -name "*.test.*" -o -name "*.spec.*" | xargs rm -f 2>/dev/null || true

# Stage the cleanup
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
  echo "ℹ️ No changes to commit after merge and cleanup"
else
  SHORT_SHA="${SOURCE_SHA:0:7}"
  git commit -m "chore: clean dev artifacts from release

- Removed: tests/, coverage/, dev configs
- Source commit: $SHORT_SHA
- Version: $CLEAN_VERSION
- Build date: $(date -u +%Y-%m-%dT%H:%M:%SZ)

[skip ci]"
fi

# Push to release branch
# Note: Using force-with-lease to safely overwrite release branch
# This preserves all Development commits for semantic-release to analyze
echo "📤 Force pushing to release branch..."
git push origin release --force-with-lease

if [ $? -eq 0 ]; then
  echo "✅ Release branch updated with all Development commits"
  echo "🔄 Release versioning workflow should trigger automatically"
else
  echo "❌ Failed to push to release branch"
  exit 1
fi
