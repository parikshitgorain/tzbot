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
/**
 * Log event types for structured logging
 */
export declare enum LogEventType {
    MODERATION_ACTION = "moderation_action",
    VIOLATION_DETECTED = "violation_detected",
    MESSAGE_DELETED = "message_deleted",
    MALICIOUS_LINK = "malicious_link",
    SYSTEM_TRANSITION = "system_transition",
    ERROR = "error",
    SECURITY_EVENT = "security_event",
    PERFORMANCE_WARNING = "performance_warning",
    API_REQUEST = "api_request",
    DATABASE_OPERATION = "database_operation"
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
    [key: string]: unknown;
}
export declare const logger: winston.Logger;
export declare const logStream: {
    write: (message: string) => void;
};
/**
 * Log an error with full stack trace and context (Requirement 14.5)
 * @param message - Error message
 * @param error - Error object
 * @param context - Additional context
 */
export declare const logError: (message: string, error: Error, context?: ErrorLogContext) => void;
/**
 * Log a moderation action with full context (Requirement 5.6)
 * @param context - Moderation action context
 */
export declare const logModeration: (context: ModerationLogContext) => void;
/**
 * Log a deleted message with full context (Requirement 3.5)
 * @param context - Message deletion context
 */
export declare const logMessageDeletion: (context: MessageDeletionContext) => void;
/**
 * Log malicious link detection (Requirement 7.6)
 * @param context - Malicious link context
 */
export declare const logMaliciousLink: (context: MaliciousLinkContext) => void;
/**
 * Log a system state transition (Requirement 8.6)
 * @param context - System transition context
 */
export declare const logSystemTransition: (context: SystemTransitionContext) => void;
/**
 * Log a violation detection
 * @param userId - User ID
 * @param violationType - Type of violation
 * @param details - Violation details
 * @param context - Additional context
 */
export declare const logViolation: (userId: string, violationType: string, details: string, context?: Record<string, unknown>) => void;
/**
 * Log a security event
 * @param message - Security event message
 * @param context - Security event context
 */
export declare const logSecurityEvent: (message: string, context: Record<string, unknown>) => void;
/**
 * Log a performance warning
 * @param message - Performance warning message
 * @param context - Performance metrics
 */
export declare const logPerformanceWarning: (message: string, context: Record<string, unknown>) => void;
/**
 * Log a database operation
 * @param operation - Database operation type
 * @param context - Operation context
 */
export declare const logDatabaseOperation: (operation: string, context: Record<string, unknown>) => void;
/**
 * Create a child logger with additional default metadata
 * @param metadata - Default metadata for child logger
 * @returns Child logger instance
 */
export declare const createChildLogger: (metadata: Record<string, unknown>) => winston.Logger;
/**
 * Flush all log transports (useful for graceful shutdown)
 */
export declare const flushLogs: () => Promise<void>;
//# sourceMappingURL=logger.d.ts.map