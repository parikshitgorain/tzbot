import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OffenseRepository } from '../../../../../src/core/database/repositories/OffenseRepository.js';
import type { Pool } from 'pg';

describe('OffenseRepository', () => {
  let mockClient: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };
  let mockPool: Pool;
  let repo: OffenseRepository;

  beforeEach(() => {
    mockClient = { query: vi.fn(), release: vi.fn() };
    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn(),
    } as unknown as Pool;
    repo = new OffenseRepository(mockPool);
  });

  describe('getOffenseRecord()', () => {
    it('returns null when no record exists', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      expect(await repo.getOffenseRecord('u1')).toBeNull();
    });

    it('returns record with entries', async () => {
      const now = new Date();
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{
            user_id: 'u1', total_offenses: 2, last_offense_timestamp: now,
            current_timeout_duration: 0, is_banned: false,
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 1, timestamp: now, reason: 'spam', punishment_applied: 'WARNING',
            moderator_id: 'mod1', timeout_duration: null,
          }],
        });
      const record = await repo.getOffenseRecord('u1');
      expect(record?.user_id).toBe('u1');
      expect(record?.total_offenses).toBe(2);
      expect(record?.warning_history).toHaveLength(1);
    });

    it('throws wrapped error on DB failure', async () => {
      mockClient.query.mockRejectedValue(new Error('db down'));
      await expect(repo.getOffenseRecord('u1')).rejects.toThrow('Failed to get offense record');
    });

    it('wraps non-Error throws with Unknown error', async () => {
      mockClient.query.mockRejectedValue('oops');
      await expect(repo.getOffenseRecord('u1')).rejects.toThrow('Unknown error');
    });
  });

  describe('saveOffenseRecord()', () => {
    it('executes upsert query', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.saveOffenseRecord({
        user_id: 'u1', total_offenses: 1, last_offense_timestamp: new Date(),
        current_timeout_duration: 0, is_banned: false, warning_history: [],
      });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO offense_records'),
        expect.any(Array),
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.saveOffenseRecord({
        user_id: 'u1', total_offenses: 0, last_offense_timestamp: null,
        current_timeout_duration: 0, is_banned: false, warning_history: [],
      })).rejects.toThrow('Failed to save offense record');
    });
  });

  describe('addOffenseEntry()', () => {
    it('inserts offense entry', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.addOffenseEntry('u1', {
        timestamp: new Date(), reason: 'spam',
        punishment_applied: 'WARNING', moderator_id: 'mod1',
      });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO offense_entries'),
        expect.any(Array),
      );
    });

    it('passes null for missing timeout_duration', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.addOffenseEntry('u1', {
        timestamp: new Date(), reason: '', punishment_applied: '', moderator_id: '',
      });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([null]),
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.addOffenseEntry('u1', {
        timestamp: new Date(), reason: '', punishment_applied: '', moderator_id: '',
      })).rejects.toThrow('Failed to add offense entry');
    });
  });

  describe('getAllActiveOffenses()', () => {
    it('returns empty array when no active offenses', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      expect(await repo.getAllActiveOffenses()).toEqual([]);
    });

    it('returns records combined with entries', async () => {
      const now = new Date();
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{
            user_id: 'u1', total_offenses: 1, last_offense_timestamp: now,
            current_timeout_duration: 0, is_banned: false,
          }],
        })
        .mockResolvedValueOnce({ rows: [] }); // entries
      const records = await repo.getAllActiveOffenses();
      expect(records).toHaveLength(1);
      expect(records[0].warning_history).toEqual([]);
    });

    it('throws wrapped error on DB failure', async () => {
      mockClient.query.mockRejectedValue(new Error('db down'));
      await expect(repo.getAllActiveOffenses()).rejects.toThrow('Failed to get all active offenses');
    });
  });

  describe('removeLastOffense()', () => {
    it('executes delete + update in a transaction', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      await repo.removeLastOffense('u1');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('rolls back and throws on DB failure', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error('db down'));
      await expect(repo.removeLastOffense('u1')).rejects.toThrow('Failed to remove last offense');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('resetOffenses()', () => {
    it('deletes offense record', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.resetOffenses('u1');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM offense_records'),
        ['u1'],
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.resetOffenses('u1')).rejects.toThrow('Failed to reset offenses');
    });
  });

  describe('withTransaction()', () => {
    it('executes callback inside BEGIN/COMMIT', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      const cb = vi.fn().mockResolvedValue('result');
      const result = await repo.withTransaction(cb);
      expect(result).toBe('result');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('rolls back on callback failure', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      const cb = vi.fn().mockRejectedValue(new Error('cb error'));
      await expect(repo.withTransaction(cb)).rejects.toThrow('cb error');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });
});
