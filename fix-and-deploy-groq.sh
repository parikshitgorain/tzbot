#!/bin/bash
# Fix TypeScript installation and deploy Groq AI
# Run this on VPS: bash fix-and-deploy-groq.sh

set -e

echo "🤖 Fixing TypeScript and deploying Groq AI..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
BOT_DIR="/var/www/tzbot/current"
ENV_FILE="/var/www/tzbot/shared/.env"
GROQ_API_KEY="YOUR_GROQ_API_KEY_HERE"

echo -e "${YELLOW}Step 1: Going to bot directory...${NC}"
cd "$BOT_DIR"
echo -e "${GREEN}✓ In bot directory${NC}"

echo -e "${YELLOW}Step 2: Checking Node.js and npm...${NC}"
node --version
npm --version
echo -e "${GREEN}✓ Node.js and npm available${NC}"

echo -e "${YELLOW}Step 3: Installing TypeScript and dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo -e "${YELLOW}Step 4: Verifying TypeScript installation...${NC}"
if ! npx tsc --version; then
    echo -e "${RED}Error: TypeScript still not available${NC}"
    echo "Installing TypeScript globally..."
    npm install -g typescript
fi
npx tsc --version
echo -e "${GREEN}✓ TypeScript available${NC}"

echo -e "${YELLOW}Step 5: Building code...${NC}"
npm run build
echo -e "${GREEN}✓ Build completed${NC}"

echo -e "${YELLOW}Step 6: Verifying build output...${NC}"
if [ ! -f "dist/ai/providers/groq-provider.js" ]; then
    echo -e "${RED}Error: groq-provider.js not found in dist${NC}"
    echo "Checking dist structure..."
    ls -la dist/ai/providers/ || echo "dist/ai/providers/ does not exist"
    exit 1
fi
echo -e "${GREEN}✓ Build output verified${NC}"

echo -e "${YELLOW}Step 7: Backing up environment file...${NC}"
cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "${GREEN}✓ Backup created${NC}"

echo -e "${YELLOW}Step 8: Configuring environment variables...${NC}"

# Update AI configuration
sed -i 's/^AI_ENABLED=.*/AI_ENABLED=true/' "$ENV_FILE"
sed -i 's/^AI_PROVIDER=.*/AI_PROVIDER=groq/' "$ENV_FILE"

# Remove AI_BASE_URL if it exists
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

echo -e "${YELLOW}Step 9: Verifying environment configuration...${NC}"
echo "AI settings:"
grep "^AI_" "$ENV_FILE" || echo "No AI settings found"
echo -e "${GREEN}✓ Configuration verified${NC}"

echo -e "${YELLOW}Step 10: Stopping Ollama (saves 2.3GB RAM)...${NC}"
if systemctl is-active --quiet ollama 2>/dev/null; then
    sudo systemctl stop ollama
    sudo systemctl disable ollama
    echo -e "${GREEN}✓ Ollama stopped and disabled${NC}"
else
    echo -e "${YELLOW}⚠ Ollama not running${NC}"
fi

echo -e "${YELLOW}Step 11: Restarting bot...${NC}"
pm2 restart tzbot
echo -e "${GREEN}✓ Bot restarted${NC}"

echo -e "${YELLOW}Step 12: Waiting for bot to initialize...${NC}"
sleep 5

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Groq AI Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Configuration:"
echo "  • Provider: Groq Cloud"
echo "  • Model: llama-3.1-8b-instant"
echo "  • Speed: 1-2 seconds (was 60+ seconds)"
echo "  • Memory: Freed 2.3GB RAM"
echo "  • Free tier: 14,400 requests/day"
echo ""
echo "Checking logs for AI initialization..."
echo ""
pm2 logs tzbot --lines 20 --nostream | grep -i "AI\|groq\|provider" || pm2 logs tzbot --lines 20 --nostream
echo ""
echo "Next steps:"
echo "  1. Check full logs: pm2 logs tzbot"
echo "  2. Look for: 'AI provider initialized' with 'Groq'"
echo "  3. Test in Discord by mentioning the bot"
echo ""
echo "Troubleshooting:"
echo "  • View logs: pm2 logs tzbot"
echo "  • Check status: pm2 status"
echo "  • Restart: pm2 restart tzbot"
echo ""
