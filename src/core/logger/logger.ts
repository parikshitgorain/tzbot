/**
 * @file logger.ts
 * @description Comprehensive structured logging system using Winston
 * @module core/logger
 *
 * Validates Requirements:
 * - 3.5: Log all deleted messages with user ID, message content, and timestamp
 * - 5.6: Log moderation actions with moderator ID, target user ID, action type, reason, and timestamp
 * - 7.6: Log malicious link detection with user ID, message content, and detected link
 * - 8.6: Log all monitoring system transitions with timestamp and reason
 * - 14.5: Log all errors with stack traces, timestamps, and context information
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '@/config/index.js';
import path from 'path';

/**
 * Log event types for structured logging
 */
export enum LogEventType {
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

/**
 * Structured log entry interface
 */
export interface LogEntry {
  eventType: LogEventType;
  timestamp: Date;
  message: string;
  context: Record<string, unknown>;
  userId?: string;
  error?: {
    message: string;
    stack?: string;
    name: string;
  };
}

/**
 * Moderation action log context
 */
export interface ModerationLogContext {
  action: string;
  moderatorId: string;
  targetUserId: string;
  reason?: string;
  actionType: 'ban' | 'kick' | 'timeout' | 'warn' | 'role_add' | 'role_remove';
  duration?: number;
  channelId?: string;
}

/**
 * Message deletion log context (Requirement 3.5)
 */
export interface MessageDeletionContext {
  messageId: string;
  userId: string;
  channelId: string;
  content: string;
  reason: string;
  deletedBy?: string;
}

/**
 * Malicious link detection log context (Requirement 7.6)
 */
export interface MaliciousLinkContext {
  userId: string;
  messageId: string;
  channelId: string;
  messageContent: string;
  detectedLink: string;
  linkType: 'phishing' | 'malware' | 'zero_width' | 'blocklist';
  action: string;
}

/**
 * System transition log context (Requirement 8.6)
 */
export interface SystemTransitionContext {
  from: string;
  to: string;
  reason: string;
  component: string;
  automatic: boolean;
}

/**
 * Error log context (Requirement 14.5)
 */
export interface ErrorLogContext {
  errorName?: string;
  errorMessage?: string;
  stackTrace?: string;
  component?: string;
  operation?: string;
  userId?: string;
  additionalContext?: Record<string, unknown>;
  [key: string]: unknown; // Allow any additional properties
}

// Define log format with enhanced structure
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, eventType, ...meta }) => {
    let msg = `${timestamp} [${level}]`;
    if (eventType) {
      msg += ` [${eventType}]`;
    }
    msg += `: ${message}`;

    const metaKeys = Object.keys(meta).filter(k => k !== 'service' && k !== 'timestamp');
    if (metaKeys.length > 0) {
      const filteredMeta: Record<string, unknown> = {};
      metaKeys.forEach(k => filteredMeta[k] = meta[k]);
      msg += ` ${JSON.stringify(filteredMeta)}`;
    }
    return msg;
  }),
);

// Create rotating file transport for general logs
const rotatingFileTransport = new DailyRotateFile({
  filename: path.resolve(process.cwd(), 'logs/tzbot-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '10m',
  maxFiles: '14d',
  format: logFormat,
});

// Create rotating file transport for error logs
const errorRotatingTransport = new DailyRotateFile({
  filename: path.resolve(process.cwd(), 'logs/error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '10m',
  maxFiles: '30d',
  format: logFormat,
});

// Create rotating file transport for moderation logs
const moderationRotatingTransport = new DailyRotateFile({
  filename: path.resolve(process.cwd(), 'logs/moderation-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '10m',
  maxFiles: '30d', // Keep logs for maximum 30 days
  format: logFormat,
  level: 'info',
});

// Create logger instance with log rotation
export const logger = winston.createLogger({
  level: config.logLevel,
  format: logFormat,
  defaultMeta: { service: 'tzbot' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // Rotating file transports
    rotatingFileTransport,
    errorRotatingTransport,
    moderationRotatingTransport,
  ],
});

// Add stream for Morgan (HTTP logging)
export const logStream = {
  write: (message: string) => {
    logger.info(message.trim(), { eventType: LogEventType.API_REQUEST });
  },
};

/**
 * Log an error with full stack trace and context (Requirement 14.5)
 * @param message - Error message
 * @param error - Error object
 * @param context - Additional context
 */
export const logError = (
  message: string,
  error: Error,
  context?: ErrorLogContext,
): void => {
  logger.error(message, {
    eventType: LogEventType.ERROR,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    ...context,
  });
};

/**
 * Log a moderation action with full context (Requirement 5.6)
 * @param context - Moderation action context
 */
export const logModeration = (context: ModerationLogContext): void => {
  logger.info('Moderation action executed', {
    eventType: LogEventType.MODERATION_ACTION,
    ...context,
  });
};

/**
 * Log a deleted message with full context (Requirement 3.5)
 * @param context - Message deletion context
 */
export const logMessageDeletion = (context: MessageDeletionContext): void => {
  logger.info('Message deleted', {
    eventType: LogEventType.MESSAGE_DELETED,
    ...context,
  });
};

/**
 * Log malicious link detection (Requirement 7.6)
 * @param context - Malicious link context
 */
export const logMaliciousLink = (context: MaliciousLinkContext): void => {
  logger.warn('Malicious link detected', {
    eventType: LogEventType.MALICIOUS_LINK,
    ...context,
  });
};

/**
 * Log a system state transition (Requirement 8.6)
 * @param context - System transition context
 */
export const logSystemTransition = (context: SystemTransitionContext): void => {
  logger.info('System state transition', {
    eventType: LogEventType.SYSTEM_TRANSITION,
    ...context,
  });
};

/**
 * Log a violation detection
 * @param userId - User ID
 * @param violationType - Type of violation
 * @param details - Violation details
 * @param context - Additional context
 */
export const logViolation = (
  userId: string,
  violationType: string,
  details: string,
  context?: Record<string, unknown>,
): void => {
  logger.warn('Violation detected', {
    eventType: LogEventType.VIOLATION_DETECTED,
    userId,
    violationType,
    details,
    ...context,
  });
};

/**
 * Log a security event
 * @param message - Security event message
 * @param context - Security event context
 */
export const logSecurityEvent = (
  message: string,
  context: Record<string, unknown>,
): void => {
  logger.warn(message, {
    eventType: LogEventType.SECURITY_EVENT,
    ...context,
  });
};

/**
 * Log a performance warning
 * @param message - Performance warning message
 * @param context - Performance metrics
 */
export const logPerformanceWarning = (
  message: string,
  context: Record<string, unknown>,
): void => {
  logger.warn(message, {
    eventType: LogEventType.PERFORMANCE_WARNING,
    ...context,
  });
};

/**
 * Log a database operation
 * @param operation - Database operation type
 * @param context - Operation context
 */
export const logDatabaseOperation = (
  operation: string,
  context: Record<string, unknown>,
): void => {
  logger.debug('Database operation', {
    eventType: LogEventType.DATABASE_OPERATION,
    operation,
    ...context,
  });
};

/**
 * Create a child logger with additional default metadata
 * @param metadata - Default metadata for child logger
 * @returns Child logger instance
 */
export const createChildLogger = (metadata: Record<string, unknown>) => {
  return logger.child(metadata);
};

/**
 * Flush all log transports (useful for graceful shutdown)
 */
export const flushLogs = async (): Promise<void> => {
  return new Promise((resolve) => {
    logger.on('finish', resolve);
    logger.end();
  });
};
