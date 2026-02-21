# Implementation Plan: Giveaway Winner Confirmation

## Overview

This implementation plan breaks down the giveaway winner confirmation feature into discrete coding tasks. The approach follows an incremental development strategy: database schema → core state management → timer system → message handling → integration → testing. Each task builds on previous work and includes validation through tests.

## Tasks

- [x] 1. Set up database schema and migrations
  - Create `giveaway_winners` table with all required columns and constraints
  - Create `giveaway_config` table for permission management
  - Add indexes for performance optimization
  - Write migration script to apply schema changes
  - _Requirements: 10.1, 10.2, 6.4_

- [x] 2. Implement State Manager component
  - [x] 2.1 Create WinnerRecord and GiveawayConfig TypeScript interfaces
    - Define enums for WinnerStatus (PENDING, CONFIRMED, REROLLED)
    - Define all data model interfaces matching database schema
    - _Requirements: 7.1, 10.1_
  
  - [x] 2.2 Implement StateManager class with database operations
    - Implement createWinner, updateStatus, getWinner, getWinners methods
    - Implement getAllPendingWinners and hasWinnerState methods
    - Use database transactions for atomic updates
    - Enforce state transition rules (PENDING → CONFIRMED or REROLLED only)
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 10.1, 10.2, 10.3_
  
  - [x] 2.3 Write property test for state transitions
    - **Property 2: Initial Winner State**
    - **Property 6: Confirmation State Transition**
    - **Property 12: Expiry State Transition**
    - **Property 20: Terminal State Immutability**
    - **Validates: Requirements 1.2, 2.2, 4.2, 7.2, 7.3, 7.4, 7.5**
  
  - [x] 2.4 Write property test for persistence round trip
    - **Property 9: Confirmation Persistence Round Trip**
    - **Property 23: Winner Record Persistence**
    - **Validates: Requirements 2.5, 10.1, 10.2**

- [x] 3. Implement Reroll Handler component
  - [x] 3.1 Create RerollHandler class
    - Implement getEligibleParticipants method to query and filter entries
    - Implement rerollWinner method with cryptographically secure random selection
    - Handle case where no eligible participants remain
    - _Requirements: 4.3, 4.7, 7.6_
  
  - [x] 3.2 Write property test for eligibility filtering
    - **Property 13: Reroll Winner Selection**
    - **Validates: Requirements 4.3, 4.7, 5.4, 7.6**
  
  - [x] 3.3 Write unit tests for edge cases
    - Test no eligible participants remaining
    - Test all participants already selected
    - Test random selection distribution

- [x] 4. Implement Timer Manager component
  - [x] 4.1 Create TimerManager class with timer scheduling
    - Implement startTimers method with reminder (2min) and expiry (5min) callbacks
    - Implement stopTimers method to cancel pending callbacks
    - Store timer references in Map keyed by `${giveawayId}:${userId}`
    - Implement hasActiveTimers method
    - _Requirements: 1.3, 2.3, 4.5, 9.1, 9.2, 9.3_
  
  - [x] 4.2 Implement timer restoration logic for system restart
    - Implement restoreTimers method
    - Calculate elapsed time: `now - startTime`
    - Handle expired timers (elapsed >= 5min): trigger expiry immediately
    - Handle partial elapsed (2min <= elapsed < 5min): skip reminder, schedule expiry
    - Handle early elapsed (elapsed < 2min): schedule both timers
    - _Requirements: 9.4, 10.4, 10.5_
  
  - [x] 4.3 Write property test for timer initialization
    - **Property 3: Timer Initialization**
    - **Validates: Requirements 1.3, 4.5**
  
  - [x] 4.4 Write property test for timer restoration
    - **Property 22: Timer Restoration on Restart**
    - **Validates: Requirements 9.4, 10.4, 10.5**
  
  - [x] 4.5 Write unit tests for timer edge cases
    - Test timer cancellation on confirmation
    - Test expired timer on restart
    - Test concurrent timer operations

- [x] 5. Checkpoint - Ensure core components work together
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Config Manager component
  - [x] 6.1 Create ConfigManager class
    - Implement getGiveawayPermissions and updateGiveawayPermissions methods
    - Implement canUseGiveawayCommands method with role and user checks
    - Default to administrator-only access when no config exists
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [x] 6.2 Write property test for config persistence
    - **Property 17: Config Persistence Round Trip**
    - **Validates: Requirements 6.4, 10.2**
  
  - [x] 6.3 Write property test for permission enforcement
    - **Property 18: Permission Enforcement**
    - **Validates: Requirements 6.5**

- [x] 7. Implement Message Listener component
  - [x] 7.1 Create MessageListener class
    - Implement initialize method to register Discord messageCreate event handler
    - Implement isPendingWinner method with database query
    - Implement getPendingGiveaways method
    - Add in-memory cache for pending winners (invalidate on state change)
    - Ignore bot messages
    - _Requirements: 2.1_
  
  - [x] 7.2 Write property test for message author check
    - **Property 5: Message Author Winner Check**
    - **Validates: Requirements 2.1**
  
  - [x] 7.3 Write unit tests for message handling
    - Test pending winner sends message → confirmation triggered
    - Test non-winner sends message → ignored
    - Test bot message → ignored

- [x] 8. Implement Confirmation System orchestrator
  - [x] 8.1 Create ConfirmationSystem class
    - Implement startConfirmation method to initialize winner confirmation process
    - Create winner records with PENDING status
    - Start timers for each winner
    - Send winner announcement message with all required elements
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 8.2 Implement confirmWinner method
    - Update winner status to CONFIRMED
    - Stop timers for confirmed winner
    - Send confirmation notification message
    - _Requirements: 2.2, 2.3, 2.4, 2.5_
  
  - [x] 8.3 Implement reminder callback handler
    - Check winner status before sending reminder
    - Send reminder message with remaining time
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [x] 8.4 Implement expiry callback handler
    - Check winner status before processing expiry
    - Update status to REROLLED
    - Call RerollHandler to select new winner
    - If new winner found: start new confirmation process
    - If no eligible participants: announce giveaway complete
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  
  - [x] 8.5 Implement manualReroll method
    - Validate moderator permissions
    - Update original winner status to REROLLED
    - Stop timers for rerolled winner
    - Select new winner and start confirmation
    - Send reroll announcement
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [x] 8.6 Implement restoreActiveConfirmations method for system startup
    - Load all pending winners from database
    - Restore timers with correct remaining time
    - Handle expired timers
    - _Requirements: 9.4, 10.4, 10.5_
  
  - [x] 8.7 Write property test for winner selection count
    - **Property 1: Winner Selection Count**
    - **Validates: Requirements 1.1**
  
  - [x] 8.8 Write property test for announcement message format
    - **Property 4: Winner Announcement Format**
    - **Validates: Requirements 1.4, 1.5, 8.1, 8.5**
  
  - [x] 8.9 Write property test for confirmation message
    - **Property 8: Confirmation Message Sent**
    - **Validates: Requirements 2.4, 8.2**
  
  - [x] 8.10 Write property test for reminder behavior
    - **Property 10: Reminder Message Content**
    - **Property 11: Confirmation Prevents Reminder**
    - **Validates: Requirements 3.2, 3.3, 3.4, 8.3**
  
  - [x] 8.11 Write property test for reroll announcement
    - **Property 14: Reroll Announcement Format**
    - **Validates: Requirements 4.6, 8.4**
  
  - [x] 8.12 Write property test for manual reroll permissions
    - **Property 15: Permission Validation for Reroll**
    - **Property 16: Manual Reroll State Transition**
    - **Validates: Requirements 5.1, 5.2**

- [x] 9. Checkpoint - Ensure confirmation system works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [~] 10. Implement Discord slash commands
  - [x] 10.1 Add /giveaway reroll command
    - Define command with giveaway_id and winner parameters
    - Call ConfirmationSystem.manualReroll method
    - Handle errors and send appropriate responses
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [x] 10.2 Add /giveaway config command
    - Define command to display and update giveaway permissions
    - Use Discord button/select menu components for configuration UI
    - Call ConfigManager methods
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 10.3 Write unit tests for command handlers
    - Test reroll command with valid inputs
    - Test reroll command with invalid inputs
    - Test config command permission checks
    - Test config command updates

- [~] 11. Integrate with existing giveaway system
  - [x] 11.1 Hook confirmation system into giveaway end event
    - Modify giveaway manager to call ConfirmationSystem.startConfirmation when giveaway ends
    - Pass selected winners to confirmation system
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [x] 11.2 Initialize confirmation system on bot startup
    - Call ConfirmationSystem.restoreActiveConfirmations in bot initialization
    - Initialize MessageListener with Discord client
    - _Requirements: 9.4, 10.4, 10.5_
  
  - [x] 11.3 Write integration tests
    - Test end-to-end flow: giveaway end → winner selection → confirmation → reroll
    - Test system restart with active confirmations
    - Test multiple concurrent giveaways with confirmations

- [~] 12. Implement error handling and logging
  - [x] 12.1 Add error handling for all failure scenarios
    - Handle database connection failures with retry logic
    - Handle Discord API failures with graceful degradation
    - Handle no eligible participants case
    - Handle concurrent confirmation and expiry with database transactions
    - _Requirements: All error scenarios from design_
  
  - [x] 12.2 Add comprehensive logging
    - Log all state transitions
    - Log timer events (start, stop, trigger)
    - Log errors with context
    - Log reroll events
  
  - [x] 12.3 Write unit tests for error scenarios
    - Test database failure handling
    - Test Discord API failure handling
    - Test concurrent operations
    - Test invalid inputs

- [x] 13. Final checkpoint - Ensure all tests pass and feature is complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript with Discord.js and PostgreSQL
