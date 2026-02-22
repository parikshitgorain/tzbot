/**
 * Health Check Utility
 * Verifies Discord bot connection status
 * 
 * Requirements: 6.2
 */

import { Client } from 'discord.js';
import { config } from '../config/index.js';

/**
 * Check Discord bot connection health
 * @returns Promise<boolean> - true if connected, false otherwise
 */
async function checkDiscordHealth(): Promise<boolean> {
  const client = new Client({
    intents: [],
  });

  try {
    // Attempt to login
    await client.login(config.discordToken);
    
    // Check if client is ready
    if (client.isReady()) {
      // eslint-disable-next-line no-console
      console.log('Discord bot connection: HEALTHY');
      await client.destroy();
      return true;
    }
    
    // eslint-disable-next-line no-console
    console.error('Discord bot connection: NOT READY');
    await client.destroy();
    return false;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Discord bot connection: FAILED', error);
    return false;
  }
}

// Run health check if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkDiscordHealth()
    .then((healthy) => {
      process.exit(healthy ? 0 : 1);
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Health check error:', error);
      process.exit(1);
    });
}

export { checkDiscordHealth };
