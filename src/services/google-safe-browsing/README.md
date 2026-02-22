# Google Safe Browsing API Client

This module provides integration with Google Safe Browsing API v4 for detecting phishing and malware URLs.

## Features

- **URL Threat Detection**: Check URLs against Google's threat databases (malware, phishing, unwanted software)
- **Result Caching**: Cache results for 30 minutes to reduce API calls
- **Rate Limiting**: Automatic rate limit management (10,000 queries/day free tier)
- **Batch Operations**: Check multiple URLs in a single request
- **Graceful Degradation**: Returns safe results when API is unavailable or rate limited

## Configuration

Add your Google Safe Browsing API key to `.env`:

```env
GOOGLE_SAFE_BROWSING_API_KEY=your_api_key_here
```

### Getting an API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the "Safe Browsing API"
4. Create credentials (API Key)
5. Copy the API key to your `.env` file

## Usage

### Basic URL Check

```typescript
import { googleSafeBrowsingClient } from '@/services/google-safe-browsing/client.js';

// Check a single URL
const result = await googleSafeBrowsingClient.checkUrl('https://example.com');

if (!result.isSafe) {
  console.log('Threat detected!', result.threats);
  // Handle malicious URL
}
```

### Batch URL Check

```typescript
const urls = [
  'https://example1.com',
  'https://example2.com',
  'https://example3.com',
];

const results = await googleSafeBrowsingClient.checkUrls(urls);

results.forEach((result) => {
  if (!result.isSafe) {
    console.log(`Threat detected in ${result.url}:`, result.threats);
  }
});
```

### Check Rate Limit Status

```typescript
const status = await googleSafeBrowsingClient.getRateLimitStatus();

console.log(`Used ${status.count} of ${status.limit} daily queries`);
console.log(`Resets at: ${status.resetAt}`);
```

### Clear Cache

```typescript
// Clear cache for a specific URL
await googleSafeBrowsingClient.clearCache('https://example.com');
```

## API Response

The `checkUrl` and `checkUrls` methods return `UrlCheckResult` objects:

```typescript
interface UrlCheckResult {
  url: string;           // The checked URL
  isSafe: boolean;       // True if no threats detected
  threats: ThreatType[]; // Array of detected threat types
  cached: boolean;       // True if result came from cache
  checkedAt: Date;       // When the check was performed
}
```

### Threat Types

- `MALWARE`: Malicious software
- `SOCIAL_ENGINEERING`: Phishing/deceptive content
- `UNWANTED_SOFTWARE`: Unwanted software
- `POTENTIALLY_HARMFUL_APPLICATION`: Potentially harmful apps

## Caching

Results are automatically cached in Redis for 30 minutes to:
- Reduce API calls
- Improve response time
- Stay within rate limits

Cache keys are prefixed with `gsb:url:` followed by the URL.

## Rate Limiting

The free tier provides 10,000 queries per day. The client:
- Tracks daily usage in Redis
- Resets counter at midnight UTC
- Returns safe results when rate limited (to avoid blocking legitimate URLs)
- Logs warnings at 90% of daily limit

## Error Handling

The client handles errors gracefully:
- Returns safe results on API errors (to avoid false positives)
- Logs all errors for monitoring
- Continues operation even if Redis is unavailable

## Integration with Link Scanning

This client is used by the moderation system's link scanning feature:

```typescript
import { googleSafeBrowsingClient } from '@/services/google-safe-browsing/client.js';

async function scanMessageLinks(message: string): Promise<boolean> {
  const urls = extractUrls(message);
  const results = await googleSafeBrowsingClient.checkUrls(urls);
  
  return results.some((result) => !result.isSafe);
}
```

## Performance

- **Cache Hit**: <5ms (Redis lookup)
- **Cache Miss**: 200-500ms (API request)
- **Batch Request**: 300-800ms (multiple URLs)

## Monitoring

Monitor the client's performance:

```typescript
// Check if API is configured
if (!googleSafeBrowsingClient.isConfigured()) {
  console.warn('Google Safe Browsing API not configured');
}

// Check rate limit status
const status = await googleSafeBrowsingClient.getRateLimitStatus();
console.log('Rate limit status:', status);
```

## Best Practices

1. **Batch Requests**: Check multiple URLs together when possible
2. **Cache Awareness**: Results are cached for 30 minutes
3. **Rate Limit Monitoring**: Monitor daily usage to avoid hitting limits
4. **Error Handling**: Always handle the case where API is unavailable
5. **False Positives**: Consider manual review for flagged URLs

## Limitations

- **Free Tier**: 10,000 queries/day
- **Cache Duration**: 30 minutes (configurable)
- **Batch Size**: Up to 500 URLs per request
- **Latency**: 200-500ms per request (uncached)

## Testing

See `tests/unit/services/google-safe-browsing/client.test.ts` for unit tests.

## References

- [Google Safe Browsing API Documentation](https://developers.google.com/safe-browsing/v4)
- [API Pricing](https://developers.google.com/safe-browsing/v4/usage-limits)
- [Threat Types](https://developers.google.com/safe-browsing/v4/lists)
