import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WinnerStateRepository } from '../../../../../src/core/database/repositories/WinnerStateRepository.js';
import { WinnerStatus } from '../../../../../src/types/models.js';
import type { Pool } from 'pg';

describe('WinnerStateRepository', () => {
  let mockClient: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };
  let mockPool: Pool;
  let repo: WinnerStateRepository;

  beforeEach(() => {
    mockClient = { query: vi.fn(), release: vi.fn() };
    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn(),
    } as unknown as Pool;
    repo = new WinnerStateRepository(mockPool);
  });

  describe('createWinner()', () => {
    it('executes INSERT into giveaway_winners', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.createWinner({
        giveawayId: 'g1', userId: 'u1', status: WinnerStatus.PENDING,
        selectedAt: new Date(), timerStartTime: new Date(), timerActive: true,
      });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO giveaway_winners'),
        expect.any(Array),
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.createWinner({
        giveawayId: 'g1', userId: 'u1', status: WinnerStatus.PENDING,
        selectedAt: new Date(), timerStartTime: null, timerActive: false,
      })).rejects.toThrow('Failed to create winner');
    });

    it('wraps non-Error throws with Unknown error', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue('oops');
      await expect(repo.createWinner({
        giveawayId: 'g1', userId: 'u1', status: WinnerStatus.PENDING,
        selectedAt: new Date(), timerStartTime: null, timerActive: false,
      })).rejects.toThrow('Unknown error');
    });
  });

  describe('updateStatus()', () => {
    it('transitions PENDING to CONFIRMED', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ status: WinnerStatus.PENDING }] }) // SELECT
        .mockResolvedValueOnce(undefined) // UPDATE
        .mockResolvedValueOnce(undefined); // COMMIT
      await repo.updateStatus('g1', 'u1', WinnerStatus.CONFIRMED);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('ignores transition from terminal CONFIRMED state', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ status: WinnerStatus.CONFIRMED }] }); // SELECT
      await repo.updateStatus('g1', 'u1', WinnerStatus.REROLLED);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('throws when winner not found', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // SELECT - not found
      await expect(repo.updateStatus('g1', 'u1', WinnerStatus.CONFIRMED))
        .rejects.toThrow('Failed to update winner status');
    });

    it('throws on invalid transition from non-PENDING non-terminal state', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ status: 'UNKNOWN_STATE' }] }); // SELECT
      await expect(repo.updateStatus('g1', 'u1', WinnerStatus.CONFIRMED))
        .rejects.toThrow('Failed to update winner status');
    });

    it('transitions PENDING to REROLLED (sets rerolled_at)', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ status: WinnerStatus.PENDING }] }) // SELECT
        .mockResolvedValueOnce(undefined) // UPDATE
        .mockResolvedValueOnce(undefined); // COMMIT
      await repo.updateStatus('g1', 'u1', WinnerStatus.REROLLED);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('ignores transition from terminal REROLLED state', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ status: WinnerStatus.REROLLED }] }); // SELECT
      await repo.updateStatus('g1', 'u1', WinnerStatus.CONFIRMED);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('getWinner()', () => {
    it('returns null when not found', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.getWinner('g1', 'u1')).toBeNull();
    });

    it('returns mapped WinnerRecord when found', async () => {
      const now = new Date();
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{
          id: 'w1', giveaway_id: 'g1', user_id: 'u1', status: WinnerStatus.PENDING,
          selected_at: now, confirmed_at: null, rerolled_at: null,
          timer_start_time: now, timer_active: true, created_at: now, updated_at: now,
        }],
      });
      const winner = await repo.getWinner('g1', 'u1');
      expect(winner?.giveawayId).toBe('g1');
      expect(winner?.status).toBe(WinnerStatus.PENDING);
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getWinner('g1', 'u1')).rejects.toThrow('Failed to get winner');
    });
  });

  describe('getWinners()', () => {
    it('returns empty array when no winners', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.getWinners('g1')).toEqual([]);
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getWinners('g1')).rejects.toThrow('Failed to get winners');
    });
  });

  describe('getAllPendingWinners()', () => {
    it('returns empty array when none', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.getAllPendingWinners()).toEqual([]);
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getAllPendingWinners()).rejects.toThrow('Failed to get pending winners');
    });
  });

  describe('hasWinnerState()', () => {
    it('returns false when no rows', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.hasWinnerState('g1', 'u1')).toBe(false);
    });

    it('returns true when row exists', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [{ '1': 1 }] });
      expect(await repo.hasWinnerState('g1', 'u1')).toBe(true);
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.hasWinnerState('g1', 'u1')).rejects.toThrow('Failed to check winner state');
    });
  });

  describe('getPendingWinnersByUser()', () => {
    it('returns empty array when none', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.getPendingWinnersByUser('guild1', 'u1')).toEqual([]);
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getPendingWinnersByUser('guild1', 'u1')).rejects.toThrow('Failed to get pending winners by user');
    });
  });

  describe('withTransaction()', () => {
    it('commits on success', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      const cb = vi.fn().mockResolvedValue('ok');
      const result = await repo.withTransaction(cb);
      expect(result).toBe('ok');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('rolls back on failure', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      const cb = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(repo.withTransaction(cb)).rejects.toThrow('fail');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });
});
