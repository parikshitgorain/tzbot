/* eslint-disable no-console */
// @ts-nocheck - Example file for documentation purposes
/**
 * Health Check System Example
 * 
 * This example demonstrates how to use the health check system to monitor
 * all system components and alert administrators on critical issues.
 */

import { Client as DiscordClient, GatewayIntentBits } from 'discord.js';
import { HealthCheckSystem } from './health-check.js';
import { Database } from '../database/Database.js';
import { RedisClient } from '../cache/redis.client.js';
import { KickAPIClient } from '../../services/kick/client.js';
import { Logger } from '../logger/logger.js';

async function main() {
  // Initialize logger
  const logger = new Logger({
    level: 'info',
    enableConsole: true,
    enableFile: true,
    logDirectory: './logs',
  });

  // Initialize health check system
  const healthCheck = new HealthCheckSystem(
    {
      checkIntervalMs: 30000, // Check every 30 seconds
      alertThreshold: 3, // Alert after 3 consecutive failures
      adminUserIds: ['123456789012345678'], // Replace with actual admin Discord IDs
    },
    logger
  );

  // Initialize Discord client
  const discordClient = new DiscordClient({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  await discordClient.login(process.env.DISCORD_TOKEN!);
  healthCheck.setDiscordClient(discordClient);

  // Initialize database
  const database = new Database();
  await database.connect();
  healthCheck.setDatabase(database);

  // Initialize Redis cache
  const cache = new RedisClient();
  await cache.connect();
  healthCheck.setCache(cache);

  // Initialize Kick API client
  const kickClient = new KickAPIClient({
    clientId: process.env.KICK_CLIENT_ID!,
    clientSecret: process.env.KICK_CLIENT_SECRET!,
    redirectUri: process.env.KICK_REDIRECT_URI!,
  });
  healthCheck.setKickClient(kickClient);

  // Start periodic health checks
  healthCheck.startPeriodicChecks();

  // Example: Manual health check
  console.log('\n=== Manual Health Check ===\n');
  const health = await healthCheck.getSystemHealth();
  
  console.log(`Overall Status: ${health.overall}`);
  console.log(`Uptime: ${Math.floor(health.uptime)}s`);
  console.log(`Memory Usage: ${health.memoryUsage.toFixed(2)} MB`);
  console.log(`CPU Usage: ${health.cpuUsage.toFixed(2)}s`);
  console.log('\nComponent Status:');
  
  for (const [name, status] of Object.entries(health.components)) {
    const icon = status.healthy ? '✅' : '❌';
    console.log(`${icon} ${name}: ${status.healthy ? 'healthy' : 'unhealthy'}`);
    console.log(`   Latency: ${status.latency}ms`);
    if (status.error) {
      console.log(`   Error: ${status.error}`);
    }
  }

  // Example: Check individual components
  console.log('\n=== Individual Component Checks ===\n');

  const discordHealth = await healthCheck.checkDiscordHealth();
  console.log('Discord:', discordHealth.healthy ? '✅' : '❌', `(${discordHealth.latency}ms)`);

  const kickHealth = await healthCheck.checkKickHealth();
  console.log('Kick API:', kickHealth.healthy ? '✅' : '❌', `(${kickHealth.latency}ms)`);

  const dbHealth = await healthCheck.checkDatabaseHealth();
  console.log('Database:', dbHealth.healthy ? '✅' : '❌', `(${dbHealth.latency}ms)`);

  const cacheHealth = await healthCheck.checkCacheHealth();
  console.log('Cache:', cacheHealth.healthy ? '✅' : '❌', `(${cacheHealth.latency}ms)`);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    healthCheck.stopPeriodicChecks();
    await discordClient.destroy();
    await database.disconnect();
    await cache.disconnect();
    process.exit(0);
  });

  console.log('\nHealth check system running. Press Ctrl+C to exit.');
}

// Run example
main().catch(console.error);
