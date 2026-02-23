import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRepository } from '../../../../../src/core/database/repositories/UserRepository.js';
import type { Pool } from 'pg';

describe('UserRepository', () => {
  let mockPool: Pool;
  let repo: UserRepository;

  beforeEach(() => {
    mockPool = { query: vi.fn() } as unknown as Pool;
    repo = new UserRepository(mockPool);
  });

  describe('save()', () => {
    it('executes upsert query with discordId and kickUsername', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.save({ discordId: 'u1', kickUsername: 'kick_user' });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        ['u1', 'kick_user'],
      );
    });

    it('passes null for missing kickUsername', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.save({ discordId: 'u1' });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['u1', null],
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.save({ discordId: 'u1' })).rejects.toThrow('Failed to save user');
    });

    it('wraps non-Error throws with Unknown error', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue('string error');
      await expect(repo.save({ discordId: 'u1' })).rejects.toThrow('Unknown error');
    });
  });

  describe('get()', () => {
    it('returns null when user not found', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.get('u1')).toBeNull();
    });

    it('returns mapped User when found', async () => {
      const now = new Date();
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ discord_id: 'u1', kick_username: 'kick', created_at: now, updated_at: now }],
      });
      const user = await repo.get('u1');
      expect(user?.discordId).toBe('u1');
      expect(user?.kickUsername).toBe('kick');
      expect(user?.roles).toEqual([]);
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.get('u1')).rejects.toThrow('Failed to get user');
    });

    it('wraps non-Error throws with Unknown error', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue('string error');
      await expect(repo.get('u1')).rejects.toThrow('Unknown error');
    });
  });

  describe('getByKickUsername()', () => {
    it('returns null when not found', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.getByKickUsername('kick')).toBeNull();
						});

    it('returns user when found', async () => {
      const now = new Date();
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ discord_id: 'u1', kick_username: 'kick', created_at: now, updated_at: now }],
      });
      const user = await repo.getByKickUsername('kick');
      expect(user?.kickUsername).toBe('kick');
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getByKickUsername('kick')).rejects.toThrow('Failed to get user by Kick username');
    });
  });

  describe('linkKickUsername()', () => {
    it('calls upsert query', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.linkKickUsername('u1', 'kick_user');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        ['u1', 'kick_user'],
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.linkKickUsername('u1', 'kick')).rejects.toThrow('Failed to link Kick username');
    });
  });

  describe('unlinkKickUsername()', () => {
    it('calls update query setting kick_username to NULL', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.unlinkKickUsername('u1');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('kick_username = NULL'),
        ['u1'],
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.unlinkKickUsername('u1')).rejects.toThrow('Failed to unlink Kick username');
    });
  });

  describe('deleteUserData()', () => {
    it('calls DELETE query', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.deleteUserData('u1');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM users'),
        ['u1'],
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.deleteUserData('u1')).rejects.toThrow('Failed to delete user data');
    });
  });
});
