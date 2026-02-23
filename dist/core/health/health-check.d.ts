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
    checkIntervalMs: number;
    alertThreshold: number;
    adminUserIds: string[];
}
/**
 * Health check system implementation
 */
export declare class HealthCheckSystem implements IHealthCheckSystem {
    private logger;
    private discordClient;
    private kickClient;
    private database;
    private cache;
    private config;
    private checkInterval;
    private consecutiveFailures;
    private startTime;
    constructor(config: HealthCheckConfig, logger: typeof LoggerType);
    /**
     * Set the Discord client to monitor
     */
    setDiscordClient(client: DiscordClient): void;
    /**
     * Set the Kick API client to monitor
     */
    setKickClient(client: KickAPIClient): void;
    /**
     * Set the database to monitor
     */
    setDatabase(database: Database): void;
    /**
     * Set the cache to monitor
     */
    setCache(cache: RedisClient): void;
    /**
     * Check Discord connection health
     */
    checkDiscordHealth(): Promise<HealthStatus>;
    /**
     * Check Kick API health
     */
    checkKickHealth(): Promise<HealthStatus>;
    /**
     * Check database health
     */
    checkDatabaseHealth(): Promise<HealthStatus>;
    /**
     * Check Redis cache health
     */
    checkCacheHealth(): Promise<HealthStatus>;
    /**
     * Get overall system health
     */
    getSystemHealth(): Promise<SystemHealth>;
    /**
     * Start periodic health checks
     */
    startPeriodicChecks(intervalMs?: number): void;
    /**
     * Stop periodic health checks
     */
    stopPeriodicChecks(): void;
    /**
     * Update failure count for a component
     */
    private updateFailureCount;
    /**
     * Alert administrators about critical health issues
     */
    private alertAdministrators;
}
//# sourceMappingURL=health-check.d.ts.map