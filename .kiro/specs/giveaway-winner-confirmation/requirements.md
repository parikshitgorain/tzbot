# Requirements Document: Giveaway Winner Confirmation

## Introduction

This document specifies the requirements for a giveaway winner confirmation system with automatic reroll functionality. When giveaway winners are selected, each winner must send any message in the server within 5 minutes to confirm their win. Winners who fail to respond are automatically rerolled, and new winners are selected with the same confirmation requirement.

## Glossary

- **Winner**: A user selected as a giveaway winner
- **Confirmation_System**: The system that manages winner confirmation and reroll logic
- **Pending_Winner**: A winner awaiting confirmation (status = PENDING)
- **Confirmed_Winner**: A winner who has sent a message (status = CONFIRMED)
- **Rerolled_Winner**: A winner who failed to respond in time (status = REROLLED)
- **Confirmation_Timer**: A 5-minute countdown timer for each winner
- **Reminder_Timer**: A timer that triggers at 3 minutes remaining (2 minutes elapsed)
- **Message_Listener**: The component that monitors messageCreate events
- **Reroll_Handler**: The component that selects new winners when original winners fail to respond
- **Giveaway_Config**: Server-specific configuration for giveaway commands and permissions

## Requirements

### Requirement 1: Winner Selection and Announcement

**User Story:** As a giveaway host, I want winners to be announced with clear confirmation instructions, so that winners know they must respond within the time limit.

#### Acceptance Criteria

1. WHEN a giveaway ends, THE Confirmation_System SHALL select the specified number of winners
2. WHEN winners are selected, THE Confirmation_System SHALL set each winner status to PENDING
3. WHEN winners are selected, THE Confirmation_System SHALL start a 5-minute Confirmation_Timer for each winner
4. WHEN winners are announced, THE Confirmation_System SHALL send an announcement message containing all winner mentions, confirmation instructions, and moderator reroll command
5. WHEN the announcement message is sent, THE Confirmation_System SHALL include the giveaway ID in the moderator reroll command format

### Requirement 2: Winner Confirmation Detection

**User Story:** As a giveaway winner, I want my confirmation to be detected when I send any message in the server, so that I can claim my prize without complex commands.

#### Acceptance Criteria

1. WHEN a message is created in the server, THE Message_Listener SHALL check if the message author is a Pending_Winner
2. WHEN a Pending_Winner sends a message, THE Confirmation_System SHALL change their status to CONFIRMED
3. WHEN a winner is confirmed, THE Confirmation_System SHALL stop their Confirmation_Timer
4. WHEN a winner is confirmed, THE Confirmation_System SHALL send a confirmation notification mentioning the winner
5. WHEN a winner is confirmed, THE Confirmation_System SHALL persist the confirmation status to the database

### Requirement 3: Reminder Notifications

**User Story:** As a giveaway winner, I want to receive a reminder if I haven't responded, so that I don't miss the deadline.

#### Acceptance Criteria

1. WHEN 2 minutes have elapsed since winner announcement, THE Reminder_Timer SHALL trigger for each Pending_Winner
2. WHEN the Reminder_Timer triggers, THE Confirmation_System SHALL send a reminder message mentioning the Pending_Winner
3. WHEN a reminder is sent, THE Confirmation_System SHALL indicate the remaining time (3 minutes)
4. WHEN a winner is confirmed before the reminder time, THE Confirmation_System SHALL not send a reminder for that winner

### Requirement 4: Automatic Reroll

**User Story:** As a giveaway host, I want winners who don't respond to be automatically rerolled, so that active participants receive prizes.

#### Acceptance Criteria

1. WHEN 5 minutes have elapsed since winner announcement, THE Confirmation_System SHALL check each winner's status
2. WHEN a winner status is PENDING after 5 minutes, THE Reroll_Handler SHALL change their status to REROLLED
3. WHEN a winner is rerolled, THE Reroll_Handler SHALL select a new winner from remaining eligible participants
4. WHEN a new winner is selected, THE Confirmation_System SHALL set the new winner status to PENDING
5. WHEN a new winner is selected, THE Confirmation_System SHALL start a new 5-minute Confirmation_Timer for the new winner
6. WHEN a new winner is selected, THE Confirmation_System SHALL send a reroll announcement message containing the original winner mention, new winner mention, confirmation instructions, and moderator reroll command
7. WHEN selecting a new winner, THE Reroll_Handler SHALL exclude all users who have already been selected (CONFIRMED, PENDING, or REROLLED)

### Requirement 5: Manual Moderator Reroll

**User Story:** As a moderator, I want to manually reroll a specific winner, so that I can handle special cases or disputes.

#### Acceptance Criteria

1. WHEN a moderator executes the reroll command with a giveaway ID and winner mention, THE Reroll_Handler SHALL validate the moderator has permission to use giveaway commands
2. WHEN a manual reroll is requested, THE Reroll_Handler SHALL change the specified winner status to REROLLED
3. WHEN a manual reroll is executed, THE Reroll_Handler SHALL stop the Confirmation_Timer for the rerolled winner
4. WHEN a manual reroll is executed, THE Reroll_Handler SHALL select a new winner from remaining eligible participants
5. WHEN a manual reroll completes, THE Confirmation_System SHALL send a reroll announcement message with the new winner

### Requirement 6: Giveaway Configuration

**User Story:** As a server administrator, I want to configure who can use giveaway commands, so that I can control access to giveaway management features.

#### Acceptance Criteria

1. WHEN a user executes the giveaway config command, THE Giveaway_Config SHALL display a configuration interface
2. WHEN the configuration interface is displayed, THE Giveaway_Config SHALL show current permission settings for giveaway commands
3. WHEN an administrator updates permission settings, THE Giveaway_Config SHALL validate the administrator has permission to modify configuration
4. WHEN permission settings are updated, THE Giveaway_Config SHALL persist the new settings to the database
5. WHEN a user attempts to use a giveaway command, THE Confirmation_System SHALL check if the user has the required permissions based on Giveaway_Config settings

### Requirement 7: Winner State Management

**User Story:** As a system, I want to maintain accurate winner states throughout the confirmation process, so that the system behaves correctly and prevents duplicate winners.

#### Acceptance Criteria

1. THE Confirmation_System SHALL maintain exactly three winner states: PENDING, CONFIRMED, and REROLLED
2. WHEN a winner is initially selected, THE Confirmation_System SHALL transition the winner from no state to PENDING
3. WHEN a Pending_Winner sends a message, THE Confirmation_System SHALL transition the winner from PENDING to CONFIRMED
4. WHEN a Pending_Winner fails to respond within 5 minutes, THE Confirmation_System SHALL transition the winner from PENDING to REROLLED
5. WHEN a winner is in CONFIRMED or REROLLED state, THE Confirmation_System SHALL not allow state transitions for that winner
6. WHEN querying eligible participants for reroll, THE Confirmation_System SHALL exclude all users with any winner state (PENDING, CONFIRMED, or REROLLED) for the current giveaway

### Requirement 8: Message Template Consistency

**User Story:** As a user, I want consistent and clear bot messages, so that I understand what actions to take.

#### Acceptance Criteria

1. WHEN sending a winner announcement, THE Confirmation_System SHALL include winner mentions, confirmation instructions, time limit, and moderator reroll command
2. WHEN sending a confirmation message, THE Confirmation_System SHALL mention the confirmed winner and include next steps
3. WHEN sending a reminder message, THE Confirmation_System SHALL mention the pending winner and include remaining time
4. WHEN sending a reroll announcement, THE Confirmation_System SHALL mention the original winner, new winner, confirmation instructions, and moderator reroll command
5. WHEN including a moderator reroll command in messages, THE Confirmation_System SHALL use the format: `/giveaway reroll giveaway_id:<id> winner:@user`

### Requirement 9: Timer Accuracy and Reliability

**User Story:** As a system, I want timers to execute accurately and reliably, so that winners receive fair treatment and the system behaves predictably.

#### Acceptance Criteria

1. WHEN a Confirmation_Timer is started, THE Confirmation_System SHALL schedule a callback to execute at exactly 5 minutes
2. WHEN a Reminder_Timer is started, THE Confirmation_System SHALL schedule a callback to execute at exactly 2 minutes
3. WHEN a timer is stopped due to winner confirmation, THE Confirmation_System SHALL cancel all pending callbacks for that winner
4. WHEN the system restarts, THE Confirmation_System SHALL restore all active timers from persisted state
5. WHEN a timer callback executes, THE Confirmation_System SHALL verify the winner state before taking action

### Requirement 10: Database Persistence

**User Story:** As a system, I want to persist all winner states and timer information, so that the system can recover from restarts without losing data.

#### Acceptance Criteria

1. WHEN a winner is selected, THE Confirmation_System SHALL persist the winner record with status PENDING and timer start time
2. WHEN a winner status changes, THE Confirmation_System SHALL update the winner record in the database
3. WHEN a timer is stopped, THE Confirmation_System SHALL update the winner record to indicate the timer is no longer active
4. WHEN the system starts, THE Confirmation_System SHALL load all active winner records from the database
5. WHEN loading winner records on startup, THE Confirmation_System SHALL recalculate elapsed time and resume timers for PENDING winners
