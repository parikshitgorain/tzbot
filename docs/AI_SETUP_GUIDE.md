# AI Auto-Reply Setup Guide

This guide will help you set up the AI auto-reply feature for your Discord bot using local open-source models.

## Overview

The bot can automatically respond to:
- Messages that mention/tag the bot
- Messages containing casino-related keywords (casino, bet, gamble, slot, poker, etc.)
- Messages in specific channels (if configured)

## Requirements

- 4GB RAM minimum (recommended: 8GB)
- Ollama installed on your system
- A compatible AI model downloaded

## Installation Steps

### 1. Install Ollama

**Windows:**
```bash
# Download and install from: https://ollama.ai/download
# Or use winget:
winget install Ollama.Ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**macOS:**
```bash
brew install ollama
```

### 2. Start Ollama Service

**Windows:**
- Ollama starts automatically after installation
- Check if running: `ollama list`

**Linux/macOS:**
```bash
# Start Ollama service
ollama serve
```

### 3. Download a Model

For 4GB RAM systems, use lightweight models:

```bash
# Recommended: Llama 3.2 1B (fastest, ~1GB)
ollama pull llama3.2:1b

# Alternative: Phi-3 Mini (~2GB)
ollama pull phi3:mini

# Alternative: Gemma 2B (~1.5GB)
ollama pull gemma2:2b
```

For 8GB+ RAM systems:

```bash
# Llama 3.2 3B (better quality, ~2GB)
ollama pull llama3.2:3b

# Llama 3.1 8B (best quality, ~4.7GB)
ollama pull llama3.1:8b
```

### 4. Test Ollama

```bash
# Test the model
ollama run llama3.2:1b "Hello, how are you?"
```

### 5. Configure the Bot

Edit your `.env` file:

```env
# Enable AI auto-reply
AI_ENABLED=true

# Use Ollama (local open-source models)
AI_PROVIDER=ollama

# Ollama API URL (default: http://localhost:11434)
AI_BASE_URL=http://localhost:11434

# Model name (must match the model you downloaded)
AI_MODEL_NAME=llama3.2:1b

# Optional: Restrict to specific channels (comma-separated IDs)
# Leave empty to allow all channels
AI_CHANNELS=

# Not needed for Ollama (only for OpenAI/Anthropic)
AI_API_KEY=
```

### 6. Restart the Bot

```bash
npm run build
npm start
```

## Model Comparison

| Model | Size | RAM Usage | Speed | Quality | Best For |
|-------|------|-----------|-------|---------|----------|
| llama3.2:1b | ~1GB | ~2GB | Very Fast | Good | 4GB RAM systems |
| phi3:mini | ~2GB | ~3GB | Fast | Good | 4GB RAM systems |
| gemma2:2b | ~1.5GB | ~2.5GB | Fast | Good | 4GB RAM systems |
| llama3.2:3b | ~2GB | ~4GB | Medium | Better | 8GB RAM systems |
| llama3.1:8b | ~4.7GB | ~6GB | Slower | Best | 16GB RAM systems |

## Configuration Options

### AI_ENABLED
- `true`: Enable AI auto-reply
- `false`: Disable AI auto-reply (default)

### AI_PROVIDER
- `ollama`: Local open-source models (recommended)
- `openai`: OpenAI API (requires API key)
- `anthropic`: Anthropic Claude API (requires API key)

### AI_MODEL_NAME
The name of the model to use. Must match a model you've downloaded with `ollama pull`.

### AI_BASE_URL
The URL where Ollama is running. Default is `http://localhost:11434`.

If running Ollama on a different machine:
```env
AI_BASE_URL=http://192.168.1.100:11434
```

### AI_CHANNELS
Comma-separated list of channel IDs where AI should respond:
```env
# Respond only in specific channels
AI_CHANNELS=123456789012345678,987654321098765432

# Respond in all channels (default)
AI_CHANNELS=
```

## How It Works

1. **Bot Mention**: When someone mentions the bot, it will always respond
2. **Casino Keywords**: Messages containing casino-related keywords trigger a response
3. **Channel Filter**: If AI_CHANNELS is set, only those channels are monitored
4. **Context Memory**: The bot remembers the last 10 messages per channel for context

## Troubleshooting

### "Ollama is not available"
- Check if Ollama is running: `ollama list`
- Verify the base URL in .env matches where Ollama is running
- Try: `curl http://localhost:11434/api/tags`

### "Model not found"
- Make sure you've downloaded the model: `ollama pull llama3.2:1b`
- Check available models: `ollama list`
- Verify AI_MODEL_NAME matches exactly

### Slow responses
- Use a smaller model (llama3.2:1b instead of llama3.1:8b)
- Reduce max_tokens in the code
- Ensure your system has enough free RAM

### High RAM usage
- Use a smaller model
- Close other applications
- Consider upgrading RAM

## Advanced Configuration

### Custom System Prompt

Edit `src/ai/ai-manager.ts` to customize the bot's personality:

```typescript
const systemPrompt: AIMessage = {
  role: 'system',
  content: `Your custom prompt here...`,
};
```

### Adjust Response Length

In `src/ai/ai-manager.ts`, modify the `maxTokens` parameter:

```typescript
const response = await this.provider.generateResponse(messages, 300); // Shorter responses
```

### Add More Keywords

In `src/ai/ai-manager.ts`, add keywords to the `casinoKeywords` array:

```typescript
const casinoKeywords = [
  'casino',
  'bet',
  // Add your keywords here
  'lottery',
  'raffle',
];
```

## Using Cloud AI Providers

### OpenAI

```env
AI_ENABLED=true
AI_PROVIDER=openai
AI_API_KEY=sk-your-openai-api-key
AI_MODEL_NAME=gpt-3.5-turbo
```

### Anthropic Claude

```env
AI_ENABLED=true
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-your-anthropic-api-key
AI_MODEL_NAME=claude-3-haiku-20240307
```

## Performance Tips

1. **Use the smallest model that meets your needs**
2. **Limit AI_CHANNELS to reduce processing**
3. **Monitor RAM usage with Task Manager**
4. **Consider running Ollama on a separate machine**
5. **Use SSD for faster model loading**

## Support

For issues or questions:
- Check Ollama docs: https://ollama.ai/docs
- Check bot logs: `logs/tzbot.log`
- GitHub Issues: [Your repo URL]
