/**
 * Unit tests for Graceful Shutdown Manager
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GracefulShutdownManager } from '../../../../src/core/shutdown/shutdown-manager';
import { logger } from '../../../../src/core/logger/logger';

describe('GracefulShutdownManager', () => {
  let shutdownManager: GracefulShutdownManager;

  beforeEach(() => {
    shutdownManager = new GracefulShutdownManager(logger, 5000); // 5s timeout for tests
    
    // Mock process.exit to prevent actual exit
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('registerCleanup', () => {
    it('should register a cleanup function', () => {
      const cleanup = vi.fn(async () => {});
      
      shutdownManager.registerCleanup('test', cleanup);
      
      expect(shutdownManager.isShuttingDown()).toBe(false);
    });

    it('should register multiple cleanup functions', () => {
      const cleanup1 = vi.fn(async () => {});
      const cleanup2 = vi.fn(async () => {});
      
      shutdownManager.registerCleanup('test1', cleanup1);
      shutdownManager.registerCleanup('test2', cleanup2);
      
      expect(shutdownManager.isShuttingDown()).toBe(false);
    });

    it('should not register cleanup during shutdown', async () => {
      const cleanup1 = vi.fn(async () => {});
      const cleanup2 = vi.fn(async () => {});
      
      shutdownManager.registerCleanup('test1', cleanup1);
      
      // Start shutdown (don't await)
      const shutdownPromise = shutdownManager.shutdown('test');
      
      // Try to register during shutdown
      shutdownManager.registerCleanup('test2', cleanup2);
      
      await shutdownPromise;
      
      // Only first cleanup should have been called
      expect(cleanup1).toHaveBeenCalledTimes(1);
      expect(cleanup2).not.toHaveBeenCalled();
    });
  });

  describe('isShuttingDown', () => {
    it('should return false initially', () => {
      expect(shutdownManager.isShuttingDown()).toBe(false);
    });

    it('should return true during shutdown', async () => {
      const shutdownPromise = shutdownManager.shutdown('test');
      
      expect(shutdownManager.isShuttingDown()).toBe(true);
      
      await shutdownPromise;
    });
  });

  describe('trackOperation', () => {
    it('should track an in-flight operation', () => {
      const complete = shutdownManager.trackOperation();
      
      expect(shutdownManager.hasInflightOperations()).toBe(true);
      
      complete();
      
      expect(shutdownManager.hasInflightOperations()).toBe(false);
    });

    it('should track multiple in-flight operations', () => {
      const complete1 = shutdownManager.trackOperation();
      const complete2 = shutdownManager.trackOperation();
      const complete3 = shutdownManager.trackOperation();
      
      expect(shutdownManager.hasInflightOperations()).toBe(true);
      
      complete1();
      expect(shutdownManager.hasInflightOperations()).toBe(true);
      
      complete2();
      expect(shutdownManager.hasInflightOperations()).toBe(true);
      
      complete3();
      expect(shutdownManager.hasInflightOperations()).toBe(false);
    });

    it('should handle calling complete multiple times safely', () => {
      const complete = shutdownManager.trackOperation();
      
      expect(shutdownManager.hasInflightOperations()).toBe(true);
      
      complete();
      complete(); // Should be safe to call again
      complete(); // And again
      
      expect(shutdownManager.hasInflightOperations()).toBe(false);
    });

    it('should throw error when tracking operation during shutdown', async () => {
      const shutdownPromise = shutdownManager.shutdown('test');
      
      expect(() => shutdownManager.trackOperation()).toThrow(
        'Cannot start new operations during shutdown'
      );
      
      await shutdownPromise;
    });
  });

  describe('hasInflightOperations', () => {
    it('should return false when no operations are in flight', () => {
      expect(shutdownManager.hasInflightOperations()).toBe(false);
    });

    it('should return true when operations are in flight', () => {
      const complete = shutdownManager.trackOperation();
      
      expect(shutdownManager.hasInflightOperations()).toBe(true);
      
      complete();
    });
  });

  describe('shutdown', () => {
    it('should execute all cleanup functions', async () => {
      const cleanup1 = vi.fn(async () => {});
      const cleanup2 = vi.fn(async () => {});
      const cleanup3 = vi.fn(async () => {});
      
      shutdownManager.registerCleanup('test1', cleanup1);
      shutdownManager.registerCleanup('test2', cleanup2);
      shutdownManager.registerCleanup('test3', cleanup3);
      
      await shutdownManager.shutdown('test');
      
      expect(cleanup1).toHaveBeenCalledTimes(1);
      expect(cleanup2).toHaveBeenCalledTimes(1);
      expect(cleanup3).toHaveBeenCalledTimes(1);
    });

    it('should execute cleanup functions in order', async () => {
      const order: number[] = [];
      
      shutdownManager.registerCleanup('test1', async () => {
        order.push(1);
      });
      shutdownManager.registerCleanup('test2', async () => {
        order.push(2);
      });
      shutdownManager.registerCleanup('test3', async () => {
        order.push(3);
      });
      
      await shutdownManager.shutdown('test');
      
      expect(order).toEqual([1, 2, 3]);
    });

    it('should wait for in-flight operations before cleanup', async () => {
      const events: string[] = [];
      let operationComplete: (() => void) | null = null;
      
      // Start an operation
      const complete = shutdownManager.trackOperation();
      operationComplete = complete;
      
      // Register cleanup
      shutdownManager.registerCleanup('test', async () => {
        events.push('cleanup');
      });
      
      // Start shutdown
      const shutdownPromise = shutdownManager.shutdown('test');
      
      // Complete operation after a delay
      setTimeout(() => {
        events.push('operation-complete');
        operationComplete!();
      }, 100);
      
      await shutdownPromise;
      
      // Operation should complete before cleanup
      expect(events).toEqual(['operation-complete', 'cleanup']);
    });

    it('should timeout if operations take too long', async () => {
      const cleanup = vi.fn(async () => {});
      
      // Start an operation that never completes
      shutdownManager.trackOperation();
      
      shutdownManager.registerCleanup('test', cleanup);
      
      await shutdownManager.shutdown('test');
      
      // Cleanup should still run after timeout
      expect(cleanup).toHaveBeenCalledTimes(1);
    }, 10000); // 10 second timeout for this test

    it('should continue cleanup even if one function fails', async () => {
      const cleanup1 = vi.fn(async () => {
        throw new Error('Cleanup 1 failed');
      });
      const cleanup2 = vi.fn(async () => {});
      const cleanup3 = vi.fn(async () => {});
      
      shutdownManager.registerCleanup('test1', cleanup1);
      shutdownManager.registerCleanup('test2', cleanup2);
      shutdownManager.registerCleanup('test3', cleanup3);
      
      await shutdownManager.shutdown('test');
      
      expect(cleanup1).toHaveBeenCalledTimes(1);
      expect(cleanup2).toHaveBeenCalledTimes(1);
      expect(cleanup3).toHaveBeenCalledTimes(1);
    });

    it('should exit with code 0 on successful shutdown', async () => {
      const cleanup = vi.fn(async () => {});
      
      shutdownManager.registerCleanup('test', cleanup);
      
      await shutdownManager.shutdown('test');
      
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should not allow multiple simultaneous shutdowns', async () => {
      const cleanup = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      
      shutdownManager.registerCleanup('test', cleanup);
      
      const shutdown1 = shutdownManager.shutdown('test1');
      const shutdown2 = shutdownManager.shutdown('test2');
      
      await Promise.all([shutdown1, shutdown2]);
      
      // Cleanup should only be called once
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('should include signal in log context', async () => {
      const logSpy = vi.spyOn(logger, 'info');
      
      await shutdownManager.shutdown('SIGTERM');
      
      expect(logSpy).toHaveBeenCalledWith(
        'Initiating graceful shutdown',
        expect.objectContaining({ signal: 'SIGTERM' })
      );
    });
  });

  describe('setupSignalHandlers', () => {
    it('should register signal handlers', () => {
      const onSpy = vi.spyOn(process, 'on');
      
      shutdownManager.setupSignalHandlers();
      
      expect(onSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });
  });

  describe('edge cases', () => {
    it('should handle shutdown with no cleanup functions', async () => {
      await shutdownManager.shutdown('test');
      
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle shutdown with no in-flight operations', async () => {
      const cleanup = vi.fn(async () => {});
      
      shutdownManager.registerCleanup('test', cleanup);
      
      await shutdownManager.shutdown('test');
      
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle async cleanup functions', async () => {
      const cleanup = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });
      
      shutdownManager.registerCleanup('test', cleanup);
      
      await shutdownManager.shutdown('test');
      
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('should handle cleanup functions that throw synchronously', async () => {
      const cleanup1 = vi.fn(() => {
        throw new Error('Sync error');
      });
      const cleanup2 = vi.fn(async () => {});
      
      shutdownManager.registerCleanup('test1', cleanup1 as any);
      shutdownManager.registerCleanup('test2', cleanup2);
      
      await shutdownManager.shutdown('test');
      
      expect(cleanup1).toHaveBeenCalledTimes(1);
      expect(cleanup2).toHaveBeenCalledTimes(1);
    });
  });

  describe('timeout behavior', () => {
    it('should respect custom timeout', async () => {
      const customShutdownManager = new GracefulShutdownManager(logger, 1000); // 1s timeout
      
      // Start operation that never completes
      customShutdownManager.trackOperation();
      
      const start = Date.now();
      await customShutdownManager.shutdown('test');
      const elapsed = Date.now() - start;
      
      // Should timeout around 1000ms (with some tolerance)
      expect(elapsed).toBeGreaterThanOrEqual(900);
      expect(elapsed).toBeLessThan(1500);
    });

    it('should not wait longer than timeout', async () => {
      const customShutdownManager = new GracefulShutdownManager(logger, 500); // 500ms timeout
      
      // Start multiple operations that never complete
      customShutdownManager.trackOperation();
      customShutdownManager.trackOperation();
      customShutdownManager.trackOperation();
      
      const start = Date.now();
      await customShutdownManager.shutdown('test');
      const elapsed = Date.now() - start;
      
      // Should timeout around 500ms
      expect(elapsed).toBeGreaterThanOrEqual(400);
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe('integration scenarios', () => {
    it('should handle realistic shutdown scenario', async () => {
      const events: string[] = [];
      
      // Simulate database connection
      shutdownManager.registerCleanup('database', async () => {
        events.push('database-closing');
        await new Promise(resolve => setTimeout(resolve, 50));
        events.push('database-closed');
      });
      
      // Simulate cache connection
      shutdownManager.registerCleanup('cache', async () => {
        events.push('cache-closing');
        await new Promise(resolve => setTimeout(resolve, 30));
        events.push('cache-closed');
      });
      
      // Simulate Discord client
      shutdownManager.registerCleanup('discord', async () => {
        events.push('discord-closing');
        await new Promise(resolve => setTimeout(resolve, 100));
        events.push('discord-closed');
      });
      
      // Simulate in-flight message processing
      const complete1 = shutdownManager.trackOperation();
      const complete2 = shutdownManager.trackOperation();
      
      setTimeout(() => {
        events.push('message1-complete');
        complete1();
      }, 20);
      
      setTimeout(() => {
        events.push('message2-complete');
        complete2();
      }, 40);
      
      await shutdownManager.shutdown('SIGTERM');
      
      // Verify order: operations complete first, then cleanup in order
      expect(events).toEqual([
        'message1-complete',
        'message2-complete',
        'database-closing',
        'database-closed',
        'cache-closing',
        'cache-closed',
        'discord-closing',
        'discord-closed'
      ]);
    });

    it('should handle partial failure scenario', async () => {
      const events: string[] = [];
      
      shutdownManager.registerCleanup('component1', async () => {
        events.push('component1-success');
      });
      
      shutdownManager.registerCleanup('component2', async () => {
        events.push('component2-fail');
        throw new Error('Component 2 failed');
      });
      
      shutdownManager.registerCleanup('component3', async () => {
        events.push('component3-success');
      });
      
      await shutdownManager.shutdown('test');
      
      // All components should attempt cleanup
      expect(events).toEqual([
        'component1-success',
        'component2-fail',
        'component3-success'
      ]);
    });
  });
});
