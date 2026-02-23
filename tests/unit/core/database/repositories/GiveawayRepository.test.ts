import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GiveawayRepository } from '../../../../../src/core/database/repositories/GiveawayRepository.js';
import type { Pool } from 'pg';

function makeGiveaway() {
  return {
    id: 'g1',
    guildId: 'guild1',
    title: 'Test Giveaway',
    description: 'Win a prize',
    channelId: 'ch1',
    messageId: 'msg1',
    requiredRoles: [],
    winnerCount: 1,
    status: 'active' as any,
    endsAt: new Date(),
    createdAt: new Date(),
    entries: [],
    winners: [],
  };
}

describe('GiveawayRepository', () => {
  let mockPool: Pool;
  let repo: GiveawayRepository;

  beforeEach(() => {
    mockPool = { query: vi.fn() } as unknown as Pool;
    repo = new GiveawayRepository(mockPool);
  });

  describe('save()', () => {
    it('executes upsert query', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.save(makeGiveaway());
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO giveaways'),
        expect.any(Array),
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.save(makeGiveaway())).rejects.toThrow('Failed to save giveaway');
    });
  });

  describe('get()', () => {
    it('returns null when not found', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.get('g1')).toBeNull();
    });

    it('returns giveaway with entries', async () => {
      const now = new Date();
      (mockPool.query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          rows: [{
            id: 'g1', guild_id: 'guild1', title: 'Test', description: 'desc',
            channel_id: 'ch1', message_id: 'msg1', required_roles: [],
            winner_count: 1, status: 'active', ends_at: now, created_at: now,
            condition: null, winners: [], hosted_by: null,
          }],
        })
        .mockResolvedValueOnce({ rows: [] }); // getEntries
      const g = await repo.get('g1');
      expect(g?.id).toBe('g1');
      expect(g?.entries).toEqual([]);
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.get('g1')).rejects.toThrow('Failed to get giveaway');
    });
  });

  describe('getActive()', () => {
    it('returns empty array when no active giveaways', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.getActive()).toEqual([]);
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getActive()).rejects.toThrow('Failed to get active giveaways');
    });
  });

  describe('addEntry()', () => {
    it('executes INSERT INTO giveaway_entries', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.addEntry('g1', 'u1');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO giveaway_entries'),
        ['g1', 'u1'],
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.addEntry('g1', 'u1')).rejects.toThrow('Failed to add giveaway entry');
    });

    it('wraps non-Error throws with Unknown error', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue('oops');
      await expect(repo.addEntry('g1', 'u1')).rejects.toThrow('Unknown error');
    });
  });

  describe('getEntries()', () => {
    it('returns empty array when no entries', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.getEntries('g1')).toEqual([]);
    });

    it('maps rows to GiveawayEntry', async () => {
      const now = new Date();
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ user_id: 'u1', timestamp: now }],
      });
      const entries = await repo.getEntries('g1');
      expect(entries[0].userId).toBe('u1');
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getEntries('g1')).rejects.toThrow('Failed to get giveaway entries');
    });
  });

  describe('hasEntry()', () => {
    it('returns false when no rows', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.hasEntry('g1', 'u1')).toBe(false);
    });

    it('returns true when row exists', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [{ '1': 1 }] });
      expect(await repo.hasEntry('g1', 'u1')).toBe(true);
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.hasEntry('g1', 'u1')).rejects.toThrow('Failed to check giveaway entry');
    });
  });

  describe('updateStatus()', () => {
    it('executes UPDATE giveaways', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.updateStatus('g1', 'ended' as any);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE giveaways'),
        ['ended', 'g1'],
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.updateStatus('g1', 'ended' as any)).rejects.toThrow('Failed to update giveaway status');
    });
  });

  describe('getByChannel()', () => {
    it('returns empty array when none found', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.getByChannel('ch1')).toEqual([]);
    });

    it('appends status filter when provided', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.getByChannel('ch1', 'active' as any);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $2'),
        expect.any(Array),
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getByChannel('ch1')).rejects.toThrow('Failed to get giveaways by channel');
    });
  });

  describe('updateWinners()', () => {
    it('executes UPDATE with JSON winners', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.updateWinners('g1', ['u1', 'u2']);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE giveaways'),
        [JSON.stringify(['u1', 'u2']), 'g1'],
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.updateWinners('g1', ['u1'])).rejects.toThrow('Failed to update giveaway winners');
    });
  });
});
