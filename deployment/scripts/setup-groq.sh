#!/bin/bash
# Setup Groq AI on VPS

set -e

echo "🤖 Setting up Groq AI on VPS..."

# Check if API key is provided
if [ -z "$1" ]; then
    echo "❌ Error: Groq API key required"
    echo "Usage: ./setup-groq.sh YOUR_GROQ_API_KEY"
    echo ""
    echo "Get your free API key from: https://console.groq.com"
    exit 1
fi

GROQ_API_KEY="$1"
ENV_FILE="/var/www/tzbot/shared/.env"

echo "📝 Updating environment configuration..."

# Backup current .env
cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"

# Update AI settings
sed -i 's/AI_ENABLED=.*/AI_ENABLED=true/' "$ENV_FILE"
sed -i 's/AI_PROVIDER=.*/AI_PROVIDER=groq/' "$ENV_FILE"

# Add or update API key
if grep -q "^AI_API_KEY=" "$ENV_FILE"; then
    sed -i "s|^AI_API_KEY=.*|AI_API_KEY=$GROQ_API_KEY|" "$ENV_FILE"
else
    echo "AI_API_KEY=$GROQ_API_KEY" >> "$ENV_FILE"
fi

# Add or update model name
if grep -q "^AI_MODEL_NAME=" "$ENV_FILE"; then
    sed -i 's/^AI_MODEL_NAME=.*/AI_MODEL_NAME=llama-3.1-8b-instant/' "$ENV_FILE"
else
    echo "AI_MODEL_NAME=llama-3.1-8b-instant" >> "$ENV_FILE"
fi

# Remove old Ollama base URL if exists
sed -i '/^AI_BASE_URL=/d' "$ENV_FILE"

echo "✅ Environment configured"
echo ""
echo "Current AI settings:"
grep "^AI_" "$ENV_FILE"
echo ""

# Stop Ollama service (no longer needed)
echo "🛑 Stopping Ollama service (no longer needed)..."
if systemctl is-active --quiet ollama; then
    systemctl stop ollama
    systemctl disable ollama
    echo "✅ Ollama service stopped and disabled"
else
    echo "ℹ️  Ollama service not running"
fi

echo ""
echo "🎉 Groq AI setup complete!"
echo ""
echo "📊 Benefits:"
echo "  ✅ 14,400 free requests per day"
echo "  ✅ 1-2 second response time (was 60+ seconds)"
echo "  ✅ No VPS memory usage (saves 2.3GB RAM)"
echo "  ✅ Better quality responses (8B model vs 1B)"
echo ""
echo "🔄 Restart the bot to activate:"
echo "  pm2 restart tzbot"
echo ""
echo "📝 Test the AI:"
echo "  Mention @TZbot in Discord and ask a question"
echo ""
