/**
 * Health Check System Tests
 * 
 * Tests the health check system's ability to monitor all components
 * and alert administrators on critical issues.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HealthCheckSystem } from '@/core/health/health-check';
import type { HealthStatus, SystemHealth } from '@/core/health/health-check';
import { Logger } from '@/core/logger/logger';

// Mock Discord client
const createMockDiscordClient = (isReady = true, ping = 50) => ({
  isReady: () => isReady,
  ws: { ping },
  users: {
    fetch: vi.fn().mockResolvedValue({
      send: vi.fn().mockResolvedValue(undefined),
    }),
  },
});

// Mock Kick API client
const createMockKickClient = (shouldFail = false) => ({
  healthCheck: vi.fn().mockImplementation(async () => {
    if (shouldFail) {
      throw new Error('Kick API unavailable');
    }
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }),
});

// Mock Database
const createMockDatabase = (shouldFail = false) => ({
  healthCheck: vi.fn().mockImplementation(async () => {
    if (shouldFail) {
      throw new Error('Database connection failed');
    }
    // Simulate query time
    await new Promise(resolve => setTimeout(resolve, 50));
  }),
});

// Mock Redis client
const createMockCache = (shouldFail = false) => ({
  ping: vi.fn().mockImplementation(async () => {
    if (shouldFail) {
      throw new Error('Redis connection failed');
    }
    // Simulate ping time
    await new Promise(resolve => setTimeout(resolve, 10));
  }),
});

// Mock logger
const createMockLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

describe('HealthCheckSystem', () => {
  let healthCheck: HealthCheckSystem;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    healthCheck = new HealthCheckSystem(
      {
        checkIntervalMs: 30000,
        alertThreshold: 3,
        adminUserIds: ['123456789'],
      },
      mockLogger as unknown as Logger
    );
  });

  afterEach(() => {
    healthCheck.stopPeriodicChecks();
    vi.clearAllMocks();
  });

  describe('Discord Health Check', () => {
    it('should report healthy when Discord is connected with good ping', async () => {
      const mockClient = createMockDiscordClient(true, 50);
      healthCheck.setDiscordClient(mockClient as any);

      const status = await healthCheck.checkDiscordHealth();

      expect(status.healthy).toBe(true);
      expect(status.latency).toBe(50);
      expect(status.error).toBeUndefined();
    });

    it('should report unhealthy when Discord client is not ready', async () => {
      const mockClient = createMockDiscordClient(false, -1);
      healthCheck.setDiscordClient(mockClient as any);

      const status = await healthCheck.checkDiscordHealth();

      expect(status.healthy).toBe(false);
      expect(status.error).toContain('not ready');
    });

    it('should report unhealthy when Discord ping is too high', async () => {
      const mockClient = createMockDiscordClient(true, 600);
      healthCheck.setDiscordClient(mockClient as any);

      const status = await healthCheck.checkDiscordHealth();

      expect(status.healthy).toBe(false);
      expect(status.error).toContain('High latency');
    });

    it('should report unhealthy when Discord WebSocket is not connected', async () => {
      const mockClient = createMockDiscordClient(true, -1);
      healthCheck.setDiscordClient(mockClient as any);

      const status = await healthCheck.checkDiscordHealth();

      expect(status.healthy).toBe(false);
      expect(status.error).toContain('not connected');
    });

    it('should report unhealthy when Discord client is not initialized', async () => {
      const status = await healthCheck.checkDiscordHealth();

      expect(status.healthy).toBe(false);
      expect(status.error).toContain('not initialized');
    });
  });

  describe('Kick API Health Check', () => {
    it('should report healthy when Kick API responds quickly', async () => {
      const mockClient = createMockKickClient(false);
      healthCheck.setKickClient(mockClient as any);

      const status = await healthCheck.checkKickHealth();

      expect(status.healthy).toBe(true);
      expect(status.latency).toBeLessThan(5000);
      expect(status.error).toBeUndefined();
      expect(mockClient.healthCheck).toHaveBeenCalled();
    });

    it('should report unhealthy when Kick API fails', async () => {
      const mockClient = createMockKickClient(true);
      healthCheck.setKickClient(mockClient as any);

      const status = await healthCheck.checkKickHealth();

      expect(status.healthy).toBe(false);
      expect(status.error).toContain('Kick API unavailable');
    });

    it('should report unhealthy when Kick client is not initialized', async () => {
      const status = await healthCheck.checkKickHealth();

      expect(status.healthy).toBe(false);
      expect(status.error).toContain('not initialized');
    });
  });

  describe('Database Health Check', () => {
    it('should report healthy when database responds quickly', async () => {
      const mockDb = createMockDatabase(false);
      healthCheck.setDatabase(mockDb as any);

      const status = await healthCheck.checkDatabaseHealth();

      expect(status.healthy).toBe(true);
      expect(status.latency).toBeLessThan(1000);
      expect(status.error).toBeUndefined();
      expect(mockDb.healthCheck).toHaveBeenCalled();
    });

    it('should report unhealthy when database fails', async () => {
      const mockDb = createMockDatabase(true);
      healthCheck.setDatabase(mockDb as any);

      const status = await healthCheck.checkDatabaseHealth();

      expect(status.healthy).toBe(false);
      expect(status.error).toContain('Database connection failed');
    });

    it('should report unhealthy when database is not initialized', async () => {
      const status = await healthCheck.checkDatabaseHealth();

      expect(status.healthy).toBe(false);
      expect(status.error).toContain('not initialized');
    });
  });

  describe('Cache Health Check', () => {
    it('should report healthy when Redis responds quickly', async () => {
      const mockCache = createMockCache(false);
      healthCheck.setCache(mockCache as any);

      const status = await healthCheck.checkCacheHealth();

      expect(status.healthy).toBe(true);
      expect(status.latency).toBeLessThan(500);
      expect(status.error).toBeUndefined();
      expect(mockCache.ping).toHaveBeenCalled();
    });

    it('should report unhealthy when Redis fails', async () => {
      const mockCache = createMockCache(true);
      healthCheck.setCache(mockCache as any);

      const status = await healthCheck.checkCacheHealth();

      expect(status.healthy).toBe(false);
      expect(status.error).toContain('Redis connection failed');
    });

    it('should report unhealthy when cache is not initialized', async () => {
      const status = await healthCheck.checkCacheHealth();

      expect(status.healthy).toBe(false);
      expect(status.error).toContain('not initialized');
    });
  });

  describe('System Health', () => {
    it('should report overall healthy when all components are healthy', async () => {
      healthCheck.setDiscordClient(createMockDiscordClient(true, 50) as any);
      healthCheck.setKickClient(createMockKickClient(false) as any);
      healthCheck.setDatabase(createMockDatabase(false) as any);
      healthCheck.setCache(createMockCache(false) as any);

      const health = await healthCheck.getSystemHealth();

      expect(health.overall).toBe('healthy');
      expect(health.components.discord.healthy).toBe(true);
      expect(health.components.kick.healthy).toBe(true);
      expect(health.components.database.healthy).toBe(true);
      expect(health.components.cache.healthy).toBe(true);
    });

    it('should report degraded when non-critical components fail', async () => {
      healthCheck.setDiscordClient(createMockDiscordClient(true, 50) as any);
      healthCheck.setKickClient(createMockKickClient(true) as any); // Kick fails
      healthCheck.setDatabase(createMockDatabase(false) as any);
      healthCheck.setCache(createMockCache(true) as any); // Cache fails

      const health = await healthCheck.getSystemHealth();

      expect(health.overall).toBe('degraded');
      expect(health.components.discord.healthy).toBe(true);
      expect(health.components.kick.healthy).toBe(false);
      expect(health.components.database.healthy).toBe(true);
      expect(health.components.cache.healthy).toBe(false);
    });

    it('should report down when Discord fails', async () => {
      healthCheck.setDiscordClient(createMockDiscordClient(false, -1) as any);
      healthCheck.setKickClient(createMockKickClient(false) as any);
      healthCheck.setDatabase(createMockDatabase(false) as any);
      healthCheck.setCache(createMockCache(false) as any);

      const health = await healthCheck.getSystemHealth();

      expect(health.overall).toBe('down');
      expect(health.components.discord.healthy).toBe(false);
    });

    it('should report down when database fails', async () => {
      healthCheck.setDiscordClient(createMockDiscordClient(true, 50) as any);
      healthCheck.setKickClient(createMockKickClient(false) as any);
      healthCheck.setDatabase(createMockDatabase(true) as any);
      healthCheck.setCache(createMockCache(false) as any);

      const health = await healthCheck.getSystemHealth();

      expect(health.overall).toBe('down');
      expect(health.components.database.healthy).toBe(false);
    });

    it('should include system metrics', async () => {
      healthCheck.setDiscordClient(createMockDiscordClient(true, 50) as any);
      healthCheck.setKickClient(createMockKickClient(false) as any);
      healthCheck.setDatabase(createMockDatabase(false) as any);
      healthCheck.setCache(createMockCache(false) as any);

      const health = await healthCheck.getSystemHealth();

      expect(health.uptime).toBeGreaterThan(0);
      expect(health.memoryUsage).toBeGreaterThan(0);
      expect(health.cpuUsage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Periodic Health Checks', () => {
    it('should start periodic checks', () => {
      healthCheck.startPeriodicChecks(1000);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting periodic health checks')
      );
      
      healthCheck.stopPeriodicChecks();
    });

    it('should not start if already running', () => {
      healthCheck.startPeriodicChecks(1000);
      healthCheck.startPeriodicChecks(1000);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('already running')
      );
      
      healthCheck.stopPeriodicChecks();
    });

    it('should stop periodic checks', () => {
      healthCheck.startPeriodicChecks(1000);
      healthCheck.stopPeriodicChecks();
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Stopped periodic health checks')
      );
    });

    it('should perform health checks at intervals', async () => {
      healthCheck.setDiscordClient(createMockDiscordClient(true, 50) as any);
      healthCheck.setKickClient(createMockKickClient(false) as any);
      healthCheck.setDatabase(createMockDatabase(false) as any);
      healthCheck.setCache(createMockCache(false) as any);

      healthCheck.startPeriodicChecks(100); // Short interval for testing

      // Wait for at least two checks to complete
      await new Promise(resolve => setTimeout(resolve, 350));

      // Should have logged health check
      expect(mockLogger.debug).toHaveBeenCalled();

      healthCheck.stopPeriodicChecks();
    });
  });

  describe('Administrator Alerts', () => {
    it('should alert administrators when system is down', async () => {
      // Create a ready Discord client so it can send DMs
      const mockClient = createMockDiscordClient(true, -1); // Ready but bad ping
      const mockUser = { send: vi.fn().mockResolvedValue(undefined) };
      mockClient.users.fetch = vi.fn().mockResolvedValue(mockUser);

      healthCheck.setDiscordClient(mockClient as any);
      healthCheck.setKickClient(createMockKickClient(false) as any);
      healthCheck.setDatabase(createMockDatabase(false) as any);
      healthCheck.setCache(createMockCache(false) as any);

      healthCheck.startPeriodicChecks(100); // Short interval

      // Wait for multiple checks to reach alert threshold (3 failures)
      await new Promise(resolve => setTimeout(resolve, 600));

      // Should have logged critical error
      expect(mockLogger.error).toHaveBeenCalled();

      healthCheck.stopPeriodicChecks();
    });

    it('should not alert before reaching threshold', async () => {
      const mockClient = createMockDiscordClient(false, -1);
      healthCheck.setDiscordClient(mockClient as any);
      healthCheck.setKickClient(createMockKickClient(false) as any);
      healthCheck.setDatabase(createMockDatabase(false) as any);
      healthCheck.setCache(createMockCache(false) as any);

      healthCheck.startPeriodicChecks(100);

      // Only wait for 2 checks (below threshold of 3)
      await new Promise(resolve => setTimeout(resolve, 250));

      // Should not have sent alerts yet (check for specific alert message)
      const errorCalls = mockLogger.error.mock.calls.filter(
        call => call[0] && call[0].includes('alerting administrators')
      );
      expect(errorCalls.length).toBe(0);

      healthCheck.stopPeriodicChecks();
    });
  });

  describe('Latency Tracking', () => {
    it('should track latency for each component', async () => {
      healthCheck.setDiscordClient(createMockDiscordClient(true, 50) as any);
      healthCheck.setKickClient(createMockKickClient(false) as any);
      healthCheck.setDatabase(createMockDatabase(false) as any);
      healthCheck.setCache(createMockCache(false) as any);

      const health = await healthCheck.getSystemHealth();

      expect(health.components.discord.latency).toBe(50);
      expect(health.components.kick.latency).toBeGreaterThan(0);
      expect(health.components.database.latency).toBeGreaterThan(0);
      expect(health.components.cache.latency).toBeGreaterThan(0);
    });

    it('should track latency even on failures', async () => {
      const mockDb = createMockDatabase(true);
      healthCheck.setDatabase(mockDb as any);

      const status = await healthCheck.checkDatabaseHealth();

      expect(status.healthy).toBe(false);
      expect(status.latency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Last Check Timestamp', () => {
    it('should record last check timestamp', async () => {
      healthCheck.setDiscordClient(createMockDiscordClient(true, 50) as any);

      const before = new Date();
      const status = await healthCheck.checkDiscordHealth();
      const after = new Date();

      expect(status.lastCheck.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(status.lastCheck.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully during periodic checks', async () => {
      healthCheck.setDiscordClient({
        isReady: () => { throw new Error('Unexpected error'); },
      } as any);

      healthCheck.startPeriodicChecks(100);
      
      // Wait for at least two checks
      await new Promise(resolve => setTimeout(resolve, 350));

      // Should log error but not crash
      expect(mockLogger.error).toHaveBeenCalled();

      healthCheck.stopPeriodicChecks();
    });

    it('should continue checking after component failure', async () => {
      const mockDb = createMockDatabase(true);
      healthCheck.setDatabase(mockDb as any);

      // First check fails
      const status1 = await healthCheck.checkDatabaseHealth();
      expect(status1.healthy).toBe(false);

      // Fix the database
      mockDb.healthCheck.mockImplementation(async () => {
        // No delay needed for test
      });

      // Second check succeeds
      const status2 = await healthCheck.checkDatabaseHealth();
      expect(status2.healthy).toBe(true);
    });
  });
});
