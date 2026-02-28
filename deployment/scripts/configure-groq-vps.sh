#!/bin/bash
# Configure Groq AI on VPS
# Run this on the VPS after pulling latest code

set -e

echo "🤖 Configuring Groq AI on VPS..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
BOT_DIR="/var/www/tzbot/current"
ENV_FILE="/var/www/tzbot/shared/.env"
GROQ_API_KEY="YOUR_GROQ_API_KEY_HERE"

echo -e "${YELLOW}Step 1: Checking bot directory...${NC}"
if [ ! -d "$BOT_DIR" ]; then
    echo -e "${RED}Error: Bot directory not found at $BOT_DIR${NC}"
    exit 1
fi
cd "$BOT_DIR"
echo -e "${GREEN}✓ Bot directory found${NC}"

echo -e "${YELLOW}Step 2: Pulling latest code from Development branch...${NC}"
git fetch origin Development
git checkout Development
git pull origin Development
echo -e "${GREEN}✓ Code updated${NC}"

echo -e "${YELLOW}Step 3: Verifying Groq files exist...${NC}"
if [ ! -f "src/ai/providers/groq-provider.ts" ]; then
    echo -e "${RED}Error: groq-provider.ts not found${NC}"
    exit 1
fi
if [ ! -f "src/ai/ai-manager.ts" ]; then
    echo -e "${RED}Error: ai-manager.ts not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Groq files verified${NC}"

echo -e "${YELLOW}Step 4: Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo -e "${YELLOW}Step 5: Building code...${NC}"
npm run build
echo -e "${GREEN}✓ Build completed${NC}"

echo -e "${YELLOW}Step 6: Verifying build output...${NC}"
if [ ! -f "dist/ai/providers/groq-provider.js" ]; then
    echo -e "${RED}Error: groq-provider.js not found in dist${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build output verified${NC}"

echo -e "${YELLOW}Step 7: Configuring environment variables...${NC}"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: .env file not found at $ENV_FILE${NC}"
    exit 1
fi

# Backup existing .env
cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "${GREEN}✓ Backed up existing .env${NC}"

# Update AI configuration
sed -i 's/^AI_ENABLED=.*/AI_ENABLED=true/' "$ENV_FILE"
sed -i 's/^AI_PROVIDER=.*/AI_PROVIDER=groq/' "$ENV_FILE"

# Remove AI_BASE_URL if it exists (not needed for Groq)
sed -i '/^AI_BASE_URL=/d' "$ENV_FILE"

# Update or add AI_API_KEY
if grep -q "^AI_API_KEY=" "$ENV_FILE"; then
    sed -i "s|^AI_API_KEY=.*|AI_API_KEY=$GROQ_API_KEY|" "$ENV_FILE"
else
    echo "AI_API_KEY=$GROQ_API_KEY" >> "$ENV_FILE"
fi

# Update or add AI_MODEL_NAME
if grep -q "^AI_MODEL_NAME=" "$ENV_FILE"; then
    sed -i 's/^AI_MODEL_NAME=.*/AI_MODEL_NAME=llama-3.1-8b-instant/' "$ENV_FILE"
else
    echo "AI_MODEL_NAME=llama-3.1-8b-instant" >> "$ENV_FILE"
fi

echo -e "${GREEN}✓ Environment configured${NC}"

echo -e "${YELLOW}Step 8: Stopping Ollama (optional - saves 2.3GB RAM)...${NC}"
if systemctl is-active --quiet ollama; then
    sudo systemctl stop ollama
    sudo systemctl disable ollama
    echo -e "${GREEN}✓ Ollama stopped and disabled${NC}"
else
    echo -e "${YELLOW}⚠ Ollama not running${NC}"
fi

echo -e "${YELLOW}Step 9: Restarting bot...${NC}"
pm2 restart tzbot
echo -e "${GREEN}✓ Bot restarted${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Groq AI Configuration Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Configuration:"
echo "  • Provider: Groq Cloud"
echo "  • Model: llama-3.1-8b-instant"
echo "  • Speed: 1-2 seconds (was 60+ seconds)"
echo "  • Memory: Freed 2.3GB RAM"
echo "  • Free tier: 14,400 requests/day"
echo ""
echo "Next steps:"
echo "  1. Check logs: pm2 logs tzbot --lines 30"
echo "  2. Look for: 'AI provider initialized' with 'Groq'"
echo "  3. Test in Discord by mentioning the bot"
echo ""
echo "Troubleshooting:"
echo "  • View logs: pm2 logs tzbot"
echo "  • Check status: pm2 status"
echo "  • Rollback: cp $ENV_FILE.backup.* $ENV_FILE && pm2 restart tzbot"
echo ""
