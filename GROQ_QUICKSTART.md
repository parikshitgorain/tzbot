# Groq AI Quick Start Guide

## Step 1: Get Groq API Key (FREE)

1. Go to https://console.groq.com
2. Sign up (free, no credit card)
3. Click "API Keys" → "Create API Key"
4. Copy the key (starts with `gsk_...`)

## Step 2: Deploy to VPS

Run this command from your local machine:

```bash
bash deployment/scripts/deploy-groq.sh YOUR_GROQ_API_KEY
```

Replace `YOUR_GROQ_API_KEY` with your actual key.

## What This Does

✅ Builds the Groq provider code
✅ Uploads to VPS
✅ Configures environment variables
✅ Stops Ollama (no longer needed)
✅ Restarts bot with Groq

## Benefits

- **Speed**: 1-2 seconds (was 60+ seconds)
- **Quality**: 8B model (was 1B)
- **Memory**: Frees 2.3GB RAM on VPS
- **Cost**: FREE (14,400 requests/day)

## Test It

After deployment, test in Discord:
```
@TZbot what is the rainbet code?
```

Should respond in 1-2 seconds with accurate info!

## Troubleshooting

### "Build failed"
Run: `npm install` then try again

### "Groq is not available"
- Check API key is correct
- Verify at https://console.groq.com

### Bot not responding
Check logs: `ssh ocean "pm2 logs tzbot --lines 50"`

## Manual Setup (Alternative)

If the script doesn't work, do it manually:

1. SSH to VPS: `ssh ocean`
2. Edit env: `nano /var/www/tzbot/shared/.env`
3. Update these lines:
   ```
   AI_ENABLED=true
   AI_PROVIDER=groq
   AI_API_KEY=gsk_your_key_here
   AI_MODEL_NAME=llama-3.1-8b-instant
   ```
4. Save and exit (Ctrl+X, Y, Enter)
5. Restart: `pm2 restart tzbot`

## Limits

- 14,400 requests/day (FREE)
- 30 requests/minute
- 6,000 tokens/day

For a Discord bot, this is more than enough!
