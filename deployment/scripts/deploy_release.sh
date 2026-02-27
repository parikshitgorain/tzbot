#!/bin/bash
# Enhanced deploy release with intelligent PM2 process management
# Usage: ./deploy_release.sh

set -e

# Configuration
LOG_LEVEL="${LOG_LEVEL:-INFO}"  # DEBUG, INFO, WARN, ERROR

# Logging functions
log_debug() {
  [ "$LOG_LEVEL" = "DEBUG" ] && echo "[DEBUG] $1"
}

log_info() {
  echo "[INFO] $1"
}

log_warn() {
  echo "[WARN] $1"
}

log_error() {
  echo "[ERROR] $1" >&2
}

# Deployment lock to prevent concurrent deployments
LOCK_FILE="/tmp/tzbot-deploy.lock"
LOCK_TIMEOUT=900  # 15 minutes

# Check for existing lock
if [ -f "$LOCK_FILE" ]; then
  LOCK_AGE=$(($(date +%s) - $(stat -c %Y "$LOCK_FILE" 2>/dev/null || stat -f %m "$LOCK_FILE" 2>/dev/null || echo 0)))
  
  if [ "$LOCK_AGE" -lt "$LOCK_TIMEOUT" ]; then
    echo "❌ Another deployment is in progress (started ${LOCK_AGE}s ago)"
    echo "   If this is a stale lock, remove: $LOCK_FILE"
    exit 1
  else
    echo "⚠️ Removing stale lock file (${LOCK_AGE}s old)"
    rm -f "$LOCK_FILE"
  fi
fi

# Create lock file and ensure cleanup on exit
trap "rm -f $LOCK_FILE" EXIT INT TERM
echo "$$" > "$LOCK_FILE"

# Track deployment timing
DEPLOY_START_TIME=$(date +%s)

# Configurable paths
APP_DIR="${TZBOT_APP_DIR:-/var/www/tzbot}"
RELEASES_DIR="$APP_DIR/releases"
SHARED_DIR="$APP_DIR/shared"
CURRENT_LINK="$APP_DIR/current"
RELEASE_NAME="release-$(date +%Y%m%d-%H%M%S)"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_NAME"
MAX_START_ATTEMPTS=3
STARTUP_WAIT=30

log_info "Using APP_DIR: $APP_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Starting Enhanced Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Release: $RELEASE_NAME"
echo "Target: $APP_DIR"

# Check available disk space (need at least 500MB)
echo ""
echo "💾 Checking disk space..."
AVAILABLE_KB=$(df "$APP_DIR" 2>/dev/null | awk 'NR==2 {print $4}' || echo "0")
AVAILABLE_MB=$((AVAILABLE_KB / 1024))

if [ "$AVAILABLE_KB" -lt 512000 ]; then
  echo "❌ Insufficient disk space!"
  echo "   Available: ${AVAILABLE_MB}MB"
  echo "   Required: 500MB minimum"
  exit 1
fi

echo "✅ Sufficient disk space: ${AVAILABLE_MB}MB available"

# Check available memory (need at least 1GB free)
echo ""
echo "🧠 Checking available memory..."
AVAILABLE_MEM_KB=$(free | awk '/^Mem:/ {print $7}' || echo "0")
AVAILABLE_MEM_MB=$((AVAILABLE_MEM_KB / 1024))

if [ "$AVAILABLE_MEM_KB" -lt 1048576 ]; then
  echo "⚠️ Low memory warning!"
  echo "   Available: ${AVAILABLE_MEM_MB}MB"
  echo "   Recommended: 1GB+ free"
  
  # Try to free up memory
  echo "🧹 Attempting to free memory..."
  sync
  echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true
  
  # Check again
  AVAILABLE_MEM_KB=$(free | awk '/^Mem:/ {print $7}' || echo "0")
  AVAILABLE_MEM_MB=$((AVAILABLE_MEM_KB / 1024))
  echo "   After cleanup: ${AVAILABLE_MEM_MB}MB"
  
  if [ "$AVAILABLE_MEM_KB" -lt 524288 ]; then
    echo "❌ Critical: Less than 512MB free memory!"
    echo "   Deployment may fail. Consider:"
    echo "   1. Stopping other services"
    echo "   2. Upgrading VPS RAM"
    echo "   3. Using swap space"
    exit 1
  fi
else
  echo "✅ Sufficient memory: ${AVAILABLE_MEM_MB}MB available"
fi

# Check system load
echo ""
echo "📊 Checking system load..."
LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | tr -d ',')
CPU_COUNT=$(nproc)
echo "   Load average: $LOAD_AVG"
echo "   CPU cores: $CPU_COUNT"

# Warning if load is high
LOAD_INT=$(echo "$LOAD_AVG" | cut -d'.' -f1)
if [ "$LOAD_INT" -gt "$CPU_COUNT" ]; then
  echo "⚠️ High system load detected!"
  echo "   Waiting 30s for load to decrease..."
  sleep 30
fi

# Log deployment to audit trail
echo ""
echo "📝 Recording deployment..."
AUDIT_LOG="$APP_DIR/deployment-audit.log"
mkdir -p "$(dirname "$AUDIT_LOG")"
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | $RELEASE_NAME | $(whoami) | Deployment started" >> "$AUDIT_LOG"

# Create directories
echo ""
echo "📁 Creating release directory structure..."
mkdir -p "$RELEASE_DIR"
mkdir -p "$SHARED_DIR"
mkdir -p "$SHARED_DIR/logs"
mkdir -p "$SHARED_DIR/data/state"
echo "✅ Directories created"

# Extract deployment package
echo ""
echo "📦 Extracting deployment package..."
if [ ! -f "/tmp/deployment-package.tar.gz" ]; then
  echo "❌ Deployment package not found at /tmp/deployment-package.tar.gz"
  exit 1
fi

tar -xzf /tmp/deployment-package.tar.gz -C "$RELEASE_DIR"
rm /tmp/deployment-package.tar.gz
echo "✅ Package extracted"

# Verify dist directory exists (pre-built on GitHub Actions)
echo ""
echo "🔍 Verifying pre-built application..."
if [ ! -d "$RELEASE_DIR/dist" ]; then
  echo "❌ dist directory not found! Build should happen on GitHub Actions."
  exit 1
fi
echo "✅ Pre-built application verified"

# Create symlinks to shared resources
echo ""
echo "🔗 Creating symlinks to shared resources..."
rm -rf "$RELEASE_DIR/logs"
ln -sf "$SHARED_DIR/logs" "$RELEASE_DIR/logs"

# Ensure data directory exists before creating symlink
mkdir -p "$RELEASE_DIR/data"
rm -rf "$RELEASE_DIR/data/state"
ln -sf "$SHARED_DIR/data/state" "$RELEASE_DIR/data/state"

if [ -f "$SHARED_DIR/.env" ]; then
  ln -sf "$SHARED_DIR/.env" "$RELEASE_DIR/.env"
  echo "✅ .env symlink created"
else
  echo "❌ ERROR: .env file not found in $SHARED_DIR"
  echo "Please create .env file in shared directory before deploying"
  exit 1
fi

# Verify node_modules exists (should be included in package)
echo ""
echo "📦 Verifying dependencies..."
if [ ! -d "$RELEASE_DIR/node_modules" ]; then
  echo "⚠️ node_modules not found in package, installing..."
  cd "$RELEASE_DIR"
  npm ci --production --no-audit --prefer-offline
  echo "✅ Dependencies installed"
else
  echo "✅ Dependencies included in package"
fi

# Setup AI if enabled
echo ""
echo "🤖 Checking AI configuration..."
if grep -q "^AI_ENABLED=true" "$SHARED_DIR/.env" 2>/dev/null; then
  echo "AI is enabled, checking Ollama setup..."
  
  # Check if Ollama is installed
  if command -v ollama &> /dev/null; then
    echo "✅ Ollama is installed"
    
    # Check if Ollama service is running
    if systemctl is-active --quiet ollama 2>/dev/null; then
      echo "✅ Ollama service is running"
    else
      echo "⚠️ Ollama service is not running"
      echo "Run: sudo systemctl start ollama"
    fi
    
    # Check if model is downloaded
    AI_MODEL=$(grep "^AI_MODEL_NAME=" "$SHARED_DIR/.env" | cut -d'=' -f2 || echo "llama3.2:1b")
    if ollama list | grep -q "$AI_MODEL"; then
      echo "✅ Model $AI_MODEL is available"
    else
      echo "⚠️ Model $AI_MODEL not found"
      echo "Downloading model (this may take a few minutes)..."
      if timeout 600 ollama pull "$AI_MODEL"; then
        echo "✅ Model downloaded successfully"
      else
        echo "❌ Failed to download model"
        echo "You can download it manually: ollama pull $AI_MODEL"
      fi
    fi
  else
    echo "⚠️ Ollama is not installed but AI is enabled"
    echo "Run setup script: sudo bash deployment/scripts/setup-ai-vps.sh"
  fi
else
  echo "ℹ️ AI is disabled in configuration"
fi

# Update current symlink (atomic switch)
echo ""
echo "🔄 Updating current symlink..."
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

# Verify symlink was created
echo "🔍 Verifying current symlink..."
if [ ! -L "$CURRENT_LINK" ]; then
  echo "❌ Current symlink was not created!"
  exit 1
fi

LINK_TARGET=$(readlink -f "$CURRENT_LINK")
if [ "$LINK_TARGET" != "$RELEASE_DIR" ]; then
  echo "❌ Current symlink points to wrong directory!"
  echo "Expected: $RELEASE_DIR"
  echo "Actual: $LINK_TARGET"
  exit 1
fi

echo "✅ Symlink verified: $CURRENT_LINK -> $RELEASE_DIR"

# Function to safely stop PM2 process
stop_pm2_process() {
  local process_name=$1
  echo ""
  echo "🛑 Stopping PM2 process: $process_name"
  
  if pm2 describe "$process_name" > /dev/null 2>&1; then
    # Get current status
    local status=$(pm2 jlist | jq -r ".[] | select(.name==\"$process_name\") | .pm2_env.status" 2>/dev/null || echo "unknown")
    echo "Current status: $status"
    
    # Try graceful stop first
    echo "Attempting graceful stop..."
    if pm2 stop "$process_name" 2>/dev/null; then
      echo "✅ Graceful stop successful"
      sleep 2
    else
      echo "⚠️ Graceful stop failed, trying force stop..."
      pm2 stop "$process_name" --force 2>/dev/null || true
      sleep 2
    fi
    
    # Delete the process
    echo "Deleting PM2 process..."
    if pm2 delete "$process_name" 2>/dev/null; then
      echo "✅ Process deleted"
    else
      echo "⚠️ Delete failed, forcing..."
      pm2 delete "$process_name" --force 2>/dev/null || true
    fi
    
    # Wait for complete cleanup with verification
    sleep 3
    
    # Verify deletion
    for i in {1..5}; do
      if ! pm2 describe "$process_name" > /dev/null 2>&1; then
        break
      fi
      echo "⏳ Waiting for process cleanup... ($i/5)"
      sleep 1
    done
    
    # Final verification
    if pm2 describe "$process_name" > /dev/null 2>&1; then
      echo "⚠️ Process still exists, forcing cleanup..."
      pm2 kill 2>/dev/null || true
      sleep 2
      pm2 resurrect 2>/dev/null || true
    else
      echo "✅ Process completely removed"
    fi
  else
    echo "ℹ️ No existing process found"
  fi
}

# Function to start PM2 process with retries
start_pm2_process() {
  local attempt=1
  
  while [ $attempt -le $MAX_START_ATTEMPTS ]; do
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🚀 Start Attempt $attempt of $MAX_START_ATTEMPTS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Clear old logs
    echo "Clearing old PM2 logs..."
    pm2 flush tzbot 2>/dev/null || true
    
    # Verify ecosystem config exists
    if [ ! -f "ecosystem.config.cjs" ] && [ ! -f "ecosystem.config.js" ]; then
      echo "❌ No ecosystem config file found!"
      return 1
    fi
    
    # Start the process
    echo "Starting PM2 process..."
    if [ -f "ecosystem.config.cjs" ]; then
      if pm2 start ecosystem.config.cjs 2>&1 | tee /tmp/pm2_start.log; then
        echo "✅ PM2 start command executed"
      else
        echo "❌ PM2 start command failed"
        cat /tmp/pm2_start.log
        
        if [ $attempt -lt $MAX_START_ATTEMPTS ]; then
          echo "⏳ Waiting 10s before retry..."
          sleep 10
          attempt=$((attempt + 1))
          continue
        else
          return 1
        fi
      fi
    else
      if pm2 start ecosystem.config.js 2>&1 | tee /tmp/pm2_start.log; then
        echo "✅ PM2 start command executed"
      else
        echo "❌ PM2 start command failed"
        cat /tmp/pm2_start.log
        
        if [ $attempt -lt $MAX_START_ATTEMPTS ]; then
          echo "⏳ Waiting 10s before retry..."
          sleep 10
          attempt=$((attempt + 1))
          continue
        else
          return 1
        fi
      fi
    fi
    
    # Save PM2 process list
    echo "Saving PM2 process list..."
    pm2 save --force
    
    # Wait for startup
    echo ""
    echo "⏳ Waiting ${STARTUP_WAIT}s for application startup..."
    sleep $STARTUP_WAIT
    
    # Check if process exists
    if ! pm2 describe tzbot > /dev/null 2>&1; then
      echo "❌ PM2 process not found after startup!"
      
      if [ $attempt -lt $MAX_START_ATTEMPTS ]; then
        echo "⏳ Retrying..."
        attempt=$((attempt + 1))
        continue
      else
        return 1
      fi
    fi
    
    # Get process metrics
    local status=$(pm2 jlist | jq -r '.[] | select(.name=="tzbot") | .pm2_env.status' 2>/dev/null || echo "unknown")
    local pid=$(pm2 jlist | jq -r '.[] | select(.name=="tzbot") | .pid' 2>/dev/null || echo "0")
    local restarts=$(pm2 jlist | jq -r '.[] | select(.name=="tzbot") | .pm2_env.restart_time' 2>/dev/null || echo "0")
    local memory=$(pm2 jlist | jq -r '.[] | select(.name=="tzbot") | .monit.memory' 2>/dev/null || echo "0")
    
    echo ""
    echo "📊 Process Metrics:"
    echo "  Status: $status"
    echo "  PID: $pid"
    echo "  Restarts: $restarts"
    echo "  Memory: $((memory / 1024 / 1024))MB"
    
    # Check status
    if [ "$status" = "online" ] && [ "$pid" != "0" ]; then
      echo ""
      echo "✅ Process started successfully!"
      
      # Check restart count
      if [ "$restarts" -ge 3 ]; then
        echo "⚠️ WARNING: High restart count ($restarts) - checking logs..."
        echo ""
        echo "📋 Recent logs:"
        pm2 logs tzbot --lines 50 --nostream || true
        
        if [ $attempt -lt $MAX_START_ATTEMPTS ]; then
          echo ""
          echo "⚠️ Restarting due to instability..."
          stop_pm2_process "tzbot"
          attempt=$((attempt + 1))
          continue
        fi
      fi
      
      # Success!
      echo ""
      echo "📋 Application logs:"
      pm2 logs tzbot --lines 30 --nostream || true
      return 0
      
    elif [ "$status" = "errored" ] || [ "$status" = "stopped" ]; then
      echo "❌ Process is $status"
      echo ""
      echo "📋 Error logs:"
      pm2 logs tzbot --err --lines 100 --nostream || true
      
      if [ $attempt -lt $MAX_START_ATTEMPTS ]; then
        echo ""
        echo "🔄 Cleaning up and retrying..."
        stop_pm2_process "tzbot"
        sleep 5
        attempt=$((attempt + 1))
        continue
      else
        return 1
      fi
      
    else
      echo "⚠️ Process status: $status (PID: $pid)"
      echo ""
      echo "📋 Recent logs:"
      pm2 logs tzbot --lines 50 --nostream || true
      
      if [ $attempt -lt $MAX_START_ATTEMPTS ]; then
        echo ""
        echo "⏳ Waiting 15s for stabilization..."
        sleep 15
        
        # Check again
        status=$(pm2 jlist | jq -r '.[] | select(.name=="tzbot") | .pm2_env.status' 2>/dev/null || echo "unknown")
        if [ "$status" = "online" ]; then
          echo "✅ Process stabilized"
          return 0
        else
          echo "❌ Process still unstable, retrying..."
          stop_pm2_process "tzbot"
          attempt=$((attempt + 1))
          continue
        fi
      else
        return 1
      fi
    fi
  done
  
  return 1
}

# Main deployment flow
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 PM2 Process Management"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$CURRENT_LINK"

# Stop existing process
stop_pm2_process "tzbot"

# Start new process with retries
if start_pm2_process; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ PM2 Process Started Successfully"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "❌ Failed to Start PM2 Process"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "📋 Final error logs:"
  pm2 logs tzbot --err --lines 200 --nostream || true
  exit 1
fi

# Display final status
echo ""
echo "📊 Final PM2 Status:"
pm2 list

# Clean old releases (keep last 5)
echo ""
echo "🧹 Cleaning old releases (keeping last 5)..."
cd "$RELEASES_DIR"
ls -t | tail -n +6 | xargs -r rm -rf
echo "✅ Cleanup completed"

# Create weekly backup
echo ""
echo "💾 Creating weekly backup..."
WEEK=$(date +%Y-W%V)
BACKUP_DIR="$APP_DIR/backups/$WEEK"

if [ ! -d "$BACKUP_DIR" ]; then
  mkdir -p "$BACKUP_DIR"
  BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
  
  echo "Creating backup: $BACKUP_NAME"
  cp -r "$CURRENT_LINK" "$BACKUP_DIR/$BACKUP_NAME"
  
  # Keep only last 4 weeks of backups
  cd "$APP_DIR/backups"
  ls -t | tail -n +5 | xargs -r rm -rf
  
  echo "✅ Weekly backup created"
else
  echo "ℹ️ Weekly backup already exists for week $WEEK"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment Completed Successfully"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Release: $RELEASE_NAME"
echo "Location: $RELEASE_DIR"
echo "Current: $CURRENT_LINK"

# Calculate and display deployment time
DEPLOY_END_TIME=$(date +%s)
DEPLOY_DURATION=$((DEPLOY_END_TIME - DEPLOY_START_TIME))
DEPLOY_MINUTES=$((DEPLOY_DURATION / 60))
DEPLOY_SECONDS=$((DEPLOY_DURATION % 60))

if [ $DEPLOY_MINUTES -gt 0 ]; then
  echo "⏱️  Deployment time: ${DEPLOY_MINUTES}m ${DEPLOY_SECONDS}s"
else
  echo "⏱️  Deployment time: ${DEPLOY_SECONDS}s"
fi

# Log successful deployment
AUDIT_LOG="$APP_DIR/deployment-audit.log"
VERSION=$(cat "$RELEASE_DIR/package.json" 2>/dev/null | grep '"version"' | cut -d'"' -f4 || echo "unknown")
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | $RELEASE_NAME | $(whoami) | v$VERSION | SUCCESS | ${DEPLOY_DURATION}s" >> "$AUDIT_LOG"
