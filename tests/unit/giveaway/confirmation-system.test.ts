import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfirmationSystem } from '../../../src/giveaway/confirmation-system';
import { WinnerStatus, GiveawayStatus } from '../../../src/types/models';

// Mock dependencies
vi.mock('../../../src/core/logger/logger');
vi.mock('../../../src/giveaway/timer-manager');
vi.mock('../../../src/giveaway/reroll-handler');
vi.mock('../../../src/giveaway/message-listener');

describe('ConfirmationSystem', () => {
  let confirmationSystem: ConfirmationSystem;
  let mockWinnerStateRepo: any;
  let mockGiveawayRepo: any;
  let mockConfigManager: any;
  let mockClient: any;
  let mockChannel: any;

  beforeEach(() => {
    mockWinnerStateRepo = {
      createWinner: vi.fn().mockResolvedValue(undefined),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      getWinner: vi.fn(),
      getWinners: vi.fn(),
      getAllPendingWinners: vi.fn().mockResolvedValue([]),
      hasWinnerState: vi.fn(),
      getPendingWinnersByUser: vi.fn(),
    };

    mockGiveawayRepo = {
      get: vi.fn(),
      save: vi.fn(),
      updateStatus: vi.fn(),
      getEntries: vi.fn(),
    };

    mockConfigManager = {
      canUseGiveawayCommands: vi.fn().mockResolvedValue(true),
      getGiveawayPermissions: vi.fn(),
      updateGiveawayPermissions: vi.fn(),
    };

    mockChannel = {
      send: vi.fn().mockResolvedValue({}),
      isTextBased: vi.fn().mockReturnValue(true),
    };

    mockClient = {
      channels: {
        fetch: vi.fn().mockResolvedValue(mockChannel),
      },
      on: vi.fn(),
    };

    confirmationSystem = new ConfirmationSystem(
      mockWinnerStateRepo,
      mockGiveawayRepo,
      mockConfigManager
    );

    confirmationSystem.initialize(mockClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('startConfirmation', () => {
    const mockGiveaway = {
      id: 'giveaway-1',
      title: 'Test Giveaway',
      channelId: 'channel-1',
      guildId: 'guild-1',
      status: GiveawayStatus.ACTIVE,
      winnerCount: 2,
      entries: [],
      requiredRoles: [],
      endsAt: new Date(),
      createdAt: new Date(),
      winners: [],
    };

    const mockWinners = [
      { id: 'user-1', username: 'User1' },
      { id: 'user-2', username: 'User2' },
    ];

    it('should create winner records with PENDING status', async () => {
      mockGiveawayRepo.get.mockResolvedValue(mockGiveaway);

      await confirmationSystem.startConfirmation('giveaway-1', mockWinners as any);

      expect(mockWinnerStateRepo.createWinner).toHaveBeenCalledTimes(2);
      expect(mockWinnerStateRepo.createWinner).toHaveBeenCalledWith(
        expect.objectContaining({
          giveawayId: 'giveaway-1',
          userId: 'user-1',
          status: WinnerStatus.PENDING,
          timerActive: true,
        })
      );
    });

    it('should send winner announcement message', async () => {
      mockGiveawayRepo.get.mockResolvedValue(mockGiveaway);

      await confirmationSystem.startConfirmation('giveaway-1', mockWinners as any);

      expect(mockClient.channels.fetch).toHaveBeenCalledWith('channel-1');
      expect(mockChannel.send).toHaveBeenCalled();
    });

    it('should throw error if giveaway not found', async () => {
      mockGiveawayRepo.get.mockResolvedValue(null);

      await expect(
        confirmationSystem.startConfirmation('giveaway-1', mockWinners as any)
      ).rejects.toThrow('Giveaway not found');
    });
  });

  describe('confirmWinner', () => {
    it('should update status to CONFIRMED', async () => {
      mockWinnerStateRepo.getWinner.mockResolvedValue({
        id: '1',
        giveawayId: 'giveaway-1',
        userId: 'user-1',
        status: WinnerStatus.PENDING,
        selectedAt: new Date(),
        timerStartTime: new Date(),
        timerActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockGiveawayRepo.get.mockResolvedValue({
        id: 'giveaway-1',
        channelId: 'channel-1',
        guildId: 'guild-1',
        title: 'Test',
        status: GiveawayStatus.ACTIVE,
        winnerCount: 1,
        entries: [],
        requiredRoles: [],
        endsAt: new Date(),
        createdAt: new Date(),
        winners: [],
      });

      await confirmationSystem.confirmWinner('giveaway-1', 'user-1');

      expect(mockWinnerStateRepo.updateStatus).toHaveBeenCalledWith(
        'giveaway-1',
        'user-1',
        WinnerStatus.CONFIRMED
      );
    });

    it('should send confirmation message', async () => {
      mockWinnerStateRepo.getWinner.mockResolvedValue({
        id: '1',
        giveawayId: 'giveaway-1',
        userId: 'user-1',
        status: WinnerStatus.PENDING,
        selectedAt: new Date(),
        timerStartTime: new Date(),
        timerActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockGiveawayRepo.get.mockResolvedValue({
        id: 'giveaway-1',
        channelId: 'channel-1',
        guildId: 'guild-1',
        title: 'Test',
        status: GiveawayStatus.ACTIVE,
        winnerCount: 1,
        entries: [],
        requiredRoles: [],
        endsAt: new Date(),
        createdAt: new Date(),
        winners: [],
      });

      await confirmationSystem.confirmWinner('giveaway-1', 'user-1');

      expect(mockChannel.send).toHaveBeenCalled();
    });

    it('should not process if winner already confirmed', async () => {
      mockWinnerStateRepo.getWinner.mockResolvedValue({
        id: '1',
        giveawayId: 'giveaway-1',
        userId: 'user-1',
        status: WinnerStatus.CONFIRMED,
        selectedAt: new Date(),
        confirmedAt: new Date(),
        timerStartTime: new Date(),
        timerActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await confirmationSystem.confirmWinner('giveaway-1', 'user-1');

      expect(mockWinnerStateRepo.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('manualReroll', () => {
    const mockGiveaway = {
      id: 'giveaway-1',
      title: 'Test Giveaway',
      channelId: 'channel-1',
      guildId: 'guild-1',
      status: GiveawayStatus.ACTIVE,
      winnerCount: 1,
      entries: [],
      requiredRoles: [],
      endsAt: new Date(),
      createdAt: new Date(),
      winners: [],
    };

    it('should validate moderator permissions', async () => {
      mockGiveawayRepo.get.mockResolvedValue(mockGiveaway);
      mockWinnerStateRepo.getWinner.mockResolvedValue({
        id: '1',
        giveawayId: 'giveaway-1',
        userId: 'user-1',
        status: WinnerStatus.PENDING,
        selectedAt: new Date(),
        timerStartTime: new Date(),
        timerActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockConfigManager.canUseGiveawayCommands.mockResolvedValue(false);

      await expect(
        confirmationSystem.manualReroll('giveaway-1', 'user-1', 'mod-1')
      ).rejects.toThrow('Insufficient permissions');

      expect(mockConfigManager.canUseGiveawayCommands).toHaveBeenCalledWith('guild-1', 'mod-1');
    });

    it('should throw error if winner not found', async () => {
      mockGiveawayRepo.get.mockResolvedValue(mockGiveaway);
      mockWinnerStateRepo.getWinner.mockResolvedValue(null);
      mockConfigManager.canUseGiveawayCommands.mockResolvedValue(true);

      await expect(
        confirmationSystem.manualReroll('giveaway-1', 'user-1', 'mod-1')
      ).rejects.toThrow('User is not a winner');
    });
  });

  describe('restoreActiveConfirmations', () => {
    it('should restore timers for pending winners', async () => {
      const pendingWinners = [
        {
          id: '1',
          giveawayId: 'giveaway-1',
          userId: 'user-1',
          status: WinnerStatus.PENDING,
          selectedAt: new Date(),
          timerStartTime: new Date(Date.now() - 60000), // 1 minute ago
          timerActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockWinnerStateRepo.getAllPendingWinners.mockResolvedValue(pendingWinners);

      await confirmationSystem.restoreActiveConfirmations();

      expect(mockWinnerStateRepo.getAllPendingWinners).toHaveBeenCalled();
    });
  });
});
