# Redis Client

Redis client implementation with connection pooling, automatic reconnection, and error handling.

## Features

- **Connection Management**: Automatic connection with retry logic
- **Connection Pooling**: Built-in connection pooling via ioredis
- **Error Handling**: Comprehensive error handling and logging
- **Reconnection**: Automatic reconnection with exponential backoff
- **Health Checks**: Connection health monitoring
- **Common Operations**: Get, set, delete, expire, increment, decrement, and more

## Usage

### Basic Operations

```typescript
import { redisClient } from '@/core/cache/index.js';

// Connect to Redis
await redisClient.connect();

// Test connectivity
const isHealthy = await redisClient.testConnection();
console.log('Redis healthy:', isHealthy);

// Set a value
await redisClient.set('user:123', 'John Doe');

// Set a value with TTL (60 seconds)
await redisClient.set('session:abc', 'token123', 60);

// Get a value
const user = await redisClient.get('user:123');

// Delete a key
await redisClient.del('user:123');

// Check if key exists
const exists = await redisClient.exists('user:123');

// Set expiration on existing key
await redisClient.expire('session:abc', 120);

// Disconnect
await redisClient.disconnect();
```

### Counter Operations

```typescript
// Increment a counter
const newValue = await redisClient.incr('page:views');

// Decrement a counter
const decremented = await redisClient.decr('inventory:item123');
```

### Batch Operations

```typescript
// Get multiple values
const values = await redisClient.mget('key1', 'key2', 'key3');

// Set multiple values
await redisClient.mset({
  'key1': 'value1',
  'key2': 'value2',
  'key3': 'value3',
});
```

### Connection Status

```typescript
const status = redisClient.getConnectionStatus();
console.log('Connected:', status.connected);
console.log('Reconnect attempts:', status.reconnectAttempts);
```

## Configuration

Redis client uses configuration from environment variables:

```env
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_password_here
```

## Error Handling

All operations throw errors if the client is not connected or if Redis operations fail. Errors are automatically logged using the application logger.

```typescript
try {
  await redisClient.set('key', 'value');
} catch (error) {
  console.error('Redis operation failed:', error);
}
```

## Reconnection Strategy

The client implements exponential backoff for reconnection:
- Initial delay: 1 second
- Maximum delay: 60 seconds
- Maximum attempts: 10

After 10 failed attempts, the client stops trying to reconnect.

## Use Cases

### Rate Limiting

```typescript
// Token bucket rate limiting
const key = `ratelimit:user:${userId}`;
const limit = 60; // requests per minute

const current = await redisClient.incr(key);
if (current === 1) {
  await redisClient.expire(key, 60);
}

if (current > limit) {
  throw new Error('Rate limit exceeded');
}
```

### Caching

```typescript
// Cache with TTL
const cacheKey = `cache:user:${userId}`;
const cached = await redisClient.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const data = await fetchUserFromDatabase(userId);
await redisClient.set(cacheKey, JSON.stringify(data), 300); // 5 minutes
return data;
```

### Session Management

```typescript
// Store session
const sessionId = generateSessionId();
await redisClient.set(
  `session:${sessionId}`,
  JSON.stringify(sessionData),
  3600 // 1 hour
);

// Retrieve session
const session = await redisClient.get(`session:${sessionId}`);
if (session) {
  return JSON.parse(session);
}
```

## Testing

Unit tests use mocked Redis client:

```bash
npm test -- tests/unit/core/cache/redis.client.test.ts
```

Integration tests require a running Redis instance:

```bash
npm test -- tests/integration/redis.integration.test.ts
```

## Requirements Validation

This implementation satisfies:
- **Requirement 10.8**: Rate limiting support for AI responses
- **Requirement 15.6**: API rate limiting (60 requests per minute per user)
