# Announcement Relay Troubleshooting Guide

## 🔍 Issue: Relay Not Working

The announcement relay system is initialized but messages are not being relayed.

## ✅ How It Should Work

1. Moderator posts message in **private channel**
2. Bot detects message via `messageCreate` event
3. Bot verifies user has **moderator role**
4. Bot relays message to all **public channels**

## 🐛 Common Issues & Solutions

### 1. Relay Not Configured in Database

**Check:**
```bash
# SSH to VPS
ssh your_user@your_vps

# Check if configuration exists
pm2 logs tzbot --lines 100 | grep "Announcement relay"
```

**Expected output:**
```
Announcement relay initialized and started
```

**If you see:**
```
Announcement relay not configured
```

**Solution:** Run `/announcement-status` command in Discord to check configuration, then use `/announcement-setup` to configure.

---

### 2. Moderator Role Not Set

**Check:** The bot verifies if the message author has the moderator role.

**Solution:**
1. Ensure `MODERATOR_ROLE_ID` is set in GitHub Secrets
2. Run `/announcement-status` to verify configuration
3. Make sure the user posting has the moderator role

---

### 3. Private Channel ID Wrong

**Check:** Messages must be posted in the exact private channel configured.

**Solution:**
1. Run `/announcement-status` to see current private channel
2. Verify the channel ID matches where you're posting
3. If wrong, run `/announcement-setup` to reconfigure

---

### 4. Bot Lacks Permissions

**Check:** Bot needs these permissions in all channels:
- View Channel
- Send Messages
- Embed Links
- Attach Files

**Solution:**
1. Check bot role permissions in Discord server settings
2. Ensure bot can see and post in both private and public channels
3. Run `/announcement-status` - it will show ❌ for channels bot can't access

---

### 5. Event Listener Not Registered

**Check logs for:**
```
AnnouncementRelayManager started
```

**If missing:** The relay wasn't initialized. Check database configuration.

---

## 🧪 Testing the Relay

### Step 1: Check Status
```
/announcement-status
```

Should show:
- ✅ Status: 🟢 Active
- ✅ Private Channel with checkmark
- ✅ Public Channels with checkmarks

### Step 2: Test Message
1. Go to the private channel
2. Post a test message as a moderator
3. Check if it appears in public channels

### Step 3: Check Logs
```bash
# On VPS
pm2 logs tzbot --lines 50
```

Look for:
- `Relaying announcement` - Message detected
- `Message relayed to channel` - Successful relay
- `Non-moderator message in private channel ignored` - User not moderator
- `Failed to relay message` - Error occurred

---

## 🔧 Quick Fix Commands

### Reconfigure Relay
```
/announcement-setup
```
Select private channel and up to 5 public channels.

### Check Current Config
```
/announcement-status
```
Shows all configuration and validates channels.

### Enable/Disable Relay
```
/announcement-toggle
```
Temporarily enable or disable without changing configuration.

---

## 📊 Diagnostic Checklist

Run through this checklist:

- [ ] `/announcement-status` shows "🟢 Active"
- [ ] Private channel has ✅ checkmark
- [ ] All public channels have ✅ checkmarks
- [ ] User posting has moderator role
- [ ] Bot has permissions in all channels
- [ ] Logs show "AnnouncementRelayManager started"
- [ ] Test message posted in correct private channel

---

## 🚀 Code Changes Made

### Fixed in This Update:
1. ✅ Removed commented-out relay handler (relay has its own event listener)
2. ✅ Added comment explaining relay handles its own events
3. ✅ Relay properly registers `messageCreate` listener on start

### How It Works Now:
```typescript
// In AnnouncementRelayManager.start()
this.discordClient.on('messageCreate', this.boundMessageHandler);

// Handler checks:
1. Is relay enabled?
2. Is message in private channel?
3. Is author a bot? (ignore)
4. Is author a moderator?
5. If all pass → relay message
```

---

## 📝 Next Steps

1. **Commit and push changes**
2. **Deploy to production**
3. **Run `/announcement-status` in Discord**
4. **Test with a message**
5. **Check logs if it doesn't work**

---

## 🆘 Still Not Working?

If relay still doesn't work after following this guide:

1. **Check VPS logs:**
   ```bash
   pm2 logs tzbot --lines 100
   ```

2. **Look for errors:**
   - "Failed to check moderator status"
   - "Failed to relay message"
   - "Non-moderator message ignored"

3. **Verify database config:**
   ```bash
   # Check if config exists in database
   # (requires database access)
   ```

4. **Check GitHub Secrets:**
   - MODERATOR_ROLE_ID is set
   - DISCORD_GUILD_ID is correct

5. **Restart bot:**
   ```bash
   pm2 restart tzbot
   ```
