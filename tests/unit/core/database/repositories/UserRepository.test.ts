import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRepository } from '../../../../../src/core/database/repositories/UserRepository.js';
import type { Pool, QueryResult } from 'pg';

// Create a mock pool
const createMockPool = () => ({
  query: vi.fn(),
} as unknown as Pool);

describe('UserRepository', () => {
  let pool: Pool;
  let userRepo: UserRepository;

  beforeEach(() => {
    pool = createMockPool();
    userRepo = new UserRepository(pool);
    vi.clearAllMocks();
  });

  describe('save', () => {
    it('should save a new user', async () => {
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], rowCount: 1 } as unknown as QueryResult);

      const user = { discordId: '123456789', kickUsername: 'testuser' };
      await userRepo.save(user);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        [user.discordId, user.kickUsername]
      );
    });

    it('should update an existing user', async () => {
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], rowCount: 1 } as unknown as QueryResult);

      const user = { discordId: '123456789', kickUsername: 'testuser' };
      await userRepo.save(user);
      await userRepo.save({ ...user, kickUsername: 'updateduser' });

      expect(pool.query).toHaveBeenCalledTimes(2);
      expect(pool.query).toHaveBeenLastCalledWith(
        expect.stringContaining('ON CONFLICT'),
        [user.discordId, 'updateduser']
      );
    });

    it('should handle users without kick username', async () => {
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], rowCount: 1 } as unknown as QueryResult);

      const user = { discordId: '123456789' };
      await userRepo.save(user);

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        [user.discordId, null]
      );
    });
  });

  describe('get', () => {
    it('should get a user by discord ID', async () => {
      const now = new Date();
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{
          discord_id: '123456789',
          kick_username: 'testuser',
          created_at: now,
          updated_at: now,
        }],
        rowCount: 1,
      } as unknown as QueryResult);

      const user = { discordId: '123456789', kickUsername: 'testuser' };
      const retrieved = await userRepo.get(user.discordId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.discordId).toBe(user.discordId);
      expect(retrieved?.kickUsername).toBe(user.kickUsername);
    });

    it('should return null for non-existent user', async () => {
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], rowCount: 0 } as unknown as QueryResult);

      const retrieved = await userRepo.get('nonexistent');
      expect(retrieved).toBeNull();
    });
  });

  describe('getByKickUsername', () => {
    it('should get a user by kick username', async () => {
      const now = new Date();
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{
          discord_id: '123456789',
          kick_username: 'testuser',
          created_at: now,
          updated_at: now,
        }],
        rowCount: 1,
      } as unknown as QueryResult);

      const retrieved = await userRepo.getByKickUsername('testuser');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.discordId).toBe('123456789');
    });

    it('should return null for non-existent kick username', async () => {
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], rowCount: 0 } as unknown as QueryResult);

      const retrieved = await userRepo.getByKickUsername('nonexistent');
      expect(retrieved).toBeNull();
    });
  });

  describe('linkKickUsername', () => {
    it('should link a kick username to a discord user', async () => {
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], rowCount: 1 } as unknown as QueryResult);

      await userRepo.linkKickUsername('123456789', 'testuser');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        ['123456789', 'testuser']
      );
    });
  });

  describe('unlinkKickUsername', () => {
    it('should unlink a kick username', async () => {
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], rowCount: 1 } as unknown as QueryResult);

      await userRepo.unlinkKickUsername('123456789');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('kick_username = NULL'),
        ['123456789']
      );
    });
  });

  describe('deleteUserData', () => {
    it('should delete user data', async () => {
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], rowCount: 1 } as unknown as QueryResult);

      await userRepo.deleteUserData('123456789');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM users'),
        ['123456789']
      );
    });
  });
});
