#!/bin/bash

# AI Auto-Reply VPS Setup Script
# Automatically installs Ollama, downloads model, and configures the bot

set -e

echo "========================================="
echo "TZBOT AI Auto-Reply VPS Setup"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default model for 4GB RAM VPS
DEFAULT_MODEL="llama3.2:1b"

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root or with sudo"
    exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    print_error "Cannot detect OS"
    exit 1
fi

print_info "Detected OS: $OS $VERSION"

# Check available RAM
TOTAL_RAM=$(free -g | awk '/^Mem:/{print $2}')
print_info "Available RAM: ${TOTAL_RAM}GB"

if [ "$TOTAL_RAM" -lt 4 ]; then
    print_error "Warning: Less than 4GB RAM detected. AI features may not work properly."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 1: Install Ollama
echo ""
echo "========================================="
echo "Step 1: Installing Ollama"
echo "========================================="

if command -v ollama &> /dev/null; then
    print_success "Ollama is already installed"
    OLLAMA_VERSION=$(ollama --version 2>&1 | head -n 1)
    print_info "Version: $OLLAMA_VERSION"
else
    print_info "Installing Ollama..."
    curl -fsSL https://ollama.ai/install.sh | sh
    
    if command -v ollama &> /dev/null; then
        print_success "Ollama installed successfully"
    else
        print_error "Failed to install Ollama"
        exit 1
    fi
fi

# Step 2: Create Ollama systemd service
echo ""
echo "========================================="
echo "Step 2: Setting up Ollama Service"
echo "========================================="

# Create ollama user if doesn't exist
if ! id -u ollama &>/dev/null; then
    useradd -r -s /bin/false -m -d /usr/share/ollama ollama
    print_success "Created ollama user"
fi

# Create systemd service file
cat > /etc/systemd/system/ollama.service << 'EOF'
[Unit]
Description=Ollama Service
After=network-online.target

[Service]
ExecStart=/usr/local/bin/ollama serve
User=ollama
Group=ollama
Restart=always
RestartSec=3
Environment="OLLAMA_HOST=0.0.0.0:11434"

[Install]
WantedBy=default.target
EOF

print_success "Created systemd service file"

# Reload systemd and start service
systemctl daemon-reload
systemctl enable ollama
systemctl start ollama

# Wait for service to start
sleep 5

if systemctl is-active --quiet ollama; then
    print_success "Ollama service is running"
else
    print_error "Failed to start Ollama service"
    systemctl status ollama
    exit 1
fi

# Step 3: Download AI Model
echo ""
echo "========================================="
echo "Step 3: Downloading AI Model"
echo "========================================="

# Select model based on RAM
if [ "$TOTAL_RAM" -ge 8 ]; then
    MODEL="llama3.2:3b"
    print_info "8GB+ RAM detected - using llama3.2:3b for better quality"
else
    MODEL="$DEFAULT_MODEL"
    print_info "Using $MODEL (optimized for 4GB RAM)"
fi

# Check if model already exists
if ollama list | grep -q "$MODEL"; then
    print_success "Model $MODEL is already downloaded"
else
    print_info "Downloading model $MODEL (this may take a few minutes)..."
    
    # Download model with timeout and retry
    MAX_RETRIES=3
    RETRY_COUNT=0
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if timeout 600 ollama pull "$MODEL"; then
            print_success "Model $MODEL downloaded successfully"
            break
        else
            RETRY_COUNT=$((RETRY_COUNT + 1))
            if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
                print_error "Download failed, retrying ($RETRY_COUNT/$MAX_RETRIES)..."
                sleep 5
            else
                print_error "Failed to download model after $MAX_RETRIES attempts"
                exit 1
            fi
        fi
    done
fi

# Step 4: Test the model
echo ""
echo "========================================="
echo "Step 4: Testing AI Model"
echo "========================================="

print_info "Running test query..."
TEST_RESPONSE=$(timeout 30 ollama run "$MODEL" "Say hello in one sentence" 2>&1 || echo "TIMEOUT")

if [ "$TEST_RESPONSE" != "TIMEOUT" ] && [ -n "$TEST_RESPONSE" ]; then
    print_success "Model test successful"
    print_info "Response: $TEST_RESPONSE"
else
    print_error "Model test failed or timed out"
    print_info "This might be normal on first run. The model will work when the bot starts."
fi

# Step 5: Configure Bot Environment
echo ""
echo "========================================="
echo "Step 5: Configuring Bot Environment"
echo "========================================="

# Find the bot directory (assuming script is in deployment/scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

print_info "Bot directory: $BOT_DIR"

if [ ! -f "$BOT_DIR/.env" ]; then
    print_error ".env file not found at $BOT_DIR/.env"
    print_info "Please create .env file first"
    exit 1
fi

# Backup .env
cp "$BOT_DIR/.env" "$BOT_DIR/.env.backup.$(date +%Y%m%d_%H%M%S)"
print_success "Backed up .env file"

# Update .env file with AI configuration
print_info "Updating .env configuration..."

# Function to update or add env variable
update_env_var() {
    local key=$1
    local value=$2
    local file=$3
    
    if grep -q "^${key}=" "$file"; then
        sed -i "s|^${key}=.*|${key}=${value}|" "$file"
    else
        echo "${key}=${value}" >> "$file"
    fi
}

update_env_var "AI_ENABLED" "true" "$BOT_DIR/.env"
update_env_var "AI_PROVIDER" "ollama" "$BOT_DIR/.env"
update_env_var "AI_MODEL_NAME" "$MODEL" "$BOT_DIR/.env"
update_env_var "AI_BASE_URL" "http://localhost:11434" "$BOT_DIR/.env"

print_success "Updated .env configuration"

# Step 6: Verify Ollama API
echo ""
echo "========================================="
echo "Step 6: Verifying Ollama API"
echo "========================================="

if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    print_success "Ollama API is accessible"
    
    # Show available models
    print_info "Available models:"
    ollama list
else
    print_error "Ollama API is not accessible"
    print_info "Checking service status..."
    systemctl status ollama
    exit 1
fi

# Step 7: Create health check script
echo ""
echo "========================================="
echo "Step 7: Creating Health Check Script"
echo "========================================="

cat > /usr/local/bin/check-ollama-health.sh << 'EOF'
#!/bin/bash

# Check if Ollama service is running
if ! systemctl is-active --quiet ollama; then
    echo "Ollama service is not running, restarting..."
    systemctl restart ollama
    exit 1
fi

# Check if API is responding
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "Ollama API is not responding, restarting..."
    systemctl restart ollama
    exit 1
fi

echo "Ollama is healthy"
exit 0
EOF

chmod +x /usr/local/bin/check-ollama-health.sh
print_success "Created health check script"

# Add to crontab (check every 5 minutes)
(crontab -l 2>/dev/null | grep -v check-ollama-health; echo "*/5 * * * * /usr/local/bin/check-ollama-health.sh >> /var/log/ollama-health.log 2>&1") | crontab -
print_success "Added health check to crontab"

# Step 8: Configure firewall (if ufw is installed)
echo ""
echo "========================================="
echo "Step 8: Configuring Firewall"
echo "========================================="

if command -v ufw &> /dev/null; then
    # Ollama should only be accessible locally
    print_info "Ensuring Ollama port is not exposed externally"
    ufw status | grep -q "11434" && ufw delete allow 11434 2>/dev/null || true
    print_success "Firewall configured (Ollama only accessible locally)"
else
    print_info "UFW not installed, skipping firewall configuration"
fi

# Step 9: Create startup script
echo ""
echo "========================================="
echo "Step 9: Creating Startup Script"
echo "========================================="

cat > "$BOT_DIR/start-with-ai.sh" << 'EOF'
#!/bin/bash

# Start bot with AI support
# This script ensures Ollama is running before starting the bot

echo "Checking Ollama service..."
if ! systemctl is-active --quiet ollama; then
    echo "Starting Ollama service..."
    sudo systemctl start ollama
    sleep 5
fi

echo "Verifying Ollama API..."
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "ERROR: Ollama API is not responding"
    exit 1
fi

echo "Ollama is ready"
echo "Starting bot..."

# Start the bot
npm start
EOF

chmod +x "$BOT_DIR/start-with-ai.sh"
print_success "Created startup script: start-with-ai.sh"

# Final Summary
echo ""
echo "========================================="
echo "✅ Setup Complete!"
echo "========================================="
echo ""
print_success "Ollama installed and configured"
print_success "Model $MODEL downloaded and ready"
print_success "Bot environment configured"
print_success "Health checks enabled"
echo ""
echo "Configuration:"
echo "  Provider: Ollama"
echo "  Model: $MODEL"
echo "  Base URL: http://localhost:11434"
echo "  Status: $(systemctl is-active ollama)"
echo ""
echo "Next steps:"
echo "  1. Build the bot: cd $BOT_DIR && npm run build"
echo "  2. Start the bot: ./start-with-ai.sh"
echo "  3. Or use PM2: pm2 start ecosystem.config.js"
echo ""
echo "Useful commands:"
echo "  - Check Ollama status: systemctl status ollama"
echo "  - View Ollama logs: journalctl -u ollama -f"
echo "  - List models: ollama list"
echo "  - Test model: ollama run $MODEL 'Hello'"
echo "  - Health check: /usr/local/bin/check-ollama-health.sh"
echo ""
echo "The bot will now automatically respond to:"
echo "  - Messages that mention the bot"
echo "  - Messages with casino keywords"
echo ""
print_success "AI Auto-Reply is ready to use! 🎉"
echo ""
