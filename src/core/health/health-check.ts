/**
 * Health Check System
 *
 * Monitors the health of all system components:
 * - Discord connection
 * - Kick API
 * - Database
 * - Redis cache
 *
 * Provides periodic health checks and alerts administrators on critical issues.
 *
 * Requirements: 13.5, 14.1
 */

import { Client as DiscordClient } from 'discord.js';
import { Database } from '../database/Database';
import { RedisClient } from '../cache/redis.client';
import { KickAPIClient } from '../../services/kick/client';
import type { logger as LoggerType } from '../logger/logger';

/**
 * Health status for a single component
 */
export interface HealthStatus {
  healthy: boolean;
  latency: number;
  lastCheck: Date;
  error?: string;
}

/**
 * Overall system health
 */
export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'down';
  components: {
    discord: HealthStatus;
    kick: HealthStatus;
    database: HealthStatus;
    cache: HealthStatus;
  };
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
}

/**
 * Health check system interface
 */
export interface IHealthCheckSystem {
  checkDiscordHealth(): Promise<HealthStatus>;
  checkKickHealth(): Promise<HealthStatus>;
  checkDatabaseHealth(): Promise<HealthStatus>;
  checkCacheHealth(): Promise<HealthStatus>;
  getSystemHealth(): Promise<SystemHealth>;
  startPeriodicChecks(intervalMs?: number): void;
  stopPeriodicChecks(): void;
}

/**
 * Configuration for health check system
 */
export interface HealthCheckConfig {
  checkIntervalMs: number; // Default: 30000 (30 seconds)
  alertThreshold: number; // Number of consecutive failures before alerting
  adminUserIds: string[]; // Discord user IDs to alert
}

/**
 * Health check system implementation
 */
export class HealthCheckSystem implements IHealthCheckSystem {
  private logger: typeof LoggerType;
  private discordClient: DiscordClient | null = null;
  private kickClient: KickAPIClient | null = null;
  private database: Database | null = null;
  private cache: RedisClient | null = null;
  private config: HealthCheckConfig;
  private checkInterval: NodeJS.Timeout | null = null;
  private consecutiveFailures: Map<string, number> = new Map();
  private startTime: number = Date.now();

  constructor(config: HealthCheckConfig, logger: typeof LoggerType) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Set the Discord client to monitor
   */
  setDiscordClient(client: DiscordClient): void {
    this.discordClient = client;
  }

  /**
   * Set the Kick API client to monitor
   */
  setKickClient(client: KickAPIClient): void {
    this.kickClient = client;
  }

  /**
   * Set the database to monitor
   */
  setDatabase(database: Database): void {
    this.database = database;
  }

  /**
   * Set the cache to monitor
   */
  setCache(cache: RedisClient): void {
    this.cache = cache;
  }

  /**
   * Check Discord connection health
   */
  async checkDiscordHealth(): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      if (!this.discordClient) {
        return {
          healthy: false,
          latency: 0,
          lastCheck: new Date(),
          error: 'Discord client not initialized',
        };
      }

      // Check if client is ready
      if (!this.discordClient.isReady()) {
        return {
          healthy: false,
          latency: Date.now() - startTime,
          lastCheck: new Date(),
          error: 'Discord client not ready',
        };
      }

      // Check WebSocket ping
      const ping = this.discordClient.ws.ping;

      // Consider unhealthy if ping is too high (>500ms) or negative (not connected)
      const healthy = ping >= 0 && ping < 500;

      const status: HealthStatus = {
        healthy,
        latency: ping >= 0 ? ping : Date.now() - startTime,
        lastCheck: new Date(),
      };

      if (!healthy && ping < 0) {
        status.error = 'Discord WebSocket not connected';
      } else if (!healthy) {
        status.error = `High latency: ${ping}ms`;
      }

      this.updateFailureCount('discord', healthy);
      return status;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.updateFailureCount('discord', false);

      return {
        healthy: false,
        latency,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check Kick API health
   */
  async checkKickHealth(): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      if (!this.kickClient) {
        return {
          healthy: false,
          latency: 0,
          lastCheck: new Date(),
          error: 'Kick API client not initialized',
        };
      }

      // Try to make a simple API call to check connectivity
      // Using a lightweight endpoint if available
      await this.kickClient.healthCheck();

      const latency = Date.now() - startTime;
      const healthy = latency < 5000; // Consider unhealthy if response takes >5s

      const status: HealthStatus = {
        healthy,
        latency,
        lastCheck: new Date(),
      };

      if (!healthy) {
        status.error = `High latency: ${latency}ms`;
      }

      this.updateFailureCount('kick', healthy);
      return status;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.updateFailureCount('kick', false);

      return {
        healthy: false,
        latency,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check database health
   */
  async checkDatabaseHealth(): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      if (!this.database) {
        return {
          healthy: false,
          latency: 0,
          lastCheck: new Date(),
          error: 'Database not initialized',
        };
      }

      // Execute a simple query to check connectivity
      await this.database.healthCheck();

      const latency = Date.now() - startTime;
      const healthy = latency < 1000; // Consider unhealthy if query takes >1s

      const status: HealthStatus = {
        healthy,
        latency,
        lastCheck: new Date(),
      };

      if (!healthy) {
        status.error = `High latency: ${latency}ms`;
      }

      this.updateFailureCount('database', healthy);
      return status;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.updateFailureCount('database', false);

      return {
        healthy: false,
        latency,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check Redis cache health
   */
  async checkCacheHealth(): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      if (!this.cache) {
        return {
          healthy: false,
          latency: 0,
          lastCheck: new Date(),
          error: 'Redis cache not initialized',
        };
      }

      // Execute a simple ping to check connectivity
      await this.cache.ping();

      const latency = Date.now() - startTime;
      const healthy = latency < 500; // Consider unhealthy if ping takes >500ms

      const status: HealthStatus = {
        healthy,
        latency,
        lastCheck: new Date(),
      };

      if (!healthy) {
        status.error = `High latency: ${latency}ms`;
      }

      this.updateFailureCount('cache', healthy);
      return status;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.updateFailureCount('cache', false);

      return {
        healthy: false,
        latency,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get overall system health
   */
  async getSystemHealth(): Promise<SystemHealth> {
    // Check all components in parallel
    const [discord, kick, database, cache] = await Promise.all([
      this.checkDiscordHealth(),
      this.checkKickHealth(),
      this.checkDatabaseHealth(),
      this.checkCacheHealth(),
    ]);

    // Determine overall health status
    const criticalComponents = [discord, database]; // Discord and DB are critical
    const allComponents = [discord, kick, database, cache];

    const criticalDown = criticalComponents.some(c => !c.healthy);
    const anyDown = allComponents.some(c => !c.healthy);

    let overall: 'healthy' | 'degraded' | 'down';
    if (criticalDown) {
      overall = 'down';
    } else if (anyDown) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    // Get system metrics
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      overall,
      components: {
        discord,
        kick,
        database,
        cache,
      },
      uptime: (Date.now() - this.startTime) / 1000, // in seconds
      memoryUsage: memoryUsage.heapUsed / 1024 / 1024, // in MB
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // in seconds
    };
  }

  /**
   * Start periodic health checks
   */
  startPeriodicChecks(intervalMs?: number): void {
    const interval = intervalMs || this.config.checkIntervalMs;

    if (this.checkInterval) {
      this.logger.warn('Periodic health checks already running');
      return;
    }

    this.logger.info(`Starting periodic health checks every ${interval}ms`);

    this.checkInterval = setInterval(async () => {
      try {
        const health = await this.getSystemHealth();

        // Log health status
        this.logger.debug('Health check completed', {
          overall: health.overall,
          uptime: health.uptime,
          memoryUsage: health.memoryUsage,
        });

        // Alert on critical issues
        if (health.overall === 'down') {
          await this.alertAdministrators(health);
        }
      } catch (error) {
        this.logger.error('Error during periodic health check', error);
      }
    }, interval);
  }

  /**
   * Stop periodic health checks
   */
  stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      this.logger.info('Stopped periodic health checks');
    }
  }

  /**
   * Update failure count for a component
   */
  private updateFailureCount(component: string, healthy: boolean): void {
    if (healthy) {
      this.consecutiveFailures.set(component, 0);
    } else {
      const current = this.consecutiveFailures.get(component) || 0;
      this.consecutiveFailures.set(component, current + 1);
    }
  }

  /**
   * Alert administrators about critical health issues
   */
  private async alertAdministrators(health: SystemHealth): Promise<void> {
    const failures = this.consecutiveFailures;
    const shouldAlert = Array.from(failures.values()).some(
      count => count >= this.config.alertThreshold,
    );

    if (!shouldAlert) {
      return;
    }

    this.logger.error('System health critical - alerting administrators', {
      health,
      consecutiveFailures: Object.fromEntries(failures),
    });

    // Send DMs to configured admin users
    if (this.discordClient && this.discordClient.isReady()) {
      const failedComponents = Object.entries(health.components)
        .filter(([_, status]) => !status.healthy)
        .map(([name, status]) => `- ${name}: ${status.error || 'Unknown error'}`)
        .join('\n');

      const message = '🚨 **System Health Critical** 🚨\n\n' +
        `Overall Status: ${health.overall}\n` +
        `Uptime: ${Math.floor(health.uptime)}s\n\n` +
        `Failed Components:\n${failedComponents}\n\n` +
        'Please investigate immediately.';

      for (const userId of this.config.adminUserIds) {
        try {
          const user = await this.discordClient.users.fetch(userId);
          await user.send(message);
        } catch (error) {
          this.logger.error(`Failed to alert admin ${userId}`, error);
        }
      }
    }
  }
}
