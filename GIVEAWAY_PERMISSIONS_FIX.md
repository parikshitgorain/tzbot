# Giveaway Permissions System Fix

## Issue

The `/giveaway config` command allowed administrators to add specific roles and users who can use giveaway commands, but those users still couldn't see or use the commands because:

1. **Discord-level restriction**: The command had `.setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)` which hides the command from anyone without "Manage Events" permission
2. **No handler-level check**: The command handlers never actually checked the database permissions using `canUseGiveawayCommands()`

**Result**: The config system existed but was completely non-functional.

## Solution

### Changes Made

1. **Removed Discord-level permission restriction**
   - Removed `.setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)`
   - Now everyone can see the `/giveaway` command in their slash command list

2. **Added handler-level permission checks**
   - All subcommands (create, cancel, list, reroll) now check `canUseGiveawayCommands()`
   - Config subcommand requires Administrator permission
   - Proper error messages for users without permission

3. **Updated command metadata**
   - Changed `moderatorOnly: true` to `moderatorOnly: false`
   - Removed `permissions: [PermissionFlagsBits.ManageEvents]`
   - Now uses custom permission system from database

## How It Works Now

### Permission Hierarchy

1. **Administrators** - Always have access to all commands
2. **Configured Roles** - Roles added via `/giveaway config add_role`
3. **Configured Users** - Users added via `/giveaway config add_user`
4. **Everyone Else** - Cannot use commands (but can see them)

### Command Visibility

- **Before**: Only users with "Manage Events" permission could see `/giveaway`
- **After**: Everyone can see `/giveaway`, but only authorized users can use it

### Permission Checks

```typescript
// For create, cancel, list, reroll subcommands:
const canUse = await configManager.canUseGiveawayCommands(guildId, member);
if (!canUse) {
  return "❌ You don't have permission to use giveaway commands.";
}

// For config subcommand:
if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
  return "❌ Only administrators can configure giveaway permissions.";
}
```

## Usage Examples

### 1. Administrator Setup

```
/giveaway config add_role role:@Moderators
✅ Giveaway command permissions updated successfully!
```

Now all users with the @Moderators role can use giveaway commands.

### 2. Add Specific User

```
/giveaway config add_user user:@JohnDoe
✅ Giveaway command permissions updated successfully!
```

Now @JohnDoe can use giveaway commands even without a special role.

### 3. View Current Config

```
/giveaway config show:true

🎉 Giveaway Command Permissions
Allowed Roles: @Moderators, @EventManagers
Allowed Users: @JohnDoe, @JaneSmith
```

### 4. Remove Access

```
/giveaway config remove_role role:@EventManagers
✅ Giveaway command permissions updated successfully!
```

## Error Messages

### User Without Permission

```
User: /giveaway create ...
Bot: ❌ You don't have permission to use giveaway commands. Contact an administrator.
```

### Non-Admin Trying to Configure

```
User: /giveaway config add_role ...
Bot: ❌ Only administrators can configure giveaway permissions.
```

### Not in Server

```
User: /giveaway create ... (in DM)
Bot: ❌ This command can only be used in a server.
```

## Default Behavior

When no configuration exists:
- **Administrators**: Can use all commands
- **Everyone else**: Cannot use commands

This ensures security by default - admins must explicitly grant access.

## Technical Details

### Permission Check Flow

```
User executes /giveaway create
  ↓
Check if subcommand is 'config'
  ↓ No
Check if user is in server
  ↓ Yes
Get ConfigManager from GiveawayManager
  ↓
Call canUseGiveawayCommands(guildId, member)
  ↓
Check if user is Administrator → Yes → Allow
  ↓ No
Get guild config from database
  ↓
Check if user ID in allowedUsers → Yes → Allow
  ↓ No
Check if user has any role in allowedRoles → Yes → Allow
  ↓ No
Deny with error message
```

### Database Schema

```sql
CREATE TABLE giveaway_config (
  guild_id TEXT PRIMARY KEY,
  allowed_roles TEXT[], -- Array of role IDs
  allowed_users TEXT[], -- Array of user IDs
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### ConfigManager Methods

```typescript
// Get current permissions
async getGiveawayPermissions(guildId: string): Promise<GiveawayConfig>

// Update permissions
async updateGiveawayPermissions(
  guildId: string,
  allowedRoles: string[],
  allowedUsers: string[]
): Promise<void>

// Check if user can use commands
async canUseGiveawayCommands(
  guildId: string,
  member: GuildMember
): Promise<boolean>
```

## Migration Notes

### For Existing Servers

If your server was using the old system:
- Users with "Manage Events" permission will need to be added via `/giveaway config`
- OR grant them Administrator permission
- OR add their role via `/giveaway config add_role`

### Backward Compatibility

- Existing giveaways continue to work
- Existing database configs are preserved
- No data migration needed

## Testing Checklist

- [x] Administrators can use all commands
- [x] Configured roles can use commands
- [x] Configured users can use commands
- [x] Unauthorized users see error message
- [x] Config command requires Administrator
- [x] Commands work in servers only
- [x] Permission checks don't break existing functionality
- [x] Error messages are clear and helpful

## Related Files

- `src/commands/giveaway.commands.ts` - Command definitions and handlers
- `src/giveaway/config-manager.ts` - Permission checking logic
- `src/core/database/repositories/GiveawayConfigRepository.ts` - Database operations
- `docs/COMMAND_REFERENCE.md` - User documentation

## Summary

The giveaway permission system now works as intended:
- ✅ Slash commands visible to everyone
- ✅ Permission checks in handlers
- ✅ Database-driven access control
- ✅ Administrator override
- ✅ Clear error messages
- ✅ Secure by default

Administrators can now properly delegate giveaway management to specific roles and users!


---

## Prefix Command Permission Fix

### Issue with gw.reroll

The `gw.reroll` prefix command was still checking for `ManageEvents` permission instead of using the custom permission system from the database.

**Before:**
```typescript
if (!message.member?.permissions.has('ManageEvents')) {
  return "❌ You need the `Manage Events` permission to use this command.";
}
```

**After:**
```typescript
const configManager = this.giveawayManager.getConfigManager();
const canUse = await configManager.canUseGiveawayCommands(guildId, member);

if (!canUse) {
  return "❌ You don't have permission to use giveaway commands. Contact an administrator.";
}
```

### Changes Made

1. **Removed hardcoded permission check**
   - No longer checks for `ManageEvents` permission
   - Now uses `canUseGiveawayCommands()` like slash commands

2. **Consistent permission system**
   - Both `/giveaway reroll` and `gw.reroll` use the same permission logic
   - Configured roles/users can use both commands

3. **Better error message**
   - Changed from "You need the `Manage Events` permission"
   - To "You don't have permission to use giveaway commands. Contact an administrator."
   - Matches the slash command error message

### Permission Consistency

Now both command types use the same permission system:

| Command Type | Permission Check | Configurable |
|--------------|------------------|--------------|
| `/giveaway create` | `canUseGiveawayCommands()` | ✅ Yes |
| `/giveaway reroll` | `canUseGiveawayCommands()` | ✅ Yes |
| `gw.reroll` | `canUseGiveawayCommands()` | ✅ Yes |
| `/giveaway config` | Administrator only | ❌ No |

### Testing

```
# Setup: Admin adds a role
/giveaway config add_role role:@EventManagers

# Test: User with @EventManagers role
gw.reroll abc123 @winner
✅ Works! (uses custom permissions)

# Test: User without permission
gw.reroll abc123 @winner
❌ You don't have permission to use giveaway commands. Contact an administrator.
```

## Complete Permission System

### All Commands Now Use Custom Permissions

1. **Slash Commands**
   - `/giveaway create` ✅
   - `/giveaway cancel` ✅
   - `/giveaway list` ✅
   - `/giveaway reroll` ✅
   - `/giveaway config` ⚠️ (Administrator only)

2. **Prefix Commands**
   - `gw.reroll` ✅

### Configuration Commands

```bash
# Add a role
/giveaway config add_role role:@Moderators

# Add a user
/giveaway config add_user user:@JohnDoe

# Remove a role
/giveaway config remove_role role:@OldRole

# Remove a user
/giveaway config remove_user user:@OldUser

# View current config
/giveaway config show:true
```

### Permission Hierarchy

1. **Administrator** - Full access to everything (including config)
2. **Configured Roles** - Can use all giveaway commands (except config)
3. **Configured Users** - Can use all giveaway commands (except config)
4. **Everyone Else** - No access

## Summary

✅ All giveaway commands now use the custom permission system
✅ Consistent behavior between slash and prefix commands
✅ Administrators can delegate access to specific roles/users
✅ Secure by default (admin-only if no config)
✅ Clear error messages for unauthorized users

The permission system is now fully functional across all command types!
