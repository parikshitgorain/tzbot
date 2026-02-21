/**
 * @file config-manager.example.ts
 * @description Examples of using the ConfigManager for hot-reload
 * @module config
 */

import { ConfigManager, ConfigChangeEvent } from './config-manager.js';
import { config } from './index.js';
import type { BotConfig } from './types.js';

/**
 * Example 1: Basic hot-reload setup
 */
async function basicHotReload() {
  console.log('=== Example 1: Basic Hot-Reload ===\n');

  // Create config manager with current config
  const configManager = new ConfigManager(config);

  // Listen for config changes
  configManager.on('config-changed', (event: ConfigChangeEvent) => {
    console.log('Configuration changed!');
    console.log('Changed keys:', event.changedKeys);
    console.log('Timestamp:', event.timestamp);
  });

  // Start watching for changes
  configManager.startWatching();

  console.log('Config manager started. Edit .env file to see hot-reload in action.');
  console.log('Press Ctrl+C to exit.\n');

  // Keep process running
  await new Promise(() => {});
}

/**
 * Example 2: Hot-reload with admin notifications
 */
async function hotReloadWithNotifications() {
  console.log('=== Example 2: Hot-Reload with Admin Notifications ===\n');

  // Mock Discord client for sending notifications
  const mockDiscordClient = {
    sendMessage: async (channelId: string, content: string) => {
      console.log(`[NOTIFICATION to ${channelId}]: ${content}`);
    },
  };

  // Create config manager with admin notification
  const configManager = new ConfigManager(config, {
    configPath: '.env',
    debounceMs: 1000,
    notifyAdmins: async (event: ConfigChangeEvent) => {
      const message = `⚙️ Configuration Updated\n\n` +
        `Changed settings: ${event.changedKeys.join(', ')}\n` +
        `Time: ${event.timestamp.toISOString()}`;

      // Send to admin channel
      await mockDiscordClient.sendMessage('admin-channel-id', message);
    },
  });

  // Listen for config changes
  configManager.on('config-changed', (event: ConfigChangeEvent) => {
    console.log('Configuration reloaded successfully');
    console.log('Changed keys:', event.changedKeys);
  });

  // Listen for validation errors
  configManager.on('validation-error', (error: Error) => {
    console.error('Configuration validation failed:', error.message);
  });

  // Start watching
  configManager.startWatching();

  console.log('Config manager with notifications started.');
  console.log('Edit .env file to see notifications.\n');

  await new Promise(() => {});
}

/**
 * Example 3: Applying config changes to components
 */
async function applyConfigChanges() {
  console.log('=== Example 3: Applying Config Changes to Components ===\n');

  // Mock components that need config updates
  const components = {
    spamDetector: {
      updateThreshold: (threshold: BotConfig['spamThreshold']) => {
        console.log('SpamDetector: Updated threshold', threshold);
      },
    },
    linkScanner: {
      setEnabled: (enabled: boolean) => {
        console.log('LinkScanner: Set enabled =', enabled);
      },
    },
    chatRain: {
      updateConfig: (config: Partial<BotConfig>) => {
        console.log('ChatRain: Updated config', {
          enabled: config.chatRainEnabled,
          minDelay: config.chatRainMinDelay,
        });
      },
    },
  };

  const configManager = new ConfigManager(config);

  // Handle config changes
  configManager.on('config-changed', (event: ConfigChangeEvent) => {
    console.log('\n🔄 Applying configuration changes...\n');

    const newConfig = event.newConfig;

    // Update spam detector if threshold changed
    if (event.changedKeys.includes('spamThreshold')) {
      components.spamDetector.updateThreshold(newConfig.spamThreshold);
    }

    // Update link scanner if setting changed
    if (event.changedKeys.includes('linkScanningEnabled')) {
      components.linkScanner.setEnabled(newConfig.linkScanningEnabled);
    }

    // Update chat rain if any chat rain setting changed
    const chatRainKeys = ['chatRainEnabled', 'chatRainMinDelay', 'chatRainActiveWindow'];
    if (event.changedKeys.some((key) => chatRainKeys.includes(key))) {
      components.chatRain.updateConfig(newConfig);
    }

    console.log('\n✅ Configuration changes applied successfully\n');
  });

  configManager.startWatching();

  console.log('Config manager started. Components will update when config changes.\n');

  await new Promise(() => {});
}

/**
 * Example 4: Manual reload trigger
 */
async function manualReload() {
  console.log('=== Example 4: Manual Reload Trigger ===\n');

  const configManager = new ConfigManager(config);

  configManager.on('config-changed', (event: ConfigChangeEvent) => {
    console.log('Configuration reloaded:', event.changedKeys);
  });

  // Don't start automatic watching
  console.log('Manual reload mode - no automatic watching');

  // Trigger reload manually
  console.log('Triggering manual reload...');
  await configManager.triggerReload();

  console.log('Manual reload complete\n');
}

/**
 * Example 5: Handling validation errors
 */
async function handleValidationErrors() {
  console.log('=== Example 5: Handling Validation Errors ===\n');

  const configManager = new ConfigManager(config);

  // Track validation errors
  let validationErrorCount = 0;

  configManager.on('validation-error', (error: Error) => {
    validationErrorCount++;
    console.error(`❌ Validation Error #${validationErrorCount}:`, error.message);
    console.log('Current configuration kept unchanged.\n');
  });

  configManager.on('config-changed', (event: ConfigChangeEvent) => {
    console.log('✅ Configuration validated and applied:', event.changedKeys);
  });

  configManager.startWatching();

  console.log('Config manager started with validation error handling.');
  console.log('Try setting an invalid value in .env (e.g., negative number for port).\n');

  await new Promise(() => {});
}

/**
 * Example 6: Graceful shutdown
 */
async function gracefulShutdown() {
  console.log('=== Example 6: Graceful Shutdown ===\n');

  const configManager = new ConfigManager(config);

  configManager.on('config-changed', (event: ConfigChangeEvent) => {
    console.log('Config changed:', event.changedKeys);
  });

  configManager.startWatching();

  console.log('Config manager started. Will shutdown in 5 seconds...\n');

  // Simulate running for a while
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Graceful shutdown
  console.log('Shutting down config manager...');
  configManager.stopWatching();
  console.log('Config manager stopped cleanly.\n');
}

/**
 * Example 7: Integration with bot lifecycle
 */
async function botLifecycleIntegration() {
  console.log('=== Example 7: Bot Lifecycle Integration ===\n');

  // Mock bot components
  const bot = {
    config: config,
    configManager: null as ConfigManager | null,

    async start() {
      console.log('🤖 Bot starting...');

      // Create config manager
      this.configManager = new ConfigManager(this.config, {
        notifyAdmins: async (event) => {
          console.log(`📢 Notifying admins of config change: ${event.changedKeys.join(', ')}`);
        },
      });

      // Handle config changes
      this.configManager.on('config-changed', (event: ConfigChangeEvent) => {
        console.log('🔄 Bot config updated:', event.changedKeys);
        this.config = event.newConfig;
        // Update bot components with new config
      });

      // Start watching
      this.configManager.startWatching();

      console.log('✅ Bot started with hot-reload enabled\n');
    },

    async stop() {
      console.log('🛑 Bot stopping...');

      // Stop config watching
      if (this.configManager) {
        this.configManager.stopWatching();
      }

      console.log('✅ Bot stopped cleanly\n');
    },
  };

  // Start bot
  await bot.start();

  // Simulate running
  console.log('Bot running... (will stop in 5 seconds)');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Stop bot
  await bot.stop();
}

// Run examples
if (import.meta.url === `file://${process.argv[1]}`) {
  const example = process.argv[2] || '1';

  switch (example) {
    case '1':
      basicHotReload();
      break;
    case '2':
      hotReloadWithNotifications();
      break;
    case '3':
      applyConfigChanges();
      break;
    case '4':
      manualReload();
      break;
    case '5':
      handleValidationErrors();
      break;
    case '6':
      gracefulShutdown();
      break;
    case '7':
      botLifecycleIntegration();
      break;
    default:
      console.log('Usage: node config-manager.example.js [1-7]');
      console.log('Examples:');
      console.log('  1 - Basic hot-reload');
      console.log('  2 - Hot-reload with notifications');
      console.log('  3 - Applying config changes');
      console.log('  4 - Manual reload');
      console.log('  5 - Validation error handling');
      console.log('  6 - Graceful shutdown');
      console.log('  7 - Bot lifecycle integration');
  }
}
