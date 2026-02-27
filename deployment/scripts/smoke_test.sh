#!/bin/bash
# Smoke test - Quick validation that bot is functioning
# Usage: ./smoke_test.sh

set -e

echo "🧪 Running smoke tests..."

# Test 1: Check if PM2 process is running
echo "1️⃣ Testing PM2 process..."
if ! pm2 describe tzbot > /dev/null 2>&1; then
  echo "❌ PM2 process not found"
  exit 1
fi

STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="tzbot") | .pm2_env.status' 2>/dev/null || echo "unknown")
if [ "$STATUS" != "online" ]; then
  echo "❌ Process status: $STATUS (expected: online)"
  exit 1
fi
echo "✅ PM2 process is online"

# Test 2: Check if process has been stable (no recent restarts)
echo "2️⃣ Testing process stability..."
RESTARTS=$(pm2 jlist | jq -r '.[] | select(.name=="tzbot") | .pm2_env.restart_time' 2>/dev/null || echo "999")
if [ "$RESTARTS" -ge 3 ]; then
  echo "⚠️ High restart count: $RESTARTS"
  echo "📋 Recent error logs:"
  pm2 logs tzbot --err --lines 20 --nostream || true
  exit 1
fi
echo "✅ Process is stable (restarts: $RESTARTS)"

# Test 3: Check if .env file is loaded
echo "3️⃣ Testing environment configuration..."
if [ ! -f "/var/www/tzbot/current/.env" ]; then
  echo "❌ .env file not found"
  exit 1
fi
echo "✅ Environment file exists"

# Test 4: Check recent logs for errors
echo "4️⃣ Testing for critical errors..."
ERROR_COUNT=$(pm2 logs tzbot --err --lines 50 --nostream 2>/dev/null | grep -iE "(error|fatal|exception)" | wc -l || echo "0")
if [ "$ERROR_COUNT" -gt 5 ]; then
  echo "⚠️ Found $ERROR_COUNT error messages in recent logs"
  echo "📋 Recent errors:"
  pm2 logs tzbot --err --lines 20 --nostream | grep -iE "(error|fatal|exception)" || true
  exit 1
fi
echo "✅ No critical errors in recent logs"

# Test 5: Check memory usage
echo "5️⃣ Testing memory usage..."
MEMORY=$(pm2 jlist | jq -r '.[] | select(.name=="tzbot") | .monit.memory' 2>/dev/null || echo "0")
MEMORY_MB=$((MEMORY / 1024 / 1024))
if [ "$MEMORY_MB" -gt 1500 ]; then
  echo "⚠️ High memory usage: ${MEMORY_MB}MB"
  exit 1
fi
echo "✅ Memory usage is normal: ${MEMORY_MB}MB"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All smoke tests passed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

