#!/bin/bash
# Check and fix environment configuration

echo "🔍 Checking environment configuration..."

ENV_FILE="/var/www/tzbot/shared/.env"

echo ""
echo "Current AI settings in $ENV_FILE:"
grep "^AI_" "$ENV_FILE" || echo "No AI settings found"

echo ""
echo "Fixing configuration..."

# Backup
cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"

# Remove old AI settings
sed -i '/^AI_ENABLED=/d' "$ENV_FILE"
sed -i '/^AI_PROVIDER=/d' "$ENV_FILE"
sed -i '/^AI_API_KEY=/d' "$ENV_FILE"
sed -i '/^AI_MODEL_NAME=/d' "$ENV_FILE"
sed -i '/^AI_BASE_URL=/d' "$ENV_FILE"

# Add new AI settings at the end
echo "" >> "$ENV_FILE"
echo "# Groq AI Configuration" >> "$ENV_FILE"
echo "AI_ENABLED=true" >> "$ENV_FILE"
echo "AI_PROVIDER=groq" >> "$ENV_FILE"
echo "AI_API_KEY=YOUR_GROQ_API_KEY_HERE" >> "$ENV_FILE"
echo "AI_MODEL_NAME=llama-3.1-8b-instant" >> "$ENV_FILE"

echo ""
echo "New AI settings:"
grep "^AI_" "$ENV_FILE"

echo ""
echo "Restarting bot..."
pm2 restart tzbot

echo ""
echo "Waiting for bot to start..."
sleep 5

echo ""
echo "Checking logs for AI initialization..."
pm2 logs tzbot --lines 30 --nostream | grep -i "AI\|groq" || echo "No AI logs found yet"

echo ""
echo "✅ Done! Check full logs with: pm2 logs tzbot"
