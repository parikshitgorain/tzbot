import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createPool, closePool } from '../../../../../src/core/database/pool.js';
import { runMigrations } from '../../../../../src/core/database/migrator.js';
import { UserRepository } from '../../../../../src/core/database/repositories/UserRepository.js';
import type { Pool } from 'pg';

describe('UserRepository', () => {
  let pool: Pool;
  let userRepo: UserRepository;

  beforeAll(async () => {
    // Create test database connection
    pool = createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'tzbot_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    // Run migrations
    await runMigrations();

    userRepo = new UserRepository(pool);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    // Clean up users table before each test
    await pool.query('DELETE FROM users');
  });

  describe('save', () => {
    it('should save a new user', async () => {
      const user = {
        discordId: '123456789',
        kickUsername: 'testuser',
      };

      await userRepo.save(user);

      const result = await pool.query('SELECT * FROM users WHERE discord_id = $1', [user.discordId]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].discord_id).toBe(user.discordId);
      expect(result.rows[0].kick_username).toBe(user.kickUsername);
    });

    it('should update an existing user', async () => {
      const user = {
        discordId: '123456789',
        kickUsername: 'testuser',
      };

      await userRepo.save(user);
      await userRepo.save({ ...user, kickUsername: 'updateduser' });

      const result = await pool.query('SELECT * FROM users WHERE discord_id = $1', [user.discordId]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].kick_username).toBe('updateduser');
    });

    it('should handle users without kick username', async () => {
      const user = {
        discordId: '123456789',
      };

      await userRepo.save(user);

      const result = await pool.query('SELECT * FROM users WHERE discord_id = $1', [user.discordId]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].kick_username).toBeNull();
    });
  });

  describe('get', () => {
    it('should get a user by discord ID', async () => {
      const user = {
        discordId: '123456789',
        kickUsername: 'testuser',
      };

      await userRepo.save(user);
      const retrieved = await userRepo.get(user.discordId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.discordId).toBe(user.discordId);
      expect(retrieved?.kickUsername).toBe(user.kickUsername);
    });

    it('should return null for non-existent user', async () => {
      const retrieved = await userRepo.get('nonexistent');
      expect(retrieved).toBeNull();
    });
  });

  describe('getByKickUsername', () => {
    it('should get a user by kick username', async () => {
      const user = {
        discordId: '123456789',
        kickUsername: 'testuser',
      };

      await userRepo.save(user);
      const retrieved = await userRepo.getByKickUsername(user.kickUsername!);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.discordId).toBe(user.discordId);
      expect(retrieved?.kickUsername).toBe(user.kickUsername);
    });

    it('should return null for non-existent kick username', async () => {
      const retrieved = await userRepo.getByKickUsername('nonexistent');
      expect(retrieved).toBeNull();
    });
  });

  describe('linkKickUsername', () => {
    it('should link a kick username to a discord user', async () => {
      const discordId = '123456789';
      const kickUsername = 'testuser';

      await userRepo.linkKickUsername(discordId, kickUsername);

      const user = await userRepo.get(discordId);
      expect(user?.kickUsername).toBe(kickUsername);
    });

    it('should update existing link', async () => {
      const discordId = '123456789';

      await userRepo.linkKickUsername(discordId, 'olduser');
      await userRepo.linkKickUsername(discordId, 'newuser');

      const user = await userRepo.get(discordId);
      expect(user?.kickUsername).toBe('newuser');
    });
  });

  describe('unlinkKickUsername', () => {
    it('should unlink a kick username', async () => {
      const user = {
        discordId: '123456789',
        kickUsername: 'testuser',
      };

      await userRepo.save(user);
      await userRepo.unlinkKickUsername(user.discordId);

      const retrieved = await userRepo.get(user.discordId);
      expect(retrieved?.kickUsername).toBeNull();
    });
  });

  describe('deleteUserData', () => {
    it('should delete user data', async () => {
      const user = {
        discordId: '123456789',
        kickUsername: 'testuser',
      };

      await userRepo.save(user);
      await userRepo.deleteUserData(user.discordId);

      const retrieved = await userRepo.get(user.discordId);
      expect(retrieved).toBeNull();
    });
  });
});
