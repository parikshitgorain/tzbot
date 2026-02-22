# Data Retention Service

## Overview

The Data Retention Service handles automatic cleanup of old data according to GDPR compliance requirements and data retention policies. It ensures that personal data is not stored longer than necessary and provides mechanisms for users to request complete data deletion.

## Features

- **Automatic Cleanup**: Scheduled deletion of old message content and chat activity
- **GDPR Compliance**: Complete user data deletion on request
- **Configurable Retention Periods**: Customizable retention policies
- **Statistics Tracking**: Monitor data retention metrics

## Requirements

**Validates:**
- Requirement 15.2: Message content should not be stored longer than 7 days
- Requirement 15.4: Provide /deletemydata command to remove all stored data

## Usage

### Basic Setup

```typescript
import { DataRetentionService } from '@/core/data-retention/retention.service.js';
import { pool } from '@/core/database/pool.js';

// Create service with default config (7 days for messages, 30 days for activity)
const retentionService = new DataRetentionService(pool);

// Start automatic cleanup (runs every hour)
retentionService.start();

// Stop cleanup when shutting down
retentionService.stop();
```

### Custom Configuration

```typescript
const customConfig = {
  messageContentRetentionDays: 7,    // Keep messages for 7 days
  chatActivityRetentionDays: 30,     // Keep activity for 30 days
  cleanupIntervalMinutes: 60,        // Run cleanup every hour
};

const retentionService = new DataRetentionService(pool, customConfig);
retentionService.start();
```

### Manual Cleanup

```typescript
// Delete all data for a specific user (GDPR request)
await retentionService.deleteAllUserData('123456789');

// Get retention statistics
const stats = await retentionService.getRetentionStats();
console.log('Old messages to clean:', stats.oldMessageContentCount);
```

## Data Deletion Scope

When a user requests data deletion via `/deletemydata`, the following data is removed:

1. **Message Content**: All stored message content
2. **Chat Activity**: All chat activity records
3. **Chat Rain Winners**: All chat rain winner records
4. **Giveaway Entries**: All giveaway entries
5. **Violations**: All violation records
6. **Moderation Logs**: All moderation logs where user is the target
7. **User Record**: The user's account record and linked Kick username

## Retention Policies

### Message Content
- **Retention Period**: 7 days (configurable)
- **Scope**: All message content except moderation logs
- **Cleanup Frequency**: Every hour (configurable)

### Chat Activity
- **Retention Period**: 30 days (configurable)
- **Scope**: All chat activity records for chat rain eligibility
- **Cleanup Frequency**: Every hour (configurable)

## Architecture

```
DataRetentionService
├── start()                    - Start automatic cleanup scheduler
├── stop()                     - Stop automatic cleanup scheduler
├── cleanupOldMessageContent() - Delete messages older than retention period
├── cleanupOldChatActivity()   - Delete activity older than retention period
├── deleteAllUserData()        - Delete all data for a user (GDPR)
└── getRetentionStats()        - Get retention statistics
```

## Database Tables Affected

- `message_content` - Message content with 7-day retention
- `chat_activity` - Chat activity with 30-day retention
- `chat_rain_winners` - Deleted on user data deletion
- `giveaway_entries` - Deleted on user data deletion
- `violations` - Deleted on user data deletion
- `moderation_logs` - Deleted on user data deletion
- `users` - Deleted on user data deletion

## Logging

The service logs all cleanup operations:

```typescript
// Cleanup started
logger.info('Running data retention cleanup');

// Cleanup completed
logger.info('Data retention cleanup completed', {
  duration: 1234,
  deletedMessageContent: 150,
  deletedChatActivity: 500,
});

// User data deleted
logger.info('Deleted all user data', { userId: '123456789' });
```

## Error Handling

All cleanup operations are wrapped in try-catch blocks and log errors:

```typescript
try {
  await retentionService.deleteAllUserData(userId);
} catch (error) {
  // Error is logged automatically
  // Transaction is rolled back
  throw error;
}
```

## Testing

See `tests/unit/core/data-retention/retention.service.test.ts` for unit tests.

## Integration

The Data Retention Service is integrated with:

1. **Utility Commands**: `/deletemydata` command uses `deleteAllUserData()`
2. **Main Application**: Service is started on bot startup
3. **Shutdown Handler**: Service is stopped on graceful shutdown

## Performance Considerations

- Cleanup runs in background without blocking bot operations
- Uses indexed queries for efficient deletion
- Transactions ensure data consistency
- Configurable intervals prevent excessive database load

## Compliance

This service helps ensure compliance with:

- **GDPR Article 17**: Right to erasure ("right to be forgotten")
- **GDPR Article 5**: Data minimization and storage limitation
- **Discord ToS**: Proper handling of user data
