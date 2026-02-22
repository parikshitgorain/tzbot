# Giveaway Manager

The Giveaway Manager provides a complete system for creating and managing role-gated giveaways with interactive Discord buttons, cryptographically secure winner selection, and automatic state recovery.

## Features

- **Role-Gated Giveaways**: Restrict entries to users with specific roles
- **Interactive Buttons**: Users enter giveaways by clicking a button
- **Entry Validation**: Automatic validation of role requirements
- **Duplicate Prevention**: Users can only enter once per giveaway
- **CSPRNG Winner Selection**: Cryptographically secure random winner selection
- **Automatic Scheduling**: Giveaways end automatically after the specified duration
- **State Recovery**: Active giveaways are recovered on bot restart
- **Winner Notifications**: Winners are announced in the channel and receive DMs

## Requirements Implemented

- **Requirement 9.1**: Role-gated giveaway system with whitelist roles
- **Requirement 9.2**: Ephemeral messages for entry restrictions
- **Requirement 9.4**: Interactive buttons for giveaway entry
- **Requirement 9.5**: Entry recording with user ID and timestamp
- **Requirement 9.6**: Duplicate entry prevention

## Usage

### Initialize the Manager

```typescript
import { GiveawayManager } from '@/managers/giveaway.manager.js';
import { DiscordClient } from '@/core/discord/client.js';
import { GiveawayRepository } from '@/core/database/repositories/GiveawayRepository.js';

const discordClient = new DiscordClient();
const giveawayRepository = new GiveawayRepository(pool);
const giveawayManager = new GiveawayManager(discordClient, giveawayRepository);
```

### Create a Giveaway

```typescript
// Create a role-gated giveaway
const giveaway = await giveawayManager.createGiveaway({
  title: 'Premium Nitro Giveaway',
  description: 'Win 1 month of Discord Nitro!',
  channelId: 'channel_id',
  guildId: 'guild_id',
  requiredRoles: ['subscriber_role_id', 'vip_role_id'], // Users need one of these
  winnerCount: 3,
  durationMs: 24 * 60 * 60 * 1000, // 24 hours
});

// Create a public giveaway (no role restrictions)
const publicGiveaway = await giveawayManager.createGiveaway({
  title: 'Community Giveaway',
  description: 'Everyone can enter!',
  channelId: 'channel_id',
  guildId: 'guild_id',
  requiredRoles: [], // No restrictions
  winnerCount: 5,
  durationMs: 7 * 24 * 60 * 60 * 1000, // 7 days
});
```

### Handle Button Interactions

```typescript
// Set up event handler for button clicks
discordClient.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId.startsWith('giveaway_enter_')) {
    await giveawayManager.handleEntryInteraction(
      interaction,
      interaction.guildId || ''
    );
  }
});
```

### Recover Active Giveaways on Startup

```typescript
// Call this when the bot starts up
await giveawayManager.recoverActiveGiveaways(guildId);
```

### Cancel a Giveaway

```typescript
await giveawayManager.cancelGiveaway(giveawayId);
```

## Entry Validation

The manager automatically validates entries based on:

1. **Giveaway Status**: Only active giveaways accept entries
2. **Role Requirements**: Users must have at least one required role (if specified)
3. **Duplicate Prevention**: Users can only enter once per giveaway

### Validation Flow

```
User clicks button
    ↓
Check if giveaway exists
    ↓
Check if giveaway is active
    ↓
Validate role requirements
    ↓
Check for duplicate entry
    ↓
Record entry
    ↓
Send confirmation message
```

## Winner Selection

Winners are selected using a cryptographically secure pseudo-random number generator (CSPRNG) based on Node.js's `crypto.randomBytes()`.

### Selection Algorithm

1. Get all entries from the database
2. Determine winner count (min of requested winners and total entries)
3. For each winner:
   - Generate cryptographically secure random index
   - Select user at that index
   - Remove from available pool (no duplicates)
4. Announce winners in channel
5. Send DM to each winner

### CSPRNG Implementation

```typescript
// Uses crypto.randomBytes for secure randomness
private secureRandomInt(min: number, max: number): number {
  const range = max - min;
  const bytesNeeded = Math.ceil(Math.log2(range) / 8);
  const maxValue = Math.pow(256, bytesNeeded);
  const threshold = maxValue - (maxValue % range);

  let randomValue: number;
  do {
    const randomBytes = this.getRandomBytes(bytesNeeded);
    randomValue = 0;
    for (let i = 0; i < bytesNeeded; i++) {
      randomValue = randomValue * 256 + randomBytes[i];
    }
  } while (randomValue >= threshold);

  return min + (randomValue % range);
}
```

This ensures:
- No modulo bias
- Cryptographically secure randomness
- Fair winner selection

## State Recovery

The manager supports automatic recovery of active giveaways after bot restarts:

1. On startup, call `recoverActiveGiveaways(guildId)`
2. Manager loads all active giveaways from database
3. For each giveaway:
   - If end time has passed, end immediately
   - Otherwise, reschedule end event

This ensures giveaways complete even if the bot crashes or restarts.

## Message Updates

The manager automatically updates giveaway messages:

### During Active Phase
- Entry count is updated when users enter
- Shows current number of entries

### When Ended
- Embed color changes to gray
- Button is removed
- Winners are displayed
- Status shows "Ended"

### When Cancelled
- Embed color changes to red
- Button is removed
- Status shows "Cancelled"

## Error Handling

The manager handles various error scenarios:

- **Giveaway not found**: User receives error message
- **Giveaway ended**: User is informed giveaway has ended
- **Missing roles**: User receives list of required roles
- **Duplicate entry**: User is informed they already entered
- **Member not found**: User receives error about membership verification
- **DM failures**: Logged but doesn't prevent winner announcement

## Database Schema

The manager uses two tables:

### giveaways
```sql
CREATE TABLE giveaways (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  channel_id VARCHAR(20) NOT NULL,
  message_id VARCHAR(20) NOT NULL,
  required_roles JSON,
  winner_count INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status_ends (status, ends_at)
);
```

### giveaway_entries
```sql
CREATE TABLE giveaway_entries (
  giveaway_id UUID REFERENCES giveaways(id),
  user_id VARCHAR(20) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (giveaway_id, user_id)
);
```

The composite primary key on `(giveaway_id, user_id)` enforces duplicate prevention at the database level.

## Integration with Slash Commands

Example slash command integration:

```typescript
// Register command
const command = new SlashCommandBuilder()
  .setName('giveaway')
  .setDescription('Create a giveaway')
  .addStringOption(option =>
    option.setName('title')
      .setDescription('Giveaway title')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('description')
      .setDescription('Giveaway description')
      .setRequired(true))
  .addIntegerOption(option =>
    option.setName('duration')
      .setDescription('Duration in hours')
      .setRequired(true))
  .addIntegerOption(option =>
    option.setName('winners')
      .setDescription('Number of winners')
      .setRequired(true))
  .addRoleOption(option =>
    option.setName('required_role')
      .setDescription('Required role (optional)')
      .setRequired(false));

// Handle command
async function handleGiveawayCommand(interaction: ChatInputCommandInteraction) {
  const title = interaction.options.getString('title', true);
  const description = interaction.options.getString('description', true);
  const duration = interaction.options.getInteger('duration', true);
  const winners = interaction.options.getInteger('winners', true);
  const requiredRole = interaction.options.getRole('required_role');

  await giveawayManager.createGiveaway({
    title,
    description,
    channelId: interaction.channelId,
    guildId: interaction.guildId,
    requiredRoles: requiredRole ? [requiredRole.id] : [],
    winnerCount: winners,
    durationMs: duration * 60 * 60 * 1000,
  });

  await interaction.reply({
    content: '✅ Giveaway created!',
    ephemeral: true,
  });
}
```

## Logging

The manager logs important events:

- Giveaway creation
- Entry recording
- Entry validation failures
- Winner selection
- Giveaway ending
- State recovery
- Errors and failures

All logs include relevant context (giveaway ID, user ID, etc.) for debugging.

## Testing

The manager includes comprehensive unit tests covering:

- Giveaway creation
- Entry validation (role requirements)
- Duplicate entry prevention
- Giveaway status checks
- State recovery
- Winner selection
- Cancellation

Run tests with:
```bash
npm test -- tests/unit/managers/giveaway.manager.test.ts
```

## Performance Considerations

- **Entry Count Updates**: Message updates are throttled to avoid rate limits
- **CSPRNG**: Secure random generation is slightly slower than Math.random() but negligible for typical giveaway sizes (<10,000 entries)
- **Database Queries**: Indexes on `status` and `ends_at` optimize active giveaway queries
- **Memory**: Active giveaway timeouts are stored in memory (minimal overhead)

## Security

- **CSPRNG**: Uses Node.js crypto module for secure randomness
- **No Modulo Bias**: Random selection algorithm eliminates modulo bias
- **Database Constraints**: Duplicate prevention enforced at database level
- **Input Validation**: All user inputs are validated before processing
- **Permission Checks**: Role validation uses Discord's permission system

## Limitations

- Maximum 25 fields per embed (Discord limit)
- Button custom IDs limited to 100 characters
- DM failures are logged but don't prevent winner announcement
- Giveaway messages must be in text channels
- Role checks require bot to have access to member data

## Future Enhancements

Potential improvements:

- Multiple role requirement modes (AND vs OR)
- Bonus entries for specific roles
- Giveaway templates
- Scheduled giveaways (start at specific time)
- Entry limits per user across all giveaways
- Giveaway analytics and statistics
- Export entry data
- Reroll winners if original winners don't respond
