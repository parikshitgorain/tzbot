# Configuration System

This module provides configuration management with hot-reload support for TZBOT.

## Features

- **Environment Variable Loading**: Loads configuration from `.env` file
- **Validation**: Validates all configuration values using Zod schemas
- **Hot-Reload**: Watches `.env` file for changes and reloads configuration without restart
- **Change Detection**: Detects which configuration values changed
- **Admin Notifications**: Notifies administrators when configuration changes
- **Error Handling**: Validates new configuration before applying, keeps current config if validation fails

## Usage

### Basic Configuration Loading

```typescript
import { config } from './config/index.js';

// Access configuration values
console.log(config.discordToken);
console.log(config.guildId);
```

### Hot-Reload Setup

```typescript
import { ConfigManager } from './config/config-manager.js';
import { config } from './config/index.js';

// Create config manager
const configManager = new ConfigManager(config, {
  configPath: '.env',
  debounceMs: 1000,
  notifyAdmins: async (event) => {
    // Send notification to administrators
    console.log('Config changed:', event.changedKeys);
  },
});

// Listen for config changes
configManager.on('config-changed', (event) => {
  console.log('Configuration updated:', event.changedKeys);
  
  // Update components with new config
  const newConfig = configManager.getConfig();
  // ... apply changes to your components
});

// Listen for validation errors
configManager.on('validation-error', (error) => {
  console.error('Invalid configuration:', error);
});

// Start watching for changes
configManager.startWatching();

// Later, stop watching
configManager.stopWatching();
```

### Manual Reload

```typescript
// Trigger a manual reload
await configManager.triggerReload();
```

## Configuration Values

### Required Settings

- `DISCORD_TOKEN`: Discord bot token
- `DISCORD_GUILD_ID`: Discord server ID
- `DISCORD_CLIENT_ID`: Discord application client ID
- `SUBSCRIBER_ROLE_ID`: Role ID for subscribers
- `VIP_ROLE_ID`: Role ID for VIPs
- `MODERATOR_ROLE_ID`: Role ID for moderators
- `NOTIFICATION_CHANNEL_ID`: Channel for notifications
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string

### Optional Settings

- `FALLBACK_CHANNEL_ID`: Fallback notification channel
- `KICK_API_KEY`: Kick.com API key
- `KICK_CHANNEL_ID`: Kick channel ID
- `GOOGLE_SAFE_BROWSING_API_KEY`: Google Safe Browsing API key
- `AI_ENABLED`: Enable AI auto-responder (default: false)
- `CHAT_RAIN_ENABLED`: Enable chat rain system (default: false)

### Rate Limiter Settings

- `RATE_LIMITER_RESTRICTED_CHANNELS`: Channel mappings in format `channelId1:redirectId1,channelId2:redirectId2`
- `RATE_LIMITER_WINDOW_MS`: Rate limit window in milliseconds (default: 60000 = 1 minute)
- `RATE_LIMITER_VIOLATION_WINDOW_MS`: Violation window duration in milliseconds (default: 300000 = 5 minutes)
- `RATE_LIMITER_WARNING_DELETE_DELAY_MS`: Warning message auto-delete delay in milliseconds (default: 10000 = 10 seconds)
- `RATE_LIMITER_CLEANUP_INTERVAL_MS`: Cleanup interval in milliseconds (default: 60000 = 1 minute)

See `types.ts` for complete list of configuration options.

## Hot-Reload Behavior

### What Happens on File Change

1. File change detected (debounced to prevent rapid reloads)
2. New `.env` file is read and parsed
3. New configuration is validated
4. If validation fails, current config is kept and error is logged
5. If validation succeeds, changes are detected
6. New configuration is applied
7. `config-changed` event is emitted
8. Administrators are notified (if configured)

### Debouncing

File changes are debounced by default (1000ms) to prevent multiple reloads when the file is being edited. This can be configured via the `debounceMs` option.

### Validation

All configuration changes are validated before being applied. If the new configuration is invalid:
- The current configuration is kept
- An error is logged
- A `validation-error` event is emitted
- Administrators are NOT notified (to avoid spam)

### Change Detection

The config manager compares old and new configurations to detect which values changed. Only changed keys are reported in the `config-changed` event.

## Events

### `config-changed`

Emitted when configuration is successfully reloaded and changes are detected.

```typescript
interface ConfigChangeEvent {
  oldConfig: BotConfig;
  newConfig: BotConfig;
  changedKeys: string[];
  timestamp: Date;
}
```

### `validation-error`

Emitted when new configuration fails validation.

```typescript
configManager.on('validation-error', (error: Error) => {
  console.error('Invalid config:', error.message);
});
```

## Best Practices

1. **Always validate**: Never bypass validation when applying configuration changes
2. **Handle errors**: Listen for `validation-error` events to detect configuration issues
3. **Graceful updates**: Update components gracefully when configuration changes
4. **Test changes**: Test configuration changes in development before applying to production
5. **Monitor logs**: Watch logs for configuration reload events and errors
6. **Notify admins**: Configure admin notifications to be aware of configuration changes

## Security Considerations

- Sensitive values (tokens, API keys) should be encrypted at rest
- Configuration file should have restricted permissions (600)
- Validate all configuration values before applying
- Log all configuration changes for audit trail
- Notify administrators of configuration changes

## Property Validation

This module implements:

**Property 52: Configuration Hot-Reload**
- For any configuration change made while the bot is running, the new configuration should be applied without requiring a restart.
- Validates: Requirements 12.4
