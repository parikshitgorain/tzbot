import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Pool } from 'pg';
import { OffenseManager } from '../../../src/moderation/offense-manager.js';
import { PunishmentType } from '../../../src/moderation/punishment-calculator.js';
import type { OffenseRecord } from '../../../src/core/database/repositories/OffenseRepository.js';
import type { Punishment } from '../../../src/moderation/punishment-calculator.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOffenseRecord(overrides: Partial<OffenseRecord> = {}): OffenseRecord {
  return {
    user_id: 'user1',
    total_offenses: 0,
    last_offense_timestamp: null,
    current_timeout_duration: 0,
    is_banned: false,
    warning_history: [],
    ...overrides,
  };
}

function makeWarningPunishment(): Punishment {
  return {
    type: PunishmentType.WARNING,
    duration: undefined,
    nextPunishment: 'Next offense: Final warning',
  };
}

// ---------------------------------------------------------------------------
// Mock builders
// ---------------------------------------------------------------------------

function buildMocks() {
  const mockClient = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  };

  const mockPool = {
    connect: vi.fn().mockResolvedValue(mockClient),
    query: vi.fn().mockResolvedValue({ rows: [] }),
  } as unknown as Pool;

  const mockOffenseRepository = {
    getOffenseRecord: vi.fn(),
    resetOffenses: vi.fn().mockResolvedValue(undefined),
    saveOffenseRecord: vi.fn().mockResolvedValue(undefined),
    addOffenseEntry: vi.fn().mockResolvedValue(undefined),
    removeLastOffense: vi.fn().mockResolvedValue(undefined),
  };

  const mockPunishmentCalculator = {
    calculatePunishment: vi.fn().mockReturnValue(makeWarningPunishment()),
    shouldResetOffenses: vi.fn().mockReturnValue(false),
    getNextPunishmentDescription: vi.fn().mockReturnValue('Next offense: Final warning'),
  };

  const mockNotificationService = {
    sendPunishmentNotification: vi.fn().mockResolvedValue({
      dmSent: true,
      ephemeralSent: false,
      modLogSent: false,
      failures: [],
    }),
  };

  return { mockClient, mockPool, mockOffenseRepository, mockPunishmentCalculator, mockNotificationService };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OffenseManager', () => {
  describe('processOffense()', () => {
    it('processes a first offense and returns the calculated punishment', async () => {
      const { mockPool, mockOffenseRepository, mockPunishmentCalculator, mockNotificationService } =
        buildMocks();

      mockOffenseRepository.getOffenseRecord.mockResolvedValue(null);

      const manager = new OffenseManager(
        mockPool,
        mockOffenseRepository as any,
        mockPunishmentCalculator as any,
        mockNotificationService,
      );

      const punishment = await manager.processOffense('user1', 'spamming', 'mod1', 'channel1');

      expect(punishment).toBeDefined();
      expect(punishment.type).toBe(PunishmentType.WARNING);
      expect(mockOffenseRepository.saveOffenseRecord).toHaveBeenCalledOnce();
      expect(mockOffenseRepository.addOffenseEntry).toHaveBeenCalledOnce();
    });

    it('increments offense count on subsequent offense', async () => {
      const { mockPool, mockOffenseRepository, mockPunishmentCalculator, mockNotificationService } =
        buildMocks();

      const existingRecord = makeOffenseRecord({ total_offenses: 1, last_offense_timestamp: new Date() });
      mockOffenseRepository.getOffenseRecord.mockResolvedValue(existingRecord);
      mockPunishmentCalculator.shouldResetOffenses.mockReturnValue(false);

      const manager = new OffenseManager(
        mockPool,
        mockOffenseRepository as any,
        mockPunishmentCalculator as any,
        mockNotificationService,
      );

      await manager.processOffense('user1', 'spamming again', 'mod1', 'channel1');

      // calculatePunishment should be called with offense count = 2
      expect(mockPunishmentCalculator.calculatePunishment).toHaveBeenCalledWith(2, expect.any(Number));
    });

    it('resets offense record when shouldResetOffenses returns true', async () => {
      const { mockPool, mockOffenseRepository, mockPunishmentCalculator, mockNotificationService } =
        buildMocks();

      const oldRecord = makeOffenseRecord({
        total_offenses: 3,
        last_offense_timestamp: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      });

      mockOffenseRepository.getOffenseRecord
        .mockResolvedValueOnce(oldRecord) // first call returns old record
        .mockResolvedValue(null);          // after reset, returns null

      mockPunishmentCalculator.shouldResetOffenses.mockReturnValue(true);

      const manager = new OffenseManager(
        mockPool,
        mockOffenseRepository as any,
        mockPunishmentCalculator as any,
        mockNotificationService,
      );

      await manager.processOffense('user1', 'new offense', 'mod1', 'channel1');

      expect(mockOffenseRepository.resetOffenses).toHaveBeenCalledWith('user1');
      // After reset, offense count should restart at 1
      expect(mockPunishmentCalculator.calculatePunishment).toHaveBeenCalledWith(1, 0);
    });

    it('sends a punishment notification', async () => {
      const { mockPool, mockOffenseRepository, mockPunishmentCalculator, mockNotificationService } =
        buildMocks();

      mockOffenseRepository.getOffenseRecord.mockResolvedValue(null);

      const manager = new OffenseManager(
        mockPool,
        mockOffenseRepository as any,
        mockPunishmentCalculator as any,
        mockNotificationService,
      );

      await manager.processOffense('user1', 'reason', 'mod1', 'channel1');

      expect(mockNotificationService.sendPunishmentNotification).toHaveBeenCalledWith(
        'user1',
        'channel1',
        expect.objectContaining({ type: PunishmentType.WARNING }),
        'reason',
        1,
      );
    });
  });

  describe('getOffenseHistory()', () => {
    it('returns the offense record for a user', async () => {
      const { mockPool, mockOffenseRepository, mockPunishmentCalculator, mockNotificationService } =
        buildMocks();

      const record = makeOffenseRecord({ user_id: 'user1', total_offenses: 2 });
      mockOffenseRepository.getOffenseRecord.mockResolvedValue(record);

      const manager = new OffenseManager(
        mockPool,
        mockOffenseRepository as any,
        mockPunishmentCalculator as any,
        mockNotificationService,
      );

      const result = await manager.getOffenseHistory('user1');

      expect(result).toEqual(record);
      expect(mockOffenseRepository.getOffenseRecord).toHaveBeenCalledWith('user1');
    });

    it('returns null when user has no offense history', async () => {
      const { mockPool, mockOffenseRepository, mockPunishmentCalculator, mockNotificationService } =
        buildMocks();

      mockOffenseRepository.getOffenseRecord.mockResolvedValue(null);

      const manager = new OffenseManager(
        mockPool,
        mockOffenseRepository as any,
        mockPunishmentCalculator as any,
        mockNotificationService,
      );

      const result = await manager.getOffenseHistory('newuser');
      expect(result).toBeNull();
    });
  });

  describe('clearLastOffense()', () => {
    it('calls removeLastOffense and recalculates punishment', async () => {
      const { mockPool, mockOffenseRepository, mockPunishmentCalculator, mockNotificationService } =
        buildMocks();

      const record = makeOffenseRecord({ total_offenses: 2 });
      mockOffenseRepository.getOffenseRecord.mockResolvedValue(record);

      const manager = new OffenseManager(
        mockPool,
        mockOffenseRepository as any,
        mockPunishmentCalculator as any,
        mockNotificationService,
      );

      await manager.clearLastOffense('user1');

      expect(mockOffenseRepository.removeLastOffense).toHaveBeenCalledWith('user1');
      expect(mockPunishmentCalculator.calculatePunishment).toHaveBeenCalledWith(2, 0);
      expect(mockOffenseRepository.saveOffenseRecord).toHaveBeenCalled();
    });

    it('does not recalculate if record has zero offenses after removal', async () => {
      const { mockPool, mockOffenseRepository, mockPunishmentCalculator, mockNotificationService } =
        buildMocks();

      const record = makeOffenseRecord({ total_offenses: 0 });
      mockOffenseRepository.getOffenseRecord.mockResolvedValue(record);

      const manager = new OffenseManager(
        mockPool,
        mockOffenseRepository as any,
        mockPunishmentCalculator as any,
        mockNotificationService,
      );

      await manager.clearLastOffense('user1');

      expect(mockOffenseRepository.removeLastOffense).toHaveBeenCalledWith('user1');
      expect(mockPunishmentCalculator.calculatePunishment).not.toHaveBeenCalled();
    });
  });

  describe('resetAllOffenses()', () => {
    it('calls resetOffenses on the repository', async () => {
      const { mockPool, mockOffenseRepository, mockPunishmentCalculator, mockNotificationService } =
        buildMocks();

      const manager = new OffenseManager(
        mockPool,
        mockOffenseRepository as any,
        mockPunishmentCalculator as any,
        mockNotificationService,
      );

      await manager.resetAllOffenses('user1');

      expect(mockOffenseRepository.resetOffenses).toHaveBeenCalledWith('user1');
    });
  });
});
