# Chat Activity Tracking System

## Overview

The Chat Activity Tracking system is responsible for monitoring user chat activity and determining eligibility for chat rain rewards. It tracks message timestamps, identifies active chatters, and enforces cooldown periods to ensure fair reward distribution.

## Key Concepts

### Active Chatter
A user is considered an "active chatter" if they have sent **at least 3 messages in the last 10 minutes**. This threshold ensures that only genuinely engaged users are eligible for chat rain rewards.

### Chat Rain Cooldown
Users who have won a chat rain reward must wait **60 minutes** before becoming eligible again. This prevents the same users from winning repeatedly and ensures fair distribution.

### Minimum Chat Rain Delay
Chat rain events must be separated by **at least 5 minutes** to prevent spam and maintain reward value.

## Database Schema

### chat_activity Table
Tracks individual chat messages for activity analysis.

```sql
CREATE TABLE chat_activity (
  user_id VARCHAR(20) NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, timestamp)
);
```

**Fields:**
- `user_id`: Discord user ID
- `timestamp`: When the message was sent

**Indexes:**
- Primary key on `(user_id, timestamp)` for efficient lookups
- Index on `timestamp DESC` for time-based queries

### chat_rain_winners Table
Tracks chat rain winners for cooldown enforcement.

```sql
CREATE TABLE chat_rain_winners (
  user_id VARCHAR(20) NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reward_type VARCHAR(50) NOT NULL,
  reward_value TEXT,
  PRIMARY KEY (user_id, timestamp)
);
```

**Fields:**
- `user_id`: Discord user ID of the winner
- `timestamp`: When the reward was given
- `reward_type`: Type of reward (e.g., 'role', 'currency', 'announcement')
- `reward_value`: Optional value (e.g., role name, amount)

**Indexes:**
- Primary key on `(user_id, timestamp)` for efficient lookups
- Index on `(user_id, timestamp DESC)` for recent win checks

## ChatActivityRepository API

### Recording Activity

#### `record(userId: string, timestamp: Date): Promise<void>`
Records a chat activity event for a user.

**Usage:**
```typescript
await chatActivityRepo.record('123456789', new Date());
```

**Notes:**
- Duplicate records (same user + timestamp) are ignored
- Should be called for every message in monitored channels

### Querying Active Chatters

#### `getActiveChatters(since: Date): Promise<string[]>`
Returns all users who have sent at least one message since the given time.

**Usage:**
```typescript
const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
const activeChatters = await chatActivityRepo.getActiveChatters(tenMinutesAgo);
```

**Returns:** Array of distinct user IDs

#### `getMessageCount(userId: string, since: Date): Promise<number>`
Returns the number of messages a user has sent since the given time.

**Usage:**
```typescript
const count = await chatActivityRepo.getMessageCount('123456789', tenMinutesAgo);
```

**Returns:** Message count (0 if user has no messages)

#### `getQualifiedChatters(since: Date, minMessages: number = 3): Promise<string[]>`
Returns users who have sent at least `minMessages` messages since the given time.

**Usage:**
```typescript
// Get users with 3+ messages in last 10 minutes
const qualified = await chatActivityRepo.getQualifiedChatters(tenMinutesAgo, 3);
```

**Returns:** Array of user IDs meeting the threshold

**Default:** `minMessages = 3` (matches requirement 11.1)

### Managing Chat Rain Winners

#### `recordWinner(userId: string, timestamp: Date, rewardType: string, rewardValue?: string): Promise<void>`
Records a chat rain winner.

**Usage:**
```typescript
await chatActivityRepo.recordWinner(
  '123456789',
  new Date(),
  'role',
  'VIP'
);
```

**Parameters:**
- `userId`: Discord user ID
- `timestamp`: When the reward was given
- `rewardType`: Type of reward
- `rewardValue`: Optional reward details

#### `getRecentWinners(since: Date): Promise<string[]>`
Returns users who have won chat rain since the given time.

**Usage:**
```typescript
const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);
const recentWinners = await chatActivityRepo.getRecentWinners(sixtyMinutesAgo);
```

**Returns:** Array of distinct user IDs

**Use Case:** Exclude these users from the next chat rain draw

#### `hasRecentWin(userId: string, since: Date): Promise<boolean>`
Checks if a user has won chat rain since the given time.

**Usage:**
```typescript
const hasWon = await chatActivityRepo.hasRecentWin('123456789', sixtyMinutesAgo);
if (hasWon) {
  console.log('User is in cooldown period');
}
```

**Returns:** `true` if user has won recently, `false` otherwise

#### `getLastChatRainTime(): Promise<Date | null>`
Returns the timestamp of the most recent chat rain event.

**Usage:**
```typescript
const lastTime = await chatActivityRepo.getLastChatRainTime();
if (lastTime) {
  const minutesSince = (Date.now() - lastTime.getTime()) / (60 * 1000);
  if (minutesSince < 5) {
    console.log('Too soon for another chat rain');
  }
}
```

**Returns:** Date of last chat rain, or `null` if none has occurred

**Use Case:** Enforce minimum 5-minute delay between chat rain events

### Maintenance

#### `cleanupOldActivity(olderThan: Date): Promise<number>`
Deletes chat activity records older than the specified date.

**Usage:**
```typescript
// Clean up records older than 1 hour
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
const deletedCount = await chatActivityRepo.cleanupOldActivity(oneHourAgo);
```

**Returns:** Number of records deleted

**Recommendation:** Run this periodically (e.g., every hour) to prevent table bloat. Keep records for at least 10 minutes to support active chatter queries.

## Complete Eligibility Check

To determine which users are eligible for chat rain, combine multiple checks:

```typescript
async function getEligibleChatRainUsers(
  chatActivityRepo: ChatActivityRepository,
  violationRepo: ViolationRepository
): Promise<string[]> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // 1. Get users with 3+ messages in last 10 minutes
  const qualifiedChatters = await chatActivityRepo.getQualifiedChatters(
    tenMinutesAgo,
    3
  );

  // 2. Get users who won in last 60 minutes (cooldown)
  const recentWinners = await chatActivityRepo.getRecentWinners(sixtyMinutesAgo);
  const recentWinnersSet = new Set(recentWinners);

  // 3. Get users flagged by spam filter in last 24 hours
  const spamFlaggedUsers = await violationRepo.getUsersWithViolations(
    twentyFourHoursAgo,
    'spam'
  );
  const spamFlaggedSet = new Set(spamFlaggedUsers);

  // 4. Filter out ineligible users
  const eligibleUsers = qualifiedChatters.filter(
    userId => !recentWinnersSet.has(userId) && !spamFlaggedSet.has(userId)
  );

  return eligibleUsers;
}
```

## Requirements Validation

This implementation satisfies the following requirements:

### Requirement 11.1: Active Chatter Tracking
> THE TZBOT SHALL track Active_Chatters who have sent at least 3 messages in the last 10 minutes

**Implementation:**
- `getQualifiedChatters(tenMinutesAgo, 3)` returns users with 3+ messages
- Default threshold is 3 messages
- Time window is configurable (typically 10 minutes)

### Requirement 11.4: Spam Filter Exclusion
> THE TZBOT SHALL exclude users who have been flagged by Spam_Filter in the last 24 hours from Chat_Rain eligibility

**Implementation:**
- Requires integration with `ViolationRepository`
- Check for spam violations in last 24 hours
- Exclude flagged users from eligibility list

### Requirement 11.8: Chat Rain Cooldown
> THE TZBOT SHALL exclude users who have received a Chat_Rain reward in the last 60 minutes from subsequent draws

**Implementation:**
- `getRecentWinners(sixtyMinutesAgo)` returns users in cooldown
- `hasRecentWin(userId, sixtyMinutesAgo)` checks individual cooldown
- Exclude recent winners from eligibility list

### Requirement 11.5: Minimum Delay Between Events
> THE TZBOT SHALL enforce a minimum 5-minute delay between Chat_Rain events

**Implementation:**
- `getLastChatRainTime()` returns timestamp of last event
- Calculate time since last event
- Prevent new event if less than 5 minutes have passed

## Performance Considerations

### Indexes
All queries are optimized with appropriate indexes:
- `chat_activity(timestamp)` for time-based queries
- `chat_activity(user_id, timestamp)` for user-specific queries
- `chat_rain_winners(user_id, timestamp)` for cooldown checks

### Query Efficiency
- `getQualifiedChatters` uses `GROUP BY` with `HAVING COUNT(*)` for efficient aggregation
- `getRecentWinners` uses `DISTINCT` to avoid duplicates
- All queries use parameterized statements to prevent SQL injection

### Cleanup Strategy
Regular cleanup prevents table bloat:
- Run `cleanupOldActivity` every hour
- Keep records for at least 10 minutes (active chatter window)
- Consider keeping records for 1-2 hours for debugging

### Scalability
For high-traffic servers (1000+ messages/minute):
- Consider partitioning `chat_activity` by timestamp
- Use connection pooling (already implemented)
- Monitor query performance with `EXPLAIN ANALYZE`
- Consider caching qualified chatters for 30-60 seconds

## Testing

Comprehensive unit tests are provided in:
- `tests/unit/core/database/repositories/ChatActivityRepository.test.ts`

Tests cover:
- Recording activity (single, duplicate, multiple)
- Querying active chatters (time windows, distinct users)
- Message counting (per user, time windows)
- Qualified chatters (thresholds, edge cases)
- Winner recording (with/without values, multiple wins)
- Recent winner queries (time windows, distinct users)
- Cooldown checks (recent wins, no wins)
- Last chat rain time (most recent, none)
- Cleanup (old records, boundary conditions)
- Edge cases (very old timestamps, future timestamps, boundaries)

## Example Usage

See `chat-activity.example.ts` for complete examples including:
1. Recording chat activity
2. Getting active chatters
3. Getting message counts
4. Getting qualified chatters
5. Recording winners
6. Checking cooldowns
7. Getting recent winners
8. Getting last chat rain time
9. Cleaning up old records
10. Complete eligibility check

## Integration Points

### Event Manager
The Event Manager should call `record()` for every message in monitored channels:

```typescript
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!isMonitoredChannel(message.channelId)) return;
  
  await chatActivityRepo.record(message.author.id, new Date());
});
```

### Chat Rain Manager
The Chat Rain Manager should use this repository to:
1. Check if enough time has passed since last event
2. Get eligible users (qualified + not in cooldown + not spam-flagged)
3. Record winners after distribution

### Scheduled Tasks
Set up periodic cleanup:

```typescript
// Run every hour
setInterval(async () => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const deleted = await chatActivityRepo.cleanupOldActivity(oneHourAgo);
  logger.info(`Cleaned up ${deleted} old chat activity records`);
}, 60 * 60 * 1000);
```

## Error Handling

All methods throw descriptive errors:
- Database connection errors
- Query execution errors
- Invalid parameters

Errors include the original error message for debugging:

```typescript
try {
  await chatActivityRepo.record(userId, timestamp);
} catch (error) {
  logger.error('Failed to record chat activity', { userId, error });
  // Handle error appropriately
}
```

## Future Enhancements

Potential improvements:
1. **Caching**: Cache qualified chatters for 30-60 seconds to reduce database load
2. **Analytics**: Track chat rain participation rates and winner distribution
3. **Partitioning**: Partition tables by date for better performance at scale
4. **Archiving**: Archive old winner records for historical analysis
5. **Metrics**: Add Prometheus metrics for monitoring
