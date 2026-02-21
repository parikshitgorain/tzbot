# Design Document: Channel Text Rate Limiter

## Overview

The Channel Text Rate Limiter is a Discord bot feature that enforces message frequency limits on text messages in designated channels while allowing unlimited media content. The system operates as a message event handler that intercepts incoming messages, classifies them by type, applies rate limiting rules, and manages violation states.

The design follows an event-driven architecture that integrates with the existing Discord bot infrastructure. It uses a state management layer (Redis or in-memory) to track user message timestamps and violation windows, and leverages the existing configuration management system for channel mappings and timing parameters.

Key design principles:
- Non-blocking message processing
- Efficient state management with automatic cleanup
- Clear separation between classification, enforcement, and action layers
- Graceful error handling for Discord API failures

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Discord Message Event                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Message Classification Layer                    │
│  - Bot message filter                                        │
│  - Media vs Text detection                                   │
│  - Channel restriction check                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Rate Limit Enforcement Layer                    │
│  - Timestamp tracking                                        │
│  - Rate limit calculation                                    │
│  - Violation window management                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Action Layer                               │
│  - Message deletion                                          │
│  - Warning message creation                                  │
│  - State updates                                             │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  State Store (Redis/Memory)                  │
│  - User timestamps: Map<channelId:userId, timestamp>        │
│  - Violation windows: Map<channelId:userId, expiryTime>     │
└─────────────────────────────────────────────────────────────┘
```

### Integration Points

1. **Discord Client**: Receives message events via the existing event manager
2. **Configuration Manager**: Provides channel mappings and timing parameters
3. **Redis Client**: Stores and retrieves rate limiting state (with in-memory fallback)
4. **Logger**: Records rate limit violations and errors

## Components and Interfaces

### 1. ChannelTextRateLimiter (Main Component)

The primary orchestrator that handles message events and coordinates all rate limiting operations.

```typescript
interface ChannelTextRateLimiter {
  /**
   * Initialize the rate limiter with configuration and dependencies
   */
  initialize(config: RateLimiterConfig, dependencies: RateLimiterDependencies): Promise<void>;
  
  /**
   * Handle incoming Discord message event
   * Returns true if message should be allowed, false if it was handled/deleted
   */
  handleMessage(message: Message): Promise<boolean>;
  
  /**
   * Clean up expired state data
   * Should be called periodically (e.g., every 60 seconds)
   */
  cleanupExpiredState(): Promise<void>;
  
  /**
   * Shutdown and cleanup resources
   */
  shutdown(): Promise<void>;
}
```

### 2. MessageClassifier

Determines message type and whether rate limiting applies.

```typescript
interface MessageClassifier {
  /**
   * Check if message is from a bot
   */
  isBotMessage(message: Message): boolean;
  
  /**
   * Check if message contains media (attachments or media embeds)
   */
  isMediaMessage(message: Message): boolean;
  
  /**
   * Check if channel is restricted
   */
  isRestrictedChannel(channelId: string, config: RateLimiterConfig): boolean;
  
  /**
   * Get redirect channel for a restricted channel
   */
  getRedirectChannel(channelId: string, config: RateLimiterConfig): string | null;
}
```

### 3. RateLimitEnforcer

Manages rate limit state and determines if messages violate limits.

```typescript
interface RateLimitEnforcer {
  /**
   * Check if user has exceeded rate limit in channel
   * Returns violation info if limit exceeded, null otherwise
   */
  checkRateLimit(
    userId: string,
    channelId: string,
    timestamp: number
  ): Promise<RateLimitViolation | null>;
  
  /**
   * Record a message timestamp for a user in a channel
   */
  recordMessage(
    userId: string,
    channelId: string,
    timestamp: number
  ): Promise<void>;
  
  /**
   * Check if user is in violation window for a channel
   */
  isInViolationWindow(
    userId: string,
    channelId: string,
    timestamp: number
  ): Promise<boolean>;
  
  /**
   * Enter user into violation window for a channel
   */
  enterViolationWindow(
    userId: string,
    channelId: string,
    timestamp: number,
    durationMs: number
  ): Promise<void>;
  
  /**
   * Remove expired timestamps and violation windows
   */
  cleanupExpired(currentTime: number): Promise<void>;
}
```

### 4. MessageActionHandler

Executes actions like message deletion and warning delivery.

```typescript
interface MessageActionHandler {
  /**
   * Delete a message from Discord
   */
  deleteMessage(message: Message): Promise<boolean>;
  
  /**
   * Send warning message and schedule its deletion
   */
  sendWarning(
    channel: TextChannel,
    userId: string,
    channelName: string,
    redirectChannelId: string
  ): Promise<void>;
  
  /**
   * Delete a message silently (during violation window)
   */
  deleteSilently(message: Message): Promise<void>;
}
```

### 5. StateStore

Abstraction over Redis/in-memory storage for rate limiting state.

```typescript
interface StateStore {
  /**
   * Get last message timestamp for user in channel
   */
  getLastMessageTime(userId: string, channelId: string): Promise<number | null>;
  
  /**
   * Set last message timestamp for user in channel
   */
  setLastMessageTime(userId: string, channelId: string, timestamp: number): Promise<void>;
  
  /**
   * Get violation window expiry time for user in channel
   */
  getViolationExpiry(userId: string, channelId: string): Promise<number | null>;
  
  /**
   * Set violation window expiry time for user in channel
   */
  setViolationExpiry(userId: string, channelId: string, expiryTime: number): Promise<void>;
  
  /**
   * Remove expired entries
   */
  removeExpired(currentTime: number): Promise<void>;
  
  /**
   * Get all keys for cleanup operations
   */
  getAllKeys(): Promise<string[]>;
}
```

## Data Models

### RateLimiterConfig

Configuration for the rate limiter system.

```typescript
interface RateLimiterConfig {
  // Map of restricted channel IDs to redirect channel IDs
  restrictedChannels: Map<string, string>;
  
  // Duration in milliseconds for rate limit window (default: 60000)
  rateLimitWindowMs: number;
  
  // Duration in milliseconds for violation window (default: 300000)
  violationWindowMs: number;
  
  // Duration in milliseconds before warning message is deleted (default: 10000)
  warningDeleteDelayMs: number;
  
  // Interval in milliseconds for cleanup operations (default: 60000)
  cleanupIntervalMs: number;
}
```

### RateLimitViolation

Information about a rate limit violation.

```typescript
interface RateLimitViolation {
  userId: string;
  channelId: string;
  lastMessageTime: number;
  currentTime: number;
  timeSinceLastMessage: number;
}
```

### RateLimiterDependencies

External dependencies injected into the rate limiter.

```typescript
interface RateLimiterDependencies {
  discordClient: Client;
  stateStore: StateStore;
  logger: Logger;
  configManager: ConfigManager;
}
```

### State Storage Keys

Keys used in Redis/memory storage:

- **Message timestamps**: `ratelimit:msg:{channelId}:{userId}` → timestamp (number)
- **Violation windows**: `ratelimit:violation:{channelId}:{userId}` → expiryTime (number)

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Message Classification Correctness

*For any* Discord message, the classifier should correctly identify it as a media message if it contains attachments or media embeds, and as a text message otherwise.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Bot Message Filtering

*For any* message sent by a bot user, the rate limiter should ignore it and perform no rate limiting operations.

**Validates: Requirements 1.4**

### Property 3: Restricted Channel Enforcement

*For any* text message sent in a restricted channel, the rate limiter should enforce rate limiting, while text messages in non-restricted channels should be allowed without rate limiting.

**Validates: Requirements 2.1, 2.2**

### Property 4: Media Message Bypass

*For any* media message sent in a restricted channel, the rate limiter should allow it without applying rate limits.

**Validates: Requirements 2.3**

### Property 5: Rate Limit Violation Detection

*For any* user sending text messages in a restricted channel, if the time since their last message is less than 60000 milliseconds, the system should detect a rate limit violation.

**Validates: Requirements 3.1, 3.3**

### Property 6: Message Allowance and Timestamp Recording

*For any* user sending a text message in a restricted channel, if the time since their last message is 60000 milliseconds or more, the system should allow the message and record the new timestamp.

**Validates: Requirements 3.2**

### Property 7: Warning Message Content Completeness

*For any* rate limit violation, the warning message should contain the user mention, the restricted channel name, and the redirect channel name.

**Validates: Requirements 4.2, 4.3, 4.4**

### Property 8: Violation Window State Management

*For any* user who receives a rate limit warning, the system should enter that user into a violation window for that specific channel.

**Validates: Requirements 5.1**

### Property 9: Silent Deletion During Violation Window

*For any* user in a violation window for a channel, when they send a text message in that channel, the system should delete the message immediately without sending additional warnings.

**Validates: Requirements 5.2**

### Property 10: Expired State Cleanup

*For any* timestamp data older than 60000 milliseconds or violation window data older than 300000 milliseconds, the cleanup operation should remove it from the state store.

**Validates: Requirements 6.3, 6.4, 5.4**

### Property 11: Error Handling Resilience

*For any* message deletion operation that fails due to permissions or API errors, the system should log the error and continue processing subsequent messages without crashing.

**Validates: Requirements 8.4**

## Error Handling

### Discord API Errors

1. **Message Deletion Failures**
   - Catch and log permission errors (missing "Manage Messages" permission)
   - Catch and log "Unknown Message" errors (message already deleted)
   - Continue operation without crashing
   - Do not retry failed deletions to avoid rate limit issues

2. **Message Send Failures**
   - Catch and log permission errors when sending warnings
   - If warning cannot be sent, still record violation window
   - Continue operation without crashing

3. **Rate Limit Errors**
   - Respect Discord API rate limits
   - Use exponential backoff for retries if needed
   - Log rate limit errors for monitoring

### State Store Errors

1. **Redis Connection Failures**
   - Fall back to in-memory storage if Redis is unavailable
   - Log connection errors
   - Attempt reconnection on next operation

2. **Read/Write Failures**
   - Log errors with context (user ID, channel ID)
   - Return safe defaults (null for missing data)
   - Continue operation without crashing

### Configuration Errors

1. **Missing Configuration**
   - Use default values for timing parameters
   - Log warning if restricted channels map is empty
   - Continue operation with defaults

2. **Invalid Configuration**
   - Validate channel IDs exist before use
   - Log errors for invalid channel references
   - Skip invalid entries and continue with valid ones

## Testing Strategy

### Unit Testing

Unit tests will focus on specific examples, edge cases, and error conditions:

1. **Message Classification**
   - Test specific message types (text only, with attachment, with embed)
   - Test bot message detection
   - Test edge cases (empty messages, deleted attachments)

2. **Rate Limit Logic**
   - Test exact timing boundaries (59s, 60s, 61s)
   - Test first message in channel (no previous timestamp)
   - Test multiple users in same channel
   - Test same user in multiple channels

3. **Violation Window**
   - Test entry into violation window
   - Test expiry at exact boundary (299s, 300s, 301s)
   - Test cleanup of expired windows

4. **Error Handling**
   - Test permission errors during deletion
   - Test missing channel references
   - Test Redis connection failures

### Property-Based Testing

Property tests will verify universal properties across all inputs using a property-based testing library (fast-check for TypeScript). Each test should run a minimum of 100 iterations.

1. **Property 1: Message Classification Correctness**
   - Generate random messages with varying attachments and embeds
   - Verify classification matches expected type
   - Tag: **Feature: channel-text-rate-limiter, Property 1: Message Classification Correctness**

2. **Property 2: Bot Message Filtering**
   - Generate random messages from bot and non-bot users
   - Verify bot messages are always ignored
   - Tag: **Feature: channel-text-rate-limiter, Property 2: Bot Message Filtering**

3. **Property 3: Restricted Channel Enforcement**
   - Generate random channel IDs (restricted and non-restricted)
   - Verify rate limiting only applies to restricted channels
   - Tag: **Feature: channel-text-rate-limiter, Property 3: Restricted Channel Enforcement**

4. **Property 4: Media Message Bypass**
   - Generate random media messages in restricted channels
   - Verify they are never rate limited
   - Tag: **Feature: channel-text-rate-limiter, Property 4: Media Message Bypass**

5. **Property 5: Rate Limit Violation Detection**
   - Generate random message sequences with varying time gaps
   - Verify violations detected when gap < 60s
   - Tag: **Feature: channel-text-rate-limiter, Property 5: Rate Limit Violation Detection**

6. **Property 6: Message Allowance and Timestamp Recording**
   - Generate random message sequences with sufficient time gaps
   - Verify messages allowed and timestamps recorded when gap >= 60s
   - Tag: **Feature: channel-text-rate-limiter, Property 6: Message Allowance and Timestamp Recording**

7. **Property 7: Warning Message Content Completeness**
   - Generate random violations with varying channel configurations
   - Verify all required information present in warning
   - Tag: **Feature: channel-text-rate-limiter, Property 7: Warning Message Content Completeness**

8. **Property 8: Violation Window State Management**
   - Generate random violations
   - Verify violation window state is set correctly
   - Tag: **Feature: channel-text-rate-limiter, Property 8: Violation Window State Management**

9. **Property 9: Silent Deletion During Violation Window**
   - Generate random messages during violation windows
   - Verify silent deletion without additional warnings
   - Tag: **Feature: channel-text-rate-limiter, Property 9: Silent Deletion During Violation Window**

10. **Property 10: Expired State Cleanup**
    - Generate random timestamps and violation windows
    - Verify cleanup removes only expired entries
    - Tag: **Feature: channel-text-rate-limiter, Property 10: Expired State Cleanup**

11. **Property 11: Error Handling Resilience**
    - Generate random API errors during deletion
    - Verify system logs errors and continues operation
    - Tag: **Feature: channel-text-rate-limiter, Property 11: Error Handling Resilience**

### Integration Testing

Integration tests will verify the complete flow:

1. **End-to-End Rate Limiting Flow**
   - Send messages through Discord client mock
   - Verify deletion, warning, and state updates
   - Test complete violation window cycle

2. **State Store Integration**
   - Test with Redis backend
   - Test with in-memory fallback
   - Verify data persistence and retrieval

3. **Configuration Integration**
   - Test loading from config manager
   - Test default value application
   - Test configuration updates

### Test Configuration

- Property tests: Minimum 100 iterations per test
- Use fast-check library for property-based testing
- Mock Discord API calls to avoid rate limits
- Use in-memory state store for unit tests
- Use Redis test instance for integration tests
