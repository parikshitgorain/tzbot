import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserRepository } from '../../../../../src/core/database/repositories/UserRepository.js';
import type { Pool, QueryResult } from 'pg';

describe('UserRepository', () => {
  let mockPool: Pool;
  let userRepo: UserRepository;

  beforeEach(() => {
    mockPool = {
      query: vi.fn(),
    } as unknown as Pool;

    userRepo = new UserRepository(mockPool);
  });

  describe('save', () => {
    it('should save a new user', async () => {
      const user = {
        discordId: '123456789',
        kickUsername: 'testuser',
      };

      (mockPool.query as any).mockResolvedValueOnce({} as QueryResult);

      await userRepo.save(user);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        [user.discordId, user.kickUsername]
      );
    });

    it('should update an existing user', async () => {
      const user = {
        discordId: '123456789',
        kickUsername: 'testuser',
      };

      (mockPool.query as any).mockResolvedValue({} as QueryResult);

      await userRepo.save(user);
      await userRepo.save({ ...user, kickUsername: 'updateduser' });

      expect(mockPool.query).toHaveBeenCalledTimes(2);
      expect(mockPool.query).toHaveBeenLastCalledWith(
        expect.stringContaining('ON CONFLICT'),
        ['123456789', 'updateduser']
      );
    });

    it('should handle users without kick username', async () => {
      const user = {
        discordId: '123456789',
      };

      (mockPool.query as any).mockResolvedValueOnce({} as QueryResult);

      await userRepo.save(user);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.anything(),
        [user.discordId, null]
      );
    });
  });

  describe('get', () => {
    it('should get a user by discord ID', async () => {
      const user = {
        discord_id: '123456789',
        kick_username: 'testuser',
        created_at: new Date(),
        updated_at: new Date(),
      };

      (mockPool.query as any).mockResolvedValueOnce({
        rows: [user],
      } as any);

      const retrieved = await userRepo.get(user.discord_id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.discordId).toBe(user.discord_id);
      expect(retrieved?.kickUsername).toBe(user.kick_username);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [user.discord_id]
      );
    });

    it('should return null for non-existent user', async () => {
      (mockPool.query as any).mockResolvedValueOnce({
        rows: [],
      } as any);

      const retrieved = await userRepo.get('nonexistent');
      expect(retrieved).toBeNull();
    });
  });

  describe('getByKickUsername', () => {
    it('should get a user by kick username', async () => {
      const user = {
        discord_id: '123456789',
        kick_username: 'testuser',
        created_at: new Date(),
        updated_at: new Date(),
      };

      (mockPool.query as any).mockResolvedValueOnce({
        rows: [user],
      } as any);

      const retrieved = await userRepo.getByKickUsername(user.kick_username);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.discordId).toBe(user.discord_id);
      expect(retrieved?.kickUsername).toBe(user.kick_username);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE kick_username'),
        [user.kick_username]
      );
    });

    it('should return null for non-existent kick username', async () => {
      (mockPool.query as any).mockResolvedValueOnce({
        rows: [],
      } as any);

      const retrieved = await userRepo.getByKickUsername('nonexistent');
      expect(retrieved).toBeNull();
    });
  });

  describe('linkKickUsername', () => {
    it('should link a kick username to a discord user', async () => {
      const discordId = '123456789';
      const kickUsername = 'testuser';

      (mockPool.query as any).mockResolvedValueOnce({} as QueryResult);

      await userRepo.linkKickUsername(discordId, kickUsername);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        [discordId, kickUsername]
      );
    });

    it('should update existing link', async () => {
      const discordId = '123456789';

      (mockPool.query as any).mockResolvedValue({} as QueryResult);

      await userRepo.linkKickUsername(discordId, 'olduser');
      await userRepo.linkKickUsername(discordId, 'newuser');

      expect(mockPool.query).toHaveBeenCalledTimes(2);
      expect(mockPool.query).toHaveBeenLastCalledWith(
        expect.anything(),
        [discordId, 'newuser']
      );
    });
  });

  describe('unlinkKickUsername', () => {
    it('should unlink a kick username', async () => {
      const discordId = '123456789';

      (mockPool.query as any).mockResolvedValueOnce({} as QueryResult);

      await userRepo.unlinkKickUsername(discordId);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        [discordId]
      );
    });
  });

  describe('deleteUserData', () => {
    it('should delete user data', async () => {
      const discordId = '123456789';

      (mockPool.query as any).mockResolvedValueOnce({} as QueryResult);

      await userRepo.deleteUserData(discordId);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM users'),
        [discordId]
      );
    });
  });
});
