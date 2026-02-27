# AI Auto-Reply VPS Deployment Guide

This guide covers deploying the bot with AI auto-reply features on a VPS.

## Prerequisites

- VPS with at least 4GB RAM (8GB recommended)
- Ubuntu 20.04+ or Debian 11+
- Root or sudo access
- Bot already deployed (following main deployment guide)

## Quick Setup (Automated)

### Option 1: One-Command Setup

```bash
# Run the automated setup script
sudo bash deployment/scripts/setup-ai-vps.sh
```

This script will:
1. ✅ Install Ollama
2. ✅ Create systemd service
3. ✅ Download AI model (llama3.2:1b for 4GB RAM)
4. ✅ Configure bot environment
5. ✅ Set up health checks
6. ✅ Test the installation

### Option 2: Manual Setup

If you prefer manual control, follow these steps:

#### 1. Install Ollama

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Verify installation
ollama --version
```

#### 2. Create Systemd Service

```bash
# Create ollama user
sudo useradd -r -s /bin/false -m -d /usr/share/ollama ollama

# Create service file
sudo tee /etc/systemd/system/ollama.service > /dev/null << 'EOF'
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

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable ollama
sudo systemctl start ollama

# Check status
sudo systemctl status ollama
```

#### 3. Download AI Model

```bash
# For 4GB RAM VPS (recommended)
ollama pull llama3.2:1b

# For 8GB+ RAM VPS (better quality)
ollama pull llama3.2:3b

# Verify download
ollama list
```

#### 4. Test the Model

```bash
# Quick test
ollama run llama3.2:1b "Say hello in one sentence"
```

#### 5. Configure Bot

Edit your `.env` file in `/var/www/tzbot/shared/.env`:

```env
# Enable AI
AI_ENABLED=true

# Use Ollama
AI_PROVIDER=ollama

# Model name (must match downloaded model)
AI_MODEL_NAME=llama3.2:1b

# Ollama API URL
AI_BASE_URL=http://localhost:11434

# Optional: Restrict to specific channels
AI_CHANNELS=
```

#### 6. Deploy Bot

```bash
# The deployment script will automatically check AI setup
# and download the model if needed
cd /var/www/tzbot/current
npm run build
pm2 restart tzbot
```

## Automatic Model Download

The bot will automatically download the model on first start if:
- AI is enabled in .env
- Ollama is running
- Model is not already downloaded

This happens in the background and may take 2-5 minutes for the first start.

## Deployment Integration

The deployment script (`deploy_release.sh`) now includes AI checks:

```bash
# During deployment, it will:
# 1. Check if AI is enabled
# 2. Verify Ollama is installed and running
# 3. Check if model is downloaded
# 4. Auto-download model if missing
```

## Health Monitoring

The setup script creates automatic health checks:

```bash
# Health check script location
/usr/local/bin/check-ollama-health.sh

# Runs every 5 minutes via cron
# Automatically restarts Ollama if it fails

# View health check logs
tail -f /var/log/ollama-health.log
```

## Useful Commands

### Ollama Service Management

```bash
# Check status
sudo systemctl status ollama

# Start service
sudo systemctl start ollama

# Stop service
sudo systemctl stop ollama

# Restart service
sudo systemctl restart ollama

# View logs
sudo journalctl -u ollama -f
```

### Model Management

```bash
# List installed models
ollama list

# Download a model
ollama pull llama3.2:1b

# Remove a model
ollama rm llama3.2:1b

# Test a model
ollama run llama3.2:1b "Test message"
```

### Bot Management

```bash
# Check bot logs
pm2 logs tzbot

# Restart bot
pm2 restart tzbot

# Check AI status in Discord
/ai-status

# Clear conversation history
/ai-clear-history
```

## Performance Tuning

### For 4GB RAM VPS

```env
AI_MODEL_NAME=llama3.2:1b
```

- Response time: 1-3 seconds
- RAM usage: ~2GB
- Quality: Good

### For 8GB RAM VPS

```env
AI_MODEL_NAME=llama3.2:3b
```

- Response time: 3-6 seconds
- RAM usage: ~4GB
- Quality: Better

### For 16GB+ RAM VPS

```env
AI_MODEL_NAME=llama3.1:8b
```

- Response time: 5-10 seconds
- RAM usage: ~6GB
- Quality: Best

## Troubleshooting

### Ollama Not Starting

```bash
# Check logs
sudo journalctl -u ollama -n 50

# Check if port is in use
sudo lsof -i :11434

# Restart service
sudo systemctl restart ollama
```

### Model Download Fails

```bash
# Check disk space
df -h

# Check internet connection
curl -I https://ollama.ai

# Try manual download
ollama pull llama3.2:1b --verbose
```

### Bot Can't Connect to Ollama

```bash
# Verify Ollama is running
curl http://localhost:11434/api/tags

# Check firewall (should only allow local access)
sudo ufw status

# Check bot logs
pm2 logs tzbot --lines 100
```

### High Memory Usage

```bash
# Check memory
free -h

# Use smaller model
ollama pull llama3.2:1b

# Restart Ollama to free memory
sudo systemctl restart ollama
```

### Slow Responses

```bash
# Check CPU usage
top

# Use smaller model
AI_MODEL_NAME=llama3.2:1b

# Check if other processes are using resources
ps aux --sort=-%mem | head -10
```

## Security Considerations

### Firewall Configuration

Ollama should only be accessible locally:

```bash
# Ensure port 11434 is NOT exposed
sudo ufw status

# If exposed, remove the rule
sudo ufw delete allow 11434
```

### Resource Limits

Set resource limits for Ollama:

```bash
# Edit service file
sudo systemctl edit ollama

# Add limits
[Service]
MemoryMax=4G
CPUQuota=200%
```

## Monitoring

### Check AI Status

```bash
# In Discord
/ai-status

# Via logs
pm2 logs tzbot | grep "AI"

# Check Ollama
curl http://localhost:11434/api/tags
```

### Monitor Performance

```bash
# Watch memory usage
watch -n 1 free -h

# Monitor Ollama logs
sudo journalctl -u ollama -f

# Check bot performance
pm2 monit
```

## Backup and Recovery

### Backup Configuration

```bash
# Backup .env
cp /var/www/tzbot/shared/.env /var/www/tzbot/shared/.env.backup

# Backup includes AI settings
```

### Recovery

```bash
# If Ollama fails, reinstall
curl -fsSL https://ollama.ai/install.sh | sh

# Re-download model
ollama pull llama3.2:1b

# Restart services
sudo systemctl restart ollama
pm2 restart tzbot
```

## Upgrading

### Update Ollama

```bash
# Reinstall Ollama (preserves models)
curl -fsSL https://ollama.ai/install.sh | sh

# Restart service
sudo systemctl restart ollama
```

### Update Model

```bash
# Pull latest version
ollama pull llama3.2:1b

# Restart bot
pm2 restart tzbot
```

## Cost Considerations

### Local AI (Ollama)
- ✅ No API costs
- ✅ Unlimited requests
- ✅ Complete privacy
- ❌ Requires more RAM
- ❌ Slower than cloud APIs

### Cloud AI (OpenAI/Anthropic)
- ✅ Faster responses
- ✅ Better quality
- ✅ Less RAM needed
- ❌ API costs per request
- ❌ Data sent to third party

## Next Steps

1. ✅ Run setup script: `sudo bash deployment/scripts/setup-ai-vps.sh`
2. ✅ Deploy bot: Follow normal deployment process
3. ✅ Test in Discord: Mention the bot or use casino keywords
4. ✅ Monitor: Check logs and performance
5. ✅ Optimize: Adjust model based on performance

## Support

- Setup issues: Check `deployment/scripts/setup-ai-vps.sh` logs
- Bot issues: Check `pm2 logs tzbot`
- Ollama issues: Check `sudo journalctl -u ollama`
- Model issues: Check `ollama list` and disk space

---

**Deployment Status:** Ready for production
**Recommended Model:** llama3.2:1b (4GB RAM)
**Auto-Download:** Enabled
