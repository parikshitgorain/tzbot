# State Persistence Module

## Overview

The state persistence module provides automatic saving and recovery of critical bot state to ensure reliability and continuity across restarts.

## Features

- **Automatic Persistence**: Saves state every 60 seconds (configurable)
- **Checksum Verification**: Ensures data integrity using SHA-256 checksums
- **Backup System**: Maintains multiple backup files for recovery
- **Graceful Degradation**: Handles corrupted state files by falling back to backups
- **State Recovery**: Automatically restores state on bot startup

## Requirements

Implements the following requirements:
- **14.3**: Persist critical state to disk every 60 seconds
- **14.4**: Restore state from most recent persisted data on restart

## Critical State Data

The following state is persisted:

### Chat Rain State
- Last execution time for enforcing minimum delay between events

### Notification Queue
- Queued notifications awaiting retry
- Attempt counts and timestamps
- Event data and embed information

### Active Giveaways
- Giveaway IDs and end times
- Used for rescheduling giveaway end events after restart

## Usage

### Initialization

```typescript
import { StatePersistenceService } from '@/core/state/state-persistence.js';

const statePersistence = new StatePersistenceService({
  stateDir: './data/state',
  stateFile: 'bot-state.json',
  persistIntervalMs: 60000, // 60 seconds
  maxBackups: 5,
});

await statePersistence.initialize();
```

### Starting Auto-Persistence

```typescript
// Start automatic state persistence
statePersistence.startAutoPersistence();
```

### Updating State

Managers should update state when their critical data changes:

```typescript
// Update chat rain state
statePersistence.updateState({
  chatRain: {
    lastExecutionTime: new Date(),
  },
});

// Update notification queue
statePersistence.updateState({
  notificationQueue: queuedNotifications,
});

// Update active giveaways
statePersistence.updateState({
  activeGiveaways: activeGiveaways.map(g => ({
    id: g.id,
    endsAt: g.endsAt,
  })),
});
```

### Recovering State on Startup

```typescript
// Recover state from disk
const recoveredState = await statePersistence.recoverState();

if (recoveredState) {
  // Restore chat rain state
  if (recoveredState.data.chatRain) {
    chatRainManager.restoreState(recoveredState.data.chatRain);
  }

  // Restore notification queue
  if (recoveredState.data.notificationQueue) {
    notificationManager.restoreQueue(recoveredState.data.notificationQueue);
  }

  // Restore active giveaways
  if (recoveredState.data.activeGiveaways) {
    await giveawayManager.recoverActiveGiveaways(guildId);
  }
}
```

### Graceful Shutdown

```typescript
// Stop auto-persistence and save final state
await statePersistence.shutdown();
```

## State File Format

State is stored as JSON with the following structure:

```json
{
  "version": "1.0.0",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "checksum": "abc123...",
  "data": {
    "chatRain": {
      "lastExecutionTime": "2025-01-15T10:25:00.000Z"
    },
    "notificationQueue": [
      {
        "id": "uuid",
        "eventId": "event-123",
        "eventType": "stream_live",
        "embedData": { ... },
        "attempts": 1,
        "lastAttempt": "2025-01-15T10:29:00.000Z",
        "createdAt": "2025-01-15T10:28:00.000Z"
      }
    ],
    "activeGiveaways": [
      {
        "id": "giveaway-123",
        "endsAt": "2025-01-15T12:00:00.000Z"
      }
    ]
  }
}
```

## Backup System

- Backups are created before each state save
- Backup files are named: `bot-state.backup.YYYY-MM-DDTHH-MM-SS-sssZ.json`
- Only the most recent N backups are kept (configurable, default: 5)
- Backups are automatically used if the main state file is corrupted

## Error Handling

### Corrupted State File

If the main state file is corrupted (checksum mismatch):
1. Log error with details
2. Attempt to recover from most recent backup
3. Try each backup in reverse chronological order
4. If all backups fail, start with fresh state

### Missing State File

If no state file exists on startup:
- Log informational message
- Start with fresh state
- No error is raised

### Persistence Failures

If state persistence fails:
- Log error with details
- Continue operation (don't crash)
- Retry on next persistence interval

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `stateDir` | string | required | Directory to store state files |
| `stateFile` | string | `'bot-state.json'` | Filename for state file |
| `persistIntervalMs` | number | `60000` | Persistence interval in milliseconds |
| `maxBackups` | number | `5` | Maximum number of backup files to keep |

## Best Practices

1. **Update State Immediately**: Call `updateState()` whenever critical state changes
2. **Don't Store Large Data**: Only persist critical state needed for recovery
3. **Use Partial Updates**: Only update the parts of state that changed
4. **Handle Recovery Gracefully**: Check if recovered state exists before using it
5. **Test Recovery**: Regularly test state recovery by restarting the bot

## Testing

The state persistence system should be tested for:
- Successful state persistence and recovery
- Handling of corrupted state files
- Backup creation and cleanup
- Checksum verification
- Date serialization/deserialization

## Performance Considerations

- State persistence is asynchronous and non-blocking
- Persistence is skipped if already in progress
- File I/O is performed using Node.js async file system APIs
- Checksum calculation is fast (SHA-256 is optimized)
- Typical persistence time: < 50ms for small state files

## Security

- State files may contain sensitive data
- Ensure proper file permissions on state directory
- Consider encrypting state files if they contain secrets
- Backup files should have the same security as main state file

## Troubleshooting

### State Not Persisting

Check:
- State directory exists and is writable
- Auto-persistence has been started
- No errors in logs
- Disk space is available

### State Not Recovering

Check:
- State file exists in state directory
- File is valid JSON
- Checksum matches (if not, backups will be tried)
- Date fields are valid ISO 8601 strings

### Backup Files Accumulating

Check:
- `maxBackups` configuration is set correctly
- Cleanup is not failing (check logs)
- State directory has write permissions
