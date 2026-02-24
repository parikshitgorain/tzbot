import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatActivityRepository } from '../../../../../src/core/database/repositories/ChatActivityRepository.js';
import type { Pool } from 'pg';

// Mock Redis client
vi.mock('../../../../../src/core/cache/redis.client.js', () => ({
  redisClient: {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}));

// Mock logger
vi.mock('../../../../../src/core/logger/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('ChatActivityRepository', () => {
  let mockPool: Pool;
  let repo: ChatActivityRepository;

  beforeEach(() => {
    mockPool = { query: vi.fn() } as unknown as Pool;
    repo = new ChatActivityRepository(mockPool);
    vi.clearAllMocks();
  });

  describe('record()', () => {
    it('executes INSERT INTO chat_activity', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      
      // Add enough records to trigger batch flush (BATCH_SIZE = 50)
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(repo.record(`u${i}`, new Date()));
      }
      await Promise.all(promises);
      
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chat_activity'),
        expect.any(Array),
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      
      // Add enough records to trigger batch flush
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(repo.record(`u${i}`, new Date()));
      }
      
      await expect(Promise.all(promises)).rejects.toThrow('Failed to record chat activity');
    });

    it('wraps non-Error throws with Unknown error', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(42);
      
      // Add enough records to trigger batch flush
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(repo.record(`u${i}`, new Date()));
      }
      
      await expect(Promise.all(promises)).rejects.toThrow('Unknown error');
    });
  });

  describe('getActiveChatters()', () => {
    it('returns empty array when no chatters', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.getActiveChatters(new Date())).toEqual([]);
    });

    it('returns array of user IDs', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ user_id: 'u1' }, { user_id: 'u2' }],
      });
      expect(await repo.getActiveChatters(new Date())).toEqual(['u1', 'u2']);
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getActiveChatters(new Date())).rejects.toThrow('Failed to get active chatters');
    });
  });

  describe('getMessageCount()', () => {
    it('returns parsed integer count', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [{ count: '7' }] });
      expect(await repo.getMessageCount('u1', new Date())).toBe(7);
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getMessageCount('u1', new Date())).rejects.toThrow('Failed to get message count');
    });
  });

  describe('getQualifiedChatters()', () => {
    it('returns user IDs meeting message threshold', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [{ user_id: 'u1' }] });
      const result = await repo.getQualifiedChatters(new Date(), 3);
      expect(result).toEqual(['u1']);
    });

    it('uses default minMessages=3', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.getQualifiedChatters(new Date());
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('HAVING COUNT'),
        expect.arrayContaining([3]),
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getQualifiedChatters(new Date(), 3)).rejects.toThrow('Failed to get qualified chatters');
    });
  });

  describe('cleanupOldActivity()', () => {
    it('returns number of deleted rows', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 10, rows: [] });
      expect(await repo.cleanupOldActivity(new Date())).toBe(10);
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.cleanupOldActivity(new Date())).rejects.toThrow('Failed to cleanup old activity');
    });
  });

  describe('recordWinner()', () => {
    it('inserts into chat_rain_winners', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.recordWinner('u1', new Date(), 'ROLE', 'subscriber');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chat_rain_winners'),
        expect.any(Array),
      );
    });

    it('passes null for missing rewardValue', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.recordWinner('u1', new Date(), 'ROLE');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([null]),
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.recordWinner('u1', new Date(), 'ROLE')).rejects.toThrow('Failed to record chat rain winner');
    });
  });

  describe('getRecentWinners()', () => {
    it('returns user IDs', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [{ user_id: 'u1' }] });
      expect(await repo.getRecentWinners(new Date())).toEqual(['u1']);
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getRecentWinners(new Date())).rejects.toThrow('Failed to get recent winners');
    });
  });

  describe('hasRecentWin()', () => {
    it('returns false when no rows', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.hasRecentWin('u1', new Date())).toBe(false);
    });

    it('returns true when row exists', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [{ '1': 1 }] });
      expect(await repo.hasRecentWin('u1', new Date())).toBe(true);
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.hasRecentWin('u1', new Date())).rejects.toThrow('Failed to check recent win');
    });
  });

  describe('getLastChatRainTime()', () => {
    it('returns null when no winners', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [{ last_time: null }] });
      expect(await repo.getLastChatRainTime()).toBeNull();
    });

    it('returns Date when winners exist', async () => {
      const now = new Date();
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [{ last_time: now }] });
      expect(await repo.getLastChatRainTime()).toEqual(now);
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getLastChatRainTime()).rejects.toThrow('Failed to get last chat rain time');
    });
  });

  describe('getRewardHistory()', () => {
    it('returns reward records', async () => {
      const now = new Date();
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ user_id: 'u1', timestamp: now, reward_type: 'ROLE', reward_value: 'sub' }],
      });
      const records = await repo.getRewardHistory('u1');
      expect(records[0].userId).toBe('u1');
      expect(records[0].rewardType).toBe('ROLE');
    });

    it('appends since filter when provided', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.getRewardHistory('u1', new Date());
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('timestamp >= $2'),
        expect.any(Array),
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getRewardHistory('u1')).rejects.toThrow('Failed to get reward history');
    });
  });
});
