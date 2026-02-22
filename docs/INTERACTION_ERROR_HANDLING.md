# Discord Interaction Error Handling

## Problem Overview

Discord interactions have strict timing requirements that can cause errors if not handled properly:

1. **Initial Response Window**: 3 seconds to acknowledge an interaction
2. **Token Expiration**: 15 minutes to complete all interaction responses
3. **Single Acknowledgment**: An interaction can only be acknowledged once

## Common Errors

### Error 10062: Unknown Interaction
- **Cause**: Interaction token expired (usually after 3 seconds for initial response)
- **When**: Trying to respond to an interaction after the token expired
- **Solution**: Always defer the reply immediately if the operation takes time

### Error 40060: Interaction Already Acknowledged
- **Cause**: Attempting to acknowledge an interaction that was already acknowledged
- **When**: Calling `reply()` or `deferReply()` multiple times, or in error handlers after already responding
- **Solution**: Check interaction state before responding

## Best Practices

### 1. Defer Immediately for Long Operations

```typescript
handler: async (interaction: ChatInputCommandInteraction) => {
  try {
    // Defer FIRST if operation might take >3 seconds
    await interaction.deferReply({ ephemeral: true });
    
    // Do your work here
    await someSlowOperation();
    
    // Use editReply after deferring
    await interaction.editReply({
      content: '✅ Operation completed!',
    });
  } catch (error) {
    // Handle errors properly
  }
}
```

### 2. Proper Error Handling

```typescript
try {
  // Your command logic
} catch (error) {
  logger.error('Command failed', { error });
  
  try {
    // Check interaction state before responding
    if (interaction.deferred && !interaction.replied) {
      await interaction.editReply({
        content: '❌ An error occurred.',
      });
    } else if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ An error occurred.',
        ephemeral: true,
      });
    } else {
      // Can't respond - log it
      logger.warn('Cannot respond to interaction - already replied or token expired');
    }
  } catch (replyError) {
    // Token expired or other error - just log
    logger.error('Failed to send error response', { error: replyError });
  }
}
```

### 3. Use Safe Response Utilities

The codebase includes utility functions in `src/utils/interaction-response.ts`:

```typescript
import { safeReply, safeEditReply, safeDeferReply } from '@/utils/interaction-response.js';

// Safely defer
await safeDeferReply(interaction, { ephemeral: true });

// Safely reply (handles deferred/replied state automatically)
await safeReply(interaction, {
  content: 'Response message',
  ephemeral: true,
});

// Safely edit
await safeEditReply(interaction, {
  content: 'Updated message',
});
```

## Interaction State Flow

```
Initial State
    ↓
[deferReply()] → deferred = true
    ↓
[editReply()] → replied = true
    ↓
[followUp()] → Can be called multiple times
```

OR

```
Initial State
    ↓
[reply()] → replied = true
    ↓
[followUp()] → Can be called multiple times
```

## Timing Guidelines

- **< 3 seconds**: Can use `reply()` directly
- **3-15 seconds**: Must use `deferReply()` then `editReply()`
- **> 15 seconds**: Not supported - consider using webhooks or background jobs

## Fixed Issues

### Announcement Setup Command
**Problem**: The command was creating/updating the AnnouncementRelayManager synchronously, which could take longer than 3 seconds, causing the interaction token to expire.

**Solution**:
1. Wrapped relay manager initialization in try-catch to prevent failures from blocking the response
2. Added proper error handling that checks interaction state before responding
3. Improved error logging to distinguish between token expiration and other errors

### Command Manager
**Problem**: Error handler was trying to use `followUp()` for deferred interactions, which should use `editReply()`.

**Solution**:
1. Check if interaction is `replied` vs `deferred` separately
2. Use `editReply()` for deferred interactions
3. Use `followUp()` only for already-replied interactions
4. Wrap error responses in try-catch to handle token expiration gracefully

## Testing

To test interaction error handling:

1. **Simulate slow operations**: Add delays to test deferred replies
2. **Test error paths**: Throw errors at different stages to verify error handling
3. **Check logs**: Verify proper error codes are logged (10062, 40060)
4. **Monitor Discord**: Ensure users see appropriate error messages

## References

- [Discord API Error Codes](https://discord.com/developers/docs/topics/opcodes-and-status-codes#json)
- [Discord.js Interaction Guide](https://discordjs.guide/interactions/replying-to-slash-commands.html)
