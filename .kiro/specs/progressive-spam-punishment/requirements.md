# Requirements Document

## Introduction

This document specifies requirements for a progressive spam punishment system that escalates penalties for repeat offenders while providing automatic forgiveness after a period of good behavior. The system implements a warning-timeout-ban ladder with triple notifications to users, moderators, and logs.

## Glossary

- **Spam_Punishment_System**: The automated system that tracks spam offenses and applies progressive penalties
- **Offense**: A single instance of spam behavior detected by moderators
- **Timeout**: A temporary restriction preventing a user from sending messages
- **Permanent_Ban**: An indefinite ban requiring manual moderator intervention to remove
- **Reset_Period**: The 30-day duration after which offense history is cleared
- **Triple_Notification**: The three-part notification system (DM, ephemeral message, mod-log)
- **Offense_Ladder**: The progression of penalties (warning → timeout → ban)
- **Moderator**: A user with permissions to issue warnings and manage punishments

## Requirements

### Requirement 1: Progressive Punishment Ladder

**User Story:** As a moderator, I want the system to automatically escalate punishments for repeat offenders, so that persistent spammers face increasing consequences.

#### Acceptance Criteria

1. WHEN a user commits their 1st offense, THE Spam_Punishment_System SHALL issue a warning without timeout
2. WHEN a user commits their 2nd offense, THE Spam_Punishment_System SHALL issue a warning without timeout
3. WHEN a user commits their 3rd offense, THE Spam_Punishment_System SHALL apply a 1-hour timeout
4. WHEN a user commits their 4th offense, THE Spam_Punishment_System SHALL apply a 2-hour timeout
5. WHEN a user commits their 5th offense, THE Spam_Punishment_System SHALL apply a 4-hour timeout
6. WHEN a user commits their 6th or higher offense, THE Spam_Punishment_System SHALL double the previous timeout duration
7. WHEN a user reaches a cumulative timeout duration of 24 hours or more, THE Spam_Punishment_System SHALL apply a permanent ban instead of timeout

### Requirement 2: Automatic Offense Reset

**User Story:** As a system administrator, I want offenses to automatically reset after 30 days of good behavior, so that users who reform are not permanently penalized.

#### Acceptance Criteria

1. WHEN a user commits a new offense AND 30 days have passed since their last offense, THE Spam_Punishment_System SHALL reset their offense count to zero before processing the new offense
2. WHEN offense count is reset, THE Spam_Punishment_System SHALL clear the user's warning history
3. WHEN offense count is reset, THE Spam_Punishment_System SHALL reset the current timeout duration to zero

### Requirement 3: Triple Notification System

**User Story:** As a moderator, I want all punishments to notify the user, display in-channel, and log to mod-log, so that everyone is informed appropriately.

#### Acceptance Criteria

1. WHEN a punishment is applied, THE Spam_Punishment_System SHALL send a direct message to the user containing the reason, offense count, and next punishment
2. WHEN a punishment is applied, THE Spam_Punishment_System SHALL send an ephemeral message in the channel visible only to the offending user
3. WHEN a punishment is applied, THE Spam_Punishment_System SHALL post a notification to the mod-log channel containing user identifier, action taken, and timestamp
4. WHEN any notification fails to send, THE Spam_Punishment_System SHALL continue processing and log the failure

### Requirement 4: Offense Data Persistence

**User Story:** As a system administrator, I want all offense data stored persistently, so that punishment history survives bot restarts.

#### Acceptance Criteria

1. THE Spam_Punishment_System SHALL store user_id for each tracked user
2. THE Spam_Punishment_System SHALL store total_offenses count for each user
3. THE Spam_Punishment_System SHALL store last_offense_timestamp for each user
4. THE Spam_Punishment_System SHALL store current_timeout_duration for each user
5. THE Spam_Punishment_System SHALL store warning_history array containing all offense records for each user
6. THE Spam_Punishment_System SHALL store is_banned boolean flag for each user

### Requirement 5: Moderator Warning Command

**User Story:** As a moderator, I want to issue warnings with a command, so that I can manually flag spam behavior.

#### Acceptance Criteria

1. WHEN a moderator executes /warn with a user mention and reason, THE Spam_Punishment_System SHALL record a new offense for that user
2. WHEN a moderator executes /warn, THE Spam_Punishment_System SHALL apply the appropriate punishment based on offense count
3. WHEN a moderator executes /warn, THE Spam_Punishment_System SHALL trigger the triple notification system
4. WHEN a moderator executes /warn without required parameters, THE Spam_Punishment_System SHALL return an error message

### Requirement 6: Offense History Query Commands

**User Story:** As a moderator, I want to view offense histories, so that I can understand a user's punishment status.

#### Acceptance Criteria

1. WHEN a moderator executes /warnlist with a user mention, THE Spam_Punishment_System SHALL display that user's complete offense history
2. WHEN a moderator executes /warnall, THE Spam_Punishment_System SHALL display offense summaries for all users with active warnings
3. WHEN a moderator executes /modlog with a user mention, THE Spam_Punishment_System SHALL display all moderation actions taken against that user

### Requirement 7: Offense Management Commands

**User Story:** As a moderator, I want to clear or reset offenses, so that I can manually forgive users or correct mistakes.

#### Acceptance Criteria

1. WHEN a moderator executes /clearwarn with a user mention, THE Spam_Punishment_System SHALL remove the most recent offense from that user's history
2. WHEN a moderator executes /clearwarn, THE Spam_Punishment_System SHALL recalculate the user's current punishment status
3. WHEN a moderator executes /resetoffenses with a user mention, THE Spam_Punishment_System SHALL clear all offenses for that user
4. WHEN a moderator executes /resetoffenses, THE Spam_Punishment_System SHALL reset the user's timeout duration and ban status

### Requirement 8: Timeout Duration Calculation

**User Story:** As a system administrator, I want timeout durations to double with each offense after the third, so that punishments escalate appropriately.

#### Acceptance Criteria

1. WHEN calculating timeout for 3rd offense, THE Spam_Punishment_System SHALL set duration to 1 hour
2. WHEN calculating timeout for 4th offense, THE Spam_Punishment_System SHALL set duration to 2 hours
3. WHEN calculating timeout for 5th offense, THE Spam_Punishment_System SHALL set duration to 4 hours
4. FOR ALL offenses after the 5th, THE Spam_Punishment_System SHALL double the previous timeout duration
5. WHEN the calculated timeout duration reaches or exceeds 24 hours, THE Spam_Punishment_System SHALL apply a permanent ban instead
