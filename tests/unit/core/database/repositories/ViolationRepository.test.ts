import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ViolationRepository } from '../../../../../src/core/database/repositories/ViolationRepository.js';
import type { Pool } from 'pg';

describe('ViolationRepository', () => {
  let mockPool: Pool;
  let repo: ViolationRepository;

  beforeEach(() => {
    mockPool = { query: vi.fn() } as unknown as Pool;
    repo = new ViolationRepository(mockPool);
  });

  describe('save()', () => {
    it('inserts violation and returns id', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [{ id: 'v1' }] });
      const id = await repo.save({
        userId: 'u1',
        type: 'spam' as any,
        severity: 1,
        timestamp: new Date(),
        details: 'Spam message',
        punishmentApplied: undefined,
      });
      expect(id).toBe('v1');
    });

    it('passes null for missing punishmentApplied', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [{ id: 'v1' }] });
      await repo.save({
        userId: 'u1',
        type: 'spam' as any,
        severity: 1,
        timestamp: new Date(),
        details: '',
        punishmentApplied: undefined,
      });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([null]),
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.save({
        userId: 'u1', type: 'spam' as any, severity: 1,
        timestamp: new Date(), details: '', punishmentApplied: undefined,
      })).rejects.toThrow('Failed to save violation');
    });

    it('wraps non-Error throws with Unknown error', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(42);
      await expect(repo.save({
        userId: 'u1', type: 'spam' as any, severity: 1,
        timestamp: new Date(), details: '', punishmentApplied: undefined,
      })).rejects.toThrow('Unknown error');
    });
  });

  describe('get()', () => {
    it('returns empty array when no violations', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.get('u1', new Date())).toEqual([]);
    });

    it('maps rows to Violation objects', async () => {
      const now = new Date();
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{
          id: 'v1', user_id: 'u1', type: 'spam', severity: 1,
          timestamp: now, details: 'details', punishment_applied: null,
        }],
      });
      const violations = await repo.get('u1', new Date());
      expect(violations).toHaveLength(1);
      expect(violations[0].userId).toBe('u1');
      expect(violations[0].type).toBe('spam');
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.get('u1', new Date())).rejects.toThrow('Failed to get violations');
    });
  });

  describe('getCount()', () => {
    it('returns count without type filter', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [{ count: '3' }] });
      expect(await repo.getCount('u1', new Date())).toBe(3);
    });

    it('includes type in query when provided', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [{ count: '1' }] });
      await repo.getCount('u1', new Date(), 'spam' as any);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('type = $3'),
        expect.any(Array),
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getCount('u1', new Date())).rejects.toThrow('Failed to get violation count');
    });
  });

  describe('clear()', () => {
    it('executes DELETE for user', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.clear('u1');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM violations'),
        ['u1'],
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.clear('u1')).rejects.toThrow('Failed to clear violations');
    });
  });

  describe('clearOldViolations()', () => {
    it('deletes old violations and returns count', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 5, rows: [] });
      const count = await repo.clearOldViolations(new Date());
      expect(count).toBe(5);
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.clearOldViolations(new Date())).rejects.toThrow('Failed to clear old violations');
    });
  });

  describe('getLatest()', () => {
    it('returns null when no violations', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.getLatest('u1')).toBeNull();
    });

    it('returns latest violation', async () => {
      const now = new Date();
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ id: 'v1', user_id: 'u1', type: 'spam', severity: 1, timestamp: now, details: '', punishment_applied: null }],
      });
      const v = await repo.getLatest('u1');
      expect(v?.id).toBe('v1');
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getLatest('u1')).rejects.toThrow('Failed to get latest violation');
    });
  });

  describe('getCountByPunishment()', () => {
    it('returns count for single punishment level', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [{ count: '2' }] });
      const count = await repo.getCountByPunishment('u1', new Date(), 'WARNING' as any);
      expect(count).toBe(2);
    });

    it('accepts array of punishment levels', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [{ count: '4' }] });
      const count = await repo.getCountByPunishment('u1', new Date(), ['WARNING', 'TIMEOUT'] as any);
      expect(count).toBe(4);
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getCountByPunishment('u1', new Date(), 'WARNING' as any)).rejects.toThrow('Failed to get violation count by punishment');
    });
  });
});
