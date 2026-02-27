#!/bin/bash
# Enhanced health check with intelligent retry and recovery logic
# Usage: ./health_check.sh [max_attempts] [initial_delay]

set -e

MAX_ATTEMPTS="${1:-10}"
INITIAL_DELAY="${2:-10}"
FORCE_RESTART_THRESHOLD=3  # Force restart after 3 failed attempts

echo "🏥 Running enhanced health checks..."
echo "Max attempts: $MAX_ATTEMPTS"
echo "Initial delay: ${INITIAL_DELAY}s"
echo "Force restart threshold: $FORCE_RESTART_THRESHOLD attempts"

ATTEMPT=1
DELAY=$INITIAL_DELAY
CONSECUTIVE_FAILURES=0

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Health check attempt $ATTEMPT of $MAX_ATTEMPTS"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  # Check if PM2 process exists
  if ! pm2 describe tzbot > /dev/null 2>&1; then
    echo "❌ PM2 process 'tzbot' not found"
    CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
    
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
  
  # Get process status and metrics
  STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="tzbot") | .pm2_env.status' 2>/dev/null || echo "unknown")
  RESTARTS=$(pm2 jlist | jq -r '.[] | select(.name=="tzbot") | .pm2_env.restart_time' 2>/dev/null || echo "0")
  UPTIME=$(pm2 jlist | jq -r '.[] | select(.name=="tzbot") | .pm2_env.pm_uptime' 2>/dev/null || echo "0")
  MEMORY=$(pm2 jlist | jq -r '.[] | select(.name=="tzbot") | .monit.memory' 2>/dev/null || echo "0")
  PID=$(pm2 jlist | jq -r '.[] | select(.name=="tzbot") | .pid' 2>/dev/null || echo "0")
  
  echo "📊 Current Status:"
  echo "  Status: $STATUS"
  echo "  PID: $PID"
  echo "  Restarts: $RESTARTS"
  echo "  Memory: $((MEMORY / 1024 / 1024))MB"
  
  # Handle different status scenarios
  case "$STATUS" in
    "online")
      echo "✅ PM2 process is online"
      
      # Check if PID is valid (not 0)
      if [ "$PID" -eq 0 ]; then
        echo "⚠️ Invalid PID (0) - process may be starting"
        CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
      else
        # Check restart count (high restarts indicate instability)
        if [ "$RESTARTS" -lt 5 ]; then
          echo "✅ Restart count is acceptable: $RESTARTS"
          
          # Check if process has been up for at least 20 seconds
          CURRENT_TIME=$(date +%s)
          UPTIME_SECONDS=$(( (CURRENT_TIME * 1000 - UPTIME) / 1000 ))
          
          if [ "$UPTIME_SECONDS" -ge 20 ]; then
            echo "✅ Process has been stable for ${UPTIME_SECONDS}s"
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "✅ Health check PASSED"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            exit 0
          else
            echo "⚠️ Process just started (${UPTIME_SECONDS}s uptime)"
            echo "   Waiting for stability..."
            CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
          fi
        else
          echo "⚠️ High restart count: $RESTARTS (indicates instability)"
          echo "📋 Recent error logs:"
          pm2 logs tzbot --err --lines 30 --nostream || true
          CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
        fi
      fi
      ;;
      
    "stopping"|"stopped")
      echo "❌ Process is $STATUS"
      echo "🔄 Attempting to restart..."
      pm2 restart tzbot || true
      sleep 5
      CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
      ;;
      
    "waiting restart"|"launching"|"errored")
      echo "❌ Process status: $STATUS"
      CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
      
      # If we've failed multiple times, force a hard restart
      if [ $CONSECUTIVE_FAILURES -ge $FORCE_RESTART_THRESHOLD ]; then
        echo ""
        echo "⚠️ Multiple failures detected ($CONSECUTIVE_FAILURES)"
        echo "🔄 Forcing hard restart..."
        
        # Show error logs before restart
        echo "📋 Error logs before restart:"
        pm2 logs tzbot --err --lines 50 --nostream || true
        
        # Force stop and restart
        pm2 stop tzbot || true
        sleep 2
        pm2 delete tzbot || true
        sleep 2
        
        # Restart from ecosystem file
        if [ -f "ecosystem.config.cjs" ]; then
          pm2 start ecosystem.config.cjs
        elif [ -f "ecosystem.config.js" ]; then
          pm2 start ecosystem.config.js
        else
          echo "❌ No ecosystem config file found"
          exit 1
        fi
        
        echo "✅ Hard restart completed"
        sleep 10  # Give it time to start
        CONSECUTIVE_FAILURES=0  # Reset counter after restart
      else
        echo "📋 Error logs:"
        pm2 logs tzbot --err --lines 50 --nostream || true
      fi
      ;;
      
    *)
      echo "❌ Unknown status: $STATUS"
      CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
      ;;
  esac
  
  # Retry logic
  if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
    echo ""
    echo "⏳ Waiting ${DELAY}s before next attempt..."
    sleep $DELAY
    
    # Exponential backoff, but cap at 80 seconds
    NEW_DELAY=$((DELAY * 2))
    if [ $NEW_DELAY -gt 80 ]; then
      DELAY=80
    else
      DELAY=$NEW_DELAY
    fi
  fi
  
  ATTEMPT=$((ATTEMPT + 1))
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "❌ Health check FAILED after $MAX_ATTEMPTS attempts"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Final status: $STATUS"
echo "Final restarts: $RESTARTS"
echo "Consecutive failures: $CONSECUTIVE_FAILURES"
echo ""
echo "📋 Final error logs:"
pm2 logs tzbot --err --lines 100 --nostream || true
exit 1
