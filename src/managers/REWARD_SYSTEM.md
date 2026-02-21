# Reward Distribution System

## Overview

The Reward Distribution System handles the distribution of rewards to chat rain winners. It supports multiple reward types, announces winners in chat, and maintains a complete reward history.

## Features

- **Multiple Reward Types**: Support for roles, currency, announcements, and custom rewards
- **Temporary Rewards**: Automatic removal of temporary roles after a specified duration
- **Winner Announcements**: Automatic announcement of winners in the designated channel
- **Reward History**: Complete tracking of all rewards distributed to users
- **Error Handling**: Graceful handling of failed distributions with detailed error reporting

## Reward Types

### 1. Role Rewards (`RewardType.ROLE`)

Assigns a Discord role to winners. Supports both permanent and temporary roles.

**Configuration:**
```typescript
{
  type: RewardType.ROLE,
  value: '1234567890123456789', // Discord role ID
  durationMs: 24 * 60 * 60 * 1000, // Optional: 24 hours
  customMessage: 'You\'ve been awarded the Active Chatter role!'
}
```

**Use Cases:**
- Temporary "Winner" role for 24 hours
- Permanent "Active Member" role
- Special event roles

### 2. Currency Rewards (`RewardType.CURRENCY`)

Awards server currency or points to winners. Requires integration with an economy bot or custom currency system.

**Configuration:**
```typescript
{
  type: RewardType.CURRENCY,
  value: '100', // Amount as string
  customMessage: 'You\'ve been awarded 100 coins!'
}
```

**Integration Options:**
- UnbelievaBoat API
- Dank Memer API
- Custom economy database

### 3. Announcement Rewards (`RewardType.ANNOUNCEMENT`)

Recognizes winners without distributing a tangible reward. Useful for community recognition.

**Configuration:**
```typescript
{
  type: RewardType.ANNOUNCEMENT,
  customMessage: 'You\'ve been recognized as one of our most active chatters! 🎉'
}
```

**Use Cases:**
- Community recognition
- Leaderboard highlights
- Engagement tracking

### 4. Custom Rewards (`RewardType.CUSTOM`)

Executes custom reward logic via webhooks or external systems.

**Configuration:**
```typescript
{
  type: RewardType.CUSTOM,
  value: JSON.stringify({
    webhookUrl: 'https://example.com/api/rewards',
    action: 'award_points',
    amount: 500
  }),
  customMessage: 'You\'ve received a special reward!'
}
```

**Use Cases:**
- Integration with external systems
- Custom game rewards
- Third-party service integration

## Architecture

### Components

```
RewardSystem
├── distributeRewards()      - Main distribution method
├── announceWinners()         - Announces winners in chat
├── getRewardHistory()        - Retrieves reward history
└── Private Methods
    ├── distributeRewardToUser()  - Distributes to single user
    ├── assignRole()              - Handles role rewards
    ├── awardCurrency()           - Handles currency rewards
    └── handleCustomReward()      - Handles custom rewards
```

### Integration with Chat Rain

```typescript
ChatRainManager
├── executeChatRain()
│   ├── getEligibleRecipients()
│   ├── selectRandomRecipients()
│   └── RewardSystem.distributeRewards()  ← Integration point
└── buildReward()
```

## Usage Examples

### Basic Setup

```typescript
import { RewardSystem, RewardType } from './reward-system.js';
import { ChatRainManager } from './chat-rain.manager.js';

// Create reward system
const rewardSystem = new RewardSystem(
  discordClient,
  chatActivityRepo,
  guildId
);

// Configure chat rain with role reward
const config = {
  minDelayMinutes: 5,
  activeWindowMinutes: 10,
  minMessages: 3,
  cooldownMinutes: 60,
  rewardType: RewardType.ROLE,
  rewardValue: 'role-id-here',
  rewardDurationMs: 24 * 60 * 60 * 1000 // 24 hours
};

// Create chat rain manager
const chatRainManager = new ChatRainManager(
  chatActivityRepo,
  violationRepo,
  rewardSystem,
  config
);
```

### Execute Chat Rain

```typescript
// Execute chat rain in a specific channel
const channelId = '123456789012345678';
const winners = await chatRainManager.executeChatRain(channelId);

if (winners) {
  console.log(`Chat rain executed! ${winners.length} winners selected.`);
} else {
  console.log('Chat rain could not be executed (cooldown or no eligible users)');
}
```

### Manual Reward Distribution

```typescript
// Distribute rewards manually (e.g., for special events)
const userIds = ['user1', 'user2', 'user3'];
const reward = {
  type: RewardType.ROLE,
  value: 'special-event-role-id',
  durationMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  customMessage: 'Special event reward! VIP status for 7 days!'
};

const result = await rewardSystem.distributeRewards(
  userIds,
  reward,
  channelId
);

console.log(`Successfully distributed to: ${result.successful.length} users`);
console.log(`Failed to distribute to: ${result.failed.length} users`);

// Handle errors
for (const [userId, error] of result.errors) {
  console.error(`Failed to reward ${userId}: ${error}`);
}
```

### Get Reward History

```typescript
// Get all rewards for a user
const userId = '123456789012345678';
const allRewards = await rewardSystem.getRewardHistory(userId);

console.log(`User has received ${allRewards.length} total rewards`);

// Get rewards from last 30 days
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const recentRewards = await rewardSystem.getRewardHistory(userId, thirtyDaysAgo);

console.log(`User has received ${recentRewards.length} rewards in the last 30 days`);
```

## Announcement Format

The system automatically generates announcements when distributing rewards:

```
🌧️ **Chat Rain!** 🌧️

Congratulations to: @user1, @user2, @user3

You've been awarded a special role! (24 hours)
```

The announcement includes:
- Winner mentions
- Reward description
- Duration (for temporary rewards)
- Custom message (if configured)

## Error Handling

The system handles various error scenarios:

### User Not Found
```typescript
{
  successful: [],
  failed: ['user1'],
  errors: Map { 'user1' => 'User not found' }
}
```

### Role Not Found
```typescript
{
  successful: [],
  failed: ['user1'],
  errors: Map { 'user1' => 'Role not found: role-id' }
}
```

### Channel Not Accessible
```typescript
// Throws error: 'Channel not found' or 'Channel is not a text channel'
```

## Database Schema

### chat_rain_winners Table

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

**Fields:**
- `user_id`: Discord user ID
- `timestamp`: When the reward was distributed
- `reward_type`: Type of reward (role, currency, announcement, custom)
- `reward_value`: Value associated with the reward (role ID, amount, etc.)

## Requirements Validation

This implementation validates the following requirements:

### Requirement 11.7: Announce Winners in Chat
✅ Winners are announced in the designated channel with formatted messages
✅ Announcements include winner mentions and reward details
✅ Failed distributions are reported in the announcement

### Property 48: Chat Rain Winner Announcement
✅ For any chat rain event, an announcement listing the winners is posted in the chat channel

## Configuration Options

### ChatRainConfig

```typescript
interface ChatRainConfig {
  minDelayMinutes: number;        // Minimum delay between events (default: 5)
  activeWindowMinutes: number;    // Active chatter window (default: 10)
  minMessages: number;            // Minimum messages required (default: 3)
  cooldownMinutes: number;        // Winner cooldown period (default: 60)
  rewardType: RewardType;         // Type of reward
  rewardValue?: string;           // Value for the reward
  rewardDurationMs?: number;      // Duration for temporary rewards
  customMessage?: string;         // Custom announcement message
}
```

## Best Practices

### 1. Role Rewards
- Use temporary roles for chat rain to avoid role bloat
- Set reasonable durations (24 hours recommended)
- Ensure the bot has permission to manage the role
- Place the reward role below the bot's highest role

### 2. Currency Rewards
- Integrate with a reliable economy bot or system
- Set reasonable amounts to maintain economy balance
- Consider implementing daily/weekly limits
- Log all currency transactions for auditing

### 3. Announcements
- Keep messages concise and engaging
- Use emojis to make announcements stand out
- Avoid mentioning too many users at once (Discord limits)
- Consider using embeds for richer formatting

### 4. Custom Rewards
- Validate webhook URLs before use
- Implement timeout handling for external calls
- Log all custom reward executions
- Have fallback behavior for failed integrations

## Testing

The reward system includes comprehensive unit tests:

```bash
npm test -- tests/unit/managers/reward-system.test.ts
```

**Test Coverage:**
- ✅ Role reward distribution
- ✅ Temporary role scheduling
- ✅ Currency rewards
- ✅ Announcement generation
- ✅ Multiple winners
- ✅ Failed distributions
- ✅ Reward history retrieval
- ✅ Edge cases (empty lists, invalid channels, missing roles)

## Future Enhancements

### Planned Features
- [ ] Reward templates for common configurations
- [ ] Batch reward distribution optimization
- [ ] Reward scheduling (delayed distribution)
- [ ] Reward tiers based on activity level
- [ ] Integration with more economy bots
- [ ] Webhook retry logic for custom rewards
- [ ] Rich embed announcements
- [ ] Reward statistics and analytics

### Integration Opportunities
- Economy bot APIs (UnbelievaBoat, Dank Memer)
- External game servers
- Loyalty point systems
- NFT/crypto rewards (with proper compliance)
- Streaming platform integrations

## Troubleshooting

### Winners Not Receiving Roles

**Possible Causes:**
1. Bot lacks "Manage Roles" permission
2. Reward role is above bot's highest role
3. User has left the server
4. Role ID is incorrect

**Solution:**
- Check bot permissions in server settings
- Ensure reward role is below bot's role in hierarchy
- Verify role ID is correct
- Check error logs for specific failure reasons

### Announcements Not Appearing

**Possible Causes:**
1. Bot lacks "Send Messages" permission in channel
2. Channel ID is incorrect
3. Channel was deleted

**Solution:**
- Verify bot has permission to send messages
- Check channel ID is correct
- Ensure channel exists and is a text channel

### Temporary Roles Not Being Removed

**Possible Causes:**
1. Bot was offline when removal was scheduled
2. Bot lost "Manage Roles" permission
3. User left and rejoined server

**Solution:**
- Temporary role removal uses setTimeout, which doesn't persist across restarts
- Consider implementing a scheduled job to check and remove expired roles
- Log all role assignments and removals for auditing

## Support

For issues or questions:
1. Check the error logs for detailed error messages
2. Verify all configuration values are correct
3. Ensure bot has required permissions
4. Review the example files for proper usage
5. Check the test files for expected behavior

## License

This component is part of the TZBOT Discord Bot project.
