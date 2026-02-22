#!/bin/bash
# VPS Initial Setup Script
# Installs dependencies, creates directory structure, sets up PM2 with auto-recovery

set -e

echo "🚀 Starting VPS Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="${APP_NAME:-tzbot}"
DEPLOY_BASE="${DEPLOY_BASE:-/var/www/tzbot}"
SERVICE_NAME="${SERVICE_NAME:-tzbot}"

echo -e "${GREEN}Configuration:${NC}"
echo "  APP_NAME: $APP_NAME"
echo "  DEPLOY_BASE: $DEPLOY_BASE"
echo "  SERVICE_NAME: $SERVICE_NAME"

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo -e "${YELLOW}⚠️  Running as root${NC}"
fi

# 1. Install PM2 if not installed
echo -e "\n${GREEN}📦 Checking PM2 installation...${NC}"
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2 globally..."
    npm install -g pm2
    echo -e "${GREEN}✅ PM2 installed${NC}"
else
    echo -e "${GREEN}✅ PM2 already installed ($(pm2 --version))${NC}"
fi

# 2. Create directory structure
echo -e "\n${GREEN}📁 Creating directory structure...${NC}"

# Create base deployment directory if it doesn't exist
if [ ! -d "$DEPLOY_BASE" ]; then
    echo "Creating $DEPLOY_BASE..."
    mkdir -p "$DEPLOY_BASE"
fi

# Create deployment subdirectories
mkdir -p "$DEPLOY_BASE/releases"
mkdir -p "$DEPLOY_BASE/shared"
mkdir -p "$DEPLOY_BASE/shared/logs"
mkdir -p "$DEPLOY_BASE/shared/data"
mkdir -p "$DEPLOY_BASE/backups"

echo -e "${GREEN}✅ Directory structure created${NC}"

# 3. Set up PM2 ecosystem file
echo -e "\n${GREEN}⚙️  Creating PM2 ecosystem file...${NC}"
cat > "$DEPLOY_BASE/ecosystem.config.js" << 'EOF'
module.exports = {
  apps: [{
    name: 'tzbot',
    script: './dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    exp_backoff_restart_delay: 100,
    listen_timeout: 10000,
    kill_timeout: 5000
  }]
};
EOF

echo -e "${GREEN}✅ PM2 ecosystem file created${NC}"

# 4. Set up PM2 startup script
echo -e "\n${GREEN}🔄 Configuring PM2 startup...${NC}"
pm2 startup systemd -u $USER --hp $HOME || true
echo -e "${GREEN}✅ PM2 startup configured${NC}"

# 5. Create deployment state file
echo -e "\n${GREEN}📝 Initializing deployment state...${NC}"
cat > "$DEPLOY_BASE/deployment-history.json" << 'EOF'
{
  "deployments": [],
  "currentDeployment": null
}
EOF

echo -e "${GREEN}✅ Deployment state initialized${NC}"

# 6. Set up log rotation
echo -e "\n${GREEN}📋 Setting up log rotation...${NC}"
if command -v logrotate &> /dev/null; then
    cat > /etc/logrotate.d/tzbot << EOF
$DEPLOY_BASE/shared/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    missingok
    create 0644 $USER $USER
}
EOF
    echo -e "${GREEN}✅ Log rotation configured${NC}"
else
    echo -e "${YELLOW}⚠️  logrotate not found, skipping${NC}"
fi

# 7. Create health check script
echo -e "\n${GREEN}🏥 Creating health check script...${NC}"
cat > "$DEPLOY_BASE/health-check-cron.sh" << 'EOFHEALTH'
#!/bin/bash
# Health check script for cron

APP_NAME="tzbot"
LOG_FILE="/var/www/tzbot/shared/logs/health-check.log"

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
EOFHEALTH

chmod +x "$DEPLOY_BASE/health-check-cron.sh"
echo -e "${GREEN}✅ Health check script created${NC}"

# 8. Set up cron job for health checks (every 5 minutes)
echo -e "\n${GREEN}⏰ Setting up health check cron job...${NC}"
CRON_JOB="*/5 * * * * $DEPLOY_BASE/health-check-cron.sh"
(crontab -l 2>/dev/null | grep -v "health-check-cron.sh"; echo "$CRON_JOB") | crontab -
echo -e "${GREEN}✅ Health check cron job configured (runs every 5 minutes)${NC}"

# 9. Set permissions
echo -e "\n${GREEN}🔐 Setting permissions...${NC}"
chown -R $USER:$USER "$DEPLOY_BASE" 2>/dev/null || true
chmod -R 755 "$DEPLOY_BASE"
echo -e "${GREEN}✅ Permissions set${NC}"

# 10. Summary
echo -e "\n${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}✅ VPS Setup Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "Directory structure:"
echo "  $DEPLOY_BASE/"
echo "  ├── releases/          (deployment releases)"
echo "  ├── shared/            (shared files)"
echo "  │   ├── logs/          (application logs)"
echo "  │   └── data/          (persistent data)"
echo "  ├── backups/           (deployment backups)"
echo "  ├── ecosystem.config.js (PM2 config)"
echo "  └── deployment-history.json"
echo ""
echo "PM2 Status:"
pm2 list
echo ""
echo "Auto-recovery enabled:"
echo "  ✅ PM2 auto-restart on crash"
echo "  ✅ PM2 startup on system boot"
echo "  ✅ Health check cron (every 5 minutes)"
echo ""
echo "Next steps:"
echo "  1. Copy .env file to $DEPLOY_BASE/shared/.env"
echo "  2. Run deployment from GitHub Actions"
echo ""
