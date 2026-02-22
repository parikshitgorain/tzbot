import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatActivityRepository } from '../../../../../src/core/database/repositories/ChatActivityRepository.js';
import type { Pool, QueryResult } from 'pg';

describe('ChatActivityRepository', () => {
  let mockPool: Pool;
  let repository: ChatActivityRepository;

  beforeEach(() => {
    // Create a mock pool with query method
    mockPool = {
      query: vi.fn(),
    } as unknown as Pool;

    repository = new ChatActivityRepository(mockPool);
  });

  describe('record', () => {
    it('should record chat activity for a user', async () => {
      const userId = '123456789';
      const timestamp = new Date();

      vi.mocked(mockPool.query).mockResolvedValueOnce({} as QueryResult);

      await repository.record(userId, timestamp);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chat_activity'),
        [userId, timestamp]
      );
    });

    it('should handle duplicate records gracefully with ON CONFLICT', async () => {
      const userId = '123456789';
      const timestamp = new Date();

      vi.mocked(mockPool.query).mockResolvedValue({} as QueryResult);

      await repository.record(userId, timestamp);
      await repository.record(userId, timestamp);

      expect(mockPool.query).toHaveBeenCalledTimes(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        [userId, timestamp]
      );
    });

    it('should throw error on database failure', async () => {
      const userId = '123456789';
      const timestamp = new Date();

      vi.mocked(mockPool.query).mockRejectedValueOnce(new Error('DB error'));

      await expect(repository.record(userId, timestamp)).rejects.toThrow('Failed to record chat activity');
    });
  });

  describe('getActiveChatters', () => {
    it('should return users who have chatted since the given time', async () => {
      const now = new Date();
      const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [{ user_id: 'user1' }, { user_id: 'user2' }],
      } as QueryResult);

      const activeChatters = await repository.getActiveChatters(fifteenMinutesAgo);

      expect(activeChatters).toHaveLength(2);
      expect(activeChatters).toContain('user1');
      expect(activeChatters).toContain('user2');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DISTINCT user_id'),
        [fifteenMinutesAgo]
      );
    });

    it('should return empty array when no users have chatted', async () => {
      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [],
      } as QueryResult);

      const activeChatters = await repository.getActiveChatters(new Date());

      expect(activeChatters).toHaveLength(0);
    });

    it('should return distinct user IDs', async () => {
      const now = new Date();

      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [{ user_id: 'user1' }],
      } as QueryResult);

      const activeChatters = await repository.getActiveChatters(
        new Date(now.getTime() - 10 * 60 * 1000)
      );

      expect(activeChatters).toHaveLength(1);
      expect(activeChatters[0]).toBe('user1');
    });
  });

  describe('getMessageCount', () => {
    it('should return the correct message count for a user', async () => {
      const userId = 'user1';
      const since = new Date(Date.now() - 15 * 60 * 1000);

      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [{ count: '3' }],
      } as QueryResult);

      const count = await repository.getMessageCount(userId, since);

      expect(count).toBe(3);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        [userId, since]
      );
    });

    it('should return 0 for a user with no messages', async () => {
      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [{ count: '0' }],
      } as QueryResult);

      const count = await repository.getMessageCount('nonexistent', new Date());

      expect(count).toBe(0);
    });
  });

  describe('getQualifiedChatters', () => {
    it('should return users with at least 3 messages in the time window', async () => {
      const now = new Date();
      const since = new Date(now.getTime() - 10 * 60 * 1000);

      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [{ user_id: 'user1' }, { user_id: 'user3' }],
      } as QueryResult);

      const qualified = await repository.getQualifiedChatters(since, 3);

      expect(qualified).toHaveLength(2);
      expect(qualified).toContain('user1');
      expect(qualified).toContain('user3');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('HAVING COUNT(*)'),
        [since, 3]
      );
    });

    it('should use default minimum of 3 messages', async () => {
      const now = new Date();
      const since = new Date(now.getTime() - 10 * 60 * 1000);

      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [{ user_id: 'user1' }],
      } as QueryResult);

      const qualified = await repository.getQualifiedChatters(since);

      expect(qualified).toHaveLength(1);
      expect(qualified[0]).toBe('user1');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.anything(),
        [since, 3]
      );
    });

    it('should return empty array when no users qualify', async () => {
      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [],
      } as QueryResult);

      const qualified = await repository.getQualifiedChatters(
        new Date(Date.now() - 10 * 60 * 1000),
        3
      );

      expect(qualified).toHaveLength(0);
    });

    it('should support custom minimum message thresholds', async () => {
      const now = new Date();
      const since = new Date(now.getTime() - 10 * 60 * 1000);

      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [{ user_id: 'user1' }],
      } as QueryResult);

      const qualified = await repository.getQualifiedChatters(since, 2);

      expect(qualified).toHaveLength(1);
      expect(qualified[0]).toBe('user1');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.anything(),
        [since, 2]
      );
    });
  });

  describe('cleanupOldActivity', () => {
    it('should delete activity records older than the specified date', async () => {
      const cutoffDate = new Date(Date.now() - 90 * 60 * 1000);

      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rowCount: 1,
      } as QueryResult);

      const deletedCount = await repository.cleanupOldActivity(cutoffDate);

      expect(deletedCount).toBe(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM chat_activity'),
        [cutoffDate]
      );
    });

    it('should return 0 when no records are deleted', async () => {
      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rowCount: 0,
      } as QueryResult);

      const deletedCount = await repository.cleanupOldActivity(
        new Date(Date.now() - 60 * 60 * 1000)
      );

      expect(deletedCount).toBe(0);
    });

    it('should delete all records when all are older', async () => {
      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rowCount: 2,
      } as QueryResult);

      const deletedCount = await repository.cleanupOldActivity(new Date());

      expect(deletedCount).toBe(2);
    });
  });

  describe('recordWinner', () => {
    it('should record a chat rain winner', async () => {
      const userId = 'user1';
      const timestamp = new Date();
      const rewardType = 'role';
      const rewardValue = 'VIP';

      vi.mocked(mockPool.query).mockResolvedValueOnce({} as QueryResult);

      await repository.recordWinner(userId, timestamp, rewardType, rewardValue);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chat_rain_winners'),
        [userId, timestamp, rewardType, rewardValue]
      );
    });

    it('should record winner without reward value', async () => {
      const userId = 'user1';
      const timestamp = new Date();
      const rewardType = 'announcement';

      vi.mocked(mockPool.query).mockResolvedValueOnce({} as QueryResult);

      await repository.recordWinner(userId, timestamp, rewardType);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.anything(),
        [userId, timestamp, rewardType, null]
      );
    });
  });

  describe('getRecentWinners', () => {
    it('should return users who won since the given time', async () => {
      const since = new Date(Date.now() - 60 * 60 * 1000);

      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [{ user_id: 'user1' }, { user_id: 'user2' }],
      } as QueryResult);

      const recentWinners = await repository.getRecentWinners(since);

      expect(recentWinners).toHaveLength(2);
      expect(recentWinners).toContain('user1');
      expect(recentWinners).toContain('user2');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DISTINCT user_id'),
        [since]
      );
    });

    it('should return distinct user IDs', async () => {
      const since = new Date(Date.now() - 60 * 60 * 1000);

      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [{ user_id: 'user1' }],
      } as QueryResult);

      const recentWinners = await repository.getRecentWinners(since);

      expect(recentWinners).toHaveLength(1);
      expect(recentWinners[0]).toBe('user1');
    });

    it('should return empty array when no recent winners', async () => {
      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [],
      } as QueryResult);

      const recentWinners = await repository.getRecentWinners(new Date());

      expect(recentWinners).toHaveLength(0);
    });
  });

  describe('hasRecentWin', () => {
    it('should return true when user has won recently', async () => {
      const userId = 'user1';
      const since = new Date(Date.now() - 60 * 60 * 1000);

      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [{ exists: 1 }],
      } as QueryResult);

      const hasWon = await repository.hasRecentWin(userId, since);

      expect(hasWon).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.anything(),
        [userId, since]
      );
    });

    it('should return false when user has not won recently', async () => {
      const userId = 'user1';
      const since = new Date(Date.now() - 60 * 60 * 1000);

      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [],
      } as QueryResult);

      const hasWon = await repository.hasRecentWin(userId, since);

      expect(hasWon).toBe(false);
    });

    it('should return false when user has never won', async () => {
      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [],
      } as QueryResult);

      const hasWon = await repository.hasRecentWin('nonexistent', new Date());

      expect(hasWon).toBe(false);
    });
  });

  describe('getLastChatRainTime', () => {
    it('should return the most recent chat rain timestamp', async () => {
      const now = new Date();

      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [{ last_time: now }],
      } as QueryResult);

      const lastTime = await repository.getLastChatRainTime();

      expect(lastTime).toEqual(now);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('MAX(timestamp)')
      );
    });

    it('should return null when no chat rain has occurred', async () => {
      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [{ last_time: null }],
      } as QueryResult);

      const lastTime = await repository.getLastChatRainTime();

      expect(lastTime).toBeNull();
    });
  });
});
