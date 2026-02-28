#!/bin/bash
# Deploy Groq AI provider to VPS

set -e

echo "🚀 Deploying Groq AI to VPS..."

# Check if we're in the project root
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from project root"
    exit 1
fi

# Check if API key is provided
if [ -z "$1" ]; then
    echo "❌ Error: Groq API key required"
    echo "Usage: ./deploy-groq.sh YOUR_GROQ_API_KEY"
    echo ""
    echo "Get your free API key from: https://console.groq.com"
    exit 1
fi

GROQ_API_KEY="$1"
VPS_HOST="ocean"
VPS_DIR="/var/www/tzbot/current"

echo "📦 Building TypeScript code..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build successful"
echo ""

echo "📤 Uploading Groq provider to VPS..."

# Upload the Groq provider
scp dist/ai/providers/groq-provider.js "$VPS_HOST:$VPS_DIR/dist/ai/providers/"

# Upload updated AI manager
scp dist/ai/ai-manager.js "$VPS_HOST:$VPS_DIR/dist/ai/"

# Upload updated config validator
scp dist/config/validator.js "$VPS_HOST:$VPS_DIR/dist/config/"

echo "✅ Files uploaded"
echo ""

echo "⚙️  Configuring environment on VPS..."

# Upload and run setup script
scp deployment/scripts/setup-groq.sh "$VPS_HOST:/tmp/"
ssh "$VPS_HOST" "chmod +x /tmp/setup-groq.sh && /tmp/setup-groq.sh '$GROQ_API_KEY'"

echo ""
echo "🔄 Restarting bot..."
ssh "$VPS_HOST" "pm2 restart tzbot"

echo ""
echo "⏳ Waiting for bot to start..."
sleep 5

echo ""
echo "📊 Checking bot status..."
ssh "$VPS_HOST" "pm2 logs tzbot --lines 20 --nostream | grep -i 'groq\|ai\|running' | tail -10"

echo ""
echo "🎉 Groq AI deployment complete!"
echo ""
echo "✅ What changed:"
echo "  • Switched from local Ollama (1B) to Groq cloud (8B)"
echo "  • Response time: 60+ seconds → 1-2 seconds"
echo "  • VPS memory freed: 2.3GB"
echo "  • Daily limit: 14,400 requests (free)"
echo ""
echo "🧪 Test it:"
echo "  Mention @TZbot in Discord and ask: 'what is the rainbet code?'"
echo ""
