# Implementation Plan: Channel Text Rate Limiter

## Overview

This implementation plan breaks down the channel text rate limiter feature into discrete coding tasks. The approach follows a bottom-up strategy: building core components first (state store, classifier), then the enforcement layer, then the action layer, and finally wiring everything together with the Discord event system.

## Tasks

- [ ] 1. Set up project structure and core types
  - Create directory `src/moderation/rate-limiter/` for rate limiter components
  - Define TypeScript interfaces in `src/moderation/rate-limiter/types.ts` for RateLimiterConfig, RateLimitViolation, RateLimiterDependencies
  - Add configuration schema to config manager for restricted channels mapping
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 2. Implement StateStore component
  - [ ] 2.1 Create StateStore interface and implementation
    - Write `src/moderation/rate-limiter/state-store.ts` with StateStore interface
    - Implement in-memory storage using Map data structures
    - Implement Redis storage adapter using existing Redis client
    - Add fallback logic from Redis to in-memory on connection failure
    - _Requirements: 6.1, 6.2_
  
  - [ ]* 2.2 Write property test for StateStore
    - **Property: State persistence and retrieval**
    - **Validates: Requirements 6.1, 6.2**
    - Generate random user/channel combinations and timestamps
    - Verify stored values can be retrieved correctly
  
  - [ ]* 2.3 Write unit tests for StateStore
    - Test Redis connection failure fallback
    - Test key format consistency
    - Test null returns for missing data
    - _Requirements: 6.1, 6.2_

- [ ] 3. Implement MessageClassifier component
  - [ ] 3.1 Create MessageClassifier class
    - Write `src/moderation/rate-limiter/message-classifier.ts`
    - Implement `isBotMessage()` method checking message.author.bot
    - Implement `isMediaMessage()` checking attachments and embeds
    - Implement `isRestrictedChannel()` checking config mapping
    - Implement `getRedirectChannel()` retrieving from config
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3_
  
  - [ ]* 3.2 Write property test for message classification
    - **Property 1: Message Classification Correctness**
    - **Validates: Requirements 1.1, 1.2, 1.3**
    - Generate random messages with varying attachments and embeds
    - Verify classification matches expected type
  
  - [ ]* 3.3 Write property test for bot message filtering
    - **Property 2: Bot Message Filtering**
    - **Validates: Requirements 1.4**
    - Generate random messages from bot and non-bot users
    - Verify bot messages are always identified correctly
  
  - [ ]* 3.4 Write unit tests for MessageClassifier
    - Test specific message types (text only, with attachment, with embed)
    - Test edge cases (empty messages, multiple attachments)
    - Test channel restriction checking
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2_

- [ ] 4. Implement RateLimitEnforcer component
  - [ ] 4.1 Create RateLimitEnforcer class
    - Write `src/moderation/rate-limiter/rate-limit-enforcer.ts`
    - Implement `checkRateLimit()` comparing timestamps
    - Implement `recordMessage()` storing timestamps via StateStore
    - Implement `isInViolationWindow()` checking violation expiry
    - Implement `enterViolationWindow()` setting violation expiry
    - Implement `cleanupExpired()` removing old data
    - _Requirements: 3.1, 3.2, 3.3, 5.1, 5.2, 5.4, 6.3, 6.4_
  
  - [ ]* 4.2 Write property test for rate limit violation detection
    - **Property 5: Rate Limit Violation Detection**
    - **Validates: Requirements 3.1, 3.3**
    - Generate random message sequences with varying time gaps
    - Verify violations detected when gap < 60000ms
  
  - [ ]* 4.3 Write property test for message allowance
    - **Property 6: Message Allowance and Timestamp Recording**
    - **Validates: Requirements 3.2**
    - Generate random message sequences with sufficient time gaps
    - Verify messages allowed and timestamps recorded when gap >= 60000ms
  
  - [ ]* 4.4 Write property test for violation window management
    - **Property 8: Violation Window State Management**
    - **Validates: Requirements 5.1**
    - Generate random violations
    - Verify violation window state is set correctly
  
  - [ ]* 4.5 Write property test for expired state cleanup
    - **Property 10: Expired State Cleanup**
    - **Validates: Requirements 6.3, 6.4, 5.4**
    - Generate random timestamps and violation windows
    - Verify cleanup removes only expired entries
  
  - [ ]* 4.6 Write unit tests for RateLimitEnforcer
    - Test exact timing boundaries (59999ms, 60000ms, 60001ms)
    - Test first message in channel (no previous timestamp)
    - Test multiple users in same channel
    - Test same user in multiple channels
    - _Requirements: 3.1, 3.2, 3.3_

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement MessageActionHandler component
  - [ ] 6.1 Create MessageActionHandler class
    - Write `src/moderation/rate-limiter/message-action-handler.ts`
    - Implement `deleteMessage()` with error handling for permissions
    - Implement `sendWarning()` formatting warning message with user mention, channel names
    - Implement warning auto-deletion using setTimeout
    - Implement `deleteSilently()` for violation window deletions
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 8.1, 8.2, 8.3, 8.4_
  
  - [ ]* 6.2 Write property test for warning message content
    - **Property 7: Warning Message Content Completeness**
    - **Validates: Requirements 4.2, 4.3, 4.4**
    - Generate random violations with varying channel configurations
    - Verify all required information present in warning
  
  - [ ]* 6.3 Write property test for error handling resilience
    - **Property 11: Error Handling Resilience**
    - **Validates: Requirements 8.4**
    - Generate random API errors during deletion
    - Verify system logs errors and continues operation
  
  - [ ]* 6.4 Write unit tests for MessageActionHandler
    - Test permission errors during deletion
    - Test warning message format
    - Test warning deletion timing (10 seconds)
    - Test silent deletion during violation window
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 8.4_

- [ ] 7. Implement main ChannelTextRateLimiter orchestrator
  - [ ] 7.1 Create ChannelTextRateLimiter class
    - Write `src/moderation/rate-limiter/channel-text-rate-limiter.ts`
    - Implement `initialize()` setting up dependencies and config
    - Implement `handleMessage()` orchestrating classification, enforcement, and actions
    - Implement message flow: classify → check violation window → check rate limit → take action
    - Implement `cleanupExpiredState()` calling enforcer cleanup
    - Implement `shutdown()` cleaning up resources and timers
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 5.2_
  
  - [ ]* 7.2 Write property test for restricted channel enforcement
    - **Property 3: Restricted Channel Enforcement**
    - **Validates: Requirements 2.1, 2.2**
    - Generate random channel IDs (restricted and non-restricted)
    - Verify rate limiting only applies to restricted channels
  
  - [ ]* 7.3 Write property test for media message bypass
    - **Property 4: Media Message Bypass**
    - **Validates: Requirements 2.3**
    - Generate random media messages in restricted channels
    - Verify they are never rate limited
  
  - [ ]* 7.4 Write property test for silent deletion during violation window
    - **Property 9: Silent Deletion During Violation Window**
    - **Validates: Requirements 5.2**
    - Generate random messages during violation windows
    - Verify silent deletion without additional warnings
  
  - [ ]* 7.5 Write unit tests for ChannelTextRateLimiter
    - Test complete flow for allowed message
    - Test complete flow for rate limit violation
    - Test complete flow for violation window deletion
    - Test bot message bypass
    - Test media message bypass
    - _Requirements: 1.4, 2.3, 5.2_

- [ ] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Integrate with Discord event system
  - [ ] 9.1 Register rate limiter with event manager
    - Update `src/managers/event.manager.ts` to initialize ChannelTextRateLimiter
    - Register `handleMessage()` as handler for Discord messageCreate event
    - Set up periodic cleanup timer (every 60 seconds)
    - Add shutdown hook to cleanup resources
    - _Requirements: All requirements (integration)_
  
  - [ ]* 9.2 Write integration tests
    - Test end-to-end flow with mocked Discord client
    - Test configuration loading from config manager
    - Test Redis integration with test instance
    - Test in-memory fallback when Redis unavailable
    - _Requirements: All requirements (integration)_

- [ ] 10. Add configuration and documentation
  - [ ] 10.1 Update configuration files
    - Add rate limiter configuration section to config schema
    - Add example restricted channels mapping to `.env.example`
    - Document configuration options in `src/config/README.md`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [ ]* 10.2 Create feature documentation
    - Write `src/moderation/rate-limiter/README.md` explaining feature
    - Document configuration options and defaults
    - Add usage examples and troubleshooting guide
    - _Requirements: All requirements (documentation)_

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- Integration tests verify end-to-end functionality
- Use fast-check library for property-based testing
- Mock Discord API calls to avoid rate limits during testing
