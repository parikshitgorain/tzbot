#!/bin/bash
# Prepare clean production build (remove dev/test artifacts)
# Usage: ./prepare_clean_release.sh <output_dir>

set -e

OUTPUT_DIR="${1:-/tmp/clean-build}"

echo "🧹 Preparing clean production build..."

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Copy production files
echo "📦 Copying production files..."
cp -r dist "$OUTPUT_DIR/"
cp package.json "$OUTPUT_DIR/"
cp package-lock.json "$OUTPUT_DIR/"
cp ecosystem.config.cjs "$OUTPUT_DIR/" 2>/dev/null || cp ecosystem.config.js "$OUTPUT_DIR/" || true
cp -r deployment "$OUTPUT_DIR/"
cp tsconfig.json "$OUTPUT_DIR/"
cp .env.example "$OUTPUT_DIR/"
cp README.md "$OUTPUT_DIR/"

# Copy source (needed for some runtime scenarios)
mkdir -p "$OUTPUT_DIR/src"
cp -r src "$OUTPUT_DIR/"

# Create required directories
mkdir -p "$OUTPUT_DIR/logs"
mkdir -p "$OUTPUT_DIR/data/state"
touch "$OUTPUT_DIR/logs/.gitkeep"

cd "$OUTPUT_DIR"

echo "🗑️ Removing dev/test files..."

# Remove test files
find . -type f \( \
  -name "*.test.ts" -o \
  -name "*.test.js" -o \
  -name "*.spec.ts" -o \
  -name "*.spec.js" -o \
  -name "*.example.ts" -o \
  -name "*.example.js" -o \
  -name "*.mock.ts" -o \
  -name "*.mock.js" \
\) -delete

# Remove dev directories
rm -rf tests/
rm -rf .kiro/
rm -rf .agents/
rm -rf coverage/
rm -rf .vitest/
rm -rf node_modules/.cache/
rm -rf node_modules/.bin/

# Remove dev config files
rm -f vitest.config.*
rm -f tsconfig.test.json
rm -f .eslintrc.*
rm -f .prettierrc*
rm -f eslint.config.js
rm -f skills-lock.json
rm -f .releaserc.json

# Remove scripts directory (not needed in production)
rm -rf scripts/

# Remove CI/CD documentation
rm -f docs/CICD_*.md
rm -f docs/BRANCH_PROTECTION.md
rm -f CICD_*.md
rm -f *_SUMMARY.md
rm -f *_REPORT.md
rm -f *_COMPLETE.md
rm -f CHANGELOG.md
rm -f *.log

# Remove VCS files (keep .github/workflows for CD/release workflows)
rm -rf .git
rm -rf .github/ISSUE_TEMPLATE 2>/dev/null || true
rm -rf .github/pull_request_template.md 2>/dev/null || true
rm -f .github/BRANCHING_STRATEGY.md 2>/dev/null || true
rm -f .github/DEPLOYMENT_GUIDE.md 2>/dev/null || true
# Keep .github/workflows/ for CD and release workflows
rm -f .gitignore
rm -f .gitattributes
rm -f .neon

# Remove example configs from deployment
find deployment -name "*.example.*" -delete 2>/dev/null || true
find deployment -name "vps-config.example.json" -delete 2>/dev/null || true

echo "✅ Clean production build created"
echo "📦 Production build size: $(du -sh . | cut -f1)"

# Verification
echo "🔍 Verifying production build..."
[ -d "dist" ] || { echo "❌ Missing dist/"; exit 1; }
[ -f "package.json" ] || { echo "❌ Missing package.json"; exit 1; }
[ -f "ecosystem.config.cjs" ] || [ -f "ecosystem.config.js" ] || { echo "❌ Missing ecosystem config"; exit 1; }
[ -d "deployment/scripts" ] || { echo "❌ Missing deployment/scripts"; exit 1; }
echo "✅ Production build verified"

# Final safety check
echo "🔍 Final safety check for dev artifacts..."
DEV_COUNT=$(find . -name "*.test.*" -o -name "*.spec.*" -o -name "*.mock.*" 2>/dev/null | wc -l)
if [ "$DEV_COUNT" -gt 0 ]; then
  echo "❌ Found $DEV_COUNT dev/test files after cleanup!"
  find . -name "*.test.*" -o -name "*.spec.*" -o -name "*.mock.*"
  exit 1
fi

if grep -rn "console\.log\|TODO\|DEBUG\|FIXME" dist/ 2>/dev/null | grep -v "node_modules" | head -5; then
  echo "⚠️ Warning: Found debug statements in dist/ (review recommended)"
fi

echo "✅ Final safety check passed"
