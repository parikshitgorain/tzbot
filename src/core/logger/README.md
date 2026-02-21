# Comprehensive Logging System

## Overview

The TZBOT logging system provides structured, comprehensive logging with automatic log rotation for all system events. It validates requirements 3.5, 5.6, 7.6, 8.6, and 14.5 from the requirements document.

## Features

- **Structured Logging**: All logs include event types and structured context
- **Log Rotation**: Automatic daily log rotation with configurable retention
- **Multiple Log Streams**: Separate logs for general, errors, and moderation
- **Stack Trace Capture**: Full error stack traces for debugging
- **Event Type Classification**: Categorized logging for easy filtering
- **Child Loggers**: Component-specific loggers with inherited metadata

## Requirements Validation

### Requirement 3.5: Message Deletion Logging
Logs all deleted messages with user ID, message content, and timestamp.

### Requirement 5.6: Moderation Action Logging
Logs moderation actions with moderator ID, target user ID, action type, reason, and timestamp.

### Requirement 7.6: Malicious Link Detection Logging
Logs malicious link detection with user ID, message content, and detected link.

### Requirement 8.6: System Transition Logging
Logs all monitoring system transitions with timestamp and reason.

### Requirement 14.5: Error Logging
Logs all errors with stack traces, timestamps, and context information.

## Log Event Types

```typescript
enum LogEventType {
  MODERATION_ACTION = 'moderation_action',
  VIOLATION_DETECTED = 'violation_detected',
  MESSAGE_DELETED = 'message_deleted',
  MALICIOUS_LINK = 'malicious_link',
  SYSTEM_TRANSITION = 'system_transition',
  ERROR = 'error',
  SECURITY_EVENT = 'security_event',
  PERFORMANCE_WARNING = 'performance_warning',
  API_REQUEST = 'api_request',
  DATABASE_OPERATION = 'database_operation',
}
```

## Usage Examples

### Error Logging

```typescript
import { logError } from '@/core/logger/logger.js';

try {
  // Some operation
} catch (error) {
  logError('Failed to process command', error as Error, {
    errorName: 'CommandProcessingError',
    component: 'CommandManager',
    operation: 'processCommand',
    userId: interaction.user.id,
  });
}
```

### Moderation Action Logging

```typescript
import { logModeration } from '@/core/logger/logger.js';

logModeration({
  action: 'User banned for repeated violations',
  moderatorId: interaction.user.id,
  targetUserId: targetUser.id,
  reason: 'Spam and malicious links',
  actionType: 'ban',
  channelId: interaction.channelId,
});
```

### Message Deletion Logging

```typescript
import { logMessageDeletion } from '@/core/logger/logger.js';

logMessageDeletion({
  messageId: message.id,
  userId: message.author.id,
  channelId: message.channelId,
  content: message.content,
  reason: 'Posted in read-only channel',
  deletedBy: 'AutoMod',
});
```

### Malicious Link Detection Logging

```typescript
import { logMaliciousLink } from '@/core/logger/logger.js';

logMaliciousLink({
  userId: message.author.id,
  messageId: message.id,
  channelId: message.channelId,
  messageContent: message.content,
  detectedLink: 'http://phishing-site.com',
  linkType: 'phishing',
  action: 'Message deleted and user timed out for 24 hours',
});
```

### System Transition Logging

```typescript
import { logSystemTransition } from '@/core/logger/logger.js';

logSystemTransition({
  from: 'webhook',
  to: 'polling',
  reason: 'Webhook failures exceeded threshold (3 consecutive failures)',
  component: 'NotificationManager',
  automatic: true,
});
```

### Violation Logging

```typescript
import { logViolation } from '@/core/logger/logger.js';

logViolation(
  userId,
  'spam',
  'Sent 10 messages in 5 seconds',
  {
    messageCount: 10,
    timeWindow: 5,
    channelId: message.channelId,
  }
);
```

### Security Event Logging

```typescript
import { logSecurityEvent } from '@/core/logger/logger.js';

logSecurityEvent('Rate limit exceeded', {
  userId: user.id,
  endpoint: '/api/commands',
  requestCount: 100,
  timeWindow: 60,
});
```

### Performance Warning Logging

```typescript
import { logPerformanceWarning } from '@/core/logger/logger.js';

logPerformanceWarning('High memory usage detected', {
  memoryUsage: 450,
  threshold: 512,
  unit: 'MB',
  component: 'EventManager',
});
```

### Database Operation Logging

```typescript
import { logDatabaseOperation } from '@/core/logger/logger.js';

logDatabaseOperation('INSERT', {
  table: 'violations',
  duration: 15,
  rowsAffected: 1,
  userId: user.id,
});
```

### Child Logger

```typescript
import { createChildLogger } from '@/core/logger/logger.js';

const componentLogger = createChildLogger({ component: 'GiveawayManager' });
componentLogger.info('Giveaway created', { giveawayId: '123' });
```

## Log Rotation

The logging system implements automatic log rotation with the following configuration:

### General Logs
- **File Pattern**: `logs/tzbot-%DATE%.log`
- **Rotation**: Daily
- **Max Size**: 10MB per file
- **Retention**: 14 days

### Error Logs
- **File Pattern**: `logs/error-%DATE%.log`
- **Rotation**: Daily
- **Max Size**: 10MB per file
- **Retention**: 30 days

### Moderation Logs
- **File Pattern**: `logs/moderation-%DATE%.log`
- **Rotation**: Daily
- **Max Size**: 10MB per file
- **Retention**: 90 days (for compliance and audit purposes)

## Log Format

### JSON Format (File Logs)
```json
{
  "timestamp": "2024-01-15 10:30:45.123",
  "level": "info",
  "message": "Moderation action executed",
  "eventType": "moderation_action",
  "service": "tzbot",
  "action": "User banned for spam",
  "moderatorId": "123456789",
  "targetUserId": "987654321",
  "reason": "Repeated spam violations",
  "actionType": "ban"
}
```

### Console Format (Development)
```
2024-01-15 10:30:45 [info] [moderation_action]: Moderation action executed {"action":"User banned for spam","moderatorId":"123456789","targetUserId":"987654321"}
```

## Configuration

The logger uses the following configuration from `config/index.ts`:

```typescript
{
  logLevel: 'info',  // Minimum log level (error, warn, info, debug)
  logFile: 'logs/tzbot.log'  // Legacy log file (still supported)
}
```

## Best Practices

1. **Always Include Context**: Provide relevant context for all log entries
2. **Use Appropriate Event Types**: Select the correct event type for filtering
3. **Log User Actions**: Include user IDs for audit trails
4. **Capture Errors Completely**: Always log full error objects with stack traces
5. **Avoid Sensitive Data**: Never log passwords, tokens, or personal information
6. **Use Child Loggers**: Create component-specific loggers for better organization
7. **Log State Transitions**: Track all system state changes for debugging

## Performance Considerations

- **Async Logging**: All logging operations are asynchronous
- **Buffered Writes**: Logs are buffered before writing to disk
- **Rotation Overhead**: Log rotation happens automatically with minimal impact
- **Debug Level**: Use debug level sparingly in production

## Graceful Shutdown

To ensure all logs are flushed before shutdown:

```typescript
import { flushLogs } from '@/core/logger/logger.js';

process.on('SIGTERM', async () => {
  await flushLogs();
  process.exit(0);
});
```

## Testing

The logging system includes comprehensive unit tests covering:
- Error logging with stack traces
- Moderation action logging
- Message deletion logging
- Malicious link detection logging
- System transition logging
- Violation logging
- Security event logging
- Performance warning logging
- Database operation logging
- Edge cases and error handling

Run tests with:
```bash
npm test -- tests/unit/core/logger/logger.test.ts
```

## Troubleshooting

### Logs Not Appearing
- Check log level configuration
- Verify log directory permissions
- Ensure disk space is available

### Log Rotation Not Working
- Check file system permissions
- Verify date pattern configuration
- Ensure winston-daily-rotate-file is installed

### Performance Issues
- Reduce log level in production
- Increase rotation size limits
- Consider external log aggregation

## Integration with Other Components

The logger is used throughout the system:

- **Moderation Manager**: Logs all moderation actions and violations
- **Link Scanner**: Logs malicious link detections
- **Notification Manager**: Logs system transitions
- **Event Manager**: Logs all system events
- **Database**: Logs database operations (debug level)
- **API Endpoints**: Logs HTTP requests via Morgan

## Future Enhancements

- External log aggregation (e.g., ELK stack, Datadog)
- Log compression for archived logs
- Real-time log streaming
- Advanced filtering and search capabilities
- Metrics extraction from logs
