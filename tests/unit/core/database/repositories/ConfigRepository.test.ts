import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigRepository } from '../../../../../src/core/database/repositories/ConfigRepository.js';
import type { Pool } from 'pg';

describe('ConfigRepository', () => {
  let mockClient: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };
  let mockPool: Pool;
  let repo: ConfigRepository;

  beforeEach(() => {
    mockClient = { query: vi.fn(), release: vi.fn() };
    mockPool = {
      query: vi.fn(),
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as Pool;
    repo = new ConfigRepository(mockPool);
  });

  describe('get()', () => {
    it('returns null when key not found', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.get('missing')).toBeNull();
    });

    it('returns parsed JSON for object values', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [{ value: '{"foo":"bar"}' }] });
      expect(await repo.get('key')).toEqual({ foo: 'bar' });
    });

    it('returns string as-is for Discord snowflake ID (18 digits)', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [{ value: '123456789012345678' }] });
      expect(await repo.get('key')).toBe('123456789012345678');
    });

    it('returns string as-is for comma-separated Discord IDs', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [{ value: '123456789012345678,987654321098765432' }] });
      expect(await repo.get('key')).toBe('123456789012345678,987654321098765432');
    });

    it('returns raw string when JSON parse fails', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [{ value: 'plain-string' }] });
      expect(await repo.get('key')).toBe('plain-string');
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.get('key')).rejects.toThrow('Failed to get config');
    });

    it('wraps non-Error throws with Unknown error', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue('string error');
      await expect(repo.get('key')).rejects.toThrow('Unknown error');
    });
  });

  describe('set()', () => {
    it('upserts string value directly', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.set('key', 'string-val');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO config'),
        ['key', 'string-val'],
      );
    });

    it('upserts JSON-serialized non-string value', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.set('key', { a: 1 });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['key', '{"a":1}'],
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.set('key', 'val')).rejects.toThrow('Failed to set config');
    });
  });

  describe('getMany()', () => {
    it('returns map with parsed values', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ key: 'k1', value: '42' }, { key: 'k2', value: 'hello' }],
      });
      const result = await repo.getMany(['k1', 'k2']);
      expect(result.get('k1')).toBe(42);
      expect(result.get('k2')).toBe('hello');
    });

    it('handles snowflake ID values in getMany', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ key: 'channel', value: '123456789012345678' }],
      });
      const result = await repo.getMany(['channel']);
      expect(result.get('channel')).toBe('123456789012345678');
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getMany(['k1'])).rejects.toThrow('Failed to get multiple configs');
    });
  });

  describe('setMany()', () => {
    it('does nothing for empty map', async () => {
      await repo.setMany(new Map());
      expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it('inserts all entries in a transaction', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      const configs = new Map<string, unknown>([['k1', 'v1'], ['k2', 42]]);
      await repo.setMany(configs);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('rolls back and throws on DB failure', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error('db down'));
      const configs = new Map<string, unknown>([['k1', 'v1']]);
      await expect(repo.setMany(configs)).rejects.toThrow('Failed to set multiple configs');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('delete()', () => {
    it('returns true when key deleted', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1, rows: [] });
      expect(await repo.delete('key')).toBe(true);
    });

    it('returns false when key not found', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 0, rows: [] });
      expect(await repo.delete('missing')).toBe(false);
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.delete('key')).rejects.toThrow('Failed to delete config');
    });
  });

  describe('getAllKeys()', () => {
    it('returns array of keys', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [{ key: 'a' }, { key: 'b' }] });
      expect(await repo.getAllKeys()).toEqual(['a', 'b']);
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getAllKeys()).rejects.toThrow('Failed to get all config keys');
    });
  });

  describe('getAll()', () => {
    it('returns map of all configs', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ key: 'k1', value: '"val1"' }],
      });
      const result = await repo.getAll();
      expect(result.get('k1')).toBe('val1');
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getAll()).rejects.toThrow('Failed to get all configs');
    });
  });

  describe('has()', () => {
    it('returns true when key exists', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [{ '1': 1 }] });
      expect(await repo.has('key')).toBe(true);
    });

    it('returns false when key does not exist', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.has('missing')).toBe(false);
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.has('key')).rejects.toThrow('Failed to check config existence');
    });
  });
});
