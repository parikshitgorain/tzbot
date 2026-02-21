import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createPool, closePool } from '../../../../../src/core/database/pool.js';
import { runMigrations } from '../../../../../src/core/database/migrator.js';
import { WinnerStateRepository } from '../../../../../src/core/database/repositories/WinnerStateRepository.js';
import { WinnerStatus } from '../../../../../src/types/models.js';
import type { Pool } from 'pg';

describe('WinnerStateRepository', () => {
  let pool: Pool;
  let repository: WinnerStateRepository;
  const testGiveawayId = '550e8400-e29b-41d4-a716-446655440000';
  const testUserId = '123456789012345678';

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

    repository = new WinnerStateRepository(pool);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await pool.query('DELETE FROM giveaway_winners WHERE giveaway_id = $1', [testGiveawayId]);
    await pool.query('DELETE FROM giveaways WHERE id = $1', [testGiveawayId]);
    
    // Create a test giveaway for foreign key constraint
    await pool.query(
      `INSERT INTO giveaways (
        id, guild_id, channel_id, message_id, title, description, winner_count,
        ends_at, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        testGiveawayId,
        '987654321098765432', // guild_id
        '111111111111111111', // channel_id
        '222222222222222222', // message_id
        'Test Giveaway',      // title
        'Test Description',   // description
        1,                    // winner_count
        new Date(Date.now() + 3600000), // ends_at (1 hour from now)
        'active',             // status
        new Date()            // created_at
      ]
    );
  });

  describe('createWinner', () => {
    it('should create a new winner record with PENDING status', async () => {
      const now = new Date();
      await repository.createWinner({
        giveawayId: testGiveawayId,
        userId: testUserId,
        status: WinnerStatus.PENDING,
        selectedAt: now,
        timerStartTime: now,
        timerActive: true,
      });

      const winner = await repository.getWinner(testGiveawayId, testUserId);
      expect(winner).not.toBeNull();
      expect(winner?.status).toBe(WinnerStatus.PENDING);
      expect(winner?.userId).toBe(testUserId);
      expect(winner?.timerActive).toBe(true);
    });

    it('should throw error on duplicate winner', async () => {
      const now = new Date();
      const record = {
        giveawayId: testGiveawayId,
        userId: testUserId,
        status: WinnerStatus.PENDING,
        selectedAt: now,
        timerStartTime: now,
        timerActive: true,
      };

      await repository.createWinner(record);
      await expect(repository.createWinner(record)).rejects.toThrow();
    });
  });

  describe('updateStatus', () => {
    beforeEach(async () => {
      const now = new Date();
      await repository.createWinner({
        giveawayId: testGiveawayId,
        userId: testUserId,
        status: WinnerStatus.PENDING,
        selectedAt: now,
        timerStartTime: now,
        timerActive: true,
      });
    });

    it('should transition PENDING to CONFIRMED', async () => {
      await repository.updateStatus(testGiveawayId, testUserId, WinnerStatus.CONFIRMED);

      const winner = await repository.getWinner(testGiveawayId, testUserId);
      expect(winner?.status).toBe(WinnerStatus.CONFIRMED);
      expect(winner?.confirmedAt).toBeDefined();
      expect(winner?.timerActive).toBe(false);
    });

    it('should transition PENDING to REROLLED', async () => {
      await repository.updateStatus(testGiveawayId, testUserId, WinnerStatus.REROLLED);

      const winner = await repository.getWinner(testGiveawayId, testUserId);
      expect(winner?.status).toBe(WinnerStatus.REROLLED);
      expect(winner?.rerolledAt).toBeDefined();
      expect(winner?.timerActive).toBe(false);
    });

    it('should not allow transition from CONFIRMED (terminal state)', async () => {
      await repository.updateStatus(testGiveawayId, testUserId, WinnerStatus.CONFIRMED);
      
      // Attempt to change from CONFIRMED to REROLLED should be silently ignored
      await repository.updateStatus(testGiveawayId, testUserId, WinnerStatus.REROLLED);

      const winner = await repository.getWinner(testGiveawayId, testUserId);
      expect(winner?.status).toBe(WinnerStatus.CONFIRMED); // Should remain CONFIRMED
    });

    it('should not allow transition from REROLLED (terminal state)', async () => {
      await repository.updateStatus(testGiveawayId, testUserId, WinnerStatus.REROLLED);
      
      // Attempt to change from REROLLED to CONFIRMED should be silently ignored
      await repository.updateStatus(testGiveawayId, testUserId, WinnerStatus.CONFIRMED);

      const winner = await repository.getWinner(testGiveawayId, testUserId);
      expect(winner?.status).toBe(WinnerStatus.REROLLED); // Should remain REROLLED
    });

    it('should throw error for non-existent winner', async () => {
      await expect(
        repository.updateStatus(testGiveawayId, 'nonexistent', WinnerStatus.CONFIRMED)
      ).rejects.toThrow('Winner record not found');
    });
  });

  describe('getWinner', () => {
    it('should return null for non-existent winner', async () => {
      const winner = await repository.getWinner(testGiveawayId, 'nonexistent');
      expect(winner).toBeNull();
    });

    it('should return winner record with all fields', async () => {
      const now = new Date();
      await repository.createWinner({
        giveawayId: testGiveawayId,
        userId: testUserId,
        status: WinnerStatus.PENDING,
        selectedAt: now,
        timerStartTime: now,
        timerActive: true,
      });

      const winner = await repository.getWinner(testGiveawayId, testUserId);
      expect(winner).not.toBeNull();
      expect(winner?.id).toBeDefined();
      expect(winner?.giveawayId).toBe(testGiveawayId);
      expect(winner?.userId).toBe(testUserId);
      expect(winner?.status).toBe(WinnerStatus.PENDING);
      expect(winner?.createdAt).toBeDefined();
      expect(winner?.updatedAt).toBeDefined();
    });
  });

  describe('getWinners', () => {
    it('should return empty array for giveaway with no winners', async () => {
      const winners = await repository.getWinners(testGiveawayId);
      expect(winners).toEqual([]);
    });

    it('should return all winners for a giveaway', async () => {
      const now = new Date();
      
      await repository.createWinner({
        giveawayId: testGiveawayId,
        userId: testUserId,
        status: WinnerStatus.PENDING,
        selectedAt: now,
        timerStartTime: now,
        timerActive: true,
      });

      await repository.createWinner({
        giveawayId: testGiveawayId,
        userId: '987654321098765432',
        status: WinnerStatus.CONFIRMED,
        selectedAt: now,
        timerStartTime: now,
        timerActive: false,
      });

      const winners = await repository.getWinners(testGiveawayId);
      expect(winners).toHaveLength(2);
      expect(winners.map(w => w.userId)).toContain(testUserId);
      expect(winners.map(w => w.userId)).toContain('987654321098765432');
    });
  });

  describe('getAllPendingWinners', () => {
    it('should return only pending winners with active timers', async () => {
      const now = new Date();
      
      // Create PENDING winner with active timer
      await repository.createWinner({
        giveawayId: testGiveawayId,
        userId: testUserId,
        status: WinnerStatus.PENDING,
        selectedAt: now,
        timerStartTime: now,
        timerActive: true,
      });

      // Create CONFIRMED winner (should not be returned)
      await repository.createWinner({
        giveawayId: testGiveawayId,
        userId: '987654321098765432',
        status: WinnerStatus.CONFIRMED,
        selectedAt: now,
        timerStartTime: now,
        timerActive: false,
      });

      const pendingWinners = await repository.getAllPendingWinners();
      expect(pendingWinners.length).toBeGreaterThanOrEqual(1);
      
      const testWinner = pendingWinners.find(w => w.userId === testUserId);
      expect(testWinner).toBeDefined();
      expect(testWinner?.status).toBe(WinnerStatus.PENDING);
      expect(testWinner?.timerActive).toBe(true);
    });
  });

  describe('hasWinnerState', () => {
    it('should return false for user with no winner state', async () => {
      const hasState = await repository.hasWinnerState(testGiveawayId, testUserId);
      expect(hasState).toBe(false);
    });

    it('should return true for user with winner state', async () => {
      const now = new Date();
      await repository.createWinner({
        giveawayId: testGiveawayId,
        userId: testUserId,
        status: WinnerStatus.PENDING,
        selectedAt: now,
        timerStartTime: now,
        timerActive: true,
      });

      const hasState = await repository.hasWinnerState(testGiveawayId, testUserId);
      expect(hasState).toBe(true);
    });

    it('should return true for any winner status', async () => {
      const now = new Date();
      await repository.createWinner({
        giveawayId: testGiveawayId,
        userId: testUserId,
        status: WinnerStatus.PENDING,
        selectedAt: now,
        timerStartTime: now,
        timerActive: true,
      });

      await repository.updateStatus(testGiveawayId, testUserId, WinnerStatus.CONFIRMED);

      const hasState = await repository.hasWinnerState(testGiveawayId, testUserId);
      expect(hasState).toBe(true);
    });
  });

  describe('withTransaction', () => {
    it('should commit transaction on success', async () => {
      const now = new Date();
      
      await repository.withTransaction(async (client) => {
        await client.query(
          `INSERT INTO giveaway_winners (
            giveaway_id, user_id, status, selected_at, timer_start_time, timer_active
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [testGiveawayId, testUserId, WinnerStatus.PENDING, now, now, true]
        );
      });

      const winner = await repository.getWinner(testGiveawayId, testUserId);
      expect(winner).not.toBeNull();
    });

    it('should rollback transaction on error', async () => {
      const now = new Date();
      
      await expect(
        repository.withTransaction(async (client) => {
          await client.query(
            `INSERT INTO giveaway_winners (
              giveaway_id, user_id, status, selected_at, timer_start_time, timer_active
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [testGiveawayId, testUserId, WinnerStatus.PENDING, now, now, true]
          );
          
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      const winner = await repository.getWinner(testGiveawayId, testUserId);
      expect(winner).toBeNull();
    });
  });
});
