import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WinnerStateRepository } from '../../../../../src/core/database/repositories/WinnerStateRepository.js';
import { WinnerStatus } from '../../../../../src/types/models.js';
import type { Pool, QueryResult, PoolClient } from 'pg';

describe('WinnerStateRepository', () => {
  let mockPool: Pool;
  let mockClient: PoolClient;
  let repository: WinnerStateRepository;
  const testGiveawayId = '550e8400-e29b-41d4-a716-446655440000';
  const testUserId = '123456789012345678';

  beforeEach(() => {
    // Create mock client with properly typed query function
    mockClient = {
      query: vi.fn() as any,
      release: vi.fn(),
    } as unknown as PoolClient;

    // Create mock pool with properly typed query function
    mockPool = {
      query: vi.fn() as any,
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as Pool;

    repository = new WinnerStateRepository(mockPool);
  });

  describe('createWinner', () => {
    it('should create a new winner record with PENDING status', async () => {
      const now = new Date();

      (mockPool.query as any).mockResolvedValueOnce({
        rows: [],
        command: 'INSERT',
        rowCount: 1,
        oid: 0,
        fields: [],
      } as QueryResult);

      await repository.createWinner({
        giveawayId: testGiveawayId,
        userId: testUserId,
        status: WinnerStatus.PENDING,
        selectedAt: now,
        timerStartTime: now,
        timerActive: true,
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO giveaway_winners'),
        expect.arrayContaining([testGiveawayId, testUserId, WinnerStatus.PENDING, now, now, true])
      );
    });

    it('should throw error on duplicate winner', async () => {
      (mockPool.query as any).mockRejectedValueOnce(new Error('duplicate key value'));

      const now = new Date();
      const record = {
        giveawayId: testGiveawayId,
        userId: testUserId,
        status: WinnerStatus.PENDING,
        selectedAt: now,
        timerStartTime: now,
        timerActive: true,
      };

      await expect(repository.createWinner(record)).rejects.toThrow();
    });
  });

  describe('updateStatus', () => {
    it('should transition PENDING to CONFIRMED', async () => {
      // Mock BEGIN, SELECT (get current status), UPDATE, COMMIT
      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [], command: 'BEGIN', rowCount: 0, oid: 0, fields: [] } as QueryResult) // BEGIN
        .mockResolvedValueOnce({ rows: [{ status: WinnerStatus.PENDING }], command: 'SELECT', rowCount: 1, oid: 0, fields: [] } as QueryResult) // SELECT current status
        .mockResolvedValueOnce({ rows: [], command: 'UPDATE', rowCount: 1, oid: 0, fields: [] } as QueryResult) // UPDATE
        .mockResolvedValueOnce({ rows: [], command: 'COMMIT', rowCount: 0, oid: 0, fields: [] } as QueryResult); // COMMIT

      await repository.updateStatus(testGiveawayId, testUserId, WinnerStatus.CONFIRMED);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT status FROM giveaway_winners'),
        expect.arrayContaining([testGiveawayId, testUserId])
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE giveaway_winners'),
        expect.arrayContaining([WinnerStatus.CONFIRMED, testGiveawayId, testUserId])
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should transition PENDING to REROLLED', async () => {
      // Mock BEGIN, SELECT (get current status), UPDATE, COMMIT
      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [], command: 'BEGIN', rowCount: 0, oid: 0, fields: [] } as QueryResult) // BEGIN
        .mockResolvedValueOnce({ rows: [{ status: WinnerStatus.PENDING }], command: 'SELECT', rowCount: 1, oid: 0, fields: [] } as QueryResult) // SELECT current status
        .mockResolvedValueOnce({ rows: [], command: 'UPDATE', rowCount: 1, oid: 0, fields: [] } as QueryResult) // UPDATE
        .mockResolvedValueOnce({ rows: [], command: 'COMMIT', rowCount: 0, oid: 0, fields: [] } as QueryResult); // COMMIT

      await repository.updateStatus(testGiveawayId, testUserId, WinnerStatus.REROLLED);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT status FROM giveaway_winners'),
        expect.arrayContaining([testGiveawayId, testUserId])
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE giveaway_winners'),
        expect.arrayContaining([WinnerStatus.REROLLED, testGiveawayId, testUserId])
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error for non-existent winner', async () => {
      // Mock BEGIN, UPDATE (with 0 rows), ROLLBACK
      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [], command: 'BEGIN', rowCount: 0, oid: 0, fields: [] } as QueryResult)
        .mockRejectedValueOnce(new Error('Winner record not found'))
        .mockResolvedValueOnce({ rows: [], command: 'ROLLBACK', rowCount: 0, oid: 0, fields: [] } as QueryResult);

      await expect(
        repository.updateStatus(testGiveawayId, 'nonexistent', WinnerStatus.CONFIRMED)
      ).rejects.toThrow();
      
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getWinner', () => {
    it('should return null for non-existent winner', async () => {
      (mockPool.query as any).mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      } as QueryResult);

      const winner = await repository.getWinner(testGiveawayId, 'nonexistent');
      expect(winner).toBeNull();
    });

    it('should return winner record with all fields', async () => {
      const now = new Date();

      (mockPool.query as any).mockResolvedValueOnce({
        rows: [{
          id: 1,
          giveaway_id: testGiveawayId,
          user_id: testUserId,
          status: WinnerStatus.PENDING,
          selected_at: now,
          timer_start_time: now,
          timer_active: true,
          confirmed_at: null,
          rerolled_at: null,
          created_at: now,
          updated_at: now,
        }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      } as QueryResult);

      const winner = await repository.getWinner(testGiveawayId, testUserId);
      expect(winner).not.toBeNull();
      expect(winner?.id).toBe(1);
      expect(winner?.giveawayId).toBe(testGiveawayId);
      expect(winner?.userId).toBe(testUserId);
      expect(winner?.status).toBe(WinnerStatus.PENDING);
      expect(winner?.createdAt).toBeDefined();
      expect(winner?.updatedAt).toBeDefined();
    });
  });

  describe('getWinners', () => {
    it('should return empty array for giveaway with no winners', async () => {
      (mockPool.query as any).mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      } as QueryResult);

      const winners = await repository.getWinners(testGiveawayId);
      expect(winners).toEqual([]);
    });

    it('should return all winners for a giveaway', async () => {
      const now = new Date();

      (mockPool.query as any).mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            giveaway_id: testGiveawayId,
            user_id: testUserId,
            status: WinnerStatus.PENDING,
            selected_at: now,
            timer_start_time: now,
            timer_active: true,
            confirmed_at: null,
            rerolled_at: null,
            created_at: now,
            updated_at: now,
          },
          {
            id: 2,
            giveaway_id: testGiveawayId,
            user_id: '987654321098765432',
            status: WinnerStatus.CONFIRMED,
            selected_at: now,
            timer_start_time: now,
            timer_active: false,
            confirmed_at: now,
            rerolled_at: null,
            created_at: now,
            updated_at: now,
          },
        ],
        command: 'SELECT',
        rowCount: 2,
        oid: 0,
        fields: [],
      } as QueryResult);

      const winners = await repository.getWinners(testGiveawayId);
      expect(winners).toHaveLength(2);
      expect(winners.map(w => w.userId)).toContain(testUserId);
      expect(winners.map(w => w.userId)).toContain('987654321098765432');
    });
  });

  describe('getAllPendingWinners', () => {
    it('should return only pending winners with active timers', async () => {
      const now = new Date();

      (mockPool.query as any).mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            giveaway_id: testGiveawayId,
            user_id: testUserId,
            status: WinnerStatus.PENDING,
            selected_at: now,
            timer_start_time: now,
            timer_active: true,
            confirmed_at: null,
            rerolled_at: null,
            created_at: now,
            updated_at: now,
          },
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      } as QueryResult);

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
      (mockPool.query as any).mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      } as QueryResult);

      const hasState = await repository.hasWinnerState(testGiveawayId, testUserId);
      expect(hasState).toBe(false);
    });

    it('should return true for user with winner state', async () => {
      (mockPool.query as any).mockResolvedValueOnce({
        rows: [{ exists: 1 }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      } as QueryResult);

      const hasState = await repository.hasWinnerState(testGiveawayId, testUserId);
      expect(hasState).toBe(true);
    });

    it('should return true for any winner status', async () => {
      (mockPool.query as any).mockResolvedValueOnce({
        rows: [{ exists: 1 }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      } as QueryResult);

      const hasState = await repository.hasWinnerState(testGiveawayId, testUserId);
      expect(hasState).toBe(true);
    });
  });

  describe('withTransaction', () => {
    it('should commit transaction on success', async () => {
      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [], command: 'BEGIN', rowCount: 0, oid: 0, fields: [] } as QueryResult)
        .mockResolvedValueOnce({ rows: [], command: 'INSERT', rowCount: 1, oid: 0, fields: [] } as QueryResult)
        .mockResolvedValueOnce({ rows: [], command: 'COMMIT', rowCount: 0, oid: 0, fields: [] } as QueryResult);

      await repository.withTransaction(async (client) => {
        await client.query(
          'INSERT INTO giveaway_winners VALUES ($1, $2)',
          [testGiveawayId, testUserId]
        );
      });

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [], command: 'BEGIN', rowCount: 0, oid: 0, fields: [] } as QueryResult)
        .mockRejectedValueOnce(new Error('Test error'))
        .mockResolvedValueOnce({ rows: [], command: 'ROLLBACK', rowCount: 0, oid: 0, fields: [] } as QueryResult);

      await expect(
        repository.withTransaction(async (client) => {
          await client.query('INSERT INTO giveaway_winners VALUES ($1)', [testGiveawayId]);
        })
      ).rejects.toThrow('Test error');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
