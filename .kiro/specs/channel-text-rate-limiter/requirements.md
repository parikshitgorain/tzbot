# Requirements Document

## Introduction

This document specifies the requirements for a channel-specific text rate limiting system for a Discord bot. The system limits text message frequency in designated channels while allowing unlimited media attachments, and implements automatic message deletion for users who exceed rate limits.

## Glossary

- **Rate_Limiter**: The system component that tracks and enforces message rate limits
- **Text_Message**: A Discord message containing only text content, without attachments or media embeds
- **Media_Message**: A Discord message containing photos, videos, attachments, or media embeds
- **Restricted_Channel**: A Discord channel where text rate limiting is enforced
- **Redirect_Channel**: A Discord channel where users are directed to chat freely
- **Violation_Window**: The 5-minute period after a warning during which all text messages are auto-deleted
- **Rate_Limit_Window**: The 60-second period used to determine if a user has exceeded the message limit
- **Warning_Message**: A temporary message informing the user of the rate limit violation

## Requirements

### Requirement 1: Message Type Classification

**User Story:** As a moderator, I want the system to distinguish between text and media messages, so that only text messages are rate-limited.

#### Acceptance Criteria

1. WHEN a message contains attachments, THEN THE Rate_Limiter SHALL classify it as a Media_Message
2. WHEN a message contains embeds with media content, THEN THE Rate_Limiter SHALL classify it as a Media_Message
3. WHEN a message contains only text content without attachments or media embeds, THEN THE Rate_Limiter SHALL classify it as a Text_Message
4. WHEN a message is sent by a bot, THEN THE Rate_Limiter SHALL ignore it and perform no classification

### Requirement 2: Channel-Specific Rate Limiting

**User Story:** As a moderator, I want to configure which channels have rate limiting, so that I can control chat behavior in specific channels.

#### Acceptance Criteria

1. WHEN a Text_Message is sent in a Restricted_Channel, THEN THE Rate_Limiter SHALL enforce the rate limit
2. WHEN a Text_Message is sent in a non-restricted channel, THEN THE Rate_Limiter SHALL allow it without rate limiting
3. WHEN a Media_Message is sent in a Restricted_Channel, THEN THE Rate_Limiter SHALL allow it without rate limiting
4. THE Rate_Limiter SHALL maintain a mapping of Restricted_Channel identifiers to Redirect_Channel identifiers

### Requirement 3: Text Message Rate Limit Enforcement

**User Story:** As a moderator, I want users limited to 1 text message per 60 seconds in restricted channels, so that channels remain focused and clean.

#### Acceptance Criteria

1. WHEN a user sends a Text_Message in a Restricted_Channel, THEN THE Rate_Limiter SHALL check if the user has sent a Text_Message in that channel within the last 60 seconds
2. WHEN a user has NOT sent a Text_Message in the Restricted_Channel within the last 60 seconds, THEN THE Rate_Limiter SHALL allow the message and record the timestamp
3. WHEN a user has sent a Text_Message in the Restricted_Channel within the last 60 seconds, THEN THE Rate_Limiter SHALL delete the violating message and issue a warning
4. THE Rate_Limiter SHALL track message timestamps per user per channel

### Requirement 4: Warning Message Delivery

**User Story:** As a user, I want to receive a clear warning when I exceed the rate limit, so that I understand why my message was deleted and where I should chat instead.

#### Acceptance Criteria

1. WHEN a user exceeds the rate limit, THEN THE Rate_Limiter SHALL send a Warning_Message in the Restricted_Channel
2. THE Warning_Message SHALL mention the user using their Discord handle
3. THE Warning_Message SHALL specify the Restricted_Channel name
4. THE Warning_Message SHALL specify the Redirect_Channel name
5. WHEN a Warning_Message is sent, THEN THE Rate_Limiter SHALL automatically delete it after 10 seconds

### Requirement 5: Violation Window Enforcement

**User Story:** As a moderator, I want repeat violators to have their messages auto-deleted for 5 minutes, so that the channel remains clean without repeated warnings.

#### Acceptance Criteria

1. WHEN a user receives a warning for rate limit violation, THEN THE Rate_Limiter SHALL enter that user into a Violation_Window for that channel
2. WHILE a user is in a Violation_Window for a channel, WHEN the user sends a Text_Message in that channel, THEN THE Rate_Limiter SHALL delete the message immediately without sending additional warnings
3. THE Violation_Window SHALL last for 300000 milliseconds from the time of the warning
4. WHEN the Violation_Window expires, THEN THE Rate_Limiter SHALL remove the user from violation status for that channel

### Requirement 6: State Management and Memory

**User Story:** As a system administrator, I want the rate limiter to manage memory efficiently, so that the bot remains performant over time.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL store user message timestamps in a persistent data store
2. THE Rate_Limiter SHALL store violation window data in a persistent data store
3. WHEN timestamp data is older than 60 seconds, THEN THE Rate_Limiter SHALL remove it
4. WHEN violation window data is older than 300000 milliseconds, THEN THE Rate_Limiter SHALL remove it

### Requirement 7: Configuration Management

**User Story:** As a system administrator, I want to configure rate limiting parameters, so that I can adjust the system behavior without code changes.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL read a configuration mapping of Restricted_Channel identifiers to Redirect_Channel identifiers
2. THE Rate_Limiter SHALL read a configuration value for the Rate_Limit_Window duration in milliseconds
3. THE Rate_Limiter SHALL read a configuration value for the Violation_Window duration in milliseconds
4. WHEN a configuration value is not provided, THEN THE Rate_Limiter SHALL use 60000 milliseconds for Rate_Limit_Window
5. WHEN a configuration value is not provided, THEN THE Rate_Limiter SHALL use 300000 milliseconds for Violation_Window

### Requirement 8: Message Deletion Operations

**User Story:** As a moderator, I want violating messages deleted automatically, so that restricted channels remain clean without manual intervention.

#### Acceptance Criteria

1. WHEN a Text_Message violates the rate limit, THEN THE Rate_Limiter SHALL delete the message from the channel
2. WHEN a user is in a Violation_Window and sends a Text_Message, THEN THE Rate_Limiter SHALL delete the message silently without warnings
3. WHEN a Warning_Message is sent, THEN THE Rate_Limiter SHALL schedule its deletion for 10 seconds later
4. IF message deletion fails due to permissions or API errors, THEN THE Rate_Limiter SHALL log the error and continue operation
