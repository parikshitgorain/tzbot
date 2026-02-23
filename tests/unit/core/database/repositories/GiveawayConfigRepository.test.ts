import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GiveawayConfigRepository } from '../../../../../src/core/database/repositories/GiveawayConfigRepository.js';
import type { Pool } from 'pg';

describe('GiveawayConfigRepository', () => {
  let mockPool: Pool;
  let repo: GiveawayConfigRepository;

  beforeEach(() => {
    mockPool = { query: vi.fn() } as unknown as Pool;
    repo = new GiveawayConfigRepository(mockPool);
  });

  describe('getGiveawayPermissions()', () => {
    it('returns null when no config exists', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.getGiveawayPermissions('guild1')).toBeNull();
    });

    it('returns mapped config when found', async () => {
      const now = new Date();
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{
          guild_id: 'guild1',
          allowed_roles: ['r1'],
          allowed_users: ['u1'],
          created_at: now,
          updated_at: now,
        }],
      });
      const config = await repo.getGiveawayPermissions('guild1');
      expect(config?.guildId).toBe('guild1');
      expect(config?.allowedRoles).toEqual(['r1']);
      expect(config?.allowedUsers).toEqual(['u1']);
    });

    it('handles null allowed_roles/users gracefully', async () => {
      const now = new Date();
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{
          guild_id: 'guild1',
          allowed_roles: null,
          allowed_users: null,
          created_at: now,
          updated_at: now,
        }],
      });
      const config = await repo.getGiveawayPermissions('guild1');
      expect(config?.allowedRoles).toEqual([]);
      expect(config?.allowedUsers).toEqual([]);
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getGiveawayPermissions('guild1')).rejects.toThrow('Failed to get giveaway permissions');
    });
  });

  describe('updateGiveawayPermissions()', () => {
    it('executes upsert query with correct params', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.updateGiveawayPermissions('guild1', ['r1'], ['u1']);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO giveaway_config'),
        expect.arrayContaining(['guild1']),
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.updateGiveawayPermissions('guild1', [], [])).rejects.toThrow('Failed to update giveaway permissions');
    });
  });
});
