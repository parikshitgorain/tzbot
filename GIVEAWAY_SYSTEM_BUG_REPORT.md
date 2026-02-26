# Giveaway System - Comprehensive Bug Hunt Report

## Executive Summary

Conducted a thorough security and logic review of the entire giveaway system. Found **12 critical/high severity issues** and **8 medium/low severity issues** that could cause data corruption, race conditions, security vulnerabilities, and poor user experience.

---

## 🔴 CRITICAL ISSUES

### 1. **Race Condition in Entry Handling - Duplicate Entries Possible**
**Location:** `src/managers/giveaway.manager.ts:188-329` (handleEntryInteraction)

**Issue:** The duplicate entry check has a race condition window between Redis check and Redis write.

```typescript
// Check for duplicate
const alreadyEntered = await redisClient.exists(entryKey);
if (alreadyEntered) {
  return; // Already entered
}

// RACE CONDITION HERE - Multiple requests can pass the check simultaneously

// Record entry
await redisClient.set(entryKey, entryData, 86400);
```

**Impact:** Users can enter multiple times by clicking the button rapidly, violating the "one entry per user" rule.

**Fix:** Use Redis `SETNX` (SET if Not eXists) or Lua script for atomic check-and-set:
```typescript
// Atomic operation
const wasSet = await redisClient.set(entryKey, entryData, {
  NX: true, // Only set if not exists
  EX: 86400
});

if (!wasSet) {
  await this.queueResponse(interaction, '✅ Already entered!');
  return;
}
```

---

### 2. **Winner Selection Bias in Reroll Handler**
**Location:** `src/giveaway/reroll-handler.ts:95-145` (selectRandomUser)

**Issue:** The rejection sampling has a fallback that uses modulo, which can introduce bias:

```typescript
if (attempts >= maxAttempts) {
  // Fallback to simple modulo if rejection sampling takes too long
  randomIndex = randomIndex % userIds.length; // BIASED!
  break;
}
```

**Impact:** After 100 attempts, the selection becomes biased, favoring certain users.

**Fix:** Remove the fallback or increase maxAttempts significantly. The rejection sampling should always succeed for reasonable array sizes.

---

### 3. **No Transaction Protection for Winner State Updates**
**Location:** `src/giveaway/confirmation-system.ts:263-370` (manualReroll)

**Issue:** Multiple database operations without transaction protection:

```typescript
// Update status to REROLLED
await this.winnerStateRepo.updateStatus(giveawayId, userId, WinnerStatus.REROLLED);

// Select new winner
const newWinnerId = await this.rerollHandler.rerollWinner(giveawayId);

// Create new winner record
await this.winnerStateRepo.createWinner({...});

// Update giveaway winners array
await this.giveawayRepo.updateWinners(giveawayId, updatedWinners);
```

**Impact:** If any step fails, the system is left in an inconsistent state (old winner marked as rerolled but no new winner selected).

**Fix:** Wrap all operations in a database transaction.

---

### 4. **Timer Memory Leak on System Restart**
**Location:** `src/giveaway/timer-manager.ts:46-88` (startTimers)

**Issue:** When restoring timers on restart, if a timer has already expired, it's triggered with `setImmediate`, but the timer reference is still stored in the map:

```typescript
if (elapsed < this.EXPIRY_DELAY_MS) {
  timerRefs.expiryTimer = setTimeout(...);
} else {
  // Timer already expired - trigger immediately
  setImmediate(() => {
    this.handleExpiryCallback(giveawayId, userId);
  });
  // BUG: timerRefs.expiryTimer is undefined, but we still store timerRefs
}

this.timers.set(key, timerRefs); // Stores empty object
```

**Impact:** Memory leak - timer references accumulate without being cleaned up.

**Fix:** Don't store timer refs if both timers have expired:
```typescript
if (Object.keys(timerRefs).length > 0) {
  this.timers.set(key, timerRefs);
}
```

---

### 5. **Giveaway End Race Condition - Multiple Endings**
**Location:** `src/managers/giveaway.manager.ts:755-874` (endGiveaway)

**Issue:** No locking mechanism to prevent multiple simultaneous calls to `endGiveaway`:

```typescript
if (giveaway.status !== 'active') {
  logger.debug('Giveaway already ended');
  return; // Check happens, but...
}

// RACE CONDITION HERE - Multiple calls can pass the check

await this.giveawayRepository.updateStatus(giveawayId, GiveawayStatus.ENDED);
```

**Impact:** Multiple winner selections, duplicate announcements, data corruption.

**Fix:** Use database-level locking or Redis distributed lock:
```typescript
const lockKey = `giveaway:end:${giveawayId}`;
const lock = await redisClient.set(lockKey, '1', { NX: true, EX: 60 });
if (!lock) {
  logger.debug('Giveaway end already in progress');
  return;
}
```

---

### 6. **Entries Lost on Redis Failure During Giveaway**
**Location:** `src/managers/giveaway.manager.ts:188-329` (handleEntryInteraction)

**Issue:** If Redis fails during the giveaway, entries fall back to database, but the entry count in Redis becomes out of sync:

```typescript
} catch (error) {
  // If Redis fails, fallback to database
  await this.giveawayRepository.addEntry(giveawayId, interaction.user.id);
  const entries = await this.giveawayRepository.getEntries(giveawayId);
  void this.updateGiveawayMessage(giveaway, entries.length);
}
```

**Impact:** Entry count displayed on the giveaway message becomes incorrect, and some entries might be lost if Redis recovers.

**Fix:** Always write to database as well, or implement a proper sync mechanism.

---

## 🟠 HIGH SEVERITY ISSUES

### 7. **Confirmation Lock Timeout Too Short**
**Location:** `src/giveaway/confirmation-system.ts:103-150` (confirmWinner)

**Issue:** The confirmation lock is released after only 1 second:

```typescript
finally {
  setTimeout(() => {
    this.confirmationLocks.delete(lockKey);
  }, 1000); // Only 1 second!
}
```

**Impact:** If the confirmation process takes longer than 1 second (network delays, database slow), duplicate confirmations can occur.

**Fix:** Increase timeout to 5-10 seconds or release lock immediately after status update.

---

### 8. **No Validation for Giveaway ID Format**
**Location:** `src/commands/giveaway.commands.ts` (all subcommands)

**Issue:** Giveaway IDs are accepted as strings without validation:

```typescript
const giveawayId = interaction.options.getString('giveaway_id', true);
// No validation - could be SQL injection attempt or malformed ID
```

**Impact:** Potential SQL injection, error messages exposing internal structure.

**Fix:** Validate giveaway ID format (should match `GW-XX-XXXXX` pattern).

---

### 9. **Winner Confirmation Can Be Triggered Multiple Times**
**Location:** `src/giveaway/message-listener.ts:43-78` (handleMessage)

**Issue:** A user can send multiple messages rapidly, triggering multiple confirmation attempts:

```typescript
for (const giveawayId of giveawayIds) {
  await this.confirmationCallback(giveawayId, userId);
  // If user sends another message before this completes, duplicate call
}
```

**Impact:** Race condition in confirmation, potential duplicate processing.

**Fix:** Add per-user rate limiting or check if confirmation is already in progress before calling callback.

---

### 10. **Reroll Handler Doesn't Check for Active Giveaway**
**Location:** `src/giveaway/reroll-handler.ts:26-60` (getEligibleParticipants)

**Issue:** The reroll handler doesn't verify the giveaway status:

```typescript
const giveaway = await this.giveawayRepository.get(giveawayId);
if (!giveaway) {
  throw new Error(`Giveaway not found: ${giveawayId}`);
}
// No check for giveaway.status === 'ended'
```

**Impact:** Could potentially reroll winners from active or cancelled giveaways.

**Fix:** Add status validation.

---

## 🟡 MEDIUM SEVERITY ISSUES

### 11. **Entry Count Mismatch Between Redis and Database**
**Location:** `src/managers/giveaway.manager.ts:755-874` (endGiveaway)

**Issue:** When giveaway ends, entries are read from Redis, but if some entries were written to database as fallback, they're not included:

```typescript
const cachedEntries = await redisClient.get(entriesListKey);
if (cachedEntries) {
  entries = parsedEntries.map(...);
} else {
  entries = await this.giveawayRepository.getEntries(giveawayId);
}
```

**Impact:** Some users who entered might not be included in winner selection.

**Fix:** Always merge Redis and database entries, removing duplicates.

---

### 12. **No Cleanup of Expired Giveaway Data**
**Location:** Multiple locations

**Issue:** No mechanism to clean up old giveaway data from database.

**Impact:** Database grows indefinitely, performance degrades over time.

**Fix:** Implement a cleanup job to archive or delete giveaways older than X days.

---

### 13. **Response Queue Can Grow Unbounded**
**Location:** `src/managers/giveaway.manager.ts:330-385` (queueResponse, processResponseQueue)

**Issue:** The response queue has no size limit:

```typescript
private responseQueue: Array<{
  interaction: ButtonInteraction;
  content: string;
}> = [];
```

**Impact:** Memory exhaustion if many users enter simultaneously.

**Fix:** Add queue size limit and reject entries if queue is full.

---

### 14. **Countdown Update Can Fail Silently**
**Location:** `src/managers/giveaway.manager.ts:694-754` (updateCountdown)

**Issue:** Countdown updates are fire-and-forget with no error handling:

```typescript
private async updateCountdown(...) {
  try {
    // Update message
  } catch (error) {
    // Error logged but countdown continues
  }
}
```

**Impact:** Users see stale countdown information.

**Fix:** Implement retry logic or stop countdown on repeated failures.

---

### 15. **Winner State Repository Has No Unique Constraint**
**Location:** `src/core/database/schema/004_giveaway_winner_confirmation.sql`

**Issue:** The `giveaway_winners` table doesn't have a unique constraint on `(giveaway_id, user_id)`:

```sql
CREATE TABLE IF NOT EXISTS giveaway_winners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  user_id VARCHAR(20) NOT NULL,
  -- Missing: UNIQUE(giveaway_id, user_id)
```

**Impact:** Duplicate winner records can be created.

**Fix:** Add unique constraint in migration.

---

## 🟢 LOW SEVERITY ISSUES

### 16. **Hardcoded Timer Delays**
**Location:** `src/giveaway/timer-manager.ts:30-32`

**Issue:** Timer delays are hardcoded:

```typescript
private readonly REMINDER_DELAY_MS = 2 * 60 * 1000; // 2 minutes
private readonly EXPIRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes
```

**Impact:** Not configurable per giveaway or per server.

**Fix:** Make configurable via environment variables or database.

---

### 17. **No Rate Limiting on Giveaway Creation**
**Location:** `src/commands/giveaway.commands.ts:280-400` (handleCreateGiveaway)

**Issue:** No rate limiting on giveaway creation.

**Impact:** Spam/abuse possible.

**Fix:** Implement rate limiting (e.g., max 5 giveaways per hour per user).

---

### 18. **Message Listener Cache Never Refreshed**
**Location:** `src/giveaway/message-listener.ts:107-120` (refreshCache)

**Issue:** The cache refresh method is never called:

```typescript
async refreshCache(guildId: string): Promise<void> {
  // This method is defined but never called
}
```

**Impact:** Cache can become stale, causing missed confirmations.

**Fix:** Call refreshCache periodically or on winner selection.

---

### 19. **No Logging for Critical State Transitions**
**Location:** `src/core/database/repositories/WinnerStateRepository.ts:40-110`

**Issue:** State transitions in winner status are not logged:

```typescript
await client.query(updateQuery, [newStatus, giveawayId, userId]);
// No logging of state transition
```

**Impact:** Difficult to debug issues or audit winner selection.

**Fix:** Add detailed logging for all state transitions.

---

### 20. **Giveaway ID Generation Not Collision-Resistant**
**Location:** `src/managers/giveaway.manager.ts:1281-1293` (generateGiveawayId)

**Issue:** The ID generation uses only 5 random digits:

```typescript
private generateGiveawayId(): string {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `GW-${timestamp.slice(0, 2)}-${timestamp.slice(2)}${random}`;
}
```

**Impact:** Collision possible if multiple giveaways created in same millisecond.

**Fix:** Use crypto.randomBytes for the random portion or add collision detection.

---

## Priority Recommendations

### Immediate (Fix Today):
1. **Issue #1** - Race condition in entry handling (data corruption)
2. **Issue #3** - No transaction protection (data corruption)
3. **Issue #5** - Giveaway end race condition (duplicate winners)
4. **Issue #15** - Missing unique constraint (duplicate winners)

### High Priority (Fix This Week):
5. **Issue #2** - Winner selection bias
6. **Issue #4** - Timer memory leak
7. **Issue #6** - Entries lost on Redis failure
8. **Issue #7** - Confirmation lock timeout
9. **Issue #9** - Multiple confirmation triggers

### Medium Priority (Fix This Month):
10. **Issue #8** - No giveaway ID validation
11. **Issue #10** - Reroll doesn't check status
12. **Issue #11** - Entry count mismatch
13. **Issue #13** - Unbounded response queue

### Low Priority (Technical Debt):
14. All remaining issues

---

## Testing Recommendations

1. **Load Testing**: Simulate 100+ users entering simultaneously
2. **Race Condition Testing**: Use concurrent requests to test all critical sections
3. **Failure Testing**: Test Redis failures, database failures, Discord API failures
4. **Recovery Testing**: Test system restart with active giveaways and pending winners
5. **Edge Case Testing**: Test with 0 entries, 1 entry, max entries, expired giveaways

---

## Security Audit Summary

- **SQL Injection Risk**: Low (using parameterized queries)
- **Race Conditions**: High (multiple critical sections)
- **Data Corruption Risk**: High (no transactions)
- **Memory Leaks**: Medium (timer cleanup issues)
- **DoS Vulnerability**: Medium (no rate limiting)

---

## Conclusion

The giveaway system has solid foundations but needs critical fixes for production use. The most severe issues are race conditions and lack of transaction protection, which can lead to data corruption and unfair winner selection.

**Estimated Fix Time**: 2-3 days for critical issues, 1 week for all high-priority issues.
