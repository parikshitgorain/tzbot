# User Linking and Role Synchronization

This document describes the user linking and role synchronization systems for connecting Kick and Discord accounts.

## Overview

The system consists of two main components:

1. **User Linking System** - Allows users to link their Kick and Discord accounts
2. **Role Sync System** - Automatically synchronizes Discord roles based on Kick badges

## User Linking System

### How It Works

1. User runs `/link` command on Discord
2. Bot generates a unique 8-character token (expires in 10 minutes)
3. Bot sends token to user via DM
4. User types `!verify TOKEN` in Kick chat
5. Bot monitors Kick chat for verification commands
6. Bot completes the link and stores mapping in database
7. Bot sends confirmation DM to user

### Features

- **Secure Token Generation**: Uses cryptographically secure random tokens
- **Token Expiration**: Tokens expire after 10 minutes
- **Automatic Cleanup**: Expired tokens are cleaned up every 5 minutes
- **Duplicate Prevention**: Prevents linking same Kick username to multiple Discord accounts
- **Case-Insensitive**: Tokens work regardless of case

### API

```typescript
interface IUserLinkingSystem {
  // Start linking process
  startLinking(discordId: string): Promise<LinkToken>;

  // Verify token
  verifyToken(token: string): Promise<string | null>;

  // Complete link
  completeLink(discordId: string, kickUsername: string): Promise<void>;

  // Unlink accounts
  unlinkAccounts(discordId: string): Promise<void>;

  // Check link status
  isLinked(discordId: string): Promise<boolean>;

  // Get linked username/ID
  getKickUsername(discordId: string): Promise<string | null>;
  getDiscordId(kickUsername: string): Promise<string | null>;

  // Process verification message
  processVerificationMessage(message: KickChatMessage): Promise<LinkResult | null>;

  // Cleanup expired tokens
  cleanupExpiredTokens(): Promise<void>;
}
```

### Usage Example

```typescript
import { UserLinkingSystem } from './user-linking.js';
import { Database } from '../../core/database/Database.js';

const database = new Database(config.databaseUrl);
await database.connect();

const linkingSystem = new UserLinkingSystem(database.users);

// Start linking
const linkToken = await linkingSystem.startLinking('123456789');
console.log(`Token: ${linkToken.token}`);

// Process verification from Kick chat
const message = {
  id: '1',
  username: 'testuser',
  content: '!verify ABC12345',
  timestamp: new Date(),
  badges: [],
};

const result = await linkingSystem.processVerificationMessage(message);
if (result?.success) {
  console.log('Link successful!');
}
```

## Role Sync System

### How It Works

1. User chats on Kick
2. Bot detects subscriber/VIP badges in chat message
3. Bot looks up linked Discord user
4. Bot compares current roles with badge status
5. Bot adds/removes roles as needed
6. Bot logs all role changes

### Features

- **Automatic Synchronization**: Roles sync whenever user chats on Kick
- **Badge Detection**: Detects subscriber and VIP badges
- **Bidirectional Sync**: Adds roles when badges appear, removes when they disappear
- **Error Handling**: Gracefully handles Discord API errors
- **Enable/Disable**: Can be toggled on/off without restarting bot
- **Comprehensive Logging**: Logs all role changes for audit trail

### Supported Badges

- **Subscriber**: Assigns subscriber role
- **VIP**: Assigns VIP role
- **Moderator**: Detected but no role assigned (informational)
- **Broadcaster**: Detected but no role assigned (informational)

### API

```typescript
interface IRoleSyncSystem {
  // Sync roles from chat message
  syncRolesFromMessage(message: KickChatMessage): Promise<RoleSyncResult | null>;

  // Sync roles from badge info
  syncRolesFromBadges(badgeInfo: UserBadgeInfo): Promise<RoleSyncResult | null>;

  // Manual role sync
  syncUserRoles(
    discordId: string,
    hasSubscriberBadge: boolean,
    hasVIPBadge: boolean
  ): Promise<RoleSyncResult>;

  // Check role status
  hasRole(discordId: string, roleId: string): Promise<boolean>;

  // Enable/disable
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
}
```

### Usage Example

```typescript
import { RoleSyncSystem } from './role-sync.js';
import { discordClient } from '../../core/discord/client.js';

const roleSyncSystem = new RoleSyncSystem(
  {
    guildId: '123456789',
    subscriberRoleId: 'sub-role-id',
    vipRoleId: 'vip-role-id',
    enabled: true,
  },
  discordClient,
  linkingSystem
);

// Sync roles from chat message
const message = {
  id: '1',
  username: 'testuser',
  content: 'Hello!',
  timestamp: new Date(),
  badges: [{ type: 'subscriber', months: 3 }],
};

const result = await roleSyncSystem.syncRolesFromMessage(message);
if (result?.success) {
  console.log(`Roles added: ${result.rolesAdded.join(', ')}`);
  console.log(`Roles removed: ${result.rolesRemoved.join(', ')}`);
}
```

## Integration with Kick Chat Client

Both systems integrate seamlessly with the Kick chat client:

```typescript
import { kickChatClient } from './chat-client.js';

await kickChatClient.connect({
  channelId: config.kickChannelId,

  onMessage: async (message) => {
    // Check for verification commands
    const linkResult = await linkingSystem.processVerificationMessage(message);
    if (linkResult) {
      if (linkResult.success) {
        // Send confirmation DM
        // Immediately sync roles
      }
      return;
    }

    // Sync roles based on badges
    await roleSyncSystem.syncRolesFromMessage(message);
  },

  onSubscriberDetected: async (username, months) => {
    console.log(`Subscriber detected: ${username}`);
  },

  onVIPDetected: async (username) => {
    console.log(`VIP detected: ${username}`);
  },
});
```

## Discord Commands

### /link

Starts the account linking process.

**Response:**
```
🔗 Account Linking Instructions

To link your Kick account, follow these steps:

1. Go to the Kick stream chat
2. Type the following command in chat:
   !verify ABC12345

Your token will expire in 10 minutes.

Once verified, your Discord roles will automatically sync with your Kick badges!
```

### /unlink

Removes the account link and associated roles.

**Response:**
```
✅ Your account has been unlinked from Kick username: testuser

Your subscriber and VIP roles have been removed.
```

### /checklink

Checks the current link status.

**Response (linked):**
```
✅ Your Discord account is linked to Kick username: testuser

Your roles are automatically synchronized based on your Kick badges.
```

**Response (not linked):**
```
You don't have a linked Kick account.

Use /link to start the linking process.
```

## Database Schema

The system uses the existing `users` table:

```sql
CREATE TABLE users (
  discord_id VARCHAR(20) PRIMARY KEY,
  kick_username VARCHAR(100) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_kick_username ON users(kick_username);
```

## Configuration

Required configuration values:

```typescript
interface Config {
  guildId: string; // Discord server ID
  subscriberRoleId: string; // Subscriber role ID
  vipRoleId: string; // VIP role ID
  kickChannelId: string; // Kick channel ID
  databaseUrl: string; // PostgreSQL connection string
}
```

## Error Handling

Both systems include comprehensive error handling:

- **Token Expiration**: Expired tokens are automatically cleaned up
- **Duplicate Links**: Prevents linking same Kick username to multiple Discord accounts
- **Discord API Errors**: Gracefully handles role assignment failures
- **Database Errors**: Logs errors and returns appropriate error messages
- **Missing Members**: Handles cases where Discord member is not found

## Logging

All operations are logged with appropriate context:

- Token generation and verification
- Account linking/unlinking
- Role additions/removals
- Errors and failures

Example log entries:

```
[INFO] Generated linking token { discordId: '123456789', token: 'ABC12345' }
[INFO] Account linking completed { discordId: '123456789', kickUsername: 'testuser' }
[INFO] Added subscriber role { discordId: '123456789', kickUsername: 'testuser' }
[INFO] Removed VIP role { discordId: '123456789', kickUsername: 'testuser' }
```

## Performance Considerations

- **Token Storage**: Tokens are stored in memory (Map) for fast lookup
- **Token Cleanup**: Automatic cleanup every 5 minutes prevents memory leaks
- **Role Checks**: Checks current roles before adding/removing to avoid unnecessary API calls
- **Database Queries**: Uses indexed columns for fast lookups

## Security Considerations

- **Cryptographically Secure Tokens**: Uses `crypto.randomBytes()` for token generation
- **Token Expiration**: Tokens expire after 10 minutes
- **Duplicate Prevention**: Prevents account hijacking by checking existing links
- **Case-Insensitive Tokens**: Prevents user confusion while maintaining security

## Limitations

- **Chat Requirement**: Users must chat on Kick at least once for role sync to work
- **Badge Detection**: Only detects badges when user chats (not real-time)
- **Manual Verification**: Requires user to manually type verification command
- **Single Guild**: Currently supports one Discord server per bot instance

## Future Enhancements

Potential improvements:

1. **Webhook Integration**: Use Kick webhooks for real-time badge updates
2. **Periodic Sync**: Implement periodic role sync for all linked users
3. **Multi-Guild Support**: Support multiple Discord servers
4. **Role History**: Track role change history for analytics
5. **Automatic Unlinking**: Unlink accounts after X days of inactivity
6. **Custom Roles**: Support custom role mappings per server

## Requirements Validation

This implementation satisfies the following requirements:

- **Requirement 2.1**: Assign subscriber role when user becomes subscriber on Kick
- **Requirement 2.2**: Assign VIP role when user becomes VIP on Kick
- **Requirement 2.3**: Remove subscriber role when user loses subscriber status
- **Requirement 2.4**: Remove VIP role when user loses VIP status
- **Requirement 2.5**: Maintain mapping between Kick usernames and Discord user IDs
- **Requirement 2.6**: Log synchronization failures and retry on next sync cycle

## Testing

Both systems include comprehensive unit tests:

- **User Linking**: 25 tests covering all functionality
- **Role Sync**: 19 tests covering all functionality

Run tests:

```bash
npm test -- tests/unit/services/kick/user-linking.test.ts
npm test -- tests/unit/services/kick/role-sync.test.ts
```

## Support

For issues or questions:

1. Check the logs for error messages
2. Verify configuration is correct
3. Ensure bot has required Discord permissions
4. Check database connectivity
5. Verify Kick chat connection is active
