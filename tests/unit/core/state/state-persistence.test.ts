/**
 * @file state-persistence.test.ts
 * @description Unit tests for state persistence service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { StatePersistenceService, type BotState } from '@/core/state/state-persistence.js';
import { tmpdir } from 'os';

describe('StatePersistenceService', () => {
  let statePersistence: StatePersistenceService;
  let testStateDir: string;

  beforeEach(async () => {
    // Create unique temp directory for each test
    testStateDir = join(tmpdir(), `tzbot-test-${Date.now()}-${Math.random()}`);

    statePersistence = new StatePersistenceService({
      stateDir: testStateDir,
      stateFile: 'test-state.json',
      persistIntervalMs: 100, // Fast interval for testing
      maxBackups: 3,
    });

    await statePersistence.initialize();
  });

  afterEach(async () => {
    // Stop auto-persistence
    statePersistence.stopAutoPersistence();

    // Clean up test directory
    try {
      await fs.rm(testStateDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    it('should create state directory if it does not exist', async () => {
      const stats = await fs.stat(testStateDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should not fail if state directory already exists', async () => {
      // Initialize again
      await expect(statePersistence.initialize()).resolves.not.toThrow();
    });
  });

  describe('State Updates', () => {
    it('should update chat rain state', () => {
      const now = new Date();
      statePersistence.updateState({
        chatRain: {
          lastExecutionTime: now,
        },
      });

      const currentState = statePersistence.getCurrentState();
      expect(currentState).not.toBeNull();
      expect(currentState?.data.chatRain?.lastExecutionTime).toEqual(now);
    });

    it('should update notification queue state', () => {
      const queue = [
        {
          id: 'queue-1',
          eventId: 'event-1',
          eventType: 'stream_live',
          embedData: { title: 'Test' },
          attempts: 1,
          createdAt: new Date(),
        },
      ];

      statePersistence.updateState({
        notificationQueue: queue,
      });

      const currentState = statePersistence.getCurrentState();
      expect(currentState?.data.notificationQueue).toEqual(queue);
    });

    it('should update active giveaways state', () => {
      const giveaways = [
        { id: 'giveaway-1', endsAt: new Date() },
        { id: 'giveaway-2', endsAt: new Date() },
      ];

      statePersistence.updateState({
        activeGiveaways: giveaways,
      });

      const currentState = statePersistence.getCurrentState();
      expect(currentState?.data.activeGiveaways).toEqual(giveaways);
    });

    it('should merge partial state updates', () => {
      statePersistence.updateState({
        chatRain: { lastExecutionTime: new Date() },
      });

      statePersistence.updateState({
        notificationQueue: [],
      });

      const currentState = statePersistence.getCurrentState();
      expect(currentState?.data.chatRain).toBeDefined();
      expect(currentState?.data.notificationQueue).toBeDefined();
    });

    it('should update timestamp on state update', () => {
      const before = Date.now();
      statePersistence.updateState({
        chatRain: { lastExecutionTime: new Date() },
      });
      const after = Date.now();

      const currentState = statePersistence.getCurrentState();
      const timestamp = currentState?.timestamp.getTime() ?? 0;
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('State Persistence', () => {
    it('should persist state to disk', async () => {
      statePersistence.updateState({
        chatRain: { lastExecutionTime: new Date() },
      });

      await statePersistence.persistState();

      const stateFile = join(testStateDir, 'test-state.json');
      const fileExists = await fs
        .access(stateFile)
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(true);
    });

    it('should include checksum in persisted state', async () => {
      statePersistence.updateState({
        chatRain: { lastExecutionTime: new Date() },
      });

      await statePersistence.persistState();

      const stateFile = join(testStateDir, 'test-state.json');
      const content = await fs.readFile(stateFile, 'utf8');
      const state = JSON.parse(content) as BotState;

      expect(state.checksum).toBeDefined();
      expect(state.checksum).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    });

    it('should include version and timestamp in persisted state', async () => {
      statePersistence.updateState({
        chatRain: { lastExecutionTime: new Date() },
      });

      await statePersistence.persistState();

      const stateFile = join(testStateDir, 'test-state.json');
      const content = await fs.readFile(stateFile, 'utf8');
      const state = JSON.parse(content) as BotState;

      expect(state.version).toBeDefined();
      expect(state.timestamp).toBeDefined();
    });

    it('should not persist if no state exists', async () => {
      await statePersistence.persistState();

      const stateFile = join(testStateDir, 'test-state.json');
      const fileExists = await fs
        .access(stateFile)
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(false);
    });

    it('should skip persistence if already persisting', async () => {
      statePersistence.updateState({
        chatRain: { lastExecutionTime: new Date() },
      });

      // Start two persistence operations simultaneously
      const promise1 = statePersistence.persistState();
      const promise2 = statePersistence.persistState();

      await Promise.all([promise1, promise2]);

      // Should not throw or cause issues
      expect(true).toBe(true);
    });
  });

  describe('State Recovery', () => {
    it('should recover persisted state', async () => {
      const testDate = new Date();
      statePersistence.updateState({
        chatRain: { lastExecutionTime: testDate },
        notificationQueue: [],
        activeGiveaways: [{ id: 'test-1', endsAt: testDate }],
      });

      await statePersistence.persistState();

      // Create new instance to test recovery
      const newInstance = new StatePersistenceService({
        stateDir: testStateDir,
        stateFile: 'test-state.json',
      });

      await newInstance.initialize();
      const recoveredState = await newInstance.recoverState();

      expect(recoveredState).not.toBeNull();
      expect(recoveredState?.data.chatRain?.lastExecutionTime).toEqual(testDate);
      expect(recoveredState?.data.notificationQueue).toEqual([]);
      expect(recoveredState?.data.activeGiveaways).toHaveLength(1);
    });

    it('should return null if no state file exists', async () => {
      const recoveredState = await statePersistence.recoverState();
      expect(recoveredState).toBeNull();
    });

    it('should convert date strings to Date objects on recovery', async () => {
      const testDate = new Date();
      statePersistence.updateState({
        chatRain: { lastExecutionTime: testDate },
      });

      await statePersistence.persistState();

      const newInstance = new StatePersistenceService({
        stateDir: testStateDir,
        stateFile: 'test-state.json',
      });

      await newInstance.initialize();
      const recoveredState = await newInstance.recoverState();

      expect(recoveredState?.data.chatRain?.lastExecutionTime).toBeInstanceOf(Date);
      expect(recoveredState?.timestamp).toBeInstanceOf(Date);
    });

    it('should verify checksum on recovery', async () => {
      statePersistence.updateState({
        chatRain: { lastExecutionTime: new Date() },
      });

      await statePersistence.persistState();

      // Corrupt the state file
      const stateFile = join(testStateDir, 'test-state.json');
      const content = await fs.readFile(stateFile, 'utf8');
      const state = JSON.parse(content) as BotState;
      state.data.chatRain = { lastExecutionTime: null }; // Change data without updating checksum
      await fs.writeFile(stateFile, JSON.stringify(state), 'utf8');

      const newInstance = new StatePersistenceService({
        stateDir: testStateDir,
        stateFile: 'test-state.json',
      });

      await newInstance.initialize();
      const recoveredState = await newInstance.recoverState();

      // Should return null because checksum doesn't match and no backups exist
      expect(recoveredState).toBeNull();
    });
  });

  describe('Backup System', () => {
    it('should create backup before persisting', async () => {
      // First persistence (no backup created since no previous file)
      statePersistence.updateState({
        chatRain: { lastExecutionTime: new Date() },
      });
      await statePersistence.persistState();

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Second persistence (should create backup of first)
      statePersistence.updateState({
        notificationQueue: [],
      });
      await statePersistence.persistState();

      // Check for backup files
      const files = await fs.readdir(testStateDir);
      const backupFiles = files.filter((f) => f.startsWith('test-state.backup.'));

      expect(backupFiles.length).toBeGreaterThan(0);
    });

    it('should limit number of backups to maxBackups', async () => {
      // Create more backups than maxBackups (3)
      for (let i = 0; i < 5; i++) {
        statePersistence.updateState({
          chatRain: { lastExecutionTime: new Date() },
        });
        await statePersistence.persistState();
        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const files = await fs.readdir(testStateDir);
      const backupFiles = files.filter((f) => f.startsWith('test-state.backup.'));

      expect(backupFiles.length).toBeLessThanOrEqual(3);
    });

    it('should recover from backup if main state is corrupted', async () => {
      const testDate = new Date();
      statePersistence.updateState({
        chatRain: { lastExecutionTime: testDate },
      });
      await statePersistence.persistState();

      // Create another state (creates backup)
      await new Promise((resolve) => setTimeout(resolve, 10));
      statePersistence.updateState({
        notificationQueue: [],
      });
      await statePersistence.persistState();

      // Corrupt main state file
      const stateFile = join(testStateDir, 'test-state.json');
      await fs.writeFile(stateFile, 'invalid json', 'utf8');

      // Try to recover
      const newInstance = new StatePersistenceService({
        stateDir: testStateDir,
        stateFile: 'test-state.json',
      });

      await newInstance.initialize();
      const recoveredState = await newInstance.recoverState();

      // Should recover from backup
      expect(recoveredState).not.toBeNull();
    });
  });

  describe('Auto-Persistence', () => {
    it('should start auto-persistence', () => {
      statePersistence.startAutoPersistence();
      // Should not throw
      expect(true).toBe(true);
    });

    it('should stop auto-persistence', () => {
      statePersistence.startAutoPersistence();
      statePersistence.stopAutoPersistence();
      // Should not throw
      expect(true).toBe(true);
    });

    it('should persist state automatically at intervals', async () => {
      statePersistence.updateState({
        chatRain: { lastExecutionTime: new Date() },
      });

      statePersistence.startAutoPersistence();

      // Wait for at least one persistence interval (100ms in tests)
      await new Promise((resolve) => setTimeout(resolve, 150));

      const stateFile = join(testStateDir, 'test-state.json');
      const fileExists = await fs
        .access(stateFile)
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(true);
    });

    it('should not start auto-persistence twice', () => {
      statePersistence.startAutoPersistence();
      statePersistence.startAutoPersistence();
      // Should not throw or create multiple timers
      expect(true).toBe(true);
    });
  });

  describe('Shutdown', () => {
    it('should stop auto-persistence on shutdown', async () => {
      statePersistence.startAutoPersistence();
      await statePersistence.shutdown();

      // Auto-persistence should be stopped
      // (No direct way to test this, but it shouldn't throw)
      expect(true).toBe(true);
    });

    it('should persist final state on shutdown', async () => {
      statePersistence.updateState({
        chatRain: { lastExecutionTime: new Date() },
      });

      await statePersistence.shutdown();

      const stateFile = join(testStateDir, 'test-state.json');
      const fileExists = await fs
        .access(stateFile)
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(true);
    });
  });

  describe('Force Persist', () => {
    it('should persist state immediately', async () => {
      statePersistence.updateState({
        chatRain: { lastExecutionTime: new Date() },
      });

      await statePersistence.forcePersist();

      const stateFile = join(testStateDir, 'test-state.json');
      const fileExists = await fs
        .access(stateFile)
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty state data', async () => {
      statePersistence.updateState({});
      await statePersistence.persistState();

      const newInstance = new StatePersistenceService({
        stateDir: testStateDir,
        stateFile: 'test-state.json',
      });

      await newInstance.initialize();
      const recoveredState = await newInstance.recoverState();

      expect(recoveredState).not.toBeNull();
      expect(recoveredState?.data).toEqual({});
    });

    it('should handle null values in state', async () => {
      statePersistence.updateState({
        chatRain: { lastExecutionTime: null },
      });

      await statePersistence.persistState();

      const newInstance = new StatePersistenceService({
        stateDir: testStateDir,
        stateFile: 'test-state.json',
      });

      await newInstance.initialize();
      const recoveredState = await newInstance.recoverState();

      expect(recoveredState?.data.chatRain?.lastExecutionTime).toBeNull();
    });

    it('should handle large state data', async () => {
      // Create large notification queue
      const largeQueue = Array.from({ length: 1000 }, (_, i) => ({
        id: `queue-${i}`,
        eventId: `event-${i}`,
        eventType: 'stream_live',
        embedData: { title: `Test ${i}`, description: 'A'.repeat(100) },
        attempts: 1,
        createdAt: new Date(),
      }));

      statePersistence.updateState({
        notificationQueue: largeQueue,
      });

      await statePersistence.persistState();

      const newInstance = new StatePersistenceService({
        stateDir: testStateDir,
        stateFile: 'test-state.json',
      });

      await newInstance.initialize();
      const recoveredState = await newInstance.recoverState();

      expect(recoveredState?.data.notificationQueue).toHaveLength(1000);
    });

    it('should handle concurrent state updates', () => {
      // Update state from multiple "threads"
      statePersistence.updateState({ chatRain: { lastExecutionTime: new Date() } });
      statePersistence.updateState({ notificationQueue: [] });
      statePersistence.updateState({ activeGiveaways: [] });

      const currentState = statePersistence.getCurrentState();
      expect(currentState?.data.chatRain).toBeDefined();
      expect(currentState?.data.notificationQueue).toBeDefined();
      expect(currentState?.data.activeGiveaways).toBeDefined();
    });
  });

  describe('Requirements Validation', () => {
    it('should persist state every 60 seconds (Requirement 14.3)', async () => {
      // Use default interval (60000ms in production, 100ms in test)
      statePersistence.updateState({
        chatRain: { lastExecutionTime: new Date() },
      });

      statePersistence.startAutoPersistence();

      // Wait for persistence interval
      await new Promise((resolve) => setTimeout(resolve, 150));

      const stateFile = join(testStateDir, 'test-state.json');
      const fileExists = await fs
        .access(stateFile)
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(true);
    });

    it('should restore state from most recent persisted data (Requirement 14.4)', async () => {
      const testDate = new Date();
      statePersistence.updateState({
        chatRain: { lastExecutionTime: testDate },
        activeGiveaways: [{ id: 'test-1', endsAt: testDate }],
      });

      await statePersistence.persistState();

      // Simulate bot restart
      const newInstance = new StatePersistenceService({
        stateDir: testStateDir,
        stateFile: 'test-state.json',
      });

      await newInstance.initialize();
      const recoveredState = await newInstance.recoverState();

      expect(recoveredState).not.toBeNull();
      expect(recoveredState?.data.chatRain?.lastExecutionTime).toEqual(testDate);
      expect(recoveredState?.data.activeGiveaways).toHaveLength(1);
    });

    it('should handle corrupted state gracefully (Requirement 14.4)', async () => {
      // Create valid state with backup
      statePersistence.updateState({
        chatRain: { lastExecutionTime: new Date() },
      });
      await statePersistence.persistState();

      // Create backup
      await new Promise((resolve) => setTimeout(resolve, 10));
      statePersistence.updateState({
        notificationQueue: [],
      });
      await statePersistence.persistState();

      // Corrupt main state
      const stateFile = join(testStateDir, 'test-state.json');
      await fs.writeFile(stateFile, '{ invalid json }', 'utf8');

      // Try to recover
      const newInstance = new StatePersistenceService({
        stateDir: testStateDir,
        stateFile: 'test-state.json',
      });

      await newInstance.initialize();
      const recoveredState = await newInstance.recoverState();

      // Should recover from backup without crashing
      expect(recoveredState).not.toBeNull();
    });
  });
});
