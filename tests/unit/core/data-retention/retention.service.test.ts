/**
 * @file retention.service.test.ts
 * @description Unit tests for Data Retention Service
 * @module tests/unit/core/data-retention
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DataRetentionService, DEFAULT_RETENTION_CONFIG } from '@/core/data-retention/retention.service.js';
import type { Pool, PoolClient, QueryResult } from 'pg';

// Mock logger
vi.mock('@/core/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  logError: vi.fn(),
}));

describe('DataRetentionService', () => {
  let mockPool: Pool;
  let mockClient: PoolClient;
  let service: DataRetentionService;

  beforeEach(() => {
    // Create mock client
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    } as unknown as PoolClient;

    // Create mock pool
    mockPool = {
      query: vi.fn(),
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as Pool;

    service = new DataRetentionService(mockPool);
  });

  afterEach(() => {
    service.stop();
    vi.clearAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should create service with default configuration', () => {
      const service = new DataRetentionService(mockPool);
      expect(service).toBeDefined();
    });

    it('should create service with custom configuration', () => {
      const customConfig = {
        messageContentRetentionDays: 14,
        chatActivityRetentionDays: 60,
        cleanupIntervalMinutes: 120,
      };

      const service = new DataRetentionService(mockPool, customConfig);
      expect(service).toBeDefined();
    });
  });

  describe('start() and stop()', () => {
    it('should start the cleanup scheduler', () => {
      vi.useFakeTimers();

      service.start();

      // Verify cleanup was called immediately
      expect(mockPool.query).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should not start if already running', () => {
      service.start();
      const callCount = vi.mocked(mockPool.query).mock.calls.length;

      service.start(); // Try to start again

      // Should not increase call count
      expect(vi.mocked(mockPool.query).mock.calls.length).toBe(callCount);
    });

    it('should stop the cleanup scheduler', () => {
      vi.useFakeTimers();

      service.start();
      service.stop();

      // Advance time and verify no more cleanups
      const callCountBefore = vi.mocked(mockPool.query).mock.calls.length;
      vi.advanceTimersByTime(60 * 60 * 1000); // 1 hour
      const callCountAfter = vi.mocked(mockPool.query).mock.calls.length;

      expect(callCountAfter).toBe(callCountBefore);

      vi.useRealTimers();
    });

    it('should run cleanup at configured intervals', () => {
      vi.useFakeTimers();

      const customConfig = {
        messageContentRetentionDays: 7,
        chatActivityRetentionDays: 30,
        cleanupIntervalMinutes: 30, // 30 minutes
      };

      const service = new DataRetentionService(mockPool, customConfig);
      service.start();

      const initialCalls = vi.mocked(mockPool.query).mock.calls.length;

      // Advance time by 30 minutes
      vi.advanceTimersByTime(30 * 60 * 1000);

      // Should have run cleanup again
      expect(vi.mocked(mockPool.query).mock.calls.length).toBeGreaterThan(initialCalls);

      service.stop();
      vi.useRealTimers();
    });
  });

  describe('cleanupOldMessageContent()', () => {
    it('should delete message content older than retention period', async () => {
      const mockResult: QueryResult = {
        rows: [],
        rowCount: 150,
        command: 'DELETE',
        oid: 0,
        fields: [],
      };

      vi.mocked(mockPool.query).mockResolvedValue(mockResult);

      const deletedCount = await service.cleanupOldMessageContent();

      expect(deletedCount).toBe(150);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM message_content'),
        expect.arrayContaining([expect.any(Date)])
      );
    });

    it('should use correct retention period from config', async () => {
      const customConfig = {
        messageContentRetentionDays: 14,
        chatActivityRetentionDays: 30,
        cleanupIntervalMinutes: 60,
      };

      const service = new DataRetentionService(mockPool, customConfig);

      const mockResult: QueryResult = {
        rows: [],
        rowCount: 0,
        command: 'DELETE',
        oid: 0,
        fields: [],
      };

      vi.mocked(mockPool.query).mockResolvedValue(mockResult);

      await service.cleanupOldMessageContent();

      // Verify the cutoff date is approximately 14 days ago
      const call = vi.mocked(mockPool.query).mock.calls[0];
      const cutoffDate = call[1][0] as Date;
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - 14);

      // Allow 1 second tolerance
      expect(Math.abs(cutoffDate.getTime() - expectedDate.getTime())).toBeLessThan(1000);
    });

    it('should return 0 when no records are deleted', async () => {
      const mockResult: QueryResult = {
        rows: [],
        rowCount: 0,
        command: 'DELETE',
        oid: 0,
        fields: [],
      };

      vi.mocked(mockPool.query).mockResolvedValue(mockResult);

      const deletedCount = await service.cleanupOldMessageContent();

      expect(deletedCount).toBe(0);
    });

    it('should throw error on database failure', async () => {
      vi.mocked(mockPool.query).mockRejectedValue(new Error('Database error'));

      await expect(service.cleanupOldMessageContent()).rejects.toThrow(
        'Failed to cleanup old message content'
      );
    });
  });

  describe('cleanupOldChatActivity()', () => {
    it('should delete chat activity older than retention period', async () => {
      const mockResult: QueryResult = {
        rows: [],
        rowCount: 500,
        command: 'DELETE',
        oid: 0,
        fields: [],
      };

      vi.mocked(mockPool.query).mockResolvedValue(mockResult);

      const deletedCount = await service.cleanupOldChatActivity();

      expect(deletedCount).toBe(500);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM chat_activity'),
        expect.arrayContaining([expect.any(Date)])
      );
    });

    it('should use correct retention period from config', async () => {
      const customConfig = {
        messageContentRetentionDays: 7,
        chatActivityRetentionDays: 60,
        cleanupIntervalMinutes: 60,
      };

      const service = new DataRetentionService(mockPool, customConfig);

      const mockResult: QueryResult = {
        rows: [],
        rowCount: 0,
        command: 'DELETE',
        oid: 0,
        fields: [],
      };

      vi.mocked(mockPool.query).mockResolvedValue(mockResult);

      await service.cleanupOldChatActivity();

      // Verify the cutoff date is approximately 60 days ago
      const call = vi.mocked(mockPool.query).mock.calls[0];
      const cutoffDate = call[1][0] as Date;
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - 60);

      // Allow 1 second tolerance
      expect(Math.abs(cutoffDate.getTime() - expectedDate.getTime())).toBeLessThan(1000);
    });

    it('should throw error on database failure', async () => {
      vi.mocked(mockPool.query).mockRejectedValue(new Error('Database error'));

      await expect(service.cleanupOldChatActivity()).rejects.toThrow(
        'Failed to cleanup old chat activity'
      );
    });
  });

  describe('deleteAllUserData()', () => {
    it('should delete all user data in a transaction', async () => {
      vi.mocked(mockClient.query).mockResolvedValue({
        rows: [],
        rowCount: 1,
        command: 'DELETE',
        oid: 0,
        fields: [],
      });

      await service.deleteAllUserData('123456789');

      // Verify transaction was used
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');

      // Verify all tables were cleaned
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM message_content WHERE user_id = $1',
        ['123456789']
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM chat_activity WHERE user_id = $1',
        ['123456789']
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM chat_rain_winners WHERE user_id = $1',
        ['123456789']
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM giveaway_entries WHERE user_id = $1',
        ['123456789']
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM violations WHERE user_id = $1',
        ['123456789']
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM moderation_logs WHERE target_user_id = $1',
        ['123456789']
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM users WHERE discord_id = $1',
        ['123456789']
      );

      // Verify client was released
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      vi.mocked(mockClient.query)
        .mockResolvedValueOnce({ rows: [], rowCount: 0, command: 'BEGIN', oid: 0, fields: [] })
        .mockRejectedValueOnce(new Error('Database error'));

      await expect(service.deleteAllUserData('123456789')).rejects.toThrow(
        'Failed to delete user data'
      );

      // Verify rollback was called
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');

      // Verify client was released even on error
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should release client even if rollback fails', async () => {
      vi.mocked(mockClient.query)
        .mockResolvedValueOnce({ rows: [], rowCount: 0, command: 'BEGIN', oid: 0, fields: [] })
        .mockRejectedValueOnce(new Error('Database error'))
        .mockRejectedValueOnce(new Error('Rollback error'));

      await expect(service.deleteAllUserData('123456789')).rejects.toThrow();

      // Verify client was released
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getRetentionStats()', () => {
    it('should return retention statistics', async () => {
      vi.mocked(mockPool.query)
        .mockResolvedValueOnce({ rows: [{ count: '1000' }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [{ count: '150' }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [{ count: '5000' }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [{ count: '500' }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] });

      const stats = await service.getRetentionStats();

      expect(stats).toEqual({
        messageContentCount: 1000,
        oldMessageContentCount: 150,
        chatActivityCount: 5000,
        oldChatActivityCount: 500,
      });
    });

    it('should handle zero counts', async () => {
      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [{ count: '0' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const stats = await service.getRetentionStats();

      expect(stats).toEqual({
        messageContentCount: 0,
        oldMessageContentCount: 0,
        chatActivityCount: 0,
        oldChatActivityCount: 0,
      });
    });

    it('should throw error on database failure', async () => {
      vi.mocked(mockPool.query).mockRejectedValue(new Error('Database error'));

      await expect(service.getRetentionStats()).rejects.toThrow('Failed to get retention stats');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle multiple cleanup cycles', async () => {
      vi.useFakeTimers();

      const mockResult: QueryResult = {
        rows: [],
        rowCount: 10,
        command: 'DELETE',
        oid: 0,
        fields: [],
      };

      vi.mocked(mockPool.query).mockResolvedValue(mockResult);

      service.start();

      const initialCalls = vi.mocked(mockPool.query).mock.calls.length;

      // Advance time by 1 hour (default interval)
      vi.advanceTimersByTime(60 * 60 * 1000);

      // Should have run cleanup again
      expect(vi.mocked(mockPool.query).mock.calls.length).toBeGreaterThan(initialCalls);

      service.stop();
      vi.useRealTimers();
    });

    it('should continue running after cleanup errors', async () => {
      vi.useFakeTimers();

      // First cleanup fails
      vi.mocked(mockPool.query)
        .mockRejectedValueOnce(new Error('Database error'))
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValue({
          rows: [],
          rowCount: 5,
          command: 'DELETE',
          oid: 0,
          fields: [],
        });

      service.start();

      const initialCalls = vi.mocked(mockPool.query).mock.calls.length;

      // Advance time by 1 hour
      vi.advanceTimersByTime(60 * 60 * 1000);

      // Should have attempted cleanup again despite previous error
      expect(vi.mocked(mockPool.query).mock.calls.length).toBeGreaterThan(initialCalls);

      service.stop();
      vi.useRealTimers();
    });
  });
});
