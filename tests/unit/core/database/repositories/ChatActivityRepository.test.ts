import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatActivityRepository } from '../../../../../src/core/database/repositories/ChatActivityRepository.js';
import type { Pool, QueryResult } from 'pg';

// Create a mock pool
const createMockPool = () => ({
  query: vi.fn(),
} as unknown as Pool);

describe('ChatActivityRepository', () => {
  let pool: Pool;
  let repository: ChatActivityRepository;

  beforeEach(() => {
    pool = createMockPool();
    repository = new ChatActivityRepository(pool);
    vi.clearAllMocks();
  });

  describe('record', () => {
    it('should record chat activity for a user', async () => {
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], rowCount: 1 } as unknown as QueryResult);

      const userId = '123456789';
      const timestamp = new Date();

      await repository.record(userId, timestamp);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chat_activity'),
        [userId, timestamp]
      );
    });

    it('should handle duplicate records gracefully', async () => {
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], rowCount: 0 } as unknown as QueryResult);

      const userId = '123456789';
      const timestamp = new Date();

      // Should not throw - ON CONFLICT DO NOTHING
      await expect(repository.record(userId, timestamp)).resolves.toBeUndefined();
    });

    it('should throw on database error', async () => {
      (pool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

      await expect(repository.record('user1', new Date())).rejects.toThrow('Failed to record chat activity');
    });
  });

  describe('getActiveChatters', () => {
    it('should return users who have chatted since the given time', async () => {
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ user_id: 'user1' }, { user_id: 'user2' }],
        rowCount: 2,
      } as unknown as QueryResult);

      const since = new Date();
      const activeChatters = await repository.getActiveChatters(since);

      expect(activeChatters).toHaveLength(2);
      expect(activeChatters).toContain('user1');
      expect(activeChatters).toContain('user2');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DISTINCT user_id'),
        [since]
      );
    });

    it('should return empty array when no users have chatted', async () => {
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], rowCount: 0 } as unknown as QueryResult);

      const activeChatters = await repository.getActiveChatters(new Date());

      expect(activeChatters).toHaveLength(0);
    });

    it('should return distinct user IDs even with multiple messages', async () => {
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ user_id: 'user1' }],
        rowCount: 1,
      } as unknown as QueryResult);

      const activeChatters = await repository.getActiveChatters(new Date());

      expect(activeChatters).toHaveLength(1);
      expect(activeChatters[0]).toBe('user1');
    });
  });

  describe('getMessageCount', () => {
    it('should return the correct message count for a user', async () => {
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ count: '3' }],
        rowCount: 1,
      } as unknown as QueryResult);

      const userId = 'user1';
      const since = new Date();
      const count = await repository.getMessageCount(userId, since);

      expect(count).toBe(3);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*)'),
        [userId, since]
      );
    });

    it('should return 0 for a user with no messages', async () => {
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ count: '0' }],
        rowCount: 1,
      } as unknown as QueryResult);

      const count = await repository.getMessageCount('nonexistent', new Date());

      expect(count).toBe(0);
    });
  });

  describe('getQualifiedChatters', () => {
    it('should return users with at least 3 messages in the time window', async () => {
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ user_id: 'user1' }, { user_id: 'user3' }],
        rowCount: 2,
      } as unknown as QueryResult);

      const since = new Date();
      const qualified = await repository.getQualifiedChatters(since, 3);

      expect(qualified).toHaveLength(2);
      expect(qualified).toContain('user1');
      expect(qualified).toContain('user3');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('HAVING COUNT(*)'),
        [since, 3]
      );
    });

    it('should use default minimum of 3 messages', async () => {
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ user_id: 'user1' }],
        rowCount: 1,
      } as unknown as QueryResult);

      const qualified = await repository.getQualifiedChatters(new Date());

      expect(qualified).toHaveLength(1);
      expect(qualified[0]).toBe('user1');
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [expect.any(Date), 3]);
    });
  });

  describe('cleanupOldActivity', () => {
    it('should delete activity records older than the specified date', async () => {
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], rowCount: 1 } as unknown as QueryResult);

      const olderThan = new Date();
      const deletedCount = await repository.cleanupOldActivity(olderThan);

      expect(deletedCount).toBe(1);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM chat_activity'),
        [olderThan]
      );
    });
  });

  describe('recordWinner', () => {
    it('should record a chat rain winner', async () => {
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], rowCount: 1 } as unknown as QueryResult);

      const userId = 'user1';
      const timestamp = new Date();
      const rewardType = 'role';
      const rewardValue = 'VIP';

      await repository.recordWinner(userId, timestamp, rewardType, rewardValue);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chat_rain_winners'),
        [userId, timestamp, rewardType, rewardValue]
      );
    });
  });

  describe('getRecentWinners', () => {
    it('should return users who won since the given time', async () => {
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ user_id: 'user1' }, { user_id: 'user2' }],
        rowCount: 2,
      } as unknown as QueryResult);

      const since = new Date();
      const recentWinners = await repository.getRecentWinners(since);

      expect(recentWinners).toHaveLength(2);
      expect(recentWinners).toContain('user1');
      expect(recentWinners).toContain('user2');
    });
  });

  describe('getLastChatRainTime', () => {
    it('should return the most recent chat rain timestamp', async () => {
      const now = new Date();
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ last_time: now }],
        rowCount: 1,
      } as unknown as QueryResult);

      const lastTime = await repository.getLastChatRainTime();

      expect(lastTime).not.toBeNull();
      expect(lastTime).toBe(now);
    });

    it('should return null when no chat rain has occurred', async () => {
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ last_time: null }],
        rowCount: 1,
      } as unknown as QueryResult);

      const lastTime = await repository.getLastChatRainTime();

      expect(lastTime).toBeNull();
    });
  });
});
