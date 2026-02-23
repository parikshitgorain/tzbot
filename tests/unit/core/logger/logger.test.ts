import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  logStream,
  LogEventType,
} from '../../../../src/core/logger/logger.js';

describe('logger helpers', () => {
  // Spy on the underlying logger methods to avoid actually writing files
  beforeEach(() => {
    vi.spyOn(logger, 'error').mockImplementation(() => logger);
    vi.spyOn(logger, 'warn').mockImplementation(() => logger);
    vi.spyOn(logger, 'info').mockImplementation(() => logger);
    vi.spyOn(logger, 'debug').mockImplementation(() => logger);
  });

  describe('LogEventType', () => {
    it('exports expected event type strings', () => {
      expect(LogEventType.MODERATION_ACTION).toBe('moderation_action');
      expect(LogEventType.ERROR).toBe('error');
      expect(LogEventType.MESSAGE_DELETED).toBe('message_deleted');
      expect(LogEventType.MALICIOUS_LINK).toBe('malicious_link');
    });
  });

  describe('logError()', () => {
    it('calls logger.error with event type and error details', () => {
      const err = new Error('test error');
      logError('Something failed', err);
      expect(logger.error).toHaveBeenCalledWith(
        'Something failed',
        expect.objectContaining({
          eventType: LogEventType.ERROR,
          error: expect.objectContaining({ message: 'test error' }),
        }),
      );
    });

    it('includes optional context when provided', () => {
      logError('Failure', new Error('x'), { userId: 'u1' });
      expect(logger.error).toHaveBeenCalledWith(
        'Failure',
        expect.objectContaining({ userId: 'u1' }),
      );
    });
  });

  describe('logModeration()', () => {
    it('calls logger.info with MODERATION_ACTION event type', () => {
      logModeration({ action: 'BAN', moderatorId: 'mod1', targetUserId: 'u1', reason: 'spam', guildId: 'g1' } as any);
      expect(logger.info).toHaveBeenCalledWith(
        'Moderation action executed',
        expect.objectContaining({ eventType: LogEventType.MODERATION_ACTION }),
      );
    });
  });

  describe('logMessageDeletion()', () => {
    it('calls logger.info with MESSAGE_DELETED event type', () => {
      logMessageDeletion({ userId: 'u1', messageId: 'm1', content: 'bad', channelId: 'c1', guildId: 'g1' } as any);
      expect(logger.info).toHaveBeenCalledWith(
        'Message deleted',
        expect.objectContaining({ eventType: LogEventType.MESSAGE_DELETED }),
      );
    });
  });

  describe('logMaliciousLink()', () => {
    it('calls logger.warn with MALICIOUS_LINK event type', () => {
      logMaliciousLink({ userId: 'u1', messageContent: 'click me', detectedUrl: 'http://bad.com', guildId: 'g1' } as any);
      expect(logger.warn).toHaveBeenCalledWith(
        'Malicious link detected',
        expect.objectContaining({ eventType: LogEventType.MALICIOUS_LINK }),
      );
    });
  });

  describe('logSystemTransition()', () => {
    it('calls logger.info with SYSTEM_TRANSITION event type', () => {
      logSystemTransition({ from: 'idle', to: 'active', reason: 'startup', timestamp: new Date() } as any);
      expect(logger.info).toHaveBeenCalledWith(
        'System state transition',
        expect.objectContaining({ eventType: LogEventType.SYSTEM_TRANSITION }),
      );
    });
  });

  describe('logViolation()', () => {
    it('calls logger.warn with VIOLATION_DETECTED event type', () => {
      logViolation('u1', 'spam', 'Too many messages');
      expect(logger.warn).toHaveBeenCalledWith(
        'Violation detected',
        expect.objectContaining({
          eventType: LogEventType.VIOLATION_DETECTED,
          userId: 'u1',
          violationType: 'spam',
        }),
      );
    });

    it('includes optional context', () => {
      logViolation('u1', 'spam', 'details', { extra: 'data' });
      expect(logger.warn).toHaveBeenCalledWith(
        'Violation detected',
        expect.objectContaining({ extra: 'data' }),
      );
    });
  });

  describe('logSecurityEvent()', () => {
    it('calls logger.warn with SECURITY_EVENT event type', () => {
      logSecurityEvent('Suspicious activity', { userId: 'u1' });
      expect(logger.warn).toHaveBeenCalledWith(
        'Suspicious activity',
        expect.objectContaining({ eventType: LogEventType.SECURITY_EVENT }),
      );
    });
  });

  describe('logPerformanceWarning()', () => {
    it('calls logger.warn with PERFORMANCE_WARNING event type', () => {
      logPerformanceWarning('Slow query', { queryMs: 5000 });
      expect(logger.warn).toHaveBeenCalledWith(
        'Slow query',
        expect.objectContaining({ eventType: LogEventType.PERFORMANCE_WARNING }),
      );
    });
  });

  describe('logDatabaseOperation()', () => {
    it('calls logger.debug with DATABASE_OPERATION event type', () => {
      logDatabaseOperation('SELECT', { table: 'users' });
      expect(logger.debug).toHaveBeenCalledWith(
        'Database operation',
        expect.objectContaining({
          eventType: LogEventType.DATABASE_OPERATION,
          operation: 'SELECT',
        }),
      );
    });
  });

  describe('createChildLogger()', () => {
    it('returns a child logger object', () => {
      const child = createChildLogger({ service: 'test' });
      expect(child).toBeDefined();
      expect(typeof child.info).toBe('function');
    });
  });

  describe('logStream', () => {
    it('write() calls logger.info with trimmed message', () => {
      logStream.write('  access log  \n');
      expect(logger.info).toHaveBeenCalledWith(
        'access log',
        expect.objectContaining({ eventType: LogEventType.API_REQUEST }),
      );
    });
  });
});
