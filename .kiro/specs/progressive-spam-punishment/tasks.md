# Implementation Tasks

## Phase 1: Database Schema and Repository

### Task 1: Create Database Migration for Offense Tables
**Validates: Requirements 4.1-4.6**

- [x] 1.1 Create migration file `src/core/database/schema/002_offense_tracking.sql`
  - [x] 1.1.1 Create `offense_records` table with columns: user_id (TEXT PK), total_offenses (INTEGER), last_offense_timestamp (TIMESTAMP), current_timeout_duration (INTEGER), is_banned (BOOLEAN), created_at (TIMESTAMP), updated_at (TIMESTAMP)
  - [x] 1.1.2 Create `offense_entries` table with columns: id (SERIAL PK), user_id (TEXT FK), timestamp (TIMESTAMP), reason (TEXT), punishment_applied (TEXT), moderator_id (TEXT), timeout_duration (INTEGER)
  - [x] 1.1.3 Add indexes: idx_offense_records_last_offense, idx_offense_entries_user_id
  - [x] 1.1.4 Add CASCADE DELETE constraint on offense_entries FK
  - [x] 1.1.5 Create down migration file `src/core/database/schema/002_offense_tracking_down.sql`
- [x] 1.2 Test migration runs successfully with `npm run migrate`
- [x] 1.3 Verify tables created with correct schema using database client

### Task 2: Implement OffenseRepository
**Validates: Requirements 4.1-4.6**

- [x] 2.1 Create `src/core/database/repositories/OffenseRepository.ts`
  - [x] 2.1.1 Implement `getOffenseRecord(userId)` method - returns OffenseRecord with joined offense_entries
  - [x] 2.1.2 Implement `saveOffenseRecord(record)` method with upsert logic (INSERT ON CONFLICT UPDATE)
  - [x] 2.1.3 Implement `addOffenseEntry(userId, entry)` method - adds to offense_entries table
  - [x] 2.1.4 Implement `getAllActiveOffenses()` method - returns all users with offenses
  - [x] 2.1.5 Implement `removeLastOffense(userId)` method - deletes most recent offense_entry
  - [x] 2.1.6 Implement `resetOffenses(userId)` method - deletes offense_record (cascades to entries)
  - [x] 2.1.7 Add transaction support using pool.query with BEGIN/COMMIT/ROLLBACK
- [x] 2.2 Create unit tests in `tests/unit/core/database/repositories/OffenseRepository.test.ts`
  - [x] 2.2.1 Test getOffenseRecord returns null for non-existent user
  - [x] 2.2.2 Test saveOffenseRecord creates new record
  - [x] 2.2.3 Test saveOffenseRecord updates existing record (upsert)
  - [x] 2.2.4 Test addOffenseEntry adds to warning_history
  - [x] 2.2.5 Test removeLastOffense deletes most recent entry
  - [x] 2.2.6 Test resetOffenses cascade deletes all entries
  - [x] 2.2.7 Test transaction rollback on error
- [x] 2.3 Export OffenseRepository from `src/core/database/repositories/index.ts`

## Phase 2: Core Business Logic

### Task 3: Implement PunishmentCalculator
**Validates: Requirements 1.1-1.7, 8.1-8.5**

- [x] 3.1 Create `src/moderation/punishment-calculator.ts`
  - [x] 3.1.1 Implement `calculatePunishment(offenseCount, previousTimeout)` method
  - [x] 3.1.2 Implement punishment ladder: offense 1-2 = WARNING, 3 = 1h, 4 = 2h, 5 = 4h, 6 = 8h, 7 = 16h
  - [x] 3.1.3 Implement ban threshold check: if calculated timeout >= 24h, return PERMANENT_BAN
  - [x] 3.1.4 Implement `shouldResetOffenses(lastOffenseTimestamp)` method - checks if 30+ days passed
  - [x] 3.1.5 Add `getNextPunishmentDescription(offenseCount)` helper - returns human-readable next punishment
  - [x] 3.1.6 Export PunishmentType enum and Punishment interface
- [x] 3.2 Create unit tests in `tests/unit/moderation/punishment-calculator.test.ts`
  - [x] 3.2.1 Test offense 1 returns WARNING with no duration
  - [x] 3.2.2 Test offense 2 returns WARNING with no duration
  - [x] 3.2.3 Test offense 3 returns TIMEOUT with 1h duration
  - [x] 3.2.4 Test offense 4 returns TIMEOUT with 2h duration
  - [x] 3.2.5 Test offense 5 returns TIMEOUT with 4h duration
  - [x] 3.2.6 Test offense 6 returns TIMEOUT with 8h duration
  - [x] 3.2.7 Test offense 7 returns TIMEOUT with 16h duration
  - [x] 3.2.8 Test offense 8 returns PERMANENT_BAN (would be 32h)
  - [x] 3.2.9 Test shouldResetOffenses returns true after 30 days
  - [x] 3.2.10 Test shouldResetOffenses returns false before 30 days

### Task 4: Implement OffenseManager
**Validates: Requirements 1.1-1.7, 2.1-2.3, 7.1-7.4**

- [x] 4.1 Create `src/moderation/offense-manager.ts`
  - [x] 4.1.1 Implement constructor with OffenseRepository, PunishmentCalculator, NotificationService dependencies
  - [x] 4.1.2 Implement `processOffense(userId, reason, moderatorId, channelId)` method
  - [x] 4.1.3 Add 30-day reset check: if shouldResetOffenses, call resetOffenses before processing
  - [x] 4.1.4 Fetch current offense record, calculate new punishment, update record, add offense entry
  - [x] 4.1.5 Wrap processOffense in database transaction for atomicity
  - [x] 4.1.6 Return Punishment object for caller to apply Discord timeout/ban
  - [x] 4.1.7 Implement `getOffenseHistory(userId)` method - returns OffenseRecord
  - [x] 4.1.8 Implement `clearLastOffense(userId)` - removes last entry, recalculates current_timeout_duration
  - [x] 4.1.9 Implement `resetAllOffenses(userId)` - calls repository.resetOffenses
- [x] 4.2 Create unit tests in `tests/unit/moderation/offense-manager.test.ts`
  - [x] 4.2.1 Test processOffense creates new record for first offense
  - [x] 4.2.2 Test processOffense updates existing record
  - [x] 4.2.3 Test processOffense triggers 30-day reset when applicable
  - [x] 4.2.4 Test processOffense returns correct punishment
  - [x] 4.2.5 Test clearLastOffense recalculates timeout duration
  - [x] 4.2.6 Test resetAllOffenses clears all data
  - [x] 4.2.7 Test transaction rollback on database error

### Task 5: Implement NotificationService for Punishments
**Validates: Requirements 3.1-3.4**

- [x] 5.1 Extend `src/managers/notification.manager.ts`
  - [x] 5.1.1 Add `sendPunishmentNotification(userId, channelId, punishment, reason, offenseCount)` method
  - [x] 5.1.2 Implement DM notification: include reason, current offense count, punishment applied, next punishment
  - [x] 5.1.3 Implement ephemeral message: use interaction.followUp({ ephemeral: true }) or channel.send with flags
  - [x] 5.1.4 Implement mod-log channel notification: include user mention, action, timestamp, moderator
  - [x] 5.1.5 Wrap each notification in try-catch, log failures but continue
  - [x] 5.1.6 Return NotificationResult with success flags and failure messages
  - [x] 5.1.7 Add getModLogChannelId() method to fetch from config
- [x] 5.2 Update unit tests in `tests/unit/managers/notification.manager.test.ts`
  - [x] 5.2.1 Test sendPunishmentNotification calls all three notification methods
  - [x] 5.2.2 Test DM failure doesn't prevent ephemeral/mod-log
  - [x] 5.2.3 Test ephemeral failure doesn't prevent DM/mod-log
  - [x] 5.2.4 Test mod-log failure doesn't prevent DM/ephemeral
  - [x] 5.2.5 Test NotificationResult tracks all failures
  - [x] 5.2.6 Test notification content formatting

## Phase 3: Discord Integration

### Task 6: Update Type Definitions
- [x] 6.1 Update `src/types/models.ts`
  - [x] 6.1.1 Add `OffenseRecord` interface
  - [x] 6.1.2 Add `OffenseEntry` interface
  - [x] 6.1.3 Update `PunishmentLevel` enum (remove TIMEOUT_5M, add TIMEOUT_2H, TIMEOUT_4H, TIMEOUT_8H, TIMEOUT_16H)
  - [x] 6.1.4 Add `PunishmentType` enum
- [x] 6.2 Update `src/types/interfaces.ts`
  - [x] 6.2.1 Add `Punishment` interface
  - [x] 6.2.2 Add `NotificationResult` interface

### Task 7: Implement Moderator Commands
**Validates: Requirements 5.1-5.4, 6.1-6.3, 7.1-7.4**

- [x] 7.1 Update `src/commands/moderation.commands.ts`
  - [x] 7.1.1 Implement `/warn @user reason` - calls offenseManager.processOffense, applies punishment
  - [x] 7.1.2 Implement `/warnlist @user` - calls offenseManager.getOffenseHistory, formats as embed
  - [x] 7.1.3 Implement `/warnall` - calls offenseRepository.getAllActiveOffenses, formats as paginated list
  - [x] 7.1.4 Implement `/clearwarn @user` - calls offenseManager.clearLastOffense, confirms to moderator
  - [x] 7.1.5 Implement `/resetoffenses @user` - calls offenseManager.resetAllOffenses, confirms to moderator
  - [x] 7.1.6 Implement `/modlog @user` - displays offense_entries for user as formatted list
  - [x] 7.1.7 Add permission checks: require MODERATE_MEMBERS or ADMINISTRATOR permission
  - [x] 7.1.8 Add error handling for missing user, database errors
- [x] 7.2 Register commands in `src/managers/command.manager.ts`
  - [x] 7.2.1 Add SlashCommandBuilder definitions for all 6 commands
  - [x] 7.2.2 Register with Discord API on bot startup
- [x] 7.3 Update unit tests in `tests/unit/commands/moderation.commands.test.ts`
  - [x] 7.3.1 Test /warn command flow
  - [x] 7.3.2 Test /warnlist displays offense history
  - [x] 7.3.3 Test /warnall lists all users
  - [x] 7.3.4 Test /clearwarn removes last offense
  - [x] 7.3.5 Test /resetoffenses clears all
  - [x] 7.3.6 Test /modlog displays entries
  - [x] 7.3.7 Test permission checks reject non-moderators

### Task 8: Integrate with Spam Detection
**Validates: Requirements 1.1-1.7, 3.1-3.4**

- [x] 8.1 Update `src/index.ts` spam detection handler (around line 500-700)
  - [x] 8.1.1 Initialize OffenseManager with dependencies (offenseRepo, punishmentCalc, notificationService)
  - [x] 8.1.2 Replace violationTracker.recordViolation with offenseManager.processOffense
  - [x] 8.1.3 Get returned Punishment object from processOffense
  - [x] 8.1.4 Apply timeout: if punishment.type === TIMEOUT, call member.timeout(duration * 3600000)
  - [x] 8.1.5 Apply ban: if punishment.type === PERMANENT_BAN, call member.ban({ reason })
  - [x] 8.1.6 Trigger notifications: call notificationService.sendPunishmentNotification
  - [x] 8.1.7 Log notification failures but don't block punishment
  - [x] 8.1.8 Keep existing spam message deletion logic
- [x] 8.2 Remove old violation-tracker.ts imports and usage
  - [x] 8.2.1 Remove ViolationTracker import
  - [x] 8.2.2 Remove violationTracker initialization
  - [x] 8.2.3 Update any other files importing ViolationTracker

## Phase 4: Property-Based Testing

### Task 9: Write Property-Based Tests for PunishmentCalculator
- [x] 9.1 Create `tests/property/punishment-calculator.property.test.ts`
  - [x] 9.1.1 Property 1: Punishment severity is monotonically increasing
  - [x] 9.1.2 Property 2: Timeout duration doubles correctly
  - [x] 9.1.3 Property 7: First two offenses are always warnings
  - [x] 9.1.4 Property 8: Third offense is 1-hour timeout
  - [x] 9.1.5 Property 4: Ban applied when timeout >= 24 hours
- [x] 9.2 Install fast-check library if not present
- [x] 9.3 Run property tests and verify all pass

### Task 10: Write Property-Based Tests for OffenseManager
- [x] 10.1 Create `tests/property/offense-manager.property.test.ts`
  - [x] 10.1.1 Property 3: 30-day reset clears offense history
  - [x] 10.1.2 Property 10: Clearing last offense recalculates status
  - [x] 10.1.3 Property 9: Offense history entries are immutable
- [x] 10.2 Run property tests and verify all pass

### Task 11: Write Property-Based Tests for OffenseRepository
- [x] 11.1 Create `tests/property/offense-repository.property.test.ts`
  - [x] 11.1.1 Property 5: Offense data persists correctly
- [x] 11.2 Run property tests and verify all pass

### Task 12: Write Property-Based Tests for NotificationService
- [x] 12.1 Create `tests/property/notification-service.property.test.ts`
  - [x] 12.1.1 Property 6: Triple notification always attempted
- [x] 12.2 Run property tests and verify all pass

## Phase 5: Integration and Cleanup

### Task 13: Integration Testing
- [x] 13.1 Create `tests/integration/offense-system.integration.test.ts`
  - [x] 13.1.1 Test full offense flow from spam detection to punishment
  - [x] 13.1.2 Test 30-day reset integration
  - [x] 13.1.3 Test moderator commands end-to-end
  - [x] 13.1.4 Test notification delivery integration
- [x] 13.2 Run integration tests and fix any issues

### Task 14: Remove Old Violation System
- [x] 14.1 Delete `src/moderation/violation-tracker.ts`
- [x] 14.2 Delete `tests/unit/moderation/violation-tracker.test.ts`
- [x] 14.3 Remove ViolationRepository methods that are no longer needed
- [x] 14.4 Update any remaining references to old system

### Task 15: Documentation and Configuration
- [x] 15.1 Update `docs/MODERATOR_QUICK_REFERENCE.md` with new commands
- [x] 15.2 Update `docs/COMMAND_REFERENCE.md` with command details
- [x] 15.3 Add mod-log channel configuration to `.env.example`
- [x] 15.4 Update `docs/DATABASE_SETUP.md` with new migration
- [x] 15.5 Create `src/moderation/README.md` documenting the offense system

### Task 16: Final Testing and Validation
- [x] 16.1 Run all unit tests and ensure they pass
- [x] 16.2 Run all property-based tests and ensure they pass
- [x] 16.3 Run all integration tests and ensure they pass
- [x] 16.4 Test manually in Discord with real spam scenarios
- [x] 16.5 Verify all 10 correctness properties hold
- [x] 16.6 Run TypeScript compilation and fix any errors
- [x] 16.7 Verify bot restarts preserve offense data

## Notes

- All tasks should be completed in order within each phase
- Property-based tests must pass before moving to next phase
- Database transactions are critical for concurrent offense handling
- Notification failures must not block punishment application
- All moderator commands require proper permission checks
