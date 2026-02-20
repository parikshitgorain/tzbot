# Requirements Document: TZBOT Discord Bot

## Introduction

TZBOT is a comprehensive Discord moderation and engagement bot designed to provide premium live notifications, automated moderation, role management, and community engagement features. The system integrates with external platforms (Kick.com), provides advanced spam protection, and includes interactive features like giveaways and AI-powered auto-responses.

## Glossary

- **TZBOT**: The Discord bot system being specified
- **Kick_Platform**: The external streaming platform (Kick.com) used for subscriber/VIP data
- **Discord_Server**: The Discord server where TZBOT operates
- **Premium_Embed**: A rich, formatted notification message with zero delivery delay
- **Designated_Channel**: A Discord channel configured to receive specific notifications
- **Subscriber_Role**: A Discord role assigned to users who are subscribers on Kick
- **VIP_Role**: A Discord role assigned to users who have VIP status on Kick
- **Read_Only_Channel**: A Discord channel where only authorized users can post messages
- **Escalation_Matrix**: A progressive punishment system (warn → timeout → ban)
- **Mod_User**: A Discord user with moderator permissions
- **Slash_Command**: A Discord command invoked with the "/" prefix
- **Private_Channel**: A Discord channel accessible only to moderators
- **Public_Channel**: A Discord channel accessible to all server members
- **Zero_Width_Link**: A malicious URL containing zero-width Unicode characters to evade detection
- **Phishing_Link**: A malicious URL designed to steal user credentials or information
- **AutoMod_System**: The automated moderation component of TZBOT
- **Webhook**: An HTTP callback mechanism for receiving real-time updates
- **Polling_System**: A periodic API checking mechanism for updates
- **Whitelist_Role**: A Discord role that grants access to specific features
- **CSPRNG**: Cryptographically Secure Pseudo-Random Number Generator
- **LLM**: Large Language Model for natural language processing
- **Chat_Rain**: An automated reward distribution system for active chatters
- **Active_Chatter**: A user who has sent messages within a configured time window
- **Spam_Filter**: A system component that detects and blocks spam behavior

## Requirements

### Requirement 1: Live Notification System

**User Story:** As a Discord server administrator, I want to receive instant notifications about platform events, so that my community stays informed with zero delay.

#### Acceptance Criteria

1. WHEN a notification event occurs on Kick_Platform, THE TZBOT SHALL deliver a Premium_Embed to the Designated_Channel within 1 second
2. THE TZBOT SHALL format Premium_Embeds with title, description, thumbnail, timestamp, and color fields
3. WHEN multiple notification events occur simultaneously, THE TZBOT SHALL deliver all Premium_Embeds in chronological order
4. WHERE a Designated_Channel is configured, THE TZBOT SHALL only send Premium_Embeds to that channel
5. IF a Designated_Channel is deleted or inaccessible, THEN THE TZBOT SHALL log an error and attempt delivery to a fallback channel

### Requirement 2: Automated Role Synchronization

**User Story:** As a Discord server administrator, I want subscriber and VIP roles automatically assigned based on Kick platform status, so that role management requires no manual intervention.

**Note:** This requirement depends on Kick.com providing a public API or webhook system for subscriber/VIP status. If unavailable, manual role assignment commands will be provided as an alternative.

#### Acceptance Criteria

1. WHERE Kick_Platform provides an API or webhook, WHEN a user becomes a subscriber on Kick_Platform, THE TZBOT SHALL assign the Subscriber_Role to that user on Discord_Server within 60 seconds
2. WHERE Kick_Platform provides an API or webhook, WHEN a user becomes a VIP on Kick_Platform, THE TZBOT SHALL assign the VIP_Role to that user on Discord_Server within 60 seconds
3. WHERE Kick_Platform provides an API or webhook, WHEN a user loses subscriber status on Kick_Platform, THE TZBOT SHALL remove the Subscriber_Role from that user on Discord_Server within 60 seconds
4. WHERE Kick_Platform provides an API or webhook, WHEN a user loses VIP status on Kick_Platform, THE TZBOT SHALL remove the VIP_Role from that user on Discord_Server within 60 seconds
5. THE TZBOT SHALL maintain a mapping between Kick_Platform usernames and Discord user IDs
6. IF a user cannot be found on Discord_Server, THEN THE TZBOT SHALL log the synchronization failure and retry on the next sync cycle
7. WHERE Kick_Platform API is unavailable, THE TZBOT SHALL provide manual /addrole and /removerole Slash_Commands for Mod_Users

### Requirement 3: Channel Access Enforcement

**User Story:** As a Discord server moderator, I want unauthorized messages automatically deleted from read-only channels, so that channel restrictions are strictly enforced.

#### Acceptance Criteria

1. WHEN a non-authorized user posts a message in a Read_Only_Channel, THE TZBOT SHALL delete the message within 1 second
2. WHEN a message is deleted from a Read_Only_Channel, THE TZBOT SHALL send a direct message to the user explaining the restriction
3. THE TZBOT SHALL allow Mod_Users to post messages in Read_Only_Channels without deletion
4. WHERE a user has a Whitelist_Role for a specific Read_Only_Channel, THE TZBOT SHALL allow their messages
5. THE TZBOT SHALL log all deleted messages with user ID, message content, and timestamp

### Requirement 4: Automated Spam Protection

**User Story:** As a Discord server moderator, I want an automated escalation system for spam violations, so that repeat offenders are progressively punished without manual intervention.

#### Acceptance Criteria

1. WHEN a user violates spam rules for the first time, THE TZBOT SHALL issue a warning to that user
2. WHEN a user violates spam rules for the second time within 24 hours, THE TZBOT SHALL apply a 1-hour timeout to that user
3. WHEN a user violates spam rules for the third time within 24 hours, THE TZBOT SHALL apply a 24-hour timeout to that user
4. WHEN a user violates spam rules for the fourth time within 7 days, THE TZBOT SHALL permanently ban that user from Discord_Server
5. THE TZBOT SHALL detect spam as: 5 or more identical messages within 10 seconds, or 10 or more messages within 5 seconds
6. THE TZBOT SHALL reset a user's violation count after 7 days of no violations
7. WHEN applying a punishment, THE TZBOT SHALL notify the user via direct message with the reason and duration

### Requirement 5: Manual Moderation Commands

**User Story:** As a Discord server moderator, I want fast-action slash commands for manual moderation, so that I can quickly respond to rule violations.

#### Acceptance Criteria

1. WHERE a user is a Mod_User, THE TZBOT SHALL provide a /ban Slash_Command that permanently bans a specified user
2. WHERE a user is a Mod_User, THE TZBOT SHALL provide a /timeout Slash_Command that temporarily mutes a specified user for a configurable duration
3. WHERE a user is a Mod_User, THE TZBOT SHALL provide a /warn Slash_Command that issues a warning to a specified user
4. WHERE a user is a Mod_User, THE TZBOT SHALL provide a /kick Slash_Command that removes a specified user from Discord_Server
5. WHEN a Mod_User executes a moderation Slash_Command, THE TZBOT SHALL execute the action within 1 second
6. WHEN a moderation action is executed, THE TZBOT SHALL log the action with moderator ID, target user ID, action type, reason, and timestamp
7. WHEN a moderation Slash_Command is executed, THE TZBOT SHALL send a confirmation message to the Mod_User

### Requirement 6: Announcement Relay System

**User Story:** As a Discord server moderator, I want to submit announcements in a private channel that are automatically relayed to public channels, so that announcements are reviewed before publication.

#### Acceptance Criteria

1. WHEN a Mod_User posts a message in a designated Private_Channel, THE TZBOT SHALL relay that message to a configured Public_Channel within 2 seconds
2. THE TZBOT SHALL preserve message formatting, embeds, and attachments when relaying
3. THE TZBOT SHALL attribute relayed messages to TZBOT rather than the original Mod_User
4. WHERE multiple Public_Channels are configured, THE TZBOT SHALL relay the message to all configured channels
5. IF a relayed message fails to send, THEN THE TZBOT SHALL notify the Mod_User in the Private_Channel

### Requirement 7: Advanced Link Detection

**User Story:** As a Discord server administrator, I want advanced detection of malicious links including zero-width character obfuscation, so that phishing attempts are instantly blocked.

**Note:** This uses pattern matching and URL normalization techniques, not AI/machine learning. Detection is based on known blocklists and character normalization.

#### Acceptance Criteria

1. WHEN a message contains a Zero_Width_Link, THE TZBOT SHALL delete the message within 500 milliseconds
2. WHEN a message contains a Phishing_Link from a known blocklist, THE TZBOT SHALL delete the message within 500 milliseconds
3. WHEN a malicious link is detected, THE TZBOT SHALL apply a 24-hour timeout to the user who posted it
4. THE TZBOT SHALL normalize all URLs by removing zero-width Unicode characters (U+200B, U+200C, U+200D, U+FEFF) before analysis
5. THE TZBOT SHALL maintain a regularly updated blocklist of known Phishing_Link domains from public sources
6. WHEN a malicious link is detected, THE TZBOT SHALL log the incident with user ID, message content, and detected link
7. WHERE a user is a Mod_User, THE TZBOT SHALL not apply link detection to their messages
8. THE TZBOT SHALL check URLs against the Google Safe Browsing API or similar service for additional phishing detection

### Requirement 8: Redundant Event Monitoring

**User Story:** As a Discord server administrator, I want redundant monitoring systems with automatic fallback, so that live notifications never fail.

**Note:** This requires Kick.com to support webhooks or a public API. If neither is available, only polling will be possible.

#### Acceptance Criteria

1. WHERE Kick_Platform supports webhooks, THE TZBOT SHALL use Webhook callbacks as the primary mechanism for receiving Kick_Platform events
2. WHILE Webhook callbacks are functioning, THE TZBOT SHALL disable Polling_System to conserve resources
3. IF Webhook callbacks fail for 3 consecutive events or 60 seconds, THEN THE TZBOT SHALL activate Polling_System as a fallback
4. WHILE Polling_System is active, THE TZBOT SHALL check Kick_Platform API every 10 seconds for new events
5. WHEN Webhook callbacks resume functioning, THE TZBOT SHALL deactivate Polling_System and return to webhook-based monitoring
6. THE TZBOT SHALL log all monitoring system transitions with timestamp and reason
7. WHERE Kick_Platform only supports polling, THE TZBOT SHALL use Polling_System as the primary monitoring mechanism

### Requirement 9: Role-Gated Giveaway System

**User Story:** As a Discord server administrator, I want to run giveaways with role restrictions and cryptographically secure random selection, so that only eligible members can participate and winners are fairly chosen.

#### Acceptance Criteria

1. WHERE a giveaway is configured with Whitelist_Roles, THE TZBOT SHALL only allow users with those roles to enter
2. WHEN a user without a required Whitelist_Role attempts to enter a giveaway, THE TZBOT SHALL send an ephemeral message explaining the restriction
3. WHEN a giveaway ends, THE TZBOT SHALL select winners using CSPRNG for random number generation
4. THE TZBOT SHALL provide interactive buttons for users to enter giveaways
5. WHEN a user clicks an entry button, THE TZBOT SHALL record their entry with user ID and timestamp
6. THE TZBOT SHALL prevent duplicate entries from the same user in a single giveaway
7. WHEN winners are selected, THE TZBOT SHALL announce them in the giveaway channel and send direct messages to winners

### Requirement 10: AI-Powered Auto-Responder

**User Story:** As a Discord server administrator, I want an AI system to automatically answer common questions, so that moderators are not overwhelmed with repetitive inquiries.

**Note:** This requires hosting a local LLM (e.g., Llama 2 7B, Mistral 7B) which needs 8-16GB RAM minimum. This is separate from the bot's base memory requirements. Alternatively, can use cloud APIs (OpenAI, Anthropic) with API costs.

#### Acceptance Criteria

1. WHERE local LLM hosting is chosen, THE TZBOT SHALL host an LLM locally for processing user questions
2. WHERE cloud API is chosen, THE TZBOT SHALL use a configured API endpoint for processing user questions
3. WHEN a user asks a question in a configured channel, THE TZBOT SHALL generate a response within 10 seconds
4. THE TZBOT SHALL only respond to messages that end with a question mark or contain question keywords (who, what, when, where, why, how)
5. WHERE a response confidence score is below 0.7, THE TZBOT SHALL not respond automatically
6. THE TZBOT SHALL maintain a knowledge base of frequently asked questions and approved answers
7. WHERE a Mod_User reacts to an AI response with a ❌ emoji, THE TZBOT SHALL delete that response
8. THE TZBOT SHALL rate-limit AI responses to 1 response per user per 30 seconds to prevent spam
9. WHERE a Mod_User executes /ai-toggle Slash_Command, THE TZBOT SHALL enable or disable the auto-responder feature

### Requirement 11: Algorithmic Chat Reward System

**User Story:** As a Discord server administrator, I want to automatically reward active chatters with random drops, so that genuine engagement is incentivized without rewarding spam.

#### Acceptance Criteria

1. THE TZBOT SHALL track Active_Chatters who have sent at least 3 messages in the last 10 minutes
2. WHEN a Chat_Rain event is triggered, THE TZBOT SHALL randomly select between 3 and 10 Active_Chatters as recipients
3. THE TZBOT SHALL use CSPRNG for random selection of Chat_Rain recipients
4. THE TZBOT SHALL exclude users who have been flagged by Spam_Filter in the last 24 hours from Chat_Rain eligibility
5. THE TZBOT SHALL enforce a minimum 5-minute delay between Chat_Rain events
6. WHERE a Chat_Rain event is configured with a time delay, THE TZBOT SHALL wait the specified duration before distributing rewards
7. WHEN a Chat_Rain event occurs, THE TZBOT SHALL announce winners in the chat channel
8. THE TZBOT SHALL exclude users who have received a Chat_Rain reward in the last 60 minutes from subsequent draws

## Configuration Requirements

### Requirement 12: System Configuration

**User Story:** As a Discord server administrator, I want to configure all TZBOT features through a centralized system, so that setup and maintenance are straightforward.

#### Acceptance Criteria

1. THE TZBOT SHALL provide a configuration file or database for storing all feature settings
2. THE TZBOT SHALL validate all configuration values on startup and reject invalid configurations
3. WHERE configuration is invalid, THE TZBOT SHALL log specific validation errors with field names and expected formats
4. THE TZBOT SHALL support hot-reloading of configuration changes without requiring a restart
5. WHERE a Mod_User executes a /config Slash_Command, THE TZBOT SHALL display current configuration values
6. THE TZBOT SHALL encrypt sensitive configuration values such as API keys and tokens

## Performance Requirements

### Requirement 13: System Performance

**User Story:** As a Discord server administrator, I want TZBOT to operate efficiently under high load, so that the bot remains responsive during peak activity.

**Note:** Memory requirements exclude the optional local LLM (Requirement 10), which requires an additional 8-16GB RAM if enabled.

#### Acceptance Criteria

1. THE TZBOT SHALL handle at least 100 messages per second without degradation in response time
2. THE TZBOT SHALL maintain message processing latency below 100 milliseconds under normal load
3. THE TZBOT SHALL use no more than 512MB of RAM during normal operation (excluding optional LLM)
4. THE TZBOT SHALL use no more than 25% of one CPU core during normal operation (excluding optional LLM)
5. WHEN system resources exceed 80% of limits, THE TZBOT SHALL log a warning and implement rate limiting
6. WHERE local LLM is enabled, THE TZBOT SHALL allocate an additional 8-16GB RAM for LLM operations

## Reliability Requirements

### Requirement 14: System Reliability

**User Story:** As a Discord server administrator, I want TZBOT to be highly reliable with automatic recovery, so that the bot maintains uptime without manual intervention.

#### Acceptance Criteria

1. THE TZBOT SHALL maintain 99.5% uptime over any 30-day period
2. IF THE TZBOT crashes, THEN it SHALL automatically restart within 10 seconds
3. THE TZBOT SHALL persist all critical state data to disk every 60 seconds
4. WHEN THE TZBOT restarts, it SHALL restore state from the most recent persisted data
5. THE TZBOT SHALL log all errors with stack traces, timestamps, and context information
6. THE TZBOT SHALL implement exponential backoff for failed API requests, starting at 1 second and capping at 60 seconds

## Security Requirements

### Requirement 15: Data Security and Privacy

**User Story:** As a Discord server administrator, I want user data to be securely stored and handled, so that privacy is protected and regulations are followed.

#### Acceptance Criteria

1. THE TZBOT SHALL encrypt all API keys and tokens at rest using AES-256 encryption
2. THE TZBOT SHALL not store message content longer than 7 days unless required for moderation logs
3. WHEN storing user data, THE TZBOT SHALL only store Discord user IDs, not personal information
4. THE TZBOT SHALL provide a /deletemydata Slash_Command that removes all stored data for a requesting user
5. THE TZBOT SHALL hash all stored passwords or sensitive credentials using bcrypt with a minimum cost factor of 12
6. THE TZBOT SHALL implement rate limiting on all API endpoints to prevent abuse (maximum 60 requests per minute per user)
7. WHERE a data breach is detected, THE TZBOT SHALL log the incident and notify configured administrators immediately
