/**
 * @file offense-manager.test.ts
 * @description Unit tests for OffenseManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OffenseManager } from '@/moderation/offense-manager.js';
import type { OffenseRepository, OffenseRecord } from '@/core/database/repositories/OffenseRepository.js';
import type { PunishmentCalculator, Punishment } from '@/moderation/punishment-calculator.js';
import { PunishmentType } from '@/moderation/punishment-calculator.js';
import type { NotificationService } from '@/moderation/offense-manager.js';
import type { Pool, PoolClient } from 'pg';

describe('OffenseManager', () => {
  let offenseManager: OffenseManager;
  let mockPool: Pool;
  let mockClient: PoolClient;
  let mockOffenseRepository: OffenseRepository;
  let mockPunishmentCalculator: PunishmentCalculator;
  let mockNotificationService: NotificationService;

  beforeEach(() => {
    // Mock PoolClient
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    } as unknown as PoolClient;

    // Mock Pool
    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as Pool;

    // Mock OffenseRepository
    mockOffenseRepository = {
      getOffenseRecord: vi.fn(),
      saveOffenseRecord: vi.fn(),
      addOffenseEntry: vi.fn(),
      removeLastOffense: vi.fn(),
      resetOffenses: vi.fn(),
    } as unknown as OffenseRepository;

    // Mock PunishmentCalculator
    mockPunishmentCalculator = {
      calculatePunishment: vi.fn(),
      shouldResetOffenses: vi.fn(),
    } as unknown as PunishmentCalculator;

    // Mock NotificationService
    mockNotificationService = {
      sendPunishmentNotification: vi.fn().mockResolvedValue({
        dmSent: true,
        ephemeralSent: true,
        modLogSent: true,
        failures: [],
      }),
    } as unknown as NotificationService;

    offenseManager = new OffenseManager(
      mockPool,
      mockOffenseRepository,
      mockPunishmentCalculator,
      mockNotificationService
    );
  });

  describe('processOffense', () => {
    it('should create new record for first offense', async () => {
      // Arrange
      const userId = 'user123';
      const reason = 'Spam';
      const moderatorId = 'mod456';
      const channelId = 'channel789';

      vi.mocked(mockOffenseRepository.getOffenseRecord).mockResolvedValue(null);
      
      const expectedPunishment: Punishment = {
        type: PunishmentType.WARNING,
        duration: undefined,
        nextPunishment: 'Next offense: Final warning',
      };
      
      vi.mocked(mockPunishmentCalculator.calculatePunishment).mockReturnValue(expectedPunishment);

      // Act
      const result = await offenseManager.processOffense(userId, reason, moderatorId, channelId);

      // Assert
      expect(result).toEqual(expectedPunishment);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockOffenseRepository.saveOffenseRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          total_offenses: 1,
          current_timeout_duration: 0,
          is_banned: false,
        })
      );
      expect(mockOffenseRepository.addOffenseEntry).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          reason,
          punishment_applied: PunishmentType.WARNING,
          moderator_id: moderatorId,
        })
      );
    });

    it('should update existing record', async () => {
      // Arrange
      const userId = 'user123';
      const reason = 'Spam again';
      const moderatorId = 'mod456';
      const channelId = 'channel789';

      const existingRecord: OffenseRecord = {
        user_id: userId,
        total_offenses: 2,
        last_offense_timestamp: new Date('2024-01-01'),
        current_timeout_duration: 0,
        is_banned: false,
        warning_history: [],
      };

      vi.mocked(mockOffenseRepository.getOffenseRecord).mockResolvedValue(existingRecord);
      vi.mocked(mockPunishmentCalculator.shouldResetOffenses).mockReturnValue(false);
      
      const expectedPunishment: Punishment = {
        type: PunishmentType.TIMEOUT,
        duration: 1,
        nextPunishment: 'Next offense: 2 hour timeout',
      };
      
      vi.mocked(mockPunishmentCalculator.calculatePunishment).mockReturnValue(expectedPunishment);

      // Act
      const result = await offenseManager.processOffense(userId, reason, moderatorId, channelId);

      // Assert
      expect(result).toEqual(expectedPunishment);
      expect(mockOffenseRepository.saveOffenseRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          total_offenses: 3,
          current_timeout_duration: 1,
          is_banned: false,
        })
      );
    });

    it('should trigger 30-day reset when applicable', async () => {
      // Arrange
      const userId = 'user123';
      const reason = 'Spam';
      const moderatorId = 'mod456';
      const channelId = 'channel789';

      const oldRecord: OffenseRecord = {
        user_id: userId,
        total_offenses: 5,
        last_offense_timestamp: new Date('2023-01-01'),
        current_timeout_duration: 4,
        is_banned: false,
        warning_history: [],
      };

      vi.mocked(mockOffenseRepository.getOffenseRecord)
        .mockResolvedValueOnce(oldRecord)
        .mockResolvedValueOnce(null); // After reset
      
      vi.mocked(mockPunishmentCalculator.shouldResetOffenses).mockReturnValue(true);
      
      const expectedPunishment: Punishment = {
        type: PunishmentType.WARNING,
        duration: undefined,
        nextPunishment: 'Next offense: Final warning',
      };
      
      vi.mocked(mockPunishmentCalculator.calculatePunishment).mockReturnValue(expectedPunishment);

      // Act
      const result = await offenseManager.processOffense(userId, reason, moderatorId, channelId);

      // Assert
      expect(mockOffenseRepository.resetOffenses).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedPunishment);
      expect(mockOffenseRepository.saveOffenseRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          total_offenses: 1, // Reset to 1
          current_timeout_duration: 0,
        })
      );
    });

    it('should return correct punishment', async () => {
      // Arrange
      const userId = 'user123';
      const reason = 'Spam';
      const moderatorId = 'mod456';
      const channelId = 'channel789';

      vi.mocked(mockOffenseRepository.getOffenseRecord).mockResolvedValue(null);
      
      const expectedPunishment: Punishment = {
        type: PunishmentType.TIMEOUT,
        duration: 2,
        nextPunishment: 'Next offense: 4 hour timeout',
      };
      
      vi.mocked(mockPunishmentCalculator.calculatePunishment).mockReturnValue(expectedPunishment);

      // Act
      const result = await offenseManager.processOffense(userId, reason, moderatorId, channelId);

      // Assert
      expect(result).toEqual(expectedPunishment);
      expect(result.type).toBe(PunishmentType.TIMEOUT);
      expect(result.duration).toBe(2);
    });

    it('should handle permanent ban', async () => {
      // Arrange
      const userId = 'user123';
      const reason = 'Repeated spam';
      const moderatorId = 'mod456';
      const channelId = 'channel789';

      const existingRecord: OffenseRecord = {
        user_id: userId,
        total_offenses: 7,
        last_offense_timestamp: new Date(),
        current_timeout_duration: 16,
        is_banned: false,
        warning_history: [],
      };

      vi.mocked(mockOffenseRepository.getOffenseRecord).mockResolvedValue(existingRecord);
      vi.mocked(mockPunishmentCalculator.shouldResetOffenses).mockReturnValue(false);
      
      const expectedPunishment: Punishment = {
        type: PunishmentType.PERMANENT_BAN,
        duration: undefined,
        nextPunishment: 'Permanent ban - no further escalation',
      };
      
      vi.mocked(mockPunishmentCalculator.calculatePunishment).mockReturnValue(expectedPunishment);

      // Act
      const result = await offenseManager.processOffense(userId, reason, moderatorId, channelId);

      // Assert
      expect(result.type).toBe(PunishmentType.PERMANENT_BAN);
      expect(mockOffenseRepository.saveOffenseRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          is_banned: true,
          current_timeout_duration: 0,
        })
      );
    });

    it('should rollback transaction on database error', async () => {
      // Arrange
      const userId = 'user123';
      const reason = 'Spam';
      const moderatorId = 'mod456';
      const channelId = 'channel789';

      vi.mocked(mockOffenseRepository.getOffenseRecord).mockRejectedValue(
        new Error('Database error')
      );

      // Act & Assert
      await expect(
        offenseManager.processOffense(userId, reason, moderatorId, channelId)
      ).rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getOffenseHistory', () => {
    it('should return offense record', async () => {
      // Arrange
      const userId = 'user123';
      const expectedRecord: OffenseRecord = {
        user_id: userId,
        total_offenses: 3,
        last_offense_timestamp: new Date(),
        current_timeout_duration: 1,
        is_banned: false,
        warning_history: [],
      };

      vi.mocked(mockOffenseRepository.getOffenseRecord).mockResolvedValue(expectedRecord);

      // Act
      const result = await offenseManager.getOffenseHistory(userId);

      // Assert
      expect(result).toEqual(expectedRecord);
      expect(mockOffenseRepository.getOffenseRecord).toHaveBeenCalledWith(userId);
    });

    it('should return null for non-existent user', async () => {
      // Arrange
      const userId = 'user123';
      vi.mocked(mockOffenseRepository.getOffenseRecord).mockResolvedValue(null);

      // Act
      const result = await offenseManager.getOffenseHistory(userId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('clearLastOffense', () => {
    it('should recalculate timeout duration', async () => {
      // Arrange
      const userId = 'user123';

      const updatedRecord: OffenseRecord = {
        user_id: userId,
        total_offenses: 2,
        last_offense_timestamp: new Date(),
        current_timeout_duration: 1,
        is_banned: false,
        warning_history: [],
      };

      vi.mocked(mockOffenseRepository.getOffenseRecord).mockResolvedValue(updatedRecord);
      
      const recalculatedPunishment: Punishment = {
        type: PunishmentType.WARNING,
        duration: undefined,
        nextPunishment: 'Next offense: 1 hour timeout',
      };
      
      vi.mocked(mockPunishmentCalculator.calculatePunishment).mockReturnValue(recalculatedPunishment);

      // Act
      await offenseManager.clearLastOffense(userId);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockOffenseRepository.removeLastOffense).toHaveBeenCalledWith(userId);
      expect(mockOffenseRepository.saveOffenseRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          current_timeout_duration: 0,
          is_banned: false,
        })
      );
    });

    it('should handle user with no remaining offenses', async () => {
      // Arrange
      const userId = 'user123';

      vi.mocked(mockOffenseRepository.getOffenseRecord).mockResolvedValue(null);

      // Act
      await offenseManager.clearLastOffense(userId);

      // Assert
      expect(mockOffenseRepository.removeLastOffense).toHaveBeenCalledWith(userId);
      expect(mockOffenseRepository.saveOffenseRecord).not.toHaveBeenCalled();
    });
  });

  describe('resetAllOffenses', () => {
    it('should clear all data', async () => {
      // Arrange
      const userId = 'user123';

      // Act
      await offenseManager.resetAllOffenses(userId);

      // Assert
      expect(mockOffenseRepository.resetOffenses).toHaveBeenCalledWith(userId);
    });

    it('should handle errors', async () => {
      // Arrange
      const userId = 'user123';
      vi.mocked(mockOffenseRepository.resetOffenses).mockRejectedValue(
        new Error('Database error')
      );

      // Act & Assert
      await expect(offenseManager.resetAllOffenses(userId)).rejects.toThrow('Database error');
    });
  });
});
