# Chat Rain Manager

## Overview

The ChatRainManager handles automated reward distribution for active chatters in the Discord server. It implements a fair and secure system for randomly selecting eligible users to receive rewards, with built-in spam protection and cooldown mechanisms.

## Features

- **Active Chatter Tracking**: Identifies users who have sent 3+ messages in the last 10 minutes
- **Spam Filtering**: Excludes users with spam violations in the last 24 hours
- **Winner Cooldown**: Prevents users from winning multiple times within 60 minutes
- **Event Cooldown**: Enforces minimum 5-minute delay between chat rain events
- **CSPRNG Selection**: Uses cryptographically secure random number generation for fair winner selection
- **Configurable Recipients**: Randomly selects 3-10 winners per event

## Requirements Validation

This implementation validates the following requirements:

- **Requirement 11.1**: Active chatter tracking (3+ messages in 10 minutes)
- **Requirement 11.2**: Select 3-10 random recipients
- **Requirement 11.3**: Use CSPRNG for random selection
- **Requirement 11.4**: Exclude spam-flagged users (last 24 hours)
- **Requirement 11.5**: Enforce minimum 5-minute delay between events
- **Requirement 11.8**: Exclude users who won in last 60 minutes

## Architecture

```
ChatRainManager
├── executeChatRain()           # Main entry point for executing chat rain
├── getEligibleRecipients()     # Filters users based on eligibility criteria
├── selectRecipientCount()      # Determines number of winners (3-10)
├── selectRandomRecipients()    # CSPRNG-based winner selection
└── canExecuteChatRain()        # Checks minimum delay between events
```

## Usage

### Basic Setup

```typescript
import { ChatRainManager } from './managers/chat-rain.manager.js';
import { ChatActivityRepository } from './core/database/repositories/ChatActivityRepository.js';
import { ViolationRepository } from './core/database/repositories/ViolationRepository.js';

// Create repositories
const chatActivityRepo = new ChatActivityRepository(pool);
const violationRepo = new ViolationRepository(pool);

// Configure chat rain
const config = {
  minDelayMinutes: 5,        // 5 minutes between events
  activeWindowMinutes: 10,   // Track messages from last 10 minutes
  minMessages: 3,            // Require 3+ messages to be eligible
  cooldownMinutes: 60,       // 60 minute cooldown for winners
  rewardType: 'role',        // Reward type
  rewardValue: '123456789',  // Role ID or other value
};

// Create manager
const chatRainManager = new ChatRainManager(
  chatActivityRepo,
  violationRepo,
  config
);

// Initialize (loads last chat rain time)
await chatRainManager.initialize();
```

### Execute Chat Rain

```typescript
// Execute chat rain event
const winners = await chatRainManager.executeChatRain();

if (winners === null) {
  console.log('Chat rain on cooldown');
} else if (winners.length === 0) {
  console.log('No eligible users');
} else {
  console.log(`Winners: ${winners.join(', ')}`);
  // Announce in Discord and distribute rewards
}
```

### Check Cooldown Status

```typescript
// Get time until next chat rain
const timeUntilNext = chatRainManager.getTimeUntilNextChatRain();

if (timeUntilNext > 0) {
  const minutes = Math.ceil(timeUntilNext / 60000);
  console.log(`Next chat rain in ${minutes} minutes`);
} else {
  console.log('Chat rain available now');
}
```

### Scheduled Execution

```typescript
// Run chat rain every 15 minutes
setInterval(async () => {
  const winners = await chatRainManager.executeChatRain();
  
  if (winners && winners.length > 0) {
    // Announce winners
    await discordClient.sendMessage(
      channelId,
      `🌧️ Chat Rain! Winners: ${winners.map(id => `<@${id}>`).join(', ')}`
    );
    
    // Distribute rewards (e.g., assign role)
    for (const userId of winners) {
      await discordClient.addRole(userId, config.rewardValue);
    }
  }
}, 15 * 60 * 1000);
```

## Configuration

### ChatRainConfig Interface

```typescript
interface ChatRainConfig {
  /** Minimum delay between chat rain events in minutes (default: 5) */
  minDelayMinutes: number;
  
  /** Time window for active chatter tracking in minutes (default: 10) */
  activeWindowMinutes: number;
  
  /** Minimum messages required to be considered active (default: 3) */
  minMessages: number;
  
  /** Cooldown period for winners in minutes (default: 60) */
  cooldownMinutes: number;
  
  /** Type of reward to distribute */
  rewardType: string;
  
  /** Value of reward (role ID, currency amount, etc.) */
  rewardValue?: string;
}
```

### Recommended Settings

**Small Server (<100 active users):**
```typescript
{
  minDelayMinutes: 10,
  activeWindowMinutes: 15,
  minMessages: 3,
  cooldownMinutes: 120,
  rewardType: 'role',
  rewardValue: 'winner-role-id'
}
```

**Medium Server (100-500 active users):**
```typescript
{
  minDelayMinutes: 5,
  activeWindowMinutes: 10,
  minMessages: 3,
  cooldownMinutes: 60,
  rewardType: 'role',
  rewardValue: 'winner-role-id'
}
```

**Large Server (500+ active users):**
```typescript
{
  minDelayMinutes: 5,
  activeWindowMinutes: 5,
  minMessages: 5,
  cooldownMinutes: 30,
  rewardType: 'role',
  rewardValue: 'winner-role-id'
}
```

## Eligibility Criteria

A user is eligible for chat rain if ALL of the following are true:

1. ✅ **Active Chatter**: Sent 3+ messages in the last 10 minutes
2. ✅ **No Spam Violations**: No spam violations in the last 24 hours
3. ✅ **Not Recent Winner**: Did not win chat rain in the last 60 minutes

## Reward Types

The chat rain system supports multiple reward types:

### Role Reward
```typescript
{
  rewardType: 'role',
  rewardValue: '123456789' // Discord role ID
}
```

### Currency Reward (if using economy bot)
```typescript
{
  rewardType: 'currency',
  rewardValue: '100' // Amount of currency
}
```

### Announcement Only
```typescript
{
  rewardType: 'announcement',
  rewardValue: undefined
}
```

## CSPRNG Implementation

The manager uses cryptographically secure random number generation (CSPRNG) for all random operations:

- **Winner Selection**: Uses `crypto.randomBytes()` for selecting winners
- **Recipient Count**: Uses CSPRNG to determine number of winners (3-10)
- **Uniform Distribution**: Implements rejection sampling to ensure uniform distribution
- **No Bias**: Prevents modulo bias in random number generation

## Database Schema

The chat rain system uses two tables:

### chat_activity
```sql
CREATE TABLE chat_activity (
  user_id VARCHAR(20) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  PRIMARY KEY (user_id, timestamp),
  INDEX idx_timestamp (timestamp)
);
```

### chat_rain_winners
```sql
CREATE TABLE chat_rain_winners (
  user_id VARCHAR(20) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  reward_type VARCHAR(50) NOT NULL,
  reward_value TEXT,
  PRIMARY KEY (user_id, timestamp),
  INDEX idx_user_timestamp (user_id, timestamp)
);
```

## Error Handling

The manager handles various error scenarios:

- **No Eligible Users**: Returns empty array if no users meet criteria
- **Cooldown Active**: Returns null if minimum delay not met
- **Database Errors**: Throws descriptive errors for database failures
- **Invalid Configuration**: Validates config values on initialization

## Performance Considerations

- **Efficient Queries**: Uses indexed queries for fast lookups
- **Batch Operations**: Records all winners in batch
- **Memory Efficient**: Processes users in streams for large servers
- **Caching**: Caches last chat rain time in memory

## Testing

See `tests/unit/managers/chat-rain.manager.test.ts` for unit tests covering:

- Eligibility filtering
- CSPRNG selection
- Cooldown enforcement
- Spam filtering
- Edge cases (no users, all ineligible, etc.)

## Integration with Discord

```typescript
// Example Discord integration
import { Client, TextChannel } from 'discord.js';

async function announceChatRain(
  client: Client,
  channelId: string,
  winners: string[]
) {
  const channel = await client.channels.fetch(channelId) as TextChannel;
  
  const mentions = winners.map(id => `<@${id}>`).join(', ');
  await channel.send({
    content: `🌧️ **Chat Rain!** Congratulations to: ${mentions}`,
    allowedMentions: { users: winners }
  });
}

// Execute and announce
const winners = await chatRainManager.executeChatRain();
if (winners && winners.length > 0) {
  await announceChatRain(discordClient, channelId, winners);
}
```

## Monitoring and Logging

```typescript
// Log chat rain events
logger.info('Chat rain executed', {
  winnerCount: winners.length,
  winners: winners,
  timestamp: new Date(),
  eligibleCount: eligibleUsers.length
});

// Monitor cooldown status
const timeUntilNext = chatRainManager.getTimeUntilNextChatRain();
logger.debug('Chat rain cooldown status', {
  timeRemaining: timeUntilNext,
  canExecute: timeUntilNext === 0
});
```

## Troubleshooting

### No Winners Selected

**Possible Causes:**
- No users have sent 3+ messages in last 10 minutes
- All active users have spam violations
- All active users won recently (within 60 minutes)

**Solution:**
- Adjust `minMessages` threshold
- Increase `activeWindowMinutes`
- Decrease `cooldownMinutes`

### Chat Rain Too Frequent

**Possible Causes:**
- `minDelayMinutes` set too low
- Multiple instances running

**Solution:**
- Increase `minDelayMinutes`
- Ensure only one instance is running

### Winners Not Receiving Rewards

**Possible Causes:**
- Reward distribution not implemented
- Discord permissions missing
- Role ID incorrect

**Solution:**
- Implement reward distribution logic
- Verify bot has MANAGE_ROLES permission
- Check role ID in configuration

## Future Enhancements

Potential improvements for future versions:

- [ ] Weighted selection based on activity level
- [ ] Multiple reward tiers
- [ ] Configurable eligibility criteria
- [ ] Integration with external reward systems
- [ ] Analytics and statistics tracking
- [ ] Admin commands for manual triggering
- [ ] Scheduled events with custom timing
