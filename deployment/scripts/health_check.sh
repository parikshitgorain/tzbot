#!/bin/bash
# Health check with retries and exponential backoff
# Usage: ./health_check.sh [max_attempts] [initial_delay]

set -e

MAX_ATTEMPTS="${1:-10}"
INITIAL_DELAY="${2:-10}"

echo "🏥 Running health checks..."
echo "Max attempts: $MAX_ATTEMPTS"
echo "Initial delay: ${INITIAL_DELAY}s"

ATTEMPT=1
DELAY=$INITIAL_DELAY

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  echo ""
  echo "Health check attempt $ATTEMPT of $MAX_ATTEMPTS..."
  
  # Check if PM2 process exists
  if ! pm2 describe tzbot > /dev/null 2>&1; then
    echo "❌ PM2 process 'tzbot' not found"
    
    if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
      echo "⏳ Waiting ${DELAY}s before retry..."
      sleep $DELAY
      DELAY=$((DELAY * 2))  # Exponential backoff
      ATTEMPT=$((ATTEMPT + 1))
      continue
    else
      echo "❌ Health check failed: Process not found after $MAX_ATTEMPTS attempts"
      exit 1
    fi
  fi
  
  # Get process status
  STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="tzbot") | .pm2_env.status' 2>/dev/null || echo "unknown")
  RESTARTS=$(pm2 jlist | jq -r '.[] | select(.name=="tzbot") | .pm2_env.restart_time' 2>/dev/null || echo "0")
  UPTIME=$(pm2 jlist | jq -r '.[] | select(.name=="tzbot") | .pm2_env.pm_uptime' 2>/dev/null || echo "0")
  MEMORY=$(pm2 jlist | jq -r '.[] | select(.name=="tzbot") | .monit.memory' 2>/dev/null || echo "0")
  
  echo "Status: $STATUS"
  echo "Restarts: $RESTARTS"
  echo "Memory: $((MEMORY / 1024 / 1024))MB"
  
  # Check if process is online
  if [ "$STATUS" = "online" ]; then
    echo "✅ PM2 process is online"
    
    # Check restart count (high restarts indicate instability)
    if [ "$RESTARTS" -lt 5 ]; then
      echo "✅ Restart count is acceptable: $RESTARTS"
      
      # Check if process has been up for at least 20 seconds
      CURRENT_TIME=$(date +%s)
      UPTIME_SECONDS=$(( (CURRENT_TIME * 1000 - UPTIME) / 1000 ))
      
      if [ "$UPTIME_SECONDS" -ge 20 ]; then
        echo "✅ Process has been stable for ${UPTIME_SECONDS}s"
        echo "✅ Health check passed"
        exit 0
      else
        echo "⚠️ Process just started (${UPTIME_SECONDS}s uptime)"
      fi
    else
      echo "⚠️ High restart count: $RESTARTS"
      echo "📋 Recent error logs:"
      pm2 logs tzbot --err --lines 50 --nostream || true
    fi
  else
    echo "❌ PM2 process status: $STATUS"
    if [ "$STATUS" = "errored" ] || [ "$STATUS" = "stopped" ]; then
      echo "📋 Error logs:"
      pm2 logs tzbot --err --lines 100 --nostream || true
    fi
  fi
  
  # Retry logic
  if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
    echo "⏳ Waiting ${DELAY}s before retry..."
    sleep $DELAY
    DELAY=$((DELAY * 2))  # Exponential backoff
  fi
  
  ATTEMPT=$((ATTEMPT + 1))
done

echo ""
echo "❌ Health check failed after $MAX_ATTEMPTS attempts"
echo "Final status: $STATUS"
echo "Final restarts: $RESTARTS"
exit 1
