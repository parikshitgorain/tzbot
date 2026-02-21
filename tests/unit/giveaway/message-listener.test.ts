import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageListener } from '../../../src/giveaway/message-listener';
import { WinnerStatus } from '../../../src/types/models';

// Mock dependencies
vi.mock('../../../src/core/logger/logger');

describe('MessageListener', () => {
  let messageListener: MessageListener;
  let mockWinnerStateRepo: any;
  let mockConfirmationCallback: any;
  let mockClient: any;

  beforeEach(() => {
    mockWinnerStateRepo = {
      getPendingWinnersByUser: vi.fn(),
      getAllPendingWinners: vi.fn().mockResolvedValue([]),
    };

    mockConfirmationCallback = vi.fn().mockResolvedValue(undefined);

    messageListener = new MessageListener(
      mockWinnerStateRepo,
      mockConfirmationCallback
    );

    mockClient = {
      on: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('should register messageCreate event handler', () => {
      messageListener.initialize(mockClient);

      expect(mockClient.on).toHaveBeenCalledWith('messageCreate', expect.any(Function));
    });
  });

  describe('isPendingWinner', () => {
    it('should return true when user is a pending winner', async () => {
      mockWinnerStateRepo.getPendingWinnersByUser.mockResolvedValue([
        {
          id: '1',
          giveawayId: 'giveaway-1',
          userId: 'user-1',
          status: WinnerStatus.PENDING,
          selectedAt: new Date(),
          timerStartTime: new Date(),
          timerActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await messageListener.isPendingWinner('guild-1', 'user-1');

      expect(result).toBe(true);
      expect(mockWinnerStateRepo.getPendingWinnersByUser).toHaveBeenCalledWith('guild-1', 'user-1');
    });

    it('should return false when user is not a pending winner', async () => {
      mockWinnerStateRepo.getPendingWinnersByUser.mockResolvedValue([]);

      const result = await messageListener.isPendingWinner('guild-1', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('getPendingGiveaways', () => {
    it('should return giveaway IDs where user is pending', async () => {
      mockWinnerStateRepo.getPendingWinnersByUser.mockResolvedValue([
        {
          id: '1',
          giveawayId: 'giveaway-1',
          userId: 'user-1',
          status: WinnerStatus.PENDING,
          selectedAt: new Date(),
          timerStartTime: new Date(),
          timerActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          giveawayId: 'giveaway-2',
          userId: 'user-1',
          status: WinnerStatus.PENDING,
          selectedAt: new Date(),
          timerStartTime: new Date(),
          timerActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await messageListener.getPendingGiveaways('guild-1', 'user-1');

      expect(result).toEqual(['giveaway-1', 'giveaway-2']);
    });

    it('should return empty array when user has no pending giveaways', async () => {
      mockWinnerStateRepo.getPendingWinnersByUser.mockResolvedValue([]);

      const result = await messageListener.getPendingGiveaways('guild-1', 'user-1');

      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      mockWinnerStateRepo.getPendingWinnersByUser.mockRejectedValue(new Error('Database error'));

      const result = await messageListener.getPendingGiveaways('guild-1', 'user-1');

      expect(result).toEqual([]);
    });
  });

  describe('message handling', () => {
    let mockMessage: any;
    let messageHandler: any;

    beforeEach(() => {
      messageListener.initialize(mockClient);
      messageHandler = mockClient.on.mock.calls[0][1];

      mockMessage = {
        author: {
          id: 'user-1',
          bot: false,
        },
        guildId: 'guild-1',
      };
    });

    it('should trigger confirmation when pending winner sends message', async () => {
      mockWinnerStateRepo.getPendingWinnersByUser.mockResolvedValue([
        {
          id: '1',
          giveawayId: 'giveaway-1',
          userId: 'user-1',
          status: WinnerStatus.PENDING,
          selectedAt: new Date(),
          timerStartTime: new Date(),
          timerActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      await messageHandler(mockMessage);

      expect(mockConfirmationCallback).toHaveBeenCalledWith('giveaway-1', 'user-1');
    });

    it('should not trigger confirmation when non-winner sends message', async () => {
      mockWinnerStateRepo.getPendingWinnersByUser.mockResolvedValue([]);

      await messageHandler(mockMessage);

      expect(mockConfirmationCallback).not.toHaveBeenCalled();
    });

    it('should ignore bot messages', async () => {
      mockMessage.author.bot = true;

      await messageHandler(mockMessage);

      expect(mockWinnerStateRepo.getPendingWinnersByUser).not.toHaveBeenCalled();
      expect(mockConfirmationCallback).not.toHaveBeenCalled();
    });

    it('should ignore messages without guild context', async () => {
      mockMessage.guildId = undefined;

      await messageHandler(mockMessage);

      expect(mockWinnerStateRepo.getPendingWinnersByUser).not.toHaveBeenCalled();
      expect(mockConfirmationCallback).not.toHaveBeenCalled();
    });

    it('should handle multiple pending giveaways', async () => {
      mockWinnerStateRepo.getPendingWinnersByUser.mockResolvedValue([
        {
          id: '1',
          giveawayId: 'giveaway-1',
          userId: 'user-1',
          status: WinnerStatus.PENDING,
          selectedAt: new Date(),
          timerStartTime: new Date(),
          timerActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          giveawayId: 'giveaway-2',
          userId: 'user-1',
          status: WinnerStatus.PENDING,
          selectedAt: new Date(),
          timerStartTime: new Date(),
          timerActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      await messageHandler(mockMessage);

      expect(mockConfirmationCallback).toHaveBeenCalledTimes(2);
      expect(mockConfirmationCallback).toHaveBeenCalledWith('giveaway-1', 'user-1');
      expect(mockConfirmationCallback).toHaveBeenCalledWith('giveaway-2', 'user-1');
    });
  });

  describe('cache management', () => {
    it('should invalidate cache for specific user', () => {
      messageListener.invalidateCache('guild-1', 'user-1');
      // No error should be thrown
    });

    it('should clear entire cache', () => {
      messageListener.clearCache();
      // No error should be thrown
    });
  });
});
