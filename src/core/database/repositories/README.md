# Database Repositories

This directory contains repository classes that implement the repository pattern for clean data access.

## Overview

Each repository provides a clean interface for database operations related to a specific domain:

- **UserRepository**: User account management and Kick username linking
- **ViolationRepository**: Violation tracking for spam escalation
- **GiveawayRepository**: Giveaway state and entry management
- **ChatActivityRepository**: Chat activity tracking for chat rain
- **ConfigRepository**: Key-value configuration storage

## Architecture

The repository pattern provides several benefits:

1. **Separation of Concerns**: Database logic is isolated from business logic
2. **Testability**: Repositories can be mocked for unit testing
3. **Error Handling**: All database errors are caught and wrapped with context
4. **Type Safety**: Full TypeScript support with proper types
5. **Consistency**: Uniform interface across all data access operations

## Usage

### Basic Usage with Database Class

The recommended way to use repositories is through the `Database` class:

```typescript
import { Database } from './core/database';

const db = new Database();

// Connect to database (runs migrations automatically)
await db.connect({
  host: 'localhost',
  port: 5432,
  database: 'tzbot',
  user: 'postgres',
  password: 'password',
});

// Use database interface methods
const user = await db.getUser('123456789');
await db.saveViolation(violation);
await db.addGiveawayEntry(giveawayId, userId);

// Disconnect when done
await db.disconnect();
```

### Direct Repository Usage

For advanced use cases, you can access repositories directly:

```typescript
import { getPool } from './core/database/pool';
import { UserRepository } from './core/database/repositories';

const pool = getPool();
const userRepo = new UserRepository(pool);

// Use repository methods
const user = await userRepo.get('123456789');
await userRepo.linkKickUsername('123456789', 'kickuser');
```

## Repository Methods

### UserRepository

```typescript
// Save or update a user
await userRepo.save({
  discordId: '123456789',
  kickUsername: 'testuser',
});

// Get user by Discord ID
const user = await userRepo.get('123456789');

// Get user by Kick username
const user = await userRepo.getByKickUsername('testuser');

// Link Kick username to Discord user
await userRepo.linkKickUsername('123456789', 'kickuser');

// Unlink Kick username
await userRepo.unlinkKickUsername('123456789');

// Delete all user data (GDPR compliance)
await userRepo.deleteUserData('123456789');
```

### ViolationRepository

```typescript
// Save a violation
const violationId = await violationRepo.save({
  userId: '123456789',
  type: ViolationType.SPAM,
  severity: 1,
  timestamp: new Date(),
  details: 'Sent 5 identical messages',
  punishmentApplied: PunishmentLevel.WARNING,
});

// Get violations since a date
const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
const violations = await violationRepo.get('123456789', since);

// Get violation count
const count = await violationRepo.getCount('123456789', since, ViolationType.SPAM);

// Get latest violation
const latest = await violationRepo.getLatest('123456789');

// Clear all violations for a user
await violationRepo.clear('123456789');

// Clear old violations (cleanup job)
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const deletedCount = await violationRepo.clearOldViolations(sevenDaysAgo);
```

### GiveawayRepository

```typescript
// Save a giveaway
await giveawayRepo.save({
  id: 'giveaway-uuid',
  title: 'Free Game Key',
  description: 'Win a free game key!',
  channelId: '987654321',
  messageId: '111222333',
  requiredRoles: ['subscriber-role-id'],
  winnerCount: 3,
  status: GiveawayStatus.ACTIVE,
  endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  entries: [],
});

// Get a giveaway
const giveaway = await giveawayRepo.get('giveaway-uuid');

// Get all active giveaways
const activeGiveaways = await giveawayRepo.getActive();

// Add an entry
await giveawayRepo.addEntry('giveaway-uuid', '123456789');

// Check if user has entered
const hasEntered = await giveawayRepo.hasEntry('giveaway-uuid', '123456789');

// Get all entries
const entries = await giveawayRepo.getEntries('giveaway-uuid');

// Update status
await giveawayRepo.updateStatus('giveaway-uuid', GiveawayStatus.ENDED);

// Get giveaways by channel
const channelGiveaways = await giveawayRepo.getByChannel('987654321', GiveawayStatus.ACTIVE);
```

### ChatActivityRepository

```typescript
// Record chat activity
await chatActivityRepo.record('123456789', new Date());

// Get active chatters (sent messages in last 10 minutes)
const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
const activeChatters = await chatActivityRepo.getActiveChatters(tenMinutesAgo);

// Get message count for a user
const messageCount = await chatActivityRepo.getMessageCount('123456789', tenMinutesAgo);

// Get qualified chatters (3+ messages in time window)
const qualifiedChatters = await chatActivityRepo.getQualifiedChatters(tenMinutesAgo, 3);

// Record a chat rain winner
await chatActivityRepo.recordWinner('123456789', new Date(), 'role', 'winner-role-id');

// Get recent winners (for cooldown enforcement)
const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);
const recentWinners = await chatActivityRepo.getRecentWinners(sixtyMinutesAgo);

// Check if user won recently
const hasRecentWin = await chatActivityRepo.hasRecentWin('123456789', sixtyMinutesAgo);

// Get last chat rain time
const lastChatRainTime = await chatActivityRepo.getLastChatRainTime();

// Cleanup old activity (run periodically)
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
const deletedCount = await chatActivityRepo.cleanupOldActivity(oneHourAgo);
```

### ConfigRepository

```typescript
// Set a config value
await configRepo.set('notification_channel', '987654321');
await configRepo.set('spam_threshold', { identical: 5, rapid: 10 });

// Get a config value
const channelId = await configRepo.get('notification_channel');
const threshold = await configRepo.get('spam_threshold');

// Get multiple values
const keys = ['notification_channel', 'spam_threshold'];
const configs = await configRepo.getMany(keys);

// Set multiple values
const configMap = new Map([
  ['key1', 'value1'],
  ['key2', { nested: 'object' }],
]);
await configRepo.setMany(configMap);

// Check if key exists
const exists = await configRepo.has('notification_channel');

// Get all keys
const allKeys = await configRepo.getAllKeys();

// Get all configs
const allConfigs = await configRepo.getAll();

// Delete a config
const deleted = await configRepo.delete('old_key');
```

## Error Handling

All repository methods throw errors with descriptive messages:

```typescript
try {
  await userRepo.save(user);
} catch (error) {
  // Error message includes context: "Failed to save user: <original error>"
  console.error(error.message);
}
```

## Database Schema

The repositories work with the following database schema:

- **users**: Discord ID, Kick username, timestamps
- **violations**: User violations with type, severity, punishment
- **giveaways**: Giveaway details with status and end time
- **giveaway_entries**: User entries for giveaways
- **chat_activity**: User message timestamps
- **chat_rain_winners**: Chat rain winner history
- **config**: Key-value configuration storage

See `schema/001_initial_schema.sql` for the complete schema definition.

## Testing

Repository tests require a PostgreSQL test database:

```bash
# Create test database
createdb tzbot_test

# Run tests
npm test -- tests/unit/core/database/repositories
```

## Best Practices

1. **Always use connection pooling**: Don't create new connections for each operation
2. **Handle errors gracefully**: Wrap repository calls in try-catch blocks
3. **Use transactions for multi-step operations**: Use the pool's transaction support
4. **Clean up old data**: Run periodic cleanup jobs for chat activity and violations
5. **Use the Database class**: Prefer the unified interface over direct repository access
6. **Validate input**: Validate data before passing to repositories
7. **Use TypeScript types**: Leverage the type system for compile-time safety

## Performance Considerations

- **Indexes**: All frequently queried columns have indexes
- **Connection pooling**: Max 20 connections per requirements
- **Batch operations**: Use `setMany()` for multiple config updates
- **Cleanup jobs**: Run periodic cleanup to prevent table bloat
- **Query optimization**: All queries use parameterized statements

## Requirements Validation

This implementation satisfies the following requirements:

- **Requirement 2.5**: User mapping persistence (UserRepository)
- **Requirement 4.1-4.6**: Violation tracking and escalation (ViolationRepository)
- **Requirement 9.5**: Giveaway entry recording (GiveawayRepository)
- **Requirement 11.1**: Active chatter tracking (ChatActivityRepository)
- **Requirement 12.1**: Configuration storage (ConfigRepository)
