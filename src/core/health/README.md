# Health Check System

The health check system monitors the health of all critical system components and alerts administrators when issues are detected.

## Features

- **Component Monitoring**: Checks Discord, Kick API, Database, and Redis cache
- **Periodic Checks**: Runs health checks at configurable intervals (default: 30 seconds)
- **Latency Tracking**: Measures response time for each component
- **Failure Detection**: Tracks consecutive failures and alerts after threshold
- **Administrator Alerts**: Sends Discord DMs to configured admins on critical issues
- **System Metrics**: Reports uptime, memory usage, and CPU usage

## Requirements

Validates requirements:
- **13.5**: Resource threshold monitoring and alerting
- **14.1**: System uptime and reliability monitoring

## Usage

### Basic Setup

```typescript
import { HealthCheckSystem } from './core/health/health-check.js';
import { Logger } from './core/logger/logger.js';

// Initialize health check system
const healthCheck = new HealthCheckSystem(
  {
    checkIntervalMs: 30000, // Check every 30 seconds
    alertThreshold: 3, // Alert after 3 consecutive failures
    adminUserIds: ['123456789012345678'], // Admin Discord IDs
  },
  logger
);

// Set components to monitor
healthCheck.setDiscordClient(discordClient);
healthCheck.setKickClient(kickClient);
healthCheck.setDatabase(database);
healthCheck.setCache(cache);

// Start periodic checks
healthCheck.startPeriodicChecks();
```

### Manual Health Check

```typescript
// Get overall system health
const health = await healthCheck.getSystemHealth();

console.log(`Status: ${health.overall}`); // 'healthy', 'degraded', or 'down'
console.log(`Uptime: ${health.uptime}s`);
console.log(`Memory: ${health.memoryUsage} MB`);

// Check individual components
for (const [name, status] of Object.entries(health.components)) {
  console.log(`${name}: ${status.healthy ? '✅' : '❌'}`);
  console.log(`  Latency: ${status.latency}ms`);
  if (status.error) {
    console.log(`  Error: ${status.error}`);
  }
}
```

### Individual Component Checks

```typescript
// Check Discord connection
const discordHealth = await healthCheck.checkDiscordHealth();
console.log(`Discord: ${discordHealth.healthy ? 'OK' : 'FAIL'}`);

// Check Kick API
const kickHealth = await healthCheck.checkKickHealth();
console.log(`Kick API: ${kickHealth.healthy ? 'OK' : 'FAIL'}`);

// Check Database
const dbHealth = await healthCheck.checkDatabaseHealth();
console.log(`Database: ${dbHealth.healthy ? 'OK' : 'FAIL'}`);

// Check Redis Cache
const cacheHealth = await healthCheck.checkCacheHealth();
console.log(`Cache: ${cacheHealth.healthy ? 'OK' : 'FAIL'}`);
```

### HTTP Health Endpoint

The webhook server already exposes a `/health` endpoint that can be used for external monitoring:

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2025-01-01T12:00:00.000Z",
  "requests": {
    "total": 1234,
    "errors": 5
  },
  "webhook": {
    "healthy": true,
    "lastWebhookTime": "2025-01-01T11:59:30.000Z"
  }
}
```

## Configuration

### HealthCheckConfig

```typescript
interface HealthCheckConfig {
  checkIntervalMs: number;    // Interval between checks (default: 30000)
  alertThreshold: number;      // Consecutive failures before alert (default: 3)
  adminUserIds: string[];      // Discord user IDs to alert
}
```

### Health Thresholds

Each component has specific health criteria:

- **Discord**: Unhealthy if WebSocket ping > 500ms or not connected
- **Kick API**: Unhealthy if response time > 5000ms or request fails
- **Database**: Unhealthy if query time > 1000ms or connection fails
- **Redis**: Unhealthy if ping time > 500ms or connection fails

### Overall Status

The overall system status is determined by:

- **healthy**: All components are healthy
- **degraded**: Non-critical components (Kick API, Redis) are unhealthy
- **down**: Critical components (Discord, Database) are unhealthy

## Health Status Interface

```typescript
interface HealthStatus {
  healthy: boolean;      // Component health status
  latency: number;       // Response time in milliseconds
  lastCheck: Date;       // Timestamp of last check
  error?: string;        // Error message if unhealthy
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'down';
  components: {
    discord: HealthStatus;
    kick: HealthStatus;
    database: HealthStatus;
    cache: HealthStatus;
  };
  uptime: number;        // System uptime in seconds
  memoryUsage: number;   // Memory usage in MB
  cpuUsage: number;      // CPU usage in seconds
}
```

## Administrator Alerts

When the system status becomes 'down' and the alert threshold is reached, the health check system will:

1. Log a critical error with full health details
2. Send Discord DMs to all configured admin users
3. Include information about failed components and errors

Alert message format:
```
🚨 **System Health Critical** 🚨

Overall Status: down
Uptime: 3600s

Failed Components:
- discord: Discord WebSocket not connected
- database: Connection timeout

Please investigate immediately.
```

## Graceful Shutdown

Always stop periodic checks during shutdown:

```typescript
process.on('SIGINT', async () => {
  healthCheck.stopPeriodicChecks();
  // ... other cleanup
});
```

## Integration with Monitoring Tools

The health check system can be integrated with external monitoring tools:

### Prometheus

Export metrics for Prometheus scraping:

```typescript
app.get('/metrics', async (req, res) => {
  const health = await healthCheck.getSystemHealth();
  
  const metrics = [
    `system_health{status="${health.overall}"} 1`,
    `system_uptime_seconds ${health.uptime}`,
    `system_memory_mb ${health.memoryUsage}`,
    `component_health{component="discord"} ${health.components.discord.healthy ? 1 : 0}`,
    `component_health{component="kick"} ${health.components.kick.healthy ? 1 : 0}`,
    `component_health{component="database"} ${health.components.database.healthy ? 1 : 0}`,
    `component_health{component="cache"} ${health.components.cache.healthy ? 1 : 0}`,
    `component_latency_ms{component="discord"} ${health.components.discord.latency}`,
    `component_latency_ms{component="kick"} ${health.components.kick.latency}`,
    `component_latency_ms{component="database"} ${health.components.database.latency}`,
    `component_latency_ms{component="cache"} ${health.components.cache.latency}`,
  ].join('\n');
  
  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});
```

### Uptime Monitoring

Use the `/health` endpoint with services like:
- UptimeRobot
- Pingdom
- StatusCake
- Better Uptime

Configure them to check the endpoint every 1-5 minutes and alert on non-200 responses.

## Best Practices

1. **Set Appropriate Intervals**: 30 seconds is recommended for production
2. **Configure Alert Threshold**: 3 consecutive failures prevents false alarms
3. **Monitor Logs**: Review health check logs regularly
4. **Test Alerts**: Verify admin alerts work before production
5. **Use External Monitoring**: Combine with external uptime monitoring
6. **Track Trends**: Monitor latency trends over time
7. **Set Up Dashboards**: Visualize health metrics in Grafana or similar

## Troubleshooting

### High Discord Latency

- Check network connectivity
- Verify Discord API status
- Consider moving to a different region

### Kick API Failures

- Verify API credentials
- Check Kick API status
- Review rate limiting

### Database Slow Queries

- Check database connection pool
- Review slow query logs
- Optimize indexes

### Redis Connection Issues

- Verify Redis server is running
- Check Redis configuration
- Review Redis logs

## Example Output

```
=== System Health Check ===

Overall Status: healthy
Uptime: 3600s
Memory Usage: 245.67 MB
CPU Usage: 12.34s

Component Status:
✅ discord: healthy
   Latency: 45ms
✅ kick: healthy
   Latency: 234ms
✅ database: healthy
   Latency: 12ms
✅ cache: healthy
   Latency: 3ms
```

## See Also

- [Logger Documentation](../logger/README.md)
- [Database Documentation](../database/README.md)
- [Redis Cache Documentation](../cache/README.md)
- [Kick API Client Documentation](../../services/kick/README.md)
