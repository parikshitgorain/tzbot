# Command Update Deployment Guide

## Changes Pushed
**Commit**: `6ec7510`
**Branch**: Development
**Date**: February 24, 2026

## What Changed

### Giveaway Commands Updated
The `/giveaway` command has been updated to use a custom permission system instead of Discord's built-in "Manage Events" permission.

**Key Changes:**
- Removed Discord-level permission restriction
- Added database-driven permission checks
- Commands now visible to everyone but only usable by authorized users
- Administrators can delegate access via `/giveaway config`

## Command Registration

### Automatic Registration
When the bot restarts, it will automatically register the updated commands with Discord. This happens in the deployment process.

### How Commands Are Registered

The bot registers commands in `src/managers/command.manager.ts`:

```typescript
async deployCommands(guildId: string): Promise<void> {
  // Converts command definitions to Discord API format
  // Registers with Discord's REST API
  // Updates command permissions
}
```

### What Users Will See

**Before Update:**
- Only users with "Manage Events" permission could see `/giveaway` command

**After Update:**
- Everyone can see `/giveaway` command in their slash command list
- When unauthorized users try to use it, they get: "❌ You don't have permission to use giveaway commands. Contact an administrator."

## Deployment Steps

### 1. Bot Restart (Automatic via CI/CD)
```bash
# The deployment script will:
1. Pull latest code from Development branch
2. Install dependencies
3. Build TypeScript
4. Restart the bot with PM2
```

### 2. Command Registration (Automatic on Startup)
```typescript
// In src/index.ts - registerCommands()
await this.commandManager.deployCommands(config.guildId);
```

This happens automatically when the bot starts. Discord will update the command definitions within a few seconds.

### 3. Verify Commands Updated

**Check in Discord:**
1. Type `/giveaway` in any channel
2. You should see the command appear (even if you don't have permissions)
3. Try to use it - if you don't have permission, you'll see the error message

**Check Bot Logs:**
```bash
# SSH into VPS
ssh user@your-vps

# Check PM2 logs
pm2 logs tzbot --lines 50

# Look for:
"Commands deployed successfully"
"Registered X commands"
```

## Permission Configuration

### For Server Administrators

After deployment, configure who can use giveaway commands:

```bash
# Add a role
/giveaway config add_role role:@Moderators

# Add a specific user
/giveaway config add_user user:@JohnDoe

# View current configuration
/giveaway config show:true

# Remove access
/giveaway config remove_role role:@OldRole
/giveaway config remove_user user:@OldUser
```

### Default Behavior

If no configuration exists:
- **Administrators**: Can use all giveaway commands
- **Everyone else**: Cannot use giveaway commands

This ensures security by default.

## Testing Checklist

After deployment, verify:

- [ ] Bot restarts successfully
- [ ] Commands are registered (check logs)
- [ ] `/giveaway` command appears for all users
- [ ] Unauthorized users get permission error
- [ ] Administrators can use all commands
- [ ] `/giveaway config` works for administrators
- [ ] Added roles/users can use commands
- [ ] `gw.reroll` prefix command respects permissions
- [ ] Error messages are clear and helpful

## Rollback Plan

If issues occur:

### Option 1: Revert Commit
```bash
git revert 6ec7510
git push origin Development
# Wait for automatic deployment
```

### Option 2: Manual Rollback
```bash
# SSH into VPS
ssh user@your-vps

# Go to previous release
cd /var/www/tzbot/releases
ls -la  # Find previous release folder

# Update symlink
ln -sfn /var/www/tzbot/releases/release-PREVIOUS current

# Restart bot
pm2 restart tzbot
```

## Command Visibility Timeline

### Discord Command Cache
Discord caches slash commands. After registration:
- **Guild commands**: Update within 1-5 seconds
- **Global commands**: Can take up to 1 hour (we use guild commands)

### Force Refresh (If Needed)
Users can force refresh their command cache:
1. Restart Discord app
2. Or wait a few minutes for automatic refresh

## Monitoring

### What to Monitor

1. **Bot Logs**
   ```bash
   pm2 logs tzbot --lines 100
   ```
   Look for:
   - "Commands deployed successfully"
   - Any permission-related errors
   - Command execution logs

2. **Error Logs**
   ```bash
   tail -f /var/www/tzbot/current/logs/error-*.log
   ```
   Look for:
   - Permission validation errors
   - Database connection issues
   - Command registration failures

3. **User Reports**
   - Users reporting they can't see commands
   - Users reporting permission errors
   - Commands not working as expected

## Troubleshooting

### Commands Not Updating

**Symptom**: Users still see old command behavior

**Solutions**:
1. Check bot logs for registration errors
2. Verify bot has `applications.commands` scope
3. Restart Discord client
4. Wait 5 minutes for cache to clear

### Permission Errors

**Symptom**: Authorized users getting permission denied

**Solutions**:
1. Check database configuration: `/giveaway config show:true`
2. Verify user has correct role
3. Check bot logs for permission check errors
4. Verify database connection is working

### Commands Not Visible

**Symptom**: No one can see `/giveaway` command

**Solutions**:
1. Check bot has proper permissions in Discord
2. Verify command registration in logs
3. Check if bot is online
4. Manually trigger command deployment

## Support

### For Developers
- Check `GIVEAWAY_PERMISSIONS_FIX.md` for technical details
- Review `SECURITY_AUDIT_COMMANDS.md` for security analysis
- See `src/commands/giveaway.commands.ts` for implementation

### For Server Admins
- Use `/giveaway config` to manage permissions
- Contact bot administrator if issues persist
- Check bot status with `/config` command

## Success Criteria

Deployment is successful when:
- ✅ Bot restarts without errors
- ✅ Commands register successfully
- ✅ All users can see `/giveaway` command
- ✅ Permission checks work correctly
- ✅ Administrators can configure access
- ✅ Configured users can use commands
- ✅ Unauthorized users get clear error messages
- ✅ No security vulnerabilities introduced

## Notes

- Commands will be visible to everyone (this is intentional)
- Permission checks happen when commands are executed
- This allows for flexible, database-driven access control
- Administrators must configure permissions after deployment
- Default behavior is secure (admin-only)

---

**Deployment Status**: Ready for Production ✅
**Security Status**: Audited and Approved ✅
**Documentation**: Complete ✅
