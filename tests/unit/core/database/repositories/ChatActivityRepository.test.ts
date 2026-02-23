import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createPool, closePool } from '../../../../../src/core/database/pool.js';
import { runMigrations } from '../../../../../src/core/database/migrator.js';
import { ChatActivityRepository } from '../../../../../src/core/database/repositories/ChatActivityRepository.js';
import type { Pool } from 'pg';

describe('ChatActivityRepository', () => {
  let pool: Pool;
  let repository: ChatActivityRepository;

  beforeAll(async () => {
    // Create test database connection
    pool = createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'tzbot_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    // Run migrations
    await runMigrations();

    repository = new ChatActivityRepository(pool);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    // Clean up tables before each test
    await pool.query('DELETE FROM chat_activity');
    await pool.query('DELETE FROM chat_rain_winners');
  });

  describe('record', () => {
    it('should record chat activity for a user', async () => {
      const userId = '123456789';
      const timestamp = new Date();

      await repository.record(userId, timestamp);

      const result = await pool.query(
        'SELECT * FROM chat_activity WHERE user_id = $1',
        [userId]
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].user_id).toBe(userId);
    });

    it('should handle duplicate records gracefully', async () => {
      const userId = '123456789';
      const timestamp = new Date();

      await repository.record(userId, timestamp);
      await repository.record(userId, timestamp);

      const result = await pool.query(
        'SELECT * FROM chat_activity WHERE user_id = $1',
        [userId]
      );

      expect(result.rows).toHaveLength(1);
    });

    it('should record multiple activities for the same user at different times', async () => {
      const userId = '123456789';
      const timestamp1 = new Date('2025-01-01T10:00:00Z');
      const timestamp2 = new Date('2025-01-01T10:05:00Z');

      await repository.record(userId, timestamp1);
      await repository.record(userId, timestamp2);

      const result = await pool.query(
        'SELECT * FROM chat_activity WHERE user_id = $1 ORDER BY timestamp',
        [userId]
      );

      expect(result.rows).toHaveLength(2);
    });
  });

  describe('getActiveChatters', () => {
    it('should return users who have chatted since the given time', async () => {
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
      const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);

      await repository.record('user1', now);
      await repository.record('user2', tenMinutesAgo);
      await repository.record('user3', twentyMinutesAgo);

      const activeChatters = await repository.getActiveChatters(
        new Date(now.getTime() - 15 * 60 * 1000)
      );

      expect(activeChatters).toHaveLength(2);
      expect(activeChatters).toContain('user1');
      expect(activeChatters).toContain('user2');
      expect(activeChatters).not.toContain('user3');
    });

    it('should return empty array when no users have chatted', async () => {
      const activeChatters = await repository.getActiveChatters(new Date());

      expect(activeChatters).toHaveLength(0);
    });

    it('should return distinct user IDs even with multiple messages', async () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      await repository.record('user1', now);
      await repository.record('user1', fiveMinutesAgo);

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
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

      await repository.record(userId, now);
      await repository.record(userId, fiveMinutesAgo);
      await repository.record(userId, tenMinutesAgo);

      const count = await repository.getMessageCount(
        userId,
        new Date(now.getTime() - 15 * 60 * 1000)
      );

      expect(count).toBe(3);
    });

    it('should return 0 for a user with no messages', async () => {
      const count = await repository.getMessageCount('nonexistent', new Date());

      expect(count).toBe(0);
    });

    it('should only count messages within the time window', async () => {
      const userId = 'user1';
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);

      await repository.record(userId, now);
      await repository.record(userId, fiveMinutesAgo);
      await repository.record(userId, twentyMinutesAgo);

      const count = await repository.getMessageCount(
        userId,
        new Date(now.getTime() - 10 * 60 * 1000)
      );

      expect(count).toBe(2);
    });
  });

  describe('getQualifiedChatters', () => {
    it('should return users with at least 3 messages in the time window', async () => {
      const now = new Date();
      const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
      const fourMinutesAgo = new Date(now.getTime() - 4 * 60 * 1000);
      const sixMinutesAgo = new Date(now.getTime() - 6 * 60 * 1000);

      // User1: 3 messages (qualified)
      await repository.record('user1', now);
      await repository.record('user1', twoMinutesAgo);
      await repository.record('user1', fourMinutesAgo);

      // User2: 2 messages (not qualified)
      await repository.record('user2', now);
      await repository.record('user2', twoMinutesAgo);

      // User3: 4 messages (qualified)
      await repository.record('user3', now);
      await repository.record('user3', twoMinutesAgo);
      await repository.record('user3', fourMinutesAgo);
      await repository.record('user3', sixMinutesAgo);

      const qualified = await repository.getQualifiedChatters(
        new Date(now.getTime() - 10 * 60 * 1000),
        3
      );

      expect(qualified).toHaveLength(2);
      expect(qualified).toContain('user1');
      expect(qualified).toContain('user3');
      expect(qualified).not.toContain('user2');
    });

    it('should use default minimum of 3 messages', async () => {
      const now = new Date();
      const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
      const fourMinutesAgo = new Date(now.getTime() - 4 * 60 * 1000);

      await repository.record('user1', now);
      await repository.record('user1', twoMinutesAgo);
      await repository.record('user1', fourMinutesAgo);

      const qualified = await repository.getQualifiedChatters(
        new Date(now.getTime() - 10 * 60 * 1000)
      );

      expect(qualified).toHaveLength(1);
      expect(qualified[0]).toBe('user1');
    });

    it('should return empty array when no users qualify', async () => {
      const now = new Date();

      await repository.record('user1', now);
      await repository.record('user2', now);

      const qualified = await repository.getQualifiedChatters(
        new Date(now.getTime() - 10 * 60 * 1000),
        3
      );

      expect(qualified).toHaveLength(0);
    });

    it('should support custom minimum message thresholds', async () => {
      const now = new Date();
      const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);

      await repository.record('user1', now);
      await repository.record('user1', twoMinutesAgo);

      const qualified = await repository.getQualifiedChatters(
        new Date(now.getTime() - 10 * 60 * 1000),
        2
      );

      expect(qualified).toHaveLength(1);
      expect(qualified[0]).toBe('user1');
    });
  });

  describe('cleanupOldActivity', () => {
    it('should delete activity records older than the specified date', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      await repository.record('user1', now);
      await repository.record('user2', oneHourAgo);
      await repository.record('user3', twoHoursAgo);

      const deletedCount = await repository.cleanupOldActivity(
        new Date(now.getTime() - 90 * 60 * 1000)
      );

      expect(deletedCount).toBe(1);

      const remaining = await pool.query('SELECT * FROM chat_activity');
      expect(remaining.rows).toHaveLength(2);
    });

    it('should return 0 when no records are deleted', async () => {
      const now = new Date();
      await repository.record('user1', now);

      const deletedCount = await repository.cleanupOldActivity(
        new Date(now.getTime() - 60 * 60 * 1000)
      );

      expect(deletedCount).toBe(0);
    });

    it('should delete all records when all are older', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      await repository.record('user1', twoHoursAgo);
      await repository.record('user2', twoHoursAgo);

      const deletedCount = await repository.cleanupOldActivity(new Date());

      expect(deletedCount).toBe(2);

      const remaining = await pool.query('SELECT * FROM chat_activity');
      expect(remaining.rows).toHaveLength(0);
    });
  });

  describe('recordWinner', () => {
    it('should record a chat rain winner', async () => {
      const userId = 'user1';
      const timestamp = new Date();
      const rewardType = 'role';
      const rewardValue = 'VIP';

      await repository.recordWinner(userId, timestamp, rewardType, rewardValue);

      const result = await pool.query(
        'SELECT * FROM chat_rain_winners WHERE user_id = $1',
        [userId]
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].user_id).toBe(userId);
      expect(result.rows[0].reward_type).toBe(rewardType);
      expect(result.rows[0].reward_value).toBe(rewardValue);
    });

    it('should record winner without reward value', async () => {
      const userId = 'user1';
      const timestamp = new Date();
      const rewardType = 'announcement';

      await repository.recordWinner(userId, timestamp, rewardType);

      const result = await pool.query(
        'SELECT * FROM chat_rain_winners WHERE user_id = $1',
        [userId]
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].reward_value).toBeNull();
    });

    it('should allow multiple wins for the same user at different times', async () => {
      const userId = 'user1';
      const timestamp1 = new Date('2025-01-01T10:00:00Z');
      const timestamp2 = new Date('2025-01-01T11:00:00Z');

      await repository.recordWinner(userId, timestamp1, 'role', 'VIP');
      await repository.recordWinner(userId, timestamp2, 'role', 'VIP');

      const result = await pool.query(
        'SELECT * FROM chat_rain_winners WHERE user_id = $1 ORDER BY timestamp',
        [userId]
      );

      expect(result.rows).toHaveLength(2);
    });
  });

  describe('getRecentWinners', () => {
    it('should return users who won since the given time', async () => {
      const now = new Date();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      await repository.recordWinner('user1', now, 'role', 'VIP');
      await repository.recordWinner('user2', thirtyMinutesAgo, 'role', 'VIP');
      await repository.recordWinner('user3', twoHoursAgo, 'role', 'VIP');

      const recentWinners = await repository.getRecentWinners(
        new Date(now.getTime() - 60 * 60 * 1000)
      );

      expect(recentWinners).toHaveLength(2);
      expect(recentWinners).toContain('user1');
      expect(recentWinners).toContain('user2');
      expect(recentWinners).not.toContain('user3');
    });

    it('should return distinct user IDs even with multiple wins', async () => {
      const now = new Date();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

      await repository.recordWinner('user1', now, 'role', 'VIP');
      await repository.recordWinner('user1', thirtyMinutesAgo, 'role', 'VIP');

      const recentWinners = await repository.getRecentWinners(
        new Date(now.getTime() - 60 * 60 * 1000)
      );

      expect(recentWinners).toHaveLength(1);
      expect(recentWinners[0]).toBe('user1');
    });

    it('should return empty array when no recent winners', async () => {
      const recentWinners = await repository.getRecentWinners(new Date());

      expect(recentWinners).toHaveLength(0);
    });
  });

  describe('hasRecentWin', () => {
    it('should return true when user has won recently', async () => {
      const userId = 'user1';
      const now = new Date();

      await repository.recordWinner(userId, now, 'role', 'VIP');

      const hasWon = await repository.hasRecentWin(
        userId,
        new Date(now.getTime() - 60 * 60 * 1000)
      );

      expect(hasWon).toBe(true);
    });

    it('should return false when user has not won recently', async () => {
      const userId = 'user1';
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      await repository.recordWinner(userId, twoHoursAgo, 'role', 'VIP');

      const hasWon = await repository.hasRecentWin(
        userId,
        new Date(Date.now() - 60 * 60 * 1000)
      );

      expect(hasWon).toBe(false);
    });

    it('should return false when user has never won', async () => {
      const hasWon = await repository.hasRecentWin('nonexistent', new Date());

      expect(hasWon).toBe(false);
    });
  });

  describe('getLastChatRainTime', () => {
    it('should return the most recent chat rain timestamp', async () => {
      const now = new Date();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      await repository.recordWinner('user1', oneHourAgo, 'role', 'VIP');
      await repository.recordWinner('user2', thirtyMinutesAgo, 'role', 'VIP');
      await repository.recordWinner('user3', now, 'role', 'VIP');

      const lastTime = await repository.getLastChatRainTime();

      expect(lastTime).not.toBeNull();
      expect(lastTime!.getTime()).toBeCloseTo(now.getTime(), -2);
    });

    it('should return null when no chat rain has occurred', async () => {
      const lastTime = await repository.getLastChatRainTime();

      expect(lastTime).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle very old timestamps', async () => {
      const veryOld = new Date('2020-01-01T00:00:00Z');
      await repository.record('user1', veryOld);

      const count = await repository.getMessageCount('user1', veryOld);
      expect(count).toBe(1);
    });

    it('should handle future timestamps', async () => {
      const future = new Date(Date.now() + 60 * 60 * 1000);
      await repository.record('user1', future);

      const activeChatters = await repository.getActiveChatters(new Date());
      expect(activeChatters).toContain('user1');
    });

    it('should handle boundary conditions for 10-minute window', async () => {
      const now = new Date();
      const exactlyTenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

      await repository.record('user1', exactlyTenMinutesAgo);

      const activeChatters = await repository.getActiveChatters(exactlyTenMinutesAgo);
      expect(activeChatters).toContain('user1');
    });
  });
});
