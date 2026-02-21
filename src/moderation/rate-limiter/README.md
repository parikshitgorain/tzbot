# Channel Text Rate Limiter

A Discord bot feature that limits text message frequency in designated channels while allowing unlimited media attachments.

## Features

- Limit text messages to 1 per minute in restricted channels
- Unlimited photos, videos, and attachments
- Automatic message deletion for violations
- Warning messages with auto-delete (10 seconds)
- 5-minute violation window with silent deletion
- Automatic state cleanup
- Redis storage with in-memory fallback

## Discord Commands

### `/ratelimit-add`
Add a channel to rate limiting.

**Usage:**
```
/ratelimit-add restricted:#channel-name redirect:#chat-channel
```

**Parameters:**
- `restricted`: The channel to apply rate limiting to
- `redirect`: The channel where users should chat freely

**Permissions:** Manage Channels

**Example:**
```
/ratelimit-add restricted:#announcements redirect:#general-chat
```

### `/ratelimit-remove`
Remove a channel from rate limiting.

**Usage:**
```
/ratelimit-remove channel:#channel-name
```

**Parameters:**
- `channel`: The channel to remove from rate limiting

**Permissions:** Manage Channels

### `/ratelimit-list`
List all rate limited channels.

**Usage:**
```
/ratelimit-list
```

**Permissions:** Manage Channels

## How It Works

### Message Flow

1. User sends a message in a restricted channel
2. Bot checks if message is from a bot → Skip
3. Bot checks if message contains media → Allow (unlimited)
4. Bot checks if message is text → Apply rate limiting

### Rate Limiting Logic

**First Violation:**
1. Delete the violating message
2. Send warning: "Hey @user looks like you are chatting in #channel. Kindly go #redirect-channel for chatting. I'm deleting the message to keep the channel clean."
3. Warning auto-deletes after 10 seconds
4. User enters 5-minute violation window

**During Violation Window (5 minutes):**
1. All text messages are deleted immediately
2. No additional warnings sent
3. User must wait for window to expire

**After Violation Window:**
1. User can send 1 text message per minute again
2. Violations reset after window expires

### State Management

- **Message Timestamps**: Stored for 60 seconds (rate limit window)
- **Violation Windows**: Stored for 300 seconds (5 minutes)
- **Cleanup**: Runs every 60 seconds to remove expired data
- **Storage**: Redis (primary) with in-memory fallback

## Configuration

### Environment Variables

```bash
# Channel mappings (channelId:redirectId,channelId:redirectId)
RATE_LIMITER_RESTRICTED_CHANNELS=123456789:987654321,111222333:444555666

# Rate limit window (default: 60000ms = 1 minute)
RATE_LIMITER_WINDOW_MS=60000

# Violation window (default: 300000ms = 5 minutes)
RATE_LIMITER_VIOLATION_WINDOW_MS=300000

# Warning auto-delete delay (default: 10000ms = 10 seconds)
RATE_LIMITER_WARNING_DELETE_DELAY_MS=10000

# Cleanup interval (default: 60000ms = 1 minute)
RATE_LIMITER_CLEANUP_INTERVAL_MS=60000
```

### Database Configuration

Alternatively, use Discord commands to manage channels (stored in database):

```
/ratelimit-add restricted:#announcements redirect:#general-chat
/ratelimit-list
/ratelimit-remove channel:#announcements
```

**Note:** Bot restart required after using commands for changes to take effect.

## Architecture

### Components

1. **StateStore**: Manages rate limit state (Redis/in-memory)
2. **MessageClassifier**: Identifies bot/media/text messages
3. **RateLimitEnforcer**: Checks rate limits and manages violations
4. **MessageActionHandler**: Deletes messages and sends warnings
5. **ChannelTextRateLimiter**: Main orchestrator

### Data Flow

```
Discord Message
    ↓
MessageClassifier (bot? media? restricted?)
    ↓
RateLimitEnforcer (check timestamps & violations)
    ↓
MessageActionHandler (delete & warn)
    ↓
StateStore (update state)
```

## Error Handling

### Discord API Errors

- **Missing Permissions**: Logged, operation continues
- **Unknown Message**: Logged as warning (already deleted)
- **Rate Limit**: Respects Discord rate limits

### State Store Errors

- **Redis Connection Failure**: Falls back to in-memory storage
- **Read/Write Failures**: Logged, returns safe defaults

## Monitoring

### Logs

The rate limiter logs the following events:

- Rate limit violations
- Warning messages sent
- Silent deletions during violation window
- State cleanup operations
- Configuration changes
- Errors and warnings

### Log Levels

- **INFO**: Rate limit violations, warnings sent
- **DEBUG**: Silent deletions, state updates
- **WARN**: Failed deletions, missing permissions
- **ERROR**: Critical failures, state store errors

## Best Practices

1. **Choose Redirect Channels Wisely**: Ensure redirect channels are appropriate for general chat
2. **Monitor Logs**: Watch for permission errors or excessive violations
3. **Test Configuration**: Test in a staging environment before production
4. **Communicate Changes**: Inform users when enabling rate limiting
5. **Regular Cleanup**: Monitor state store size and cleanup frequency

## Troubleshooting

### Messages Not Being Deleted

1. Check bot has "Manage Messages" permission
2. Verify channel is in restricted channels list
3. Check logs for permission errors
4. Ensure bot role is above user roles

### Rate Limiting Not Working

1. Verify configuration is loaded (check logs on startup)
2. Restart bot after configuration changes
3. Check Redis connection status
4. Verify channels are text channels

### Warning Messages Not Appearing

1. Check bot has "Send Messages" permission
2. Verify redirect channel exists
3. Check logs for send failures
4. Ensure bot is not rate limited by Discord

## Performance

- **Memory Usage**: ~100 bytes per active user per channel
- **Redis Operations**: 2-4 per message (get/set timestamps)
- **Cleanup Overhead**: Minimal (runs every 60 seconds)
- **Message Processing**: <10ms per message

## Security

- **Permission Checks**: Requires Manage Channels for configuration
- **Input Validation**: Channel IDs validated before storage
- **State Isolation**: Per-user, per-channel state tracking
- **No PII Storage**: Only stores user IDs and timestamps

## Future Enhancements

- Hot-reload configuration without restart
- Per-channel rate limit customization
- Whitelist roles (bypass rate limiting)
- Analytics dashboard
- Configurable warning messages
- Multiple rate limit tiers
