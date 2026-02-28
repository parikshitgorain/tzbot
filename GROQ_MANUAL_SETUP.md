# Groq AI Manual Setup (Do It Yourself)

## Step 1: Get Groq API Key

1. Go to https://console.groq.com
2. Sign up (free, no credit card)
3. Click "API Keys" → "Create API Key"
4. Copy the key (starts with `gsk_...`)

## Step 2: Upload Code to VPS

From your local machine, upload the new files:

```powershell
# Upload Groq provider
scp src/ai/providers/groq-provider.ts ocean:/tmp/

# Upload AI manager
scp src/ai/ai-manager.ts ocean:/tmp/

# Upload config validator
scp src/config/validator.ts ocean:/tmp/
```

## Step 3: SSH to VPS and Build

```bash
ssh ocean

# Go to bot directory
cd /var/www/tzbot/current

# Copy new files
cp /tmp/groq-provider.ts src/ai/providers/
cp /tmp/ai-manager.ts src/ai/
cp /tmp/validator.ts src/config/

# Build the code
npm run build
```

## Step 4: Configure Environment

Edit the environment file:

```bash
nano /var/www/tzbot/shared/.env
```

Update these lines (replace `YOUR_KEY_HERE` with your actual Groq API key):

```env
AI_ENABLED=true
AI_PROVIDER=groq
AI_API_KEY=YOUR_KEY_HERE
AI_MODEL_NAME=llama-3.1-8b-instant
```

Remove this line if it exists:
```env
AI_BASE_URL=http://localhost:11434
```

Save and exit: `Ctrl+X`, then `Y`, then `Enter`

## Step 5: Stop Ollama (Optional - Saves RAM)

```bash
sudo systemctl stop ollama
sudo systemctl disable ollama
```

This frees up 2.3GB of RAM!

## Step 6: Restart Bot

```bash
pm2 restart tzbot
```

## Step 7: Check Logs

```bash
pm2 logs tzbot --lines 30
```

Look for:
- "AI provider initialized" with "provider":"Groq"
- "AI manager initialized and ready"

## Step 8: Test in Discord

Mention the bot and ask a question:
```
@TZbot what is the rainbet code?
```

Should respond in 1-2 seconds!

## Troubleshooting

### Build fails
```bash
cd /var/www/tzbot/current
npm install
npm run build
```

### "Groq is not available"
- Check API key is correct in `.env`
- Verify key works at https://console.groq.com

### Bot not responding
```bash
pm2 logs tzbot --lines 50 | grep -i error
```

## What You Get

✅ **Speed**: 1-2 seconds (was 60+ seconds)
✅ **Quality**: 8B model (was 1B)  
✅ **Memory**: Frees 2.3GB RAM
✅ **Cost**: FREE (14,400 requests/day)
✅ **Reliability**: No more nonsense responses

## Rollback (If Needed)

If something goes wrong, switch back to disabled AI:

```bash
nano /var/www/tzbot/shared/.env
```

Change to:
```env
AI_ENABLED=false
```

Then restart:
```bash
pm2 restart tzbot
```
