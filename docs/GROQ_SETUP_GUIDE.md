# Groq AI Setup Guide

## What is Groq?

Groq provides FREE, ultra-fast AI inference with generous limits:
- 14,400 requests per day (FREE)
- 30 requests per minute
- Fast responses (1-2 seconds)
- High-quality models (Llama 3.1 8B)

## Step 1: Get Groq API Key

1. Go to https://console.groq.com
2. Sign up with your email (free, no credit card needed)
3. Go to "API Keys" section
4. Click "Create API Key"
5. Copy the API key (starts with `gsk_...`)

## Step 2: Configure Bot

Add to your `.env` file:

```env
AI_ENABLED=true
AI_PROVIDER=groq
AI_API_KEY=gsk_your_api_key_here
AI_MODEL_NAME=llama-3.1-8b-instant
```

## Step 3: Restart Bot

```bash
pm2 restart tzbot
```

## Available Models

### Recommended: llama-3.1-8b-instant
- **Speed**: Very fast (1-2 seconds)
- **Quality**: Good for chat
- **Limits**: 14,400 requests/day
- **Best for**: Discord bots

### Alternative: llama-3.3-70b-versatile
- **Speed**: Fast (2-3 seconds)
- **Quality**: Excellent
- **Limits**: 1,000 requests/day
- **Best for**: Complex questions

## Features

✅ Uses TZBetz knowledge base
✅ Quick responses for common questions
✅ Profanity filter
✅ Leaderboard redirects
✅ No VPS memory usage
✅ Fast cloud processing

## Limits

- **Free Tier**: 14,400 requests/day
- **Rate Limit**: 30 requests/minute
- **Tokens**: 6,000 tokens/day

For a Discord bot with 50 questions/day, you'll use only 0.3% of your daily limit!

## Troubleshooting

### "Groq is not available"
- Check API key is correct
- Verify API key is active at https://console.groq.com
- Check internet connection

### "Rate limit exceeded"
- Wait 1 minute and try again
- Reduce bot usage
- Add cooldowns between requests

### Slow responses
- Groq should be 1-2 seconds
- If slow, check your internet connection
- Try a different model

## Cost

**FREE** - No credit card needed!
- 14,400 requests/day
- Unlimited for personal use
- No hidden fees
