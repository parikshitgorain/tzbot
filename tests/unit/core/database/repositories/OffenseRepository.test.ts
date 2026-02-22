import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OffenseRepository } from '../../../../../src/core/database/repositories/OffenseRepository.js';
import type { Pool, QueryResult, PoolClient } from 'pg';
import type { OffenseRecord, OffenseEntry } from '../../../../../src/core/database/repositories/OffenseRepository.js';

describe('OffenseRepository', () => {
  let mockPool: Pool;
  let mockClient: PoolClient;
  let offenseRepo: OffenseRepository;

  beforeEach(() => {
    // Create mock client
    mockClient = {
      query: vi.fn() as any,
      release: vi.fn(),
    } as unknown as PoolClient;

    // Create mock pool
    mockPool = {
      query: vi.fn() as any,
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as Pool;

    offenseRepo = new OffenseRepository(mockPool);
  });

  describe('getOffenseRecord', () => {
    it('should return null for non-existent user', async () => {
      (mockClient.query as any).mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      } as QueryResult);

      const result = await offenseRepo.getOffenseRecord('nonexistent-user');
      expect(result).toBeNull();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return offense record with warning history', async () => {
      const userId = 'user123';
      const now = new Date();

      (mockClient.query as any)
        .mockResolvedValueOnce({
          rows: [{
            user_id: userId,
            total_offenses: 2,
            last_offense_timestamp: now,
            current_timeout_duration: 0,
            is_banned: false,
          }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        } as QueryResult)
        .mockResolvedValueOnce({
          rows: [{
            timestamp: now,
            reason: 'Spam detected',
            punishment_applied: 'WARNING',
            moderator_id: 'mod123',
          }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        } as QueryResult);

      const retrieved = await offenseRepo.getOffenseRecord(userId);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.user_id).toBe(userId);
      expect(retrieved?.total_offenses).toBe(2);
      expect(retrieved?.warning_history).toHaveLength(1);
      expect(retrieved?.warning_history[0].reason).toBe('Spam detected');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('saveOffenseRecord', () => {
    it('should create new record', async () => {
      const userId = 'user123';
      const record: OffenseRecord = {
        user_id: userId,
        total_offenses: 1,
        last_offense_timestamp: new Date(),
        current_timeout_duration: 0,
        is_banned: false,
        warning_history: [],
      };

      (mockPool.query as any).mockResolvedValueOnce({
        command: 'INSERT',
        rowCount: 1,
        oid: 0,
        rows: [],
        fields: [],
      } as QueryResult);

      await offenseRepo.saveOffenseRecord(record);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO offense_records'),
        expect.arrayContaining([userId, 1, 0, false])
      );
    });

    it('should update existing record (upsert)', async () => {
      const userId = 'user123';
      const record1: OffenseRecord = {
        user_id: userId,
        total_offenses: 1,
        last_offense_timestamp: new Date(),
        current_timeout_duration: 0,
        is_banned: false,
        warning_history: [],
      };

      const record2: OffenseRecord = {
        user_id: userId,
        total_offenses: 2,
        last_offense_timestamp: new Date(),
        current_timeout_duration: 1,
        is_banned: false,
        warning_history: [],
      };

      (mockPool.query as any).mockResolvedValue({
        command: 'INSERT',
        rowCount: 1,
        oid: 0,
        rows: [],
        fields: [],
      } as QueryResult);

      await offenseRepo.saveOffenseRecord(record1);
      await offenseRepo.saveOffenseRecord(record2);

      expect(mockPool.query).toHaveBeenCalledTimes(2);
      expect(mockPool.query).toHaveBeenLastCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.arrayContaining([userId, 2, 1, false])
      );
    });
  });

  describe('addOffenseEntry', () => {
    it('should add offense entry to warning_history', async () => {
      const userId = 'user123';
      const entry: OffenseEntry = {
        timestamp: new Date(),
        reason: 'Spam detected',
        punishment_applied: 'WARNING',
        moderator_id: 'mod123',
      };

      (mockPool.query as any).mockResolvedValueOnce({
        command: 'INSERT',
        rowCount: 1,
        oid: 0,
        rows: [],
        fields: [],
      } as QueryResult);

      await offenseRepo.addOffenseEntry(userId, entry);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO offense_entries'),
        expect.arrayContaining([userId, 'Spam detected', 'WARNING', 'mod123'])
      );
    });

    it('should add multiple offense entries', async () => {
      const userId = 'user123';
      const entry1: OffenseEntry = {
        timestamp: new Date(),
        reason: 'First spam',
        punishment_applied: 'WARNING',
        moderator_id: 'mod123',
      };

      const entry2: OffenseEntry = {
        timestamp: new Date(),
        reason: 'Second spam',
        punishment_applied: 'WARNING',
        moderator_id: 'mod456',
      };

      (mockPool.query as any).mockResolvedValue({
        command: 'INSERT',
        rowCount: 1,
        oid: 0,
        rows: [],
        fields: [],
      } as QueryResult);

      await offenseRepo.addOffenseEntry(userId, entry1);
      await offenseRepo.addOffenseEntry(userId, entry2);

      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('removeLastOffense', () => {
    it('should delete most recent entry and decrement total_offenses', async () => {
      const userId = 'user123';

      (mockClient.query as any)
        .mockResolvedValueOnce({
          command: 'DELETE',
          rowCount: 1,
          oid: 0,
          rows: [],
          fields: [],
        } as QueryResult)
        .mockResolvedValueOnce({
          command: 'UPDATE',
          rowCount: 1,
          oid: 0,
          rows: [],
          fields: [],
        } as QueryResult);

      await offenseRepo.removeLastOffense(userId);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM offense_entries'),
        [userId]
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE offense_records'),
        [userId]
      );
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('resetOffenses', () => {
    it('should cascade delete all entries', async () => {
      const userId = 'user123';

      (mockPool.query as any).mockResolvedValueOnce({
        command: 'DELETE',
        rowCount: 1,
        oid: 0,
        rows: [],
        fields: [],
      } as QueryResult);

      await offenseRepo.resetOffenses(userId);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM offense_records'),
        [userId]
      );
    });

    it('should handle resetting non-existent user', async () => {
      (mockPool.query as any).mockResolvedValueOnce({
        command: 'DELETE',
        rowCount: 0,
        oid: 0,
        rows: [],
        fields: [],
      } as QueryResult);

      await expect(offenseRepo.resetOffenses('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('withTransaction', () => {
    it('should rollback on error', async () => {
      const transactionClient = {
        query: vi.fn() as any,
        release: vi.fn(),
      } as unknown as PoolClient;

      (mockPool.connect as any).mockResolvedValueOnce(transactionClient);
      (transactionClient.query as any)
        .mockResolvedValueOnce({ command: 'BEGIN', rowCount: 0, oid: 0, rows: [], fields: [] } as QueryResult)
        .mockRejectedValueOnce(new Error('Test error'))
        .mockResolvedValueOnce({ command: 'ROLLBACK', rowCount: 0, oid: 0, rows: [], fields: [] } as QueryResult);

      try {
        await offenseRepo.withTransaction(async (client) => {
          await client.query('INSERT INTO offense_records VALUES ($1)', ['user123']);
          throw new Error('Test error');
        });
      } catch (error) {
        // Expected error
      }

      expect(transactionClient.query).toHaveBeenCalledWith('BEGIN');
      expect(transactionClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(transactionClient.release).toHaveBeenCalled();
    });

    it('should commit on success', async () => {
      const transactionClient = {
        query: vi.fn() as any,
        release: vi.fn(),
      } as unknown as PoolClient;

      (mockPool.connect as any).mockResolvedValueOnce(transactionClient);
      (transactionClient.query as any).mockResolvedValue({
        command: 'COMMIT',
        rowCount: 0,
        oid: 0,
        rows: [],
        fields: [],
      } as QueryResult);

      await offenseRepo.withTransaction(async (client) => {
        await client.query('INSERT INTO offense_records VALUES ($1)', ['user123']);
      });

      expect(transactionClient.query).toHaveBeenCalledWith('BEGIN');
      expect(transactionClient.query).toHaveBeenCalledWith('COMMIT');
      expect(transactionClient.release).toHaveBeenCalled();
    });
  });

  describe('getAllActiveOffenses', () => {
    it('should return all users with offenses', async () => {
      const now = new Date();

      (mockClient.query as any)
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 'user1',
              total_offenses: 2,
              last_offense_timestamp: now,
              current_timeout_duration: 0,
              is_banned: false,
            },
            {
              user_id: 'user2',
              total_offenses: 3,
              last_offense_timestamp: now,
              current_timeout_duration: 1,
              is_banned: false,
            },
          ],
          command: 'SELECT',
          rowCount: 2,
          oid: 0,
          fields: [],
        } as QueryResult)
        .mockResolvedValueOnce({
          rows: [{
            timestamp: now,
            reason: 'Spam',
            punishment_applied: 'WARNING',
            moderator_id: 'mod123',
          }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        } as QueryResult)
        .mockResolvedValueOnce({
          rows: [{
            timestamp: now,
            reason: 'Spam',
            punishment_applied: 'WARNING',
            moderator_id: 'mod123',
          }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        } as QueryResult);

      const allOffenses = await offenseRepo.getAllActiveOffenses();
      
      expect(allOffenses).toHaveLength(2);
      expect(allOffenses.some(o => o.user_id === 'user1')).toBe(true);
      expect(allOffenses.some(o => o.user_id === 'user2')).toBe(true);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return empty array when no offenses exist', async () => {
      (mockClient.query as any).mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      } as QueryResult);

      const allOffenses = await offenseRepo.getAllActiveOffenses();
      expect(allOffenses).toHaveLength(0);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
