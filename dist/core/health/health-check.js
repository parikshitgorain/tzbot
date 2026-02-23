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
/**
 * Health check system implementation
 */
export class HealthCheckSystem {
    logger;
    discordClient = null;
    kickClient = null;
    database = null;
    cache = null;
    config;
    checkInterval = null;
    consecutiveFailures = new Map();
    startTime = Date.now();
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
    }
    /**
     * Set the Discord client to monitor
     */
    setDiscordClient(client) {
        this.discordClient = client;
    }
    /**
     * Set the Kick API client to monitor
     */
    setKickClient(client) {
        this.kickClient = client;
    }
    /**
     * Set the database to monitor
     */
    setDatabase(database) {
        this.database = database;
    }
    /**
     * Set the cache to monitor
     */
    setCache(cache) {
        this.cache = cache;
    }
    /**
     * Check Discord connection health
     */
    async checkDiscordHealth() {
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
            const status = {
                healthy,
                latency: ping >= 0 ? ping : Date.now() - startTime,
                lastCheck: new Date(),
            };
            if (!healthy && ping < 0) {
                status.error = 'Discord WebSocket not connected';
            }
            else if (!healthy) {
                status.error = `High latency: ${ping}ms`;
            }
            this.updateFailureCount('discord', healthy);
            return status;
        }
        catch (error) {
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
    async checkKickHealth() {
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
            const status = {
                healthy,
                latency,
                lastCheck: new Date(),
            };
            if (!healthy) {
                status.error = `High latency: ${latency}ms`;
            }
            this.updateFailureCount('kick', healthy);
            return status;
        }
        catch (error) {
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
    async checkDatabaseHealth() {
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
            const status = {
                healthy,
                latency,
                lastCheck: new Date(),
            };
            if (!healthy) {
                status.error = `High latency: ${latency}ms`;
            }
            this.updateFailureCount('database', healthy);
            return status;
        }
        catch (error) {
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
    async checkCacheHealth() {
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
            const status = {
                healthy,
                latency,
                lastCheck: new Date(),
            };
            if (!healthy) {
                status.error = `High latency: ${latency}ms`;
            }
            this.updateFailureCount('cache', healthy);
            return status;
        }
        catch (error) {
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
    async getSystemHealth() {
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
        let overall;
        if (criticalDown) {
            overall = 'down';
        }
        else if (anyDown) {
            overall = 'degraded';
        }
        else {
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
    startPeriodicChecks(intervalMs) {
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
            }
            catch (error) {
                this.logger.error('Error during periodic health check', error);
            }
        }, interval);
    }
    /**
     * Stop periodic health checks
     */
    stopPeriodicChecks() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            this.logger.info('Stopped periodic health checks');
        }
    }
    /**
     * Update failure count for a component
     */
    updateFailureCount(component, healthy) {
        if (healthy) {
            this.consecutiveFailures.set(component, 0);
        }
        else {
            const current = this.consecutiveFailures.get(component) || 0;
            this.consecutiveFailures.set(component, current + 1);
        }
    }
    /**
     * Alert administrators about critical health issues
     */
    async alertAdministrators(health) {
        const failures = this.consecutiveFailures;
        const shouldAlert = Array.from(failures.values()).some(count => count >= this.config.alertThreshold);
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
                }
                catch (error) {
                    this.logger.error(`Failed to alert admin ${userId}`, error);
                }
            }
        }
    }
}
//# sourceMappingURL=health-check.js.map