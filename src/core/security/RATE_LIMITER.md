# Rate Limiter

Token bucket rate limiting system using Redis for distributed rate limiting across bot instances.

## Overview

The rate limiter implements the token bucket algorithm to control request rates. Each user/entity has a bucket of tokens that refills at a constant rate. Each request consumes tokens, and requests are denied when the bucket is empty.

## Features

- **Token Bucket Algorithm**: Smooth rate limiting with burst capacity
- **Redis-Backed**: Distributed rate limiting across multiple bot instances
- **Configurable**: Flexible rate limit configurations for different use cases
- **Graceful Degradation**: Fails open if Redis is unavailable
- **Automatic Refill**: Tokens refill continuously based on configured rate

## Usage

### Basic Usage

```typescript
import { rateLimiter, RateLimitPresets } from '@/core/security/rate-limiter.js';

// Check API rate limit for a user
const result = await rateLimiter.checkLimit(
  userId,
  RateLimitPresets.API
);

if (!result.allowed) {
  await interaction.reply({
    content: `Rate limit exceeded. Try again in ${Math.ceil(result.retryAfter! / 1000)}s`,
    ephemeral: true,
  });
  return;
}

// Process the request
await processApiRequest(userId);
```

### Custom Rate Limits

```typescript
import { rateLimiter } from '@/core/security/rate-limiter.js';

// Custom rate limit: 5 requests per 10 seconds
const customConfig = {
  maxTokens: 5,
  refillRate: 0.5, // 0.5 tokens per second = 5 per 10 seconds
  keyPrefix: 'custom',
};

const result = await rateLimiter.checkLimit(userId, customConfig);
```

### Consuming Multiple Tokens

```typescript
// Consume 3 tokens for a heavy operation
const result = await rateLimiter.checkLimit(
  userId,
  RateLimitPresets.API,
  3 // tokens to consume
);
```

### Checking Status

```typescript
// Get current token count without consuming
const remaining = await rateLimiter.getStatus(userId, RateLimitPresets.API);
console.log(`User has ${remaining} tokens remaining`);
```

### Resetting Limits

```typescript
// Reset rate limit for a user (e.g., after moderator override)
await rateLimiter.reset(userId, 'api');
```

## Predefined Presets

### API Requests
- **Limit**: 60 requests per minute
- **Use Case**: General API endpoints
- **Key Prefix**: `api`

```typescript
RateLimitPresets.API
```

### Commands
- **Limit**: 10 commands per minute
- **Use Case**: Slash commands, moderation actions
- **Key Prefix**: `command`

```typescript
RateLimitPresets.COMMAND
```

### AI Responses
- **Limit**: 1 response per 30 seconds
- **Use Case**: AI auto-responder
- **Key Prefix**: `ai`

```typescript
RateLimitPresets.AI_RESPONSE
```

### Giveaway Entries
- **Limit**: 1 entry (no refill)
- **Use Case**: One-time giveaway entries
- **Key Prefix**: `giveaway`

```typescript
RateLimitPresets.GIVEAWAY_ENTRY
```

## Token Bucket Algorithm

The token bucket algorithm works as follows:

1. **Initialization**: Bucket starts with `maxTokens` tokens
2. **Refill**: Tokens are added at `refillRate` per second
3. **Consumption**: Each request consumes tokens
4. **Limit**: Requests are denied when tokens < required amount
5. **Burst**: Allows bursts up to `maxTokens` when bucket is full

### Example

For API preset (60 tokens, 1 token/second):
- User can make 60 requests immediately (burst)
- After burst, limited to 1 request per second
- Bucket refills to 60 tokens over 60 seconds of inactivity

## Rate Limit Response

The `checkLimit` method returns:

```typescript
interface RateLimitResult {
  allowed: boolean;      // Whether request is allowed
  remaining: number;     // Tokens remaining after this request
  retryAfter?: number;   // Milliseconds until next token (if denied)
}
```

## Integration Examples

### Command Handler

```typescript
async function handleCommand(interaction: CommandInteraction) {
  const userId = interaction.user.id;
  
  // Check rate limit
  const result = await rateLimiter.checkLimit(
    userId,
    RateLimitPresets.COMMAND
  );
  
  if (!result.allowed) {
    await interaction.reply({
      content: `Slow down! Try again in ${Math.ceil(result.retryAfter! / 1000)} seconds.`,
      ephemeral: true,
    });
    return;
  }
  
  // Execute command
  await executeCommand(interaction);
}
```

### API Endpoint

```typescript
app.post('/api/action', async (req, res) => {
  const userId = req.body.userId;
  
  // Check rate limit
  const result = await rateLimiter.checkLimit(
    userId,
    RateLimitPresets.API
  );
  
  if (!result.allowed) {
    res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil(result.retryAfter! / 1000),
    });
    return;
  }
  
  // Process request
  const data = await processAction(userId);
  res.json(data);
});
```

### AI Responder

```typescript
async function handleAIQuestion(message: Message) {
  const userId = message.author.id;
  
  // Check AI rate limit
  const result = await rateLimiter.checkLimit(
    userId,
    RateLimitPresets.AI_RESPONSE
  );
  
  if (!result.allowed) {
    // Silently skip - don't spam user with rate limit messages
    logger.debug('AI rate limit exceeded', { userId });
    return;
  }
  
  // Generate AI response
  const response = await generateAIResponse(message.content);
  await message.reply(response);
}
```

## Configuration

Rate limits are configured with:

```typescript
interface RateLimitConfig {
  maxTokens: number;     // Maximum tokens in bucket
  refillRate: number;    // Tokens added per second
  keyPrefix?: string;    // Redis key prefix
}
```

### Calculating Refill Rate

To achieve a specific rate limit:

- **X requests per minute**: `refillRate = X / 60`
- **X requests per hour**: `refillRate = X / 3600`
- **1 request per X seconds**: `refillRate = 1 / X`

Examples:
- 60 per minute: `refillRate = 1`
- 10 per minute: `refillRate = 1/6`
- 1 per 30 seconds: `refillRate = 1/30`

## Redis Keys

Rate limit data is stored in Redis with keys:
```
{keyPrefix}:{identifier}
```

Examples:
- `api:123456789` - API rate limit for user 123456789
- `command:987654321` - Command rate limit for user 987654321
- `giveaway:abc-123:456789` - Giveaway entry for user 456789 in giveaway abc-123

## Error Handling

The rate limiter implements graceful degradation:

- **Redis Unavailable**: Fails open (allows requests)
- **Parse Errors**: Logs error and allows request
- **Network Issues**: Allows request to prevent service disruption

This ensures the bot remains functional even if Redis is down, though rate limiting will be disabled.

## Logging

Rate limit violations are logged at DEBUG level:

```typescript
logger.debug('Rate limit exceeded', {
  key: 'api:123456789',
  available: 0.5,
  needed: 1,
  retryAfter: 500,
});
```

## Testing

See `tests/unit/core/security/rate-limiter.test.ts` for comprehensive unit tests.

## Requirements

Validates **Requirement 15.6**: API Rate Limiting
- Maximum 60 requests per minute per user
- Applies to all API endpoints
- Logs rate limit violations

## Related

- [Encryption](./encryption.ts) - Data encryption utilities
- [Redis Client](../cache/redis.client.ts) - Redis connection management
- [Logger](../logger/logger.ts) - Logging system
