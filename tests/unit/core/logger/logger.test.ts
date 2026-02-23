/**
 * @file logger.test.ts
 * @description Unit tests for comprehensive logging system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import winston from 'winston';
import {
  logger,
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
  LogEventType,
  type ModerationLogContext,
  type MessageDeletionContext,
  type MaliciousLinkContext,
  type SystemTransitionContext,
  type ErrorLogContext,
} from '@/core/logger/logger.js';

describe('Logger - Comprehensive Logging', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on logger methods
    logSpy = vi.spyOn(logger, 'info');
    vi.spyOn(logger, 'error');
    vi.spyOn(logger, 'warn');
    vi.spyOn(logger, 'debug');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Error Logging (Requirement 14.5)', () => {
    it('should log errors with stack traces and context', () => {
      const error = new Error('Test error');
      const context: ErrorLogContext = {
        errorName: 'TestError',
        errorMessage: 'Test error message',
        component: 'TestComponent',
        operation: 'testOperation',
        userId: 'user123',
      };

      logError('An error occurred', error, context);

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        expect.objectContaining({
          eventType: LogEventType.ERROR,
          error: expect.objectContaining({
            message: error.message,
            stack: expect.any(String),
            name: error.name,
          }),
          errorName: 'TestError',
          component: 'TestComponent',
        })
      );
    });

    it('should include stack trace in error logs', () => {
      const error = new Error('Stack trace test');
      logError('Error with stack', error);

      expect(logger.error).toHaveBeenCalledWith(
        'Error with stack',
        expect.objectContaining({
          error: expect.objectContaining({
            stack: expect.stringContaining('Error: Stack trace test'),
          }),
        })
      );
    });

    it('should log errors without additional context', () => {
      const error = new Error('Simple error');
      logError('Simple error log', error);

      expect(logger.error).toHaveBeenCalledWith(
        'Simple error log',
        expect.objectContaining({
          eventType: LogEventType.ERROR,
          error: expect.objectContaining({
            message: 'Simple error',
            name: 'Error',
          }),
        })
      );
    });
  });

  describe('Moderation Action Logging (Requirement 5.6)', () => {
    it('should log moderation actions with full context', () => {
      const context: ModerationLogContext = {
        action: 'User banned for spam',
        moderatorId: 'mod123',
        targetUserId: 'user456',
        reason: 'Repeated spam violations',
        actionType: 'ban',
        channelId: 'channel789',
      };

      logModeration(context);

      expect(logger.info).toHaveBeenCalledWith(
        'Moderation action executed',
        expect.objectContaining({
          eventType: LogEventType.MODERATION_ACTION,
          action: 'User banned for spam',
          moderatorId: 'mod123',
          targetUserId: 'user456',
          reason: 'Repeated spam violations',
          actionType: 'ban',
          channelId: 'channel789',
        })
      );
    });

    it('should log timeout actions with duration', () => {
      const context: ModerationLogContext = {
        action: 'User timed out',
        moderatorId: 'mod123',
        targetUserId: 'user456',
        reason: 'Spam',
        actionType: 'timeout',
        duration: 3600,
      };

      logModeration(context);

      expect(logger.info).toHaveBeenCalledWith(
        'Moderation action executed',
        expect.objectContaining({
          actionType: 'timeout',
          duration: 3600,
        })
      );
    });

    it('should log moderation actions without optional fields', () => {
      const context: ModerationLogContext = {
        action: 'Warning issued',
        moderatorId: 'mod123',
        targetUserId: 'user456',
        actionType: 'warn',
      };

      logModeration(context);

      expect(logger.info).toHaveBeenCalledWith(
        'Moderation action executed',
        expect.objectContaining({
          eventType: LogEventType.MODERATION_ACTION,
          actionType: 'warn',
        })
      );
    });
  });

  describe('Message Deletion Logging (Requirement 3.5)', () => {
    it('should log deleted messages with user ID, content, and timestamp', () => {
      const context: MessageDeletionContext = {
        messageId: 'msg123',
        userId: 'user456',
        channelId: 'channel789',
        content: 'Inappropriate message content',
        reason: 'Violated channel rules',
        deletedBy: 'mod123',
      };

      logMessageDeletion(context);

      expect(logger.info).toHaveBeenCalledWith(
        'Message deleted',
        expect.objectContaining({
          eventType: LogEventType.MESSAGE_DELETED,
          messageId: 'msg123',
          userId: 'user456',
          channelId: 'channel789',
          content: 'Inappropriate message content',
          reason: 'Violated channel rules',
          deletedBy: 'mod123',
        })
      );
    });

    it('should log automatic message deletions', () => {
      const context: MessageDeletionContext = {
        messageId: 'msg789',
        userId: 'user123',
        channelId: 'channel456',
        content: 'Spam message',
        reason: 'Automatic spam detection',
      };

      logMessageDeletion(context);

      expect(logger.info).toHaveBeenCalledWith(
        'Message deleted',
        expect.objectContaining({
          eventType: LogEventType.MESSAGE_DELETED,
          reason: 'Automatic spam detection',
        })
      );
    });
  });

  describe('Malicious Link Detection Logging (Requirement 7.6)', () => {
    it('should log malicious links with user ID, message content, and detected link', () => {
      const context: MaliciousLinkContext = {
        userId: 'user123',
        messageId: 'msg456',
        channelId: 'channel789',
        messageContent: 'Check out this link: http://phishing-site.com',
        detectedLink: 'http://phishing-site.com',
        linkType: 'phishing',
        action: 'Message deleted and user timed out',
      };

      logMaliciousLink(context);

      expect(logger.warn).toHaveBeenCalledWith(
        'Malicious link detected',
        expect.objectContaining({
          eventType: LogEventType.MALICIOUS_LINK,
          userId: 'user123',
          messageId: 'msg456',
          messageContent: 'Check out this link: http://phishing-site.com',
          detectedLink: 'http://phishing-site.com',
          linkType: 'phishing',
          action: 'Message deleted and user timed out',
        })
      );
    });

    it('should log zero-width character links', () => {
      const context: MaliciousLinkContext = {
        userId: 'user789',
        messageId: 'msg123',
        channelId: 'channel456',
        messageContent: 'Obfuscated link with zero-width chars',
        detectedLink: 'http://malicious.com',
        linkType: 'zero_width',
        action: 'Message deleted',
      };

      logMaliciousLink(context);

      expect(logger.warn).toHaveBeenCalledWith(
        'Malicious link detected',
        expect.objectContaining({
          linkType: 'zero_width',
        })
      );
    });

    it('should log blocklist matches', () => {
      const context: MaliciousLinkContext = {
        userId: 'user456',
        messageId: 'msg789',
        channelId: 'channel123',
        messageContent: 'Link from blocklist',
        detectedLink: 'http://blocked-domain.com',
        linkType: 'blocklist',
        action: 'Message deleted',
      };

      logMaliciousLink(context);

      expect(logger.warn).toHaveBeenCalledWith(
        'Malicious link detected',
        expect.objectContaining({
          linkType: 'blocklist',
        })
      );
    });
  });

  describe('System Transition Logging (Requirement 8.6)', () => {
    it('should log system state transitions with timestamp and reason', () => {
      const context: SystemTransitionContext = {
        from: 'webhook',
        to: 'polling',
        reason: 'Webhook failures exceeded threshold',
        component: 'NotificationManager',
        automatic: true,
      };

      logSystemTransition(context);

      expect(logger.info).toHaveBeenCalledWith(
        'System state transition',
        expect.objectContaining({
          eventType: LogEventType.SYSTEM_TRANSITION,
          from: 'webhook',
          to: 'polling',
          reason: 'Webhook failures exceeded threshold',
          component: 'NotificationManager',
          automatic: true,
        })
      );
    });

    it('should log manual system transitions', () => {
      const context: SystemTransitionContext = {
        from: 'polling',
        to: 'webhook',
        reason: 'Manual switch by administrator',
        component: 'NotificationManager',
        automatic: false,
      };

      logSystemTransition(context);

      expect(logger.info).toHaveBeenCalledWith(
        'System state transition',
        expect.objectContaining({
          automatic: false,
        })
      );
    });
  });

  describe('Violation Logging', () => {
    it('should log violations with user ID and details', () => {
      logViolation('user123', 'spam', 'Sent 10 messages in 5 seconds', {
        messageCount: 10,
        timeWindow: 5,
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Violation detected',
        expect.objectContaining({
          eventType: LogEventType.VIOLATION_DETECTED,
          userId: 'user123',
          violationType: 'spam',
          details: 'Sent 10 messages in 5 seconds',
          messageCount: 10,
          timeWindow: 5,
        })
      );
    });

    it('should log violations without additional context', () => {
      logViolation('user456', 'unauthorized_post', 'Posted in read-only channel');

      expect(logger.warn).toHaveBeenCalledWith(
        'Violation detected',
        expect.objectContaining({
          userId: 'user456',
          violationType: 'unauthorized_post',
        })
      );
    });
  });

  describe('Security Event Logging', () => {
    it('should log security events', () => {
      logSecurityEvent('Rate limit exceeded', {
        userId: 'user123',
        endpoint: '/api/commands',
        requestCount: 100,
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Rate limit exceeded',
        expect.objectContaining({
          eventType: LogEventType.SECURITY_EVENT,
          userId: 'user123',
          endpoint: '/api/commands',
          requestCount: 100,
        })
      );
    });
  });

  describe('Performance Warning Logging', () => {
    it('should log performance warnings', () => {
      logPerformanceWarning('High memory usage detected', {
        memoryUsage: 450,
        threshold: 512,
        unit: 'MB',
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'High memory usage detected',
        expect.objectContaining({
          eventType: LogEventType.PERFORMANCE_WARNING,
          memoryUsage: 450,
          threshold: 512,
        })
      );
    });
  });

  describe('Database Operation Logging', () => {
    it('should log database operations', () => {
      logDatabaseOperation('INSERT', {
        table: 'users',
        duration: 15,
        rowsAffected: 1,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        'Database operation',
        expect.objectContaining({
          eventType: LogEventType.DATABASE_OPERATION,
          operation: 'INSERT',
          table: 'users',
          duration: 15,
        })
      );
    });
  });

  describe('Child Logger', () => {
    it('should create child logger with additional metadata', () => {
      const childLogger = createChildLogger({ component: 'TestComponent' });
      expect(childLogger).toBeDefined();
    });
  });

  describe('Log Event Types', () => {
    it('should have all required event types', () => {
      expect(LogEventType.MODERATION_ACTION).toBe('moderation_action');
      expect(LogEventType.VIOLATION_DETECTED).toBe('violation_detected');
      expect(LogEventType.MESSAGE_DELETED).toBe('message_deleted');
      expect(LogEventType.MALICIOUS_LINK).toBe('malicious_link');
      expect(LogEventType.SYSTEM_TRANSITION).toBe('system_transition');
      expect(LogEventType.ERROR).toBe('error');
      expect(LogEventType.SECURITY_EVENT).toBe('security_event');
      expect(LogEventType.PERFORMANCE_WARNING).toBe('performance_warning');
      expect(LogEventType.API_REQUEST).toBe('api_request');
      expect(LogEventType.DATABASE_OPERATION).toBe('database_operation');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty context objects', () => {
      logViolation('user123', 'test', 'test details', {});
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle undefined optional fields', () => {
      const context: ModerationLogContext = {
        action: 'test',
        moderatorId: 'mod123',
        targetUserId: 'user456',
        actionType: 'warn',
      };
      logModeration(context);
      expect(logger.info).toHaveBeenCalled();
    });

    it('should handle errors without stack traces', () => {
      const error = new Error('No stack');
      error.stack = undefined;
      logError('Error without stack', error);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
