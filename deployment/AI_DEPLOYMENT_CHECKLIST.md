# AI Auto-Reply VPS Deployment Checklist

Use this checklist to ensure smooth deployment of AI features.

## Pre-Deployment

- [ ] VPS has at least 4GB RAM (8GB recommended)
- [ ] VPS has at least 10GB free disk space
- [ ] Bot is already deployed and working
- [ ] You have root/sudo access
- [ ] `.env` file is configured in `/var/www/tzbot/shared/`

## Deployment Steps

### 1. Upload AI Code

- [ ] Push AI code to repository
- [ ] Code includes `src/ai/` directory
- [ ] Code includes `deployment/scripts/setup-ai-vps.sh`
- [ ] Build passes: `npm run build`

### 2. Run Automated Setup

```bash
# SSH into VPS
ssh user@your-vps-ip

# Navigate to bot directory
cd /var/www/tzbot/current

# Run AI setup script
sudo bash deployment/scripts/setup-ai-vps.sh
```

- [ ] Ollama installed successfully
- [ ] Systemd service created
- [ ] Model downloaded (llama3.2:1b)
- [ ] Health checks configured
- [ ] `.env` updated with AI settings

### 3. Verify Installation

```bash
# Check Ollama service
sudo systemctl status ollama
```
- [ ] Service is active (running)

```bash
# Check model
ollama list
```
- [ ] Model appears in list

```bash
# Test model
ollama run llama3.2:1b "Hello"
```
- [ ] Model responds correctly

```bash
# Check API
curl http://localhost:11434/api/tags
```
- [ ] API returns JSON response

### 4. Deploy Bot

```bash
# Follow normal deployment process
# The deploy script will verify AI setup
```

- [ ] Deployment completes successfully
- [ ] Bot starts without errors
- [ ] No AI-related errors in logs

### 5. Test in Discord

- [ ] Bot is online
- [ ] Run `/ai-status` command
  - [ ] Shows "Enabled"
  - [ ] Shows correct model name
  - [ ] Shows correct provider (ollama)

- [ ] Test bot mention: `@BotName hello`
  - [ ] Bot responds within 5 seconds
  - [ ] Response is relevant

- [ ] Test casino keyword: `What are the best slot games?`
  - [ ] Bot responds automatically
  - [ ] Response is about casino/slots

- [ ] Test `/ai-clear-history`
  - [ ] Command executes successfully
  - [ ] Confirmation message appears

### 6. Monitor Performance

```bash
# Check memory usage
free -h
```
- [ ] RAM usage is acceptable (< 80%)

```bash
# Check bot logs
pm2 logs tzbot --lines 50
```
- [ ] No error messages
- [ ] AI responses being generated
- [ ] Response times acceptable

```bash
# Check Ollama logs
sudo journalctl -u ollama -n 50
```
- [ ] No error messages
- [ ] Model loading successfully

### 7. Verify Health Checks

```bash
# Run health check manually
/usr/local/bin/check-ollama-health.sh
```
- [ ] Health check passes

```bash
# Check cron job
crontab -l | grep ollama
```
- [ ] Cron job exists (runs every 5 minutes)

```bash
# Check health log
tail -f /var/log/ollama-health.log
```
- [ ] Log shows successful checks

## Post-Deployment

### Security

- [ ] Ollama port (11434) is NOT exposed externally
  ```bash
  sudo ufw status | grep 11434
  ```
  - Should show no rules or only local access

- [ ] Ollama service runs as non-root user
  ```bash
  ps aux | grep ollama
  ```
  - Should show user "ollama"

### Documentation

- [ ] Update deployment notes with AI setup
- [ ] Document any custom configurations
- [ ] Note model version and performance

### Monitoring Setup

- [ ] Add AI metrics to monitoring dashboard (if applicable)
- [ ] Set up alerts for Ollama service failures
- [ ] Monitor disk space (models can be large)

## Troubleshooting Checklist

If something goes wrong, check:

### Ollama Issues

- [ ] Service status: `sudo systemctl status ollama`
- [ ] Service logs: `sudo journalctl -u ollama -f`
- [ ] Port availability: `sudo lsof -i :11434`
- [ ] Disk space: `df -h`
- [ ] Memory: `free -h`

### Bot Issues

- [ ] Bot logs: `pm2 logs tzbot`
- [ ] Environment variables: `cat /var/www/tzbot/shared/.env | grep AI`
- [ ] Build errors: `npm run build`
- [ ] PM2 status: `pm2 list`

### Model Issues

- [ ] Model exists: `ollama list`
- [ ] Model works: `ollama run llama3.2:1b "test"`
- [ ] Disk space for models: `du -sh ~/.ollama`

### Network Issues

- [ ] Ollama API: `curl http://localhost:11434/api/tags`
- [ ] DNS resolution: `ping ollama.ai`
- [ ] Firewall rules: `sudo ufw status`

## Rollback Plan

If AI features cause issues:

1. **Disable AI in .env**
   ```bash
   # Edit .env
   AI_ENABLED=false
   
   # Restart bot
   pm2 restart tzbot
   ```

2. **Stop Ollama Service**
   ```bash
   sudo systemctl stop ollama
   sudo systemctl disable ollama
   ```

3. **Remove Model (Optional)**
   ```bash
   ollama rm llama3.2:1b
   ```

4. **Redeploy Without AI**
   ```bash
   # Follow normal deployment process
   # Bot will work without AI features
   ```

## Success Criteria

✅ All checks passed when:

- Ollama service is running and stable
- Model is downloaded and responding
- Bot starts without AI-related errors
- `/ai-status` shows correct configuration
- Bot responds to mentions and keywords
- Response times are acceptable (< 5s)
- Memory usage is within limits
- Health checks are passing
- No errors in logs

## Performance Benchmarks

Expected performance on 4GB RAM VPS:

- **First response:** 3-5 seconds (model loading)
- **Subsequent responses:** 1-3 seconds
- **Memory usage:** 2-3GB (with model loaded)
- **CPU usage:** 50-100% during generation
- **Disk usage:** ~1.5GB for model

## Maintenance Schedule

- **Daily:** Check logs for errors
- **Weekly:** Review response times and quality
- **Monthly:** Update Ollama if new version available
- **Quarterly:** Consider upgrading model if RAM allows

## Contact & Support

- **Setup Issues:** Check `deployment/AI_VPS_DEPLOYMENT.md`
- **Bot Issues:** Check `pm2 logs tzbot`
- **Ollama Issues:** https://github.com/ollama/ollama/issues
- **Model Issues:** https://ollama.ai/library

---

**Checklist Version:** 1.0
**Last Updated:** 2026-02-28
**Status:** Production Ready ✅
