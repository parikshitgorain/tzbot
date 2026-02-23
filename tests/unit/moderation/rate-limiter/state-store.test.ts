import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryStateStore, RedisStateStore } from '../../../../src/moderation/rate-limiter/state-store.js';
import type { RedisClient } from '../../../../src/core/cache/redis.client.js';

describe('InMemoryStateStore', () => {
  let store: InMemoryStateStore;

  beforeEach(() => {
    store = new InMemoryStateStore();
  });

  // -------------------------------------------------------------------------
  // getLastMessageTime / setLastMessageTime
  // -------------------------------------------------------------------------

  describe('getLastMessageTime()', () => {
    it('returns null for a new user/channel combination', async () => {
      const result = await store.getLastMessageTime('user1', 'channel1');
      expect(result).toBeNull();
    });

    it('returns the stored timestamp after setLastMessageTime', async () => {
      const ts = Date.now();
      await store.setLastMessageTime('user1', 'channel1', ts);
      const result = await store.getLastMessageTime('user1', 'channel1');
      expect(result).toBe(ts);
    });
  });

  describe('setLastMessageTime()', () => {
    it('stores different timestamps for different user/channel combos', async () => {
      const ts1 = 1000;
      const ts2 = 2000;
      await store.setLastMessageTime('user1', 'channel1', ts1);
      await store.setLastMessageTime('user2', 'channel1', ts2);

      expect(await store.getLastMessageTime('user1', 'channel1')).toBe(ts1);
      expect(await store.getLastMessageTime('user2', 'channel1')).toBe(ts2);
    });

    it('overwrites a previous timestamp for the same user/channel', async () => {
      await store.setLastMessageTime('user1', 'channel1', 1000);
      await store.setLastMessageTime('user1', 'channel1', 9999);
      expect(await store.getLastMessageTime('user1', 'channel1')).toBe(9999);
    });

    it('stores different timestamps for the same user in different channels', async () => {
      await store.setLastMessageTime('user1', 'chA', 111);
      await store.setLastMessageTime('user1', 'chB', 222);
      expect(await store.getLastMessageTime('user1', 'chA')).toBe(111);
      expect(await store.getLastMessageTime('user1', 'chB')).toBe(222);
    });
  });

  // -------------------------------------------------------------------------
  // getViolationExpiry / setViolationExpiry
  // -------------------------------------------------------------------------

  describe('getViolationExpiry()', () => {
    it('returns null initially for any user/channel', async () => {
      const result = await store.getViolationExpiry('user1', 'channel1');
      expect(result).toBeNull();
    });

    it('returns the stored expiry after setViolationExpiry', async () => {
      const expiry = Date.now() + 5000;
      await store.setViolationExpiry('user1', 'channel1', expiry);
      const result = await store.getViolationExpiry('user1', 'channel1');
      expect(result).toBe(expiry);
    });
  });

  describe('setViolationExpiry()', () => {
    it('stores correctly for independent user/channel pairs', async () => {
      const exp1 = Date.now() + 1000;
      const exp2 = Date.now() + 2000;
      await store.setViolationExpiry('user1', 'channel1', exp1);
      await store.setViolationExpiry('user2', 'channel1', exp2);

      expect(await store.getViolationExpiry('user1', 'channel1')).toBe(exp1);
      expect(await store.getViolationExpiry('user2', 'channel1')).toBe(exp2);
    });
  });

  // -------------------------------------------------------------------------
  // removeExpired()
  // -------------------------------------------------------------------------

  describe('removeExpired()', () => {
    it('removes message timestamps older than 60 seconds', async () => {
      const oldTs = Date.now() - 70_000; // 70 s ago
      await store.setLastMessageTime('user1', 'channel1', oldTs);

      await store.removeExpired(Date.now());

      expect(await store.getLastMessageTime('user1', 'channel1')).toBeNull();
    });

    it('keeps recent message timestamps (within 60 s)', async () => {
      const recentTs = Date.now() - 10_000; // 10 s ago
      await store.setLastMessageTime('user2', 'channel1', recentTs);

      await store.removeExpired(Date.now());

      expect(await store.getLastMessageTime('user2', 'channel1')).toBe(recentTs);
    });

    it('removes expired violation windows', async () => {
      const expiredExpiry = Date.now() - 1; // already expired
      await store.setViolationExpiry('user1', 'channel1', expiredExpiry);

      await store.removeExpired(Date.now());

      expect(await store.getViolationExpiry('user1', 'channel1')).toBeNull();
    });

    it('keeps violation windows that have not yet expired', async () => {
      const futureExpiry = Date.now() + 10_000;
      await store.setViolationExpiry('user1', 'channel1', futureExpiry);

      await store.removeExpired(Date.now());

      expect(await store.getViolationExpiry('user1', 'channel1')).toBe(futureExpiry);
    });
  });

  // -------------------------------------------------------------------------
  // getAllKeys()
  // -------------------------------------------------------------------------

  describe('getAllKeys()', () => {
    it('returns empty array when store is empty', async () => {
      const keys = await store.getAllKeys();
      expect(keys).toEqual([]);
    });

    it('returns all stored keys (message and violation combined)', async () => {
      await store.setLastMessageTime('user1', 'channel1', 100);
      await store.setViolationExpiry('user1', 'channel1', 200);

      const keys = await store.getAllKeys();
      expect(keys.length).toBe(2);
    });

    it('includes keys from multiple user/channel combos', async () => {
      await store.setLastMessageTime('userA', 'ch1', 1);
      await store.setLastMessageTime('userB', 'ch1', 2);
      await store.setLastMessageTime('userA', 'ch2', 3);

      const keys = await store.getAllKeys();
      expect(keys.length).toBe(3);
    });
  });
});

describe('RedisStateStore', () => {
  let mockRedis: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    keys: ReturnType<typeof vi.fn>;
  };
  let store: RedisStateStore;

  beforeEach(() => {
    mockRedis = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(undefined),
      keys: vi.fn().mockResolvedValue([]),
    };
    store = new RedisStateStore(mockRedis as unknown as RedisClient);
  });

  describe('getLastMessageTime()', () => {
    it('returns null when key not in Redis', async () => {
      mockRedis.get.mockResolvedValue(null);
      expect(await store.getLastMessageTime('u1', 'c1')).toBeNull();
    });

    it('returns parsed integer from Redis', async () => {
      mockRedis.get.mockResolvedValue('12345');
      expect(await store.getLastMessageTime('u1', 'c1')).toBe(12345);
    });

    it('falls back to in-memory on Redis error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis down'));
      expect(await store.getLastMessageTime('u1', 'c1')).toBeNull();
    });
  });

  describe('setLastMessageTime()', () => {
    it('calls Redis set with correct key', async () => {
      await store.setLastMessageTime('u1', 'c1', 1000);
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('ratelimit:msg'),
        '1000',
        expect.any(Number),
      );
    });

    it('falls back to in-memory on Redis error', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis down'));
      await expect(store.setLastMessageTime('u1', 'c1', 1000)).resolves.toBeUndefined();
    });
  });

  describe('getViolationExpiry()', () => {
    it('returns null when key not in Redis', async () => {
      mockRedis.get.mockResolvedValue(null);
      expect(await store.getViolationExpiry('u1', 'c1')).toBeNull();
    });

    it('returns parsed expiry time', async () => {
      mockRedis.get.mockResolvedValue('9999');
      expect(await store.getViolationExpiry('u1', 'c1')).toBe(9999);
    });

    it('falls back to in-memory on Redis error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis down'));
      expect(await store.getViolationExpiry('u1', 'c1')).toBeNull();
    });
  });

  describe('setViolationExpiry()', () => {
    it('calls Redis set with violation key', async () => {
      await store.setViolationExpiry('u1', 'c1', 9999);
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('ratelimit:violation'),
        '9999',
        expect.any(Number),
      );
    });

    it('falls back to in-memory on Redis error', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis down'));
      await expect(store.setViolationExpiry('u1', 'c1', 9999)).resolves.toBeUndefined();
    });
  });

  describe('removeExpired()', () => {
    it('resolves without error', async () => {
      await expect(store.removeExpired(Date.now())).resolves.toBeUndefined();
    });
  });

  describe('getAllKeys()', () => {
    it('returns combined msg and violation keys from Redis', async () => {
      mockRedis.keys
        .mockResolvedValueOnce(['ratelimit:msg:c1:u1'])
        .mockResolvedValueOnce(['ratelimit:violation:c1:u1']);
      const keys = await store.getAllKeys();
      expect(keys).toHaveLength(2);
    });

    it('falls back to in-memory on Redis error', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis down'));
      const keys = await store.getAllKeys();
      expect(Array.isArray(keys)).toBe(true);
    });
  });
});
