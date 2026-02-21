/**
 * @file logger.example.ts
 * @description Example usage of the comprehensive logging system
 */

import {
  logError,
  logModeration,
  logMessageDeletion,
  logMaliciousLink,
  logSystemTransition,
  logViolation,
  logSecurityEvent,
  logPerformanceWarning,
  logDatabaseOperation,
  createChildLogger,
  type ModerationLogContext,
  type MessageDeletionContext,
  type MaliciousLinkContext,
  type SystemTransitionContext,
  type ErrorLogContext,
} from './logger.js';

/**
 * Example 1: Error Logging (Requirement 14.5)
 * Log errors with full stack traces and context
 */
function exampleErrorLogging() {
  try {
    // Simulate an error
    throw new Error('Database connection failed');
  } catch (error) {
    const context: ErrorLogContext = {
      errorName: 'DatabaseConnectionError',
      errorMessage: 'Failed to connect to PostgreSQL',
      component: 'Database',
      operation: 'connect',
      additionalContext: {
        host: 'localhost',
        port: 5432,
        database: 'tzbot',
      },
    };

    logError('Database connection error', error as Error, context);
  }
}

/**
 * Example 2: Moderation Action Logging (Requirement 5.6)
 * Log moderation actions with full context
 */
function exampleModerationLogging() {
  // Example: Ban action
  const banContext: ModerationLogContext = {
    action: 'User permanently banned',
    moderatorId: '123456789012345678',
    targetUserId: '987654321098765432',
    reason: 'Repeated spam violations (4th offense)',
    actionType: 'ban',
    channelId: '111222333444555666',
  };
  logModeration(banContext);

  // Example: Timeout action
  const timeoutContext: ModerationLogContext = {
    action: 'User timed out',
    moderatorId: '123456789012345678',
    targetUserId: '987654321098765432',
    reason: 'Spam detected',
    actionType: 'timeout',
    duration: 3600, // 1 hour in seconds
  };
  logModeration(timeoutContext);

  // Example: Warning
  const warnContext: ModerationLogContext = {
    action: 'Warning issued',
    moderatorId: '123456789012345678',
    targetUserId: '987654321098765432',
    reason: 'First spam violation',
    actionType: 'warn',
  };
  logModeration(warnContext);

  // Example: Role management
  const roleContext: ModerationLogContext = {
    action: 'Subscriber role added',
    moderatorId: 'system',
    targetUserId: '987654321098765432',
    actionType: 'role_add',
    reason: 'User subscribed on Kick',
  };
  logModeration(roleContext);
}

/**
 * Example 3: Message Deletion Logging (Requirement 3.5)
 * Log deleted messages with user ID, content, and timestamp
 */
function exampleMessageDeletionLogging() {
  // Example: Manual deletion by moderator
  const manualDeletion: MessageDeletionContext = {
    messageId: '777888999000111222',
    userId: '987654321098765432',
    channelId: '111222333444555666',
    content: 'This is inappropriate content',
    reason: 'Violated community guidelines',
    deletedBy: '123456789012345678',
  };
  logMessageDeletion(manualDeletion);

  // Example: Automatic deletion (read-only channel)
  const autoDeletion: MessageDeletionContext = {
    messageId: '777888999000111223',
    userId: '987654321098765432',
    channelId: '111222333444555666',
    content: 'User tried to post in read-only channel',
    reason: 'Unauthorized post in read-only channel',
  };
  logMessageDeletion(autoDeletion);

  // Example: Spam detection deletion
  const spamDeletion: MessageDeletionContext = {
    messageId: '777888999000111224',
    userId: '987654321098765432',
    channelId: '111222333444555666',
    content: 'SPAM SPAM SPAM SPAM SPAM',
    reason: 'Automatic spam detection (5 identical messages)',
    deletedBy: 'AutoMod',
  };
  logMessageDeletion(spamDeletion);
}

/**
 * Example 4: Malicious Link Detection Logging (Requirement 7.6)
 * Log malicious links with user ID, message content, and detected link
 */
function exampleMaliciousLinkLogging() {
  // Example: Phishing link
  const phishingLink: MaliciousLinkContext = {
    userId: '987654321098765432',
    messageId: '777888999000111225',
    channelId: '111222333444555666',
    messageContent: 'Check out this amazing deal: http://phishing-site.com/login',
    detectedLink: 'http://phishing-site.com/login',
    linkType: 'phishing',
    action: 'Message deleted, user timed out for 24 hours',
  };
  logMaliciousLink(phishingLink);

  // Example: Zero-width character obfuscation
  const zeroWidthLink: MaliciousLinkContext = {
    userId: '987654321098765432',
    messageId: '777888999000111226',
    channelId: '111222333444555666',
    messageContent: 'Visit: http://mal​icious.com (contains zero-width chars)',
    detectedLink: 'http://malicious.com',
    linkType: 'zero_width',
    action: 'Message deleted, user timed out for 24 hours',
  };
  logMaliciousLink(zeroWidthLink);

  // Example: Blocklist match
  const blocklistLink: MaliciousLinkContext = {
    userId: '987654321098765432',
    messageId: '777888999000111227',
    channelId: '111222333444555666',
    messageContent: 'Check this out: http://known-malware-site.com',
    detectedLink: 'http://known-malware-site.com',
    linkType: 'blocklist',
    action: 'Message deleted, user timed out for 24 hours',
  };
  logMaliciousLink(blocklistLink);

  // Example: Malware link
  const malwareLink: MaliciousLinkContext = {
    userId: '987654321098765432',
    messageId: '777888999000111228',
    channelId: '111222333444555666',
    messageContent: 'Download this: http://malware-download.com/virus.exe',
    detectedLink: 'http://malware-download.com/virus.exe',
    linkType: 'malware',
    action: 'Message deleted, user banned',
  };
  logMaliciousLink(malwareLink);
}

/**
 * Example 5: System Transition Logging (Requirement 8.6)
 * Log system state transitions with timestamp and reason
 */
function exampleSystemTransitionLogging() {
  // Example: Webhook to polling failover
  const webhookFailover: SystemTransitionContext = {
    from: 'webhook',
    to: 'polling',
    reason: 'Webhook failures exceeded threshold (3 consecutive failures)',
    component: 'NotificationManager',
    automatic: true,
  };
  logSystemTransition(webhookFailover);

  // Example: Polling to webhook recovery
  const webhookRecovery: SystemTransitionContext = {
    from: 'polling',
    to: 'webhook',
    reason: 'Webhook connection restored',
    component: 'NotificationManager',
    automatic: true,
  };
  logSystemTransition(webhookRecovery);

  // Example: Manual system transition
  const manualTransition: SystemTransitionContext = {
    from: 'webhook',
    to: 'polling',
    reason: 'Manual switch by administrator for testing',
    component: 'NotificationManager',
    automatic: false,
  };
  logSystemTransition(manualTransition);

  // Example: Database connection state
  const dbTransition: SystemTransitionContext = {
    from: 'disconnected',
    to: 'connected',
    reason: 'Database connection established',
    component: 'Database',
    automatic: true,
  };
  logSystemTransition(dbTransition);
}

/**
 * Example 6: Violation Logging
 * Log user violations with context
 */
function exampleViolationLogging() {
  // Example: Spam violation
  logViolation(
    '987654321098765432',
    'spam',
    'Sent 10 messages in 5 seconds',
    {
      messageCount: 10,
      timeWindow: 5,
      channelId: '111222333444555666',
      violationNumber: 2,
    }
  );

  // Example: Unauthorized post
  logViolation(
    '987654321098765432',
    'unauthorized_post',
    'Posted in read-only channel',
    {
      channelId: '111222333444555666',
      channelName: 'announcements',
    }
  );

  // Example: Malicious link violation
  logViolation(
    '987654321098765432',
    'malicious_link',
    'Posted phishing link',
    {
      linkUrl: 'http://phishing-site.com',
      linkType: 'phishing',
    }
  );
}

/**
 * Example 7: Security Event Logging
 * Log security-related events
 */
function exampleSecurityEventLogging() {
  // Example: Rate limit exceeded
  logSecurityEvent('Rate limit exceeded', {
    userId: '987654321098765432',
    endpoint: '/api/commands',
    requestCount: 100,
    timeWindow: 60,
    action: 'Requests blocked',
  });

  // Example: Invalid authentication attempt
  logSecurityEvent('Invalid authentication attempt', {
    userId: '987654321098765432',
    ipAddress: '192.168.1.100',
    attemptCount: 3,
  });

  // Example: Permission violation
  logSecurityEvent('Permission violation detected', {
    userId: '987654321098765432',
    requiredPermission: 'ADMINISTRATOR',
    attemptedAction: 'ban_user',
  });
}

/**
 * Example 8: Performance Warning Logging
 * Log performance-related warnings
 */
function examplePerformanceWarningLogging() {
  // Example: High memory usage
  logPerformanceWarning('High memory usage detected', {
    memoryUsage: 450,
    threshold: 512,
    unit: 'MB',
    component: 'EventManager',
    action: 'Rate limiting enabled',
  });

  // Example: High CPU usage
  logPerformanceWarning('High CPU usage detected', {
    cpuUsage: 85,
    threshold: 80,
    unit: '%',
    component: 'MessageProcessor',
  });

  // Example: Slow operation
  logPerformanceWarning('Slow database query detected', {
    operation: 'SELECT',
    duration: 5000,
    threshold: 1000,
    unit: 'ms',
    query: 'SELECT * FROM violations WHERE user_id = ?',
  });
}

/**
 * Example 9: Database Operation Logging
 * Log database operations (debug level)
 */
function exampleDatabaseOperationLogging() {
  // Example: INSERT operation
  logDatabaseOperation('INSERT', {
    table: 'violations',
    duration: 15,
    rowsAffected: 1,
    userId: '987654321098765432',
  });

  // Example: UPDATE operation
  logDatabaseOperation('UPDATE', {
    table: 'users',
    duration: 8,
    rowsAffected: 1,
    userId: '987654321098765432',
    fields: ['kick_username', 'updated_at'],
  });

  // Example: SELECT operation
  logDatabaseOperation('SELECT', {
    table: 'giveaways',
    duration: 12,
    rowsReturned: 5,
    filters: { status: 'active' },
  });

  // Example: DELETE operation
  logDatabaseOperation('DELETE', {
    table: 'message_content',
    duration: 20,
    rowsAffected: 150,
    reason: '7-day retention cleanup',
  });
}

/**
 * Example 10: Child Logger
 * Create component-specific loggers
 */
function exampleChildLogger() {
  // Create a child logger for a specific component
  const giveawayLogger = createChildLogger({
    component: 'GiveawayManager',
    feature: 'giveaways',
  });

  // All logs from this logger will include the component metadata
  giveawayLogger.info('Giveaway created', {
    giveawayId: 'giveaway-123',
    title: 'Discord Nitro Giveaway',
    winnerCount: 3,
  });

  giveawayLogger.info('Giveaway ended', {
    giveawayId: 'giveaway-123',
    entryCount: 150,
    winners: ['user1', 'user2', 'user3'],
  });

  // Create another child logger
  const chatRainLogger = createChildLogger({
    component: 'ChatRainManager',
    feature: 'chat-rain',
  });

  chatRainLogger.info('Chat rain triggered', {
    recipientCount: 5,
    rewardType: 'role',
    rewardValue: 'Winner',
  });
}

/**
 * Example 11: Complex Scenario - Moderation Flow
 * Demonstrate logging throughout a complete moderation flow
 */
function exampleComplexModerationFlow() {
  const userId = '987654321098765432';
  const messageId = '777888999000111229';
  const channelId = '111222333444555666';

  // 1. Malicious link detected
  logMaliciousLink({
    userId,
    messageId,
    channelId,
    messageContent: 'Check this out: http://phishing-site.com',
    detectedLink: 'http://phishing-site.com',
    linkType: 'phishing',
    action: 'Message deleted, violation recorded',
  });

  // 2. Message deleted
  logMessageDeletion({
    messageId,
    userId,
    channelId,
    content: 'Check this out: http://phishing-site.com',
    reason: 'Malicious link detected',
    deletedBy: 'AutoMod',
  });

  // 3. Violation recorded
  logViolation(userId, 'malicious_link', 'Posted phishing link', {
    linkUrl: 'http://phishing-site.com',
    linkType: 'phishing',
    violationNumber: 1,
  });

  // 4. Moderation action applied
  logModeration({
    action: 'User timed out for 24 hours',
    moderatorId: 'system',
    targetUserId: userId,
    reason: 'Malicious link detected (automatic)',
    actionType: 'timeout',
    duration: 86400,
  });

  // 5. Security event logged
  logSecurityEvent('Automatic moderation action applied', {
    userId,
    violationType: 'malicious_link',
    action: 'timeout',
    duration: 86400,
  });
}

/**
 * Example 12: Error Handling with Context
 * Demonstrate comprehensive error logging
 */
async function exampleErrorHandlingWithContext() {
  try {
    // Simulate a complex operation that fails
    await performDatabaseOperation();
  } catch (error) {
    logError('Failed to perform database operation', error as Error, {
      errorName: 'DatabaseOperationError',
      errorMessage: 'Transaction failed',
      component: 'Database',
      operation: 'transaction',
      additionalContext: {
        transactionId: 'tx-12345',
        tables: ['users', 'violations'],
        rollbackPerformed: true,
      },
    });
  }
}

async function performDatabaseOperation() {
  throw new Error('Simulated database error');
}

/**
 * Run all examples
 */
export function runLoggingExamples() {
  console.log('=== Running Logging Examples ===\n');

  console.log('1. Error Logging');
  exampleErrorLogging();

  console.log('\n2. Moderation Logging');
  exampleModerationLogging();

  console.log('\n3. Message Deletion Logging');
  exampleMessageDeletionLogging();

  console.log('\n4. Malicious Link Logging');
  exampleMaliciousLinkLogging();

  console.log('\n5. System Transition Logging');
  exampleSystemTransitionLogging();

  console.log('\n6. Violation Logging');
  exampleViolationLogging();

  console.log('\n7. Security Event Logging');
  exampleSecurityEventLogging();

  console.log('\n8. Performance Warning Logging');
  examplePerformanceWarningLogging();

  console.log('\n9. Database Operation Logging');
  exampleDatabaseOperationLogging();

  console.log('\n10. Child Logger');
  exampleChildLogger();

  console.log('\n11. Complex Moderation Flow');
  exampleComplexModerationFlow();

  console.log('\n12. Error Handling with Context');
  exampleErrorHandlingWithContext();

  console.log('\n=== Examples Complete ===');
}

// Uncomment to run examples
// runLoggingExamples();
