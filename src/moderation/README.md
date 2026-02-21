# Moderation Module

This module contains the automated moderation systems for TZBOT.

## Spam Detection System

The spam detection system implements two types of spam detection as specified in Requirements 4.5:

### Detection Criteria

1. **Identical Message Spam**: 5 or more identical messages within 10 seconds
2. **Rapid Message Spam**: 10 or more messages (any content) within 5 seconds

### Usage

```typescript
import { SpamDetector } from './moderation/spam-detector.js';

// Create detector with default thresholds
const detector = new SpamDetector();

// Check if a message is spam
const result = detector.checkSpam(userId, messageContent);

if (result.isSpam) {
  console.log(`Spam detected: ${result.reason}`);
  console.log(`Violation type: ${result.violationType}`);
  // Apply punishment based on escalation matrix
}
```

### Custom Thresholds

You can customize the spam detection thresholds:

```typescript
const detector = new SpamDetector({
  identicalMessages: 3,    // Trigger after 3 identical messages
  identicalWindow: 5,      // Within 5 seconds
  rapidMessages: 8,        // Trigger after 8 messages
  rapidWindow: 3,          // Within 3 seconds
});
```

### Features

- **Per-user tracking**: Messages are tracked separately for each user
- **Automatic cleanup**: Old messages outside detection windows are automatically removed
- **Memory efficient**: Only stores messages within the maximum detection window
- **Configurable**: All thresholds can be customized per server
- **Type-safe**: Full TypeScript support with proper type definitions

### Implementation Details

The spam detector maintains an in-memory history of recent messages per user. When checking for spam:

1. The new message is added to the user's history
2. Old messages outside all detection windows are cleaned up
3. Identical message spam is checked first (higher priority)
4. If no identical spam, rapid message spam is checked
5. Returns a `SpamResult` with detection details

### Testing

The spam detector has comprehensive unit tests covering:
- Identical message detection
- Rapid message detection
- Time window boundaries
- User isolation
- Memory cleanup
- Custom thresholds
- Edge cases (empty messages, unicode, special characters)

Run tests with:
```bash
npm test -- tests/unit/moderation/spam-detector.test.ts
```

### Integration with Moderation System

The spam detector is designed to integrate with the offense tracking system:

```typescript
// In your message handler
const spamResult = detector.checkSpam(userId, message.content);

if (spamResult.isSpam) {
  // Delete the spam message
  await message.delete();
  
  // Process offense and apply punishment
  const punishment = await offenseManager.processOffense(
    userId,
    spamResult.reason,
    'system', // moderatorId
    message.channel.id
  );
  
  // Apply punishment
  if (punishment.type === 'TIMEOUT' && punishment.duration) {
    await member.timeout(punishment.duration * 3600000, punishment.reason);
  } else if (punishment.type === 'PERMANENT_BAN') {
    await member.ban({ reason: punishment.reason });
  }
}
```

### Performance Considerations

- **Memory usage**: Approximately 100-200 bytes per message in history
- **Cleanup frequency**: Automatic cleanup on every message check
- **Time complexity**: O(n) where n is the number of messages in the detection window
- **Typical window size**: 10-20 messages per user at most

### Future Enhancements

Potential improvements for future versions:
- Persistent storage for spam history across bot restarts
- Machine learning-based spam detection
- Pattern matching for common spam phrases
- Integration with external spam detection APIs
- Whitelist for trusted users or specific phrases

## Violation Tracking and Escalation System

The violation tracking system implements the escalation matrix as specified in Requirements 4.1-4.4 and 4.6.

### Escalation Matrix

The system automatically escalates punishments based on violation frequency:

1. **1st offense**: Warning
2. **2nd offense**: Warning
3. **3rd offense**: 1-hour timeout
4. **4th offense**: 2-hour timeout
5. **5th offense**: 4-hour timeout
6. **6th offense**: 8-hour timeout
7. **7th offense**: 16-hour timeout
8. **8th+ offense**: Permanent ban (when timeout would be ≥24 hours)

Offenses automatically reset after 30 days of good behavior.

### Usage

```typescript
import { OffenseManager } from './moderation/offense-manager.js';
import { OffenseRepository } from './core/database/repositories/OffenseRepository.js';
import { PunishmentCalculator } from './moderation/punishment-calculator.js';
import { NotificationService } from './managers/notification.manager.js';

// Create offense manager with dependencies
const offenseRepo = new OffenseRepository(pool);
const punishmentCalc = new PunishmentCalculator();
const notificationService = new NotificationService(client);

const offenseManager = new OffenseManager(
  pool,
  offenseRepo,
  punishmentCalc,
  notificationService
);

// Process an offense and get the appropriate punishment
const punishment = await offenseManager.processOffense(
  userId,
  'Sent 5 identical messages within 10 seconds',
  moderatorId,
  channelId
);

console.log(`Punishment: ${punishment.type}`);
console.log(`Duration: ${punishment.duration} hours`);
console.log(`Next punishment: ${punishment.nextPunishment}`);

// Apply the punishment
if (punishment.type === 'TIMEOUT' && punishment.duration) {
  await member.timeout(punishment.duration * 3600000, punishment.reason);
} else if (punishment.type === 'PERMANENT_BAN') {
  await member.ban({ reason: punishment.reason });
}
```

### Features

- **Progressive punishment ladder**: Automatic escalation from warnings to timeouts to permanent ban
- **30-day reset**: Offenses automatically reset after 30 days of good behavior
- **Triple notification**: Sends DM, ephemeral message, and mod-log notification for each punishment
- **Database persistence**: All offense records survive bot restarts
- **Moderator commands**: Full suite of commands for managing offenses (/warn, /warnlist, /clearwarn, etc.)
- **Transaction safety**: All operations are atomic and handle concurrent offenses correctly

### API Methods

#### `processOffense(userId, reason, moderatorId, channelId)`
Records an offense and returns the appropriate punishment based on offense history.

#### `getOffenseHistory(userId)`
Retrieves the complete offense record for a user.

#### `clearLastOffense(userId)`
Removes the most recent offense and recalculates punishment status.

#### `resetAllOffenses(userId)`
Clears all offenses for a user (moderator override).

#### `clearExpiredViolations(userId)`
Clears expired violations for a user.

#### `getViolationCount(userId, windowMs, referenceTime?)`
Gets the violation count for a user within a specific time window.

#### `getNextPunishmentLevel(userId, timestamp?)`
Previews what punishment level would be applied for the next violation without recording it.

### Integration Example

Complete integration with spam detection:

```typescript
// In your message handler
const spamResult = detector.checkSpam(userId, message.content);

if (spamResult.isSpam) {
  // Record violation and get escalation
  const escalation = await tracker.recordViolation(
    userId,
    spamResult.violationType,
    spamResult.reason
  );
  
  // Delete the spam message
  await message.delete();
  
  // Apply punishment based on escalation level
  switch (escalation.punishmentLevel) {
    case 'warning':
      await sendWarningDM(userId, escalation.reason);
      break;
    case 'timeout_1h':
      await timeoutUser(userId, 60 * 60 * 1000, escalation.reason);
      await sendTimeoutDM(userId, '1 hour', escalation.reason);
      break;
    case 'timeout_24h':
      await timeoutUser(userId, 24 * 60 * 60 * 1000, escalation.reason);
      await sendTimeoutDM(userId, '24 hours', escalation.reason);
      break;
    case 'ban':
      await banUser(userId, escalation.reason);
      await sendBanDM(userId, escalation.reason);
      break;
  }
}
```

### Periodic Cleanup

Run periodic cleanup to remove expired violations:

```typescript
// Run every hour
setInterval(async () => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const cleared = await violationRepo.clearOldViolations(sevenDaysAgo);
  console.log(`Cleared ${cleared} expired violations`);
}, 60 * 60 * 1000);
```

### Testing

The violation tracker has comprehensive unit tests covering:
- All escalation matrix scenarios
- Violation expiry logic
- Time window calculations
- Edge cases and boundary conditions
- Different violation types

Run tests with:
```bash
npm test -- tests/unit/moderation/violation-tracker.test.ts
```


## Link Scanning and Phishing Detection System

The link scanning system implements advanced URL detection and phishing protection as specified in Requirements 7.1-7.4, 7.7, and 7.8.

### Detection Features

1. **Zero-Width Character Detection**: Detects URLs obfuscated with zero-width Unicode characters (U+200B, U+200C, U+200D, U+FEFF)
2. **Phishing Blocklist**: Checks URLs against a configurable blocklist of known malicious domains
3. **Google Safe Browsing Integration**: Optional integration with Google Safe Browsing API for real-time threat detection
4. **URL Normalization**: Removes zero-width characters and normalizes URLs for consistent comparison
5. **Moderator Exemption**: Moderators are exempt from link scanning (Requirement 7.7)

### Usage

```typescript
import { LinkScanner } from './moderation/link-scanner.js';

// Create scanner with default blocklist and Google Safe Browsing enabled
const scanner = new LinkScanner();

// Scan a message from a regular user
const result = await scanner.scanMessage(
  'Check out http://example.com',
  'user123',
  false // not a moderator
);

if (result.isMalicious) {
  console.log(`Malicious link detected: ${result.reason}`);
  console.log(`URL: ${result.detectedUrl}`);
  // Delete message and apply 24-hour timeout (Requirement 7.3)
}
```

### Custom Blocklist

You can provide a custom blocklist of malicious domains:

```typescript
const customBlocklist = new Set([
  'malicious.com',
  'phishing.net',
  'scam.org',
  'discord-nitro.ru',
  'steamcommunity-login.com',
]);

const scanner = new LinkScanner(customBlocklist, true);
```

### Moderator Exemption

Moderators are automatically exempt from link scanning:

```typescript
// Check if user is a moderator
const isModerator = member.permissions.has('MODERATE_MEMBERS');

// Scan message
const result = await scanner.scanMessage(
  message.content,
  message.author.id,
  isModerator // moderators are exempt
);
```

### URL Normalization

The scanner automatically normalizes URLs by:
- Removing zero-width characters (U+200B, U+200C, U+200D, U+FEFF)
- Converting to lowercase
- Removing protocol (http://, https://)
- Removing www. prefix

```typescript
const scanner = new LinkScanner();

// Normalize a URL
const normalized = scanner.normalizeUrl('HTTPS://WWW.EX\u200BAM\u200CPLE.COM/path');
console.log(normalized); // 'example.com/path'

// Check if URL has zero-width characters
const hasZeroWidth = scanner.hasZeroWidthChars('exam\u200Bple.com');
console.log(hasZeroWidth); // true
```

### Google Safe Browsing Integration

The scanner integrates with Google Safe Browsing API for real-time threat detection:

```typescript
// Enable Google Safe Browsing (requires API key in config)
const scanner = new LinkScanner(undefined, true);

// URLs are automatically checked against Google Safe Browsing
const result = await scanner.scanMessage(
  'Visit http://malware-site.com',
  'user123',
  false
);

// Result will include threat information from Google Safe Browsing
// { isMalicious: true, reason: 'URL flagged by Google Safe Browsing: MALWARE', detectedUrl: 'malware-site.com' }
```

**Note**: Google Safe Browsing API requires an API key configured in the environment. The scanner gracefully handles missing API keys and rate limits.

### Managing Blocklist Dynamically

You can add, remove, and load blocklist entries at runtime:

```typescript
const scanner = new LinkScanner();

// Add a domain to the blocklist
scanner.addToBlocklist('newmalicious.com');

// Remove a domain from the blocklist
scanner.removeFromBlocklist('temporary.com');

// Load blocklist from an array
scanner.loadBlocklist(['bad1.com', 'bad2.com', 'bad3.com']);

// Get current blocklist
const blocklist = scanner.getBlocklist();
console.log('Blocklist:', blocklist);

// Get blocklist size
const size = scanner.getBlocklistSize();
console.log('Blocklist size:', size);
```

### Integration with Moderation System

Complete integration with violation tracking and punishment:

```typescript
// In your message handler
const isModerator = message.member?.permissions.has('MODERATE_MEMBERS') || false;

const linkResult = await scanner.scanMessage(
  message.content,
  message.author.id,
  isModerator
);

if (linkResult.isMalicious) {
  // Delete the message immediately (Requirement 7.1, 7.2)
  await message.delete();
  
  // Process offense and apply punishment
  const punishment = await offenseManager.processOffense(
    message.author.id,
    `Malicious link: ${linkResult.reason}`,
    'system', // moderatorId
    message.channel.id
  );
  
  // Apply punishment
  if (punishment.type === 'TIMEOUT' && punishment.duration) {
    await message.member?.timeout(
      punishment.duration * 3600000,
      punishment.reason
    );
  } else if (punishment.type === 'PERMANENT_BAN') {
    await message.member?.ban({ reason: punishment.reason });
  }
  
  // Log the incident (Requirement 7.6)
  logger.warn('Malicious link detected', {
    userId: message.author.id,
    url: linkResult.detectedUrl,
    reason: linkResult.reason,
    messageContent: message.content,
  });
}
```

### Features

- **Zero-width character detection**: Catches obfuscated URLs with invisible Unicode characters
- **Blocklist checking**: Fast lookup against known malicious domains
- **Google Safe Browsing**: Real-time threat detection via external API
- **URL extraction**: Automatically extracts all URLs from messages
- **Moderator exemption**: Moderators can post any links without restriction
- **Graceful degradation**: Works even if Google Safe Browsing API is unavailable
- **Caching**: Google Safe Browsing results are cached for 30 minutes
- **Rate limiting**: Respects Google Safe Browsing API rate limits (10,000/day free tier)

### Testing

The link scanner has comprehensive unit tests covering:
- URL extraction from messages
- Zero-width character detection and normalization
- Blocklist checking (exact and partial matches)
- Moderator exemption
- Google Safe Browsing integration
- Edge cases (empty messages, special characters, malformed URLs)

Run tests with:
```bash
npm test -- tests/unit/moderation/link-scanner.test.ts
```

### Performance Considerations

- **URL extraction**: O(n) where n is message length
- **Zero-width detection**: O(m) where m is URL length
- **Blocklist checking**: O(k) where k is blocklist size (typically small)
- **Google Safe Browsing**: Cached results reduce API calls
- **Memory usage**: Minimal, only stores blocklist in memory

### Security Best Practices

1. **Regular blocklist updates**: Update the blocklist regularly from trusted sources
2. **Google Safe Browsing API key**: Keep API key secure in environment variables
3. **Rate limit monitoring**: Monitor Google Safe Browsing API usage to avoid hitting limits
4. **Logging**: Log all malicious link detections for security audits
5. **Moderator trust**: Only grant moderator permissions to trusted users

### Blocklist Sources

Consider loading blocklist from these trusted sources:
- [PhishTank](https://www.phishtank.com/) - Community-driven phishing database
- [OpenPhish](https://openphish.com/) - Automated phishing detection
- [URLhaus](https://urlhaus.abuse.ch/) - Malware URL database
- Custom server-specific blocklist

### Future Enhancements

Potential improvements for future versions:
- Automatic blocklist updates from external sources
- Machine learning-based URL classification
- Homograph attack detection (lookalike characters)
- Right-to-left override detection
- URL shortener expansion and checking
- Reputation scoring for domains
- Integration with additional threat intelligence APIs

## Module Architecture

The moderation module follows a modular design:

```
moderation/
├── spam-detector.ts          # Spam detection logic
├── link-scanner.ts           # Link scanning and phishing detection
├── violation-tracker.ts      # Violation tracking and escalation
├── index.ts                  # Module exports
├── README.md                 # This file
├── spam-detector.example.ts  # Spam detector examples
└── link-scanner.example.ts   # Link scanner examples
```

Each component is:
- **Independent**: Can be used standalone or integrated
- **Testable**: Comprehensive unit tests for each component
- **Configurable**: Customizable thresholds and settings
- **Type-safe**: Full TypeScript support with proper types
- **Well-documented**: Inline documentation and examples

## Integration Example

Complete moderation system integration:

```typescript
import { SpamDetector, LinkScanner } from './moderation/index.js';
import { OffenseManager } from './moderation/offense-manager.js';
import { OffenseRepository } from './core/database/repositories/OffenseRepository.js';
import { PunishmentCalculator } from './moderation/punishment-calculator.js';
import { NotificationService } from './managers/notification.manager.js';

// Initialize components
const spamDetector = new SpamDetector();
const linkScanner = new LinkScanner();

const offenseRepo = new OffenseRepository(pool);
const punishmentCalc = new PunishmentCalculator();
const notificationService = new NotificationService(client);

const offenseManager = new OffenseManager(
  pool,
  offenseRepo,
  punishmentCalc,
  notificationService
);

// Message handler
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  
  const userId = message.author.id;
  const isModerator = message.member?.permissions.has('MODERATE_MEMBERS') || false;
  
  // Check for spam
  const spamResult = spamDetector.checkSpam(userId, message.content);
  if (spamResult.isSpam) {
    await handleSpamViolation(message, spamResult);
    return;
  }
  
  // Check for malicious links
  const linkResult = await linkScanner.scanMessage(message.content, userId, isModerator);
  if (linkResult.isMalicious) {
    await handleLinkViolation(message, linkResult);
    return;
  }
});

async function handleSpamViolation(message, spamResult) {
  // Delete message
  await message.delete();
  
  // Process offense and get punishment
  const punishment = await offenseManager.processOffense(
    message.author.id,
    spamResult.reason,
    'system', // moderatorId
    message.channel.id
  );
  
  // Apply punishment
  if (punishment.type === 'TIMEOUT' && punishment.duration) {
    await message.member?.timeout(
      punishment.duration * 3600000,
      punishment.reason
    );
  } else if (punishment.type === 'PERMANENT_BAN') {
    await message.member?.ban({ reason: punishment.reason });
  }
}

async function handleLinkViolation(message, linkResult) {
  // Delete message immediately
  await message.delete();
  
  // Process as offense
  const punishment = await offenseManager.processOffense(
    message.author.id,
    `Malicious link: ${linkResult.reason}`,
    'system',
    message.channel.id
  );
  
  // Apply punishment
  if (punishment.type === 'TIMEOUT' && punishment.duration) {
    await message.member?.timeout(
      punishment.duration * 3600000,
      punishment.reason
    );
  } else if (punishment.type === 'PERMANENT_BAN') {
    await message.member?.ban({ reason: punishment.reason });
  }
}
```

## Configuration

All moderation components can be configured via environment variables or configuration files:

```typescript
// config/moderation.ts
export const moderationConfig = {
  spam: {
    identicalMessages: parseInt(process.env.SPAM_IDENTICAL_MESSAGES || '5'),
    identicalWindow: parseInt(process.env.SPAM_IDENTICAL_WINDOW || '10'),
    rapidMessages: parseInt(process.env.SPAM_RAPID_MESSAGES || '10'),
    rapidWindow: parseInt(process.env.SPAM_RAPID_WINDOW || '5'),
  },
  links: {
    enableGoogleSafeBrowsing: process.env.ENABLE_GOOGLE_SAFE_BROWSING === 'true',
    googleSafeBrowsingApiKey: process.env.GOOGLE_SAFE_BROWSING_API_KEY,
    blocklistUrl: process.env.PHISHING_BLOCKLIST_URL,
  },
  violations: {
    expiryDays: parseInt(process.env.VIOLATION_EXPIRY_DAYS || '7'),
  },
};
```

## Logging

All moderation actions are logged for audit trails:

```typescript
// Spam detection
logger.info('Spam detected', {
  userId,
  reason: spamResult.reason,
  violationType: spamResult.violationType,
});

// Malicious link detection
logger.warn('Malicious link detected', {
  userId,
  url: linkResult.detectedUrl,
  reason: linkResult.reason,
  messageContent,
});

// Violation recorded
logger.info('Violation recorded', {
  userId,
  type: violation.type,
  punishmentLevel: escalation.punishmentLevel,
  violationCount: escalation.violationCount,
});
```

## Monitoring

Monitor moderation system health:

```typescript
// Track spam detection rate
metrics.increment('moderation.spam.detected');

// Track link scanning rate
metrics.increment('moderation.links.scanned');
metrics.increment('moderation.links.malicious');

// Track violation escalation
metrics.increment(`moderation.violations.${escalation.punishmentLevel}`);

// Track Google Safe Browsing API usage
const rateLimitStatus = await googleSafeBrowsingClient.getRateLimitStatus();
metrics.gauge('moderation.gsb.rate_limit', rateLimitStatus.count);
```


## Channel Access Enforcement System

The channel access enforcement system implements read-only channel restrictions as specified in Requirements 3.1-3.4.

### Features

1. **Unauthorized Message Deletion**: Automatically deletes messages from unauthorized users within 1 second (Requirement 3.1)
2. **DM Notifications**: Sends direct messages to users explaining why their message was deleted (Requirement 3.2)
3. **Moderator Exemption**: Moderators can post in read-only channels without restriction (Requirement 3.3)
4. **Whitelist Role Support**: Users with specific roles can post in read-only channels (Requirement 3.4)
5. **Violation Logging**: All deleted messages are logged with full context (Requirement 3.5)

### Usage

```typescript
import { ChannelAccessEnforcer } from './moderation/channel-access.js';
import { DiscordClient } from './core/discord/client.js';
import { ViolationRepository } from './core/database/repositories/ViolationRepository.js';

// Initialize dependencies
const discordClient = new DiscordClient();
const violationRepo = new ViolationRepository(database);

// Create enforcer with read-only channel configurations
const enforcer = new ChannelAccessEnforcer(
  discordClient,
  violationRepo,
  'moderator-role-id',
  [
    {
      channelId: 'announcement-channel-id',
      whitelistRoleIds: ['subscriber-role-id', 'vip-role-id'],
    },
  ]
);

// In your message handler
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  
  // Enforce channel access
  const wasDeleted = await enforcer.enforceAccess(message);
  
  if (wasDeleted) {
    console.log(`Deleted unauthorized message from ${message.author.tag}`);
  }
});
```

### Configuration

Configure read-only channels with whitelist roles:

```typescript
const readOnlyChannels = [
  {
    channelId: '123456789012345678',  // Announcement channel
    whitelistRoleIds: [
      '234567890123456789',  // Subscriber role
      '345678901234567890',  // VIP role
    ],
  },
  {
    channelId: '456789012345678901',  // Rules channel
    whitelistRoleIds: [],  // Only moderators can post
  },
];

const enforcer = new ChannelAccessEnforcer(
  discordClient,
  violationRepo,
  moderatorRoleId,
  readOnlyChannels
);
```

### Dynamic Management

Add, remove, and update read-only channels at runtime:

```typescript
// Add a new read-only channel
enforcer.addReadOnlyChannel({
  channelId: 'new-channel-id',
  whitelistRoleIds: ['role-1', 'role-2'],
});

// Remove a read-only channel
enforcer.removeReadOnlyChannel('channel-id');

// Update whitelist roles for a channel
enforcer.updateWhitelistRoles('channel-id', ['new-role-1', 'new-role-2']);

// Get all read-only channels
const channels = enforcer.getReadOnlyChannels();

// Get whitelist roles for a specific channel
const roles = enforcer.getWhitelistRoles('channel-id');

// Check if a channel is read-only
const isReadOnly = enforcer.isReadOnlyChannel('channel-id');
```

### Access Checking

Check if a user can post before they send a message:

```typescript
// Check access without enforcing
const accessResult = await enforcer.checkAccess(message);

if (accessResult.isAuthorized) {
  console.log('User is authorized to post');
} else {
  console.log(`User is NOT authorized: ${accessResult.reason}`);
}
```

### DM Notification

When a message is deleted, the user receives a DM notification:

```
⚠️ **Message Deleted**

Your message in **#announcements** was deleted because it's a read-only channel.

**Reason:** You do not have permission to post in this read-only channel

Only moderators and users with specific roles can post in this channel. If you believe this is an error, please contact a moderator.
```

**Note**: If the user has DMs disabled, the notification will fail gracefully without throwing an error.

### Violation Logging

All deleted messages are logged as violations:

```typescript
{
  userId: 'user-id',
  type: 'unauthorized_post',
  severity: 1,
  timestamp: new Date(),
  details: 'Unauthorized post in read-only channel channel-id: message content...',
  punishmentApplied: undefined,
}
```

### Integration with Event Manager

Complete integration example:

```typescript
import { ChannelAccessEnforcer } from './moderation/channel-access.js';
import { EventManager } from './managers/event.manager.js';

// Setup
const enforcer = new ChannelAccessEnforcer(
  discordClient,
  violationRepo,
  config.moderatorRoleId,
  config.readOnlyChannels
);

// Register with event manager
eventManager.on('messageCreate', async (message) => {
  // Skip bot messages
  if (message.author.bot) return;
  
  // Check if channel is read-only
  if (!enforcer.isReadOnlyChannel(message.channelId)) {
    return; // Not a read-only channel
  }
  
  // Enforce access
  try {
    const wasDeleted = await enforcer.enforceAccess(message);
    
    if (wasDeleted) {
      logger.info('Unauthorized message deleted', {
        user: message.author.tag,
        userId: message.author.id,
        channel: message.channelId,
        content: message.content.substring(0, 50),
      });
    }
  } catch (error) {
    logError('Error enforcing channel access', error, {
      userId: message.author.id,
      channelId: message.channelId,
    });
  }
});
```

### Authorization Logic

The enforcer checks authorization in this order:

1. **Non-read-only channels**: Always authorized
2. **No guild (DM)**: Always denied
3. **User not found**: Denied
4. **Moderator**: Authorized (Requirement 3.3)
5. **Has whitelist role**: Authorized (Requirement 3.4)
6. **Otherwise**: Denied

### Performance

- **Message deletion**: < 1 second (Requirement 3.1)
- **Access check**: O(1) for channel lookup, O(n) for role checking where n is number of user roles
- **Memory usage**: Minimal, only stores channel configurations
- **Database writes**: One violation record per deleted message

### Testing

The channel access enforcer has comprehensive unit tests covering:
- Read-only channel detection
- Moderator exemption
- Whitelist role validation
- Unauthorized message deletion
- DM notification sending
- Violation logging
- Configuration management
- Edge cases (empty messages, long messages, DM failures)

Run tests with:
```bash
npm test -- tests/unit/moderation/channel-access.test.ts
```

### Security Considerations

1. **Moderator role**: Ensure only trusted users have the moderator role
2. **Whitelist roles**: Carefully manage which roles can post in read-only channels
3. **DM privacy**: DM notifications may reveal channel restrictions to users
4. **Violation logging**: All deleted messages are logged for audit trails
5. **Permission checks**: Bot must have MANAGE_MESSAGES permission to delete messages

### Common Use Cases

#### Announcement Channels
Only moderators and specific roles can post announcements:

```typescript
enforcer.addReadOnlyChannel({
  channelId: 'announcements-channel-id',
  whitelistRoleIds: ['admin-role-id', 'moderator-role-id'],
});
```

#### Rules Channels
Only moderators can post rules:

```typescript
enforcer.addReadOnlyChannel({
  channelId: 'rules-channel-id',
  whitelistRoleIds: [], // Only moderators
});
```

#### Subscriber-Only Channels
Only subscribers and VIPs can post:

```typescript
enforcer.addReadOnlyChannel({
  channelId: 'subscriber-chat-id',
  whitelistRoleIds: ['subscriber-role-id', 'vip-role-id'],
});
```

#### Event Channels
Only event organizers can post:

```typescript
enforcer.addReadOnlyChannel({
  channelId: 'event-channel-id',
  whitelistRoleIds: ['event-organizer-role-id'],
});
```

### Troubleshooting

**Messages not being deleted:**
- Check bot has MANAGE_MESSAGES permission
- Verify channel ID is correct
- Ensure bot role is higher than user roles

**DM notifications not sending:**
- User may have DMs disabled (this is normal)
- Check bot can send DMs to users
- Verify DM content is not too long

**Moderators being blocked:**
- Verify moderator role ID is correct
- Check user actually has the moderator role
- Ensure role hierarchy is correct

**Whitelist roles not working:**
- Verify role IDs are correct
- Check user has the whitelist role
- Ensure role IDs are strings, not numbers

### Future Enhancements

Potential improvements for future versions:
- Temporary whitelist (time-limited posting permissions)
- Per-user whitelist (specific users can post)
- Scheduled read-only periods (channel is read-only during certain times)
- Custom DM messages per channel
- Webhook support for deleted message notifications
- Integration with audit log system
- Rate limiting for repeated unauthorized posts
- Auto-role assignment for frequent violators

### Example Files

See `channel-access.example.ts` for complete usage examples including:
- Basic setup
- Dynamic channel management
- Integration with event manager
- Access checking
- Configuration management
