#!/bin/bash
# Health check script for cron

APP_NAME="tzbot"
LOG_FILE="/www/tzbot/shared/logs/health-check.log"

# Check if PM2 process is running
if ! pm2 list | grep -q "$APP_NAME.*online"; then
    echo "[$(date)] ❌ $APP_NAME is not running, attempting restart..." >> "$LOG_FILE"
    pm2 restart "$APP_NAME" >> "$LOG_FILE" 2>&1
    
    # Wait and check again
    sleep 5
    if pm2 list | grep -q "$APP_NAME.*online"; then
        echo "[$(date)] ✅ $APP_NAME restarted successfully" >> "$LOG_FILE"
    else
        echo "[$(date)] 🚨 $APP_NAME restart failed!" >> "$LOG_FILE"
    fi
else
    echo "[$(date)] ✅ $APP_NAME is running" >> "$LOG_FILE"
fi
