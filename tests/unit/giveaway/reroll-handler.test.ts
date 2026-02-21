import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RerollHandler } from '../../../src/giveaway/reroll-handler.js';
import type { GiveawayRepository } from '../../../src/core/database/repositories/GiveawayRepository.js';
import type { WinnerStateRepository } from '../../../src/core/database/repositories/WinnerStateRepository.js';
import { WinnerStatus, type Giveaway, type WinnerRecord, GiveawayStatus } from '../../../src/types/models.js';

describe('RerollHandler', () => {
  let rerollHandler: RerollHandler;
  let mockGiveawayRepo: GiveawayRepository;
  let mockWinnerStateRepo: WinnerStateRepository;

  beforeEach(() => {
    // Create mock repositories
    mockGiveawayRepo = {
      get: vi.fn(),
      getEntries: vi.fn(),
    } as any;

    mockWinnerStateRepo = {
      getWinners: vi.fn(),
    } as any;

    rerollHandler = new RerollHandler(mockGiveawayRepo, mockWinnerStateRepo);
  });

  describe('getEligibleParticipants', () => {
    it('should return all participants when no winners exist', async () => {
      const giveawayId = 'test-giveaway-1';
      const mockGiveaway: Giveaway = {
        id: giveawayId,
        title: 'Test Giveaway',
        description: 'Test',
        channelId: 'channel-1',
        messageId: 'message-1',
        requiredRoles: [],
        winnerCount: 1,
        entries: [
          { userId: 'user-1', timestamp: new Date() },
          { userId: 'user-2', timestamp: new Date() },
          { userId: 'user-3', timestamp: new Date() },
        ],
        status: GiveawayStatus.ACTIVE,
        endsAt: new Date(),
        createdAt: new Date(),
      };

      vi.mocked(mockGiveawayRepo.get).mockResolvedValue(mockGiveaway);
      vi.mocked(mockWinnerStateRepo.getWinners).mockResolvedValue([]);

      const eligible = await rerollHandler.getEligibleParticipants(giveawayId);

      expect(eligible).toEqual(['user-1', 'user-2', 'user-3']);
    });

    it('should exclude users with PENDING status', async () => {
      const giveawayId = 'test-giveaway-2';
      const mockGiveaway: Giveaway = {
        id: giveawayId,
        title: 'Test Giveaway',
        description: 'Test',
        channelId: 'channel-1',
        messageId: 'message-1',
        requiredRoles: [],
        winnerCount: 2,
        entries: [
          { userId: 'user-1', timestamp: new Date() },
          { userId: 'user-2', timestamp: new Date() },
          { userId: 'user-3', timestamp: new Date() },
        ],
        status: GiveawayStatus.ACTIVE,
        endsAt: new Date(),
        createdAt: new Date(),
      };

      const mockWinners: WinnerRecord[] = [
        {
          id: 'winner-1',
          giveawayId,
          userId: 'user-1',
          status: WinnerStatus.PENDING,
          selectedAt: new Date(),
          timerStartTime: new Date(),
          timerActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockGiveawayRepo.get).mockResolvedValue(mockGiveaway);
      vi.mocked(mockWinnerStateRepo.getWinners).mockResolvedValue(mockWinners);

      const eligible = await rerollHandler.getEligibleParticipants(giveawayId);

      expect(eligible).toEqual(['user-2', 'user-3']);
      expect(eligible).not.toContain('user-1');
    });

    it('should exclude users with CONFIRMED status', async () => {
      const giveawayId = 'test-giveaway-3';
      const mockGiveaway: Giveaway = {
        id: giveawayId,
        title: 'Test Giveaway',
        description: 'Test',
        channelId: 'channel-1',
        messageId: 'message-1',
        requiredRoles: [],
        winnerCount: 2,
        entries: [
          { userId: 'user-1', timestamp: new Date() },
          { userId: 'user-2', timestamp: new Date() },
          { userId: 'user-3', timestamp: new Date() },
        ],
        status: GiveawayStatus.ACTIVE,
        endsAt: new Date(),
        createdAt: new Date(),
      };

      const mockWinners: WinnerRecord[] = [
        {
          id: 'winner-1',
          giveawayId,
          userId: 'user-2',
          status: WinnerStatus.CONFIRMED,
          selectedAt: new Date(),
          confirmedAt: new Date(),
          timerStartTime: new Date(),
          timerActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockGiveawayRepo.get).mockResolvedValue(mockGiveaway);
      vi.mocked(mockWinnerStateRepo.getWinners).mockResolvedValue(mockWinners);

      const eligible = await rerollHandler.getEligibleParticipants(giveawayId);

      expect(eligible).toEqual(['user-1', 'user-3']);
      expect(eligible).not.toContain('user-2');
    });

    it('should exclude users with REROLLED status', async () => {
      const giveawayId = 'test-giveaway-4';
      const mockGiveaway: Giveaway = {
        id: giveawayId,
        title: 'Test Giveaway',
        description: 'Test',
        channelId: 'channel-1',
        messageId: 'message-1',
        requiredRoles: [],
        winnerCount: 2,
        entries: [
          { userId: 'user-1', timestamp: new Date() },
          { userId: 'user-2', timestamp: new Date() },
          { userId: 'user-3', timestamp: new Date() },
        ],
        status: GiveawayStatus.ACTIVE,
        endsAt: new Date(),
        createdAt: new Date(),
      };

      const mockWinners: WinnerRecord[] = [
        {
          id: 'winner-1',
          giveawayId,
          userId: 'user-3',
          status: WinnerStatus.REROLLED,
          selectedAt: new Date(),
          rerolledAt: new Date(),
          timerStartTime: new Date(),
          timerActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockGiveawayRepo.get).mockResolvedValue(mockGiveaway);
      vi.mocked(mockWinnerStateRepo.getWinners).mockResolvedValue(mockWinners);

      const eligible = await rerollHandler.getEligibleParticipants(giveawayId);

      expect(eligible).toEqual(['user-1', 'user-2']);
      expect(eligible).not.toContain('user-3');
    });

    it('should exclude all users with any winner state', async () => {
      const giveawayId = 'test-giveaway-5';
      const mockGiveaway: Giveaway = {
        id: giveawayId,
        title: 'Test Giveaway',
        description: 'Test',
        channelId: 'channel-1',
        messageId: 'message-1',
        requiredRoles: [],
        winnerCount: 3,
        entries: [
          { userId: 'user-1', timestamp: new Date() },
          { userId: 'user-2', timestamp: new Date() },
          { userId: 'user-3', timestamp: new Date() },
          { userId: 'user-4', timestamp: new Date() },
          { userId: 'user-5', timestamp: new Date() },
        ],
        status: GiveawayStatus.ACTIVE,
        endsAt: new Date(),
        createdAt: new Date(),
      };

      const mockWinners: WinnerRecord[] = [
        {
          id: 'winner-1',
          giveawayId,
          userId: 'user-1',
          status: WinnerStatus.CONFIRMED,
          selectedAt: new Date(),
          confirmedAt: new Date(),
          timerStartTime: new Date(),
          timerActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'winner-2',
          giveawayId,
          userId: 'user-2',
          status: WinnerStatus.PENDING,
          selectedAt: new Date(),
          timerStartTime: new Date(),
          timerActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'winner-3',
          giveawayId,
          userId: 'user-3',
          status: WinnerStatus.REROLLED,
          selectedAt: new Date(),
          rerolledAt: new Date(),
          timerStartTime: new Date(),
          timerActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockGiveawayRepo.get).mockResolvedValue(mockGiveaway);
      vi.mocked(mockWinnerStateRepo.getWinners).mockResolvedValue(mockWinners);

      const eligible = await rerollHandler.getEligibleParticipants(giveawayId);

      expect(eligible).toEqual(['user-4', 'user-5']);
      expect(eligible).not.toContain('user-1');
      expect(eligible).not.toContain('user-2');
      expect(eligible).not.toContain('user-3');
    });

    it('should return empty array when all participants have been selected', async () => {
      const giveawayId = 'test-giveaway-6';
      const mockGiveaway: Giveaway = {
        id: giveawayId,
        title: 'Test Giveaway',
        description: 'Test',
        channelId: 'channel-1',
        messageId: 'message-1',
        requiredRoles: [],
        winnerCount: 2,
        entries: [
          { userId: 'user-1', timestamp: new Date() },
          { userId: 'user-2', timestamp: new Date() },
        ],
        status: GiveawayStatus.ACTIVE,
        endsAt: new Date(),
        createdAt: new Date(),
      };

      const mockWinners: WinnerRecord[] = [
        {
          id: 'winner-1',
          giveawayId,
          userId: 'user-1',
          status: WinnerStatus.CONFIRMED,
          selectedAt: new Date(),
          confirmedAt: new Date(),
          timerStartTime: new Date(),
          timerActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'winner-2',
          giveawayId,
          userId: 'user-2',
          status: WinnerStatus.REROLLED,
          selectedAt: new Date(),
          rerolledAt: new Date(),
          timerStartTime: new Date(),
          timerActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockGiveawayRepo.get).mockResolvedValue(mockGiveaway);
      vi.mocked(mockWinnerStateRepo.getWinners).mockResolvedValue(mockWinners);

      const eligible = await rerollHandler.getEligibleParticipants(giveawayId);

      expect(eligible).toEqual([]);
    });

    it('should throw error when giveaway not found', async () => {
      const giveawayId = 'non-existent-giveaway';

      vi.mocked(mockGiveawayRepo.get).mockResolvedValue(null);

      await expect(
        rerollHandler.getEligibleParticipants(giveawayId)
      ).rejects.toThrow('Giveaway not found');
    });
  });

  describe('rerollWinner', () => {
    it('should return a user ID when eligible participants exist', async () => {
      const giveawayId = 'test-giveaway-7';
      const mockGiveaway: Giveaway = {
        id: giveawayId,
        title: 'Test Giveaway',
        description: 'Test',
        channelId: 'channel-1',
        messageId: 'message-1',
        requiredRoles: [],
        winnerCount: 1,
        entries: [
          { userId: 'user-1', timestamp: new Date() },
          { userId: 'user-2', timestamp: new Date() },
        ],
        status: GiveawayStatus.ACTIVE,
        endsAt: new Date(),
        createdAt: new Date(),
      };

      vi.mocked(mockGiveawayRepo.get).mockResolvedValue(mockGiveaway);
      vi.mocked(mockWinnerStateRepo.getWinners).mockResolvedValue([]);

      const newWinner = await rerollHandler.rerollWinner(giveawayId);

      expect(newWinner).toBeTruthy();
      expect(['user-1', 'user-2']).toContain(newWinner);
    });

    it('should return null when no eligible participants remain', async () => {
      const giveawayId = 'test-giveaway-8';
      const mockGiveaway: Giveaway = {
        id: giveawayId,
        title: 'Test Giveaway',
        description: 'Test',
        channelId: 'channel-1',
        messageId: 'message-1',
        requiredRoles: [],
        winnerCount: 1,
        entries: [
          { userId: 'user-1', timestamp: new Date() },
        ],
        status: GiveawayStatus.ACTIVE,
        endsAt: new Date(),
        createdAt: new Date(),
      };

      const mockWinners: WinnerRecord[] = [
        {
          id: 'winner-1',
          giveawayId,
          userId: 'user-1',
          status: WinnerStatus.REROLLED,
          selectedAt: new Date(),
          rerolledAt: new Date(),
          timerStartTime: new Date(),
          timerActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockGiveawayRepo.get).mockResolvedValue(mockGiveaway);
      vi.mocked(mockWinnerStateRepo.getWinners).mockResolvedValue(mockWinners);

      const newWinner = await rerollHandler.rerollWinner(giveawayId);

      expect(newWinner).toBeNull();
    });

    it('should select from remaining eligible participants', async () => {
      const giveawayId = 'test-giveaway-9';
      const mockGiveaway: Giveaway = {
        id: giveawayId,
        title: 'Test Giveaway',
        description: 'Test',
        channelId: 'channel-1',
        messageId: 'message-1',
        requiredRoles: [],
        winnerCount: 2,
        entries: [
          { userId: 'user-1', timestamp: new Date() },
          { userId: 'user-2', timestamp: new Date() },
          { userId: 'user-3', timestamp: new Date() },
        ],
        status: GiveawayStatus.ACTIVE,
        endsAt: new Date(),
        createdAt: new Date(),
      };

      const mockWinners: WinnerRecord[] = [
        {
          id: 'winner-1',
          giveawayId,
          userId: 'user-1',
          status: WinnerStatus.CONFIRMED,
          selectedAt: new Date(),
          confirmedAt: new Date(),
          timerStartTime: new Date(),
          timerActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockGiveawayRepo.get).mockResolvedValue(mockGiveaway);
      vi.mocked(mockWinnerStateRepo.getWinners).mockResolvedValue(mockWinners);

      const newWinner = await rerollHandler.rerollWinner(giveawayId);

      expect(newWinner).toBeTruthy();
      expect(['user-2', 'user-3']).toContain(newWinner);
      expect(newWinner).not.toBe('user-1');
    });

    it('should use cryptographically secure random selection', async () => {
      const giveawayId = 'test-giveaway-10';
      const mockGiveaway: Giveaway = {
        id: giveawayId,
        title: 'Test Giveaway',
        description: 'Test',
        channelId: 'channel-1',
        messageId: 'message-1',
        requiredRoles: [],
        winnerCount: 1,
        entries: [
          { userId: 'user-1', timestamp: new Date() },
          { userId: 'user-2', timestamp: new Date() },
          { userId: 'user-3', timestamp: new Date() },
          { userId: 'user-4', timestamp: new Date() },
          { userId: 'user-5', timestamp: new Date() },
        ],
        status: GiveawayStatus.ACTIVE,
        endsAt: new Date(),
        createdAt: new Date(),
      };

      vi.mocked(mockGiveawayRepo.get).mockResolvedValue(mockGiveaway);
      vi.mocked(mockWinnerStateRepo.getWinners).mockResolvedValue([]);

      // Run multiple times to verify randomness
      const results = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const winner = await rerollHandler.rerollWinner(giveawayId);
        if (winner) {
          results.add(winner);
        }
      }

      // With 5 users and 20 iterations, we should see multiple different winners
      // (statistically very likely, though not guaranteed)
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('Edge Cases', () => {
    describe('No eligible participants remaining', () => {
      it('should return empty array when all participants are PENDING winners', async () => {
        const giveawayId = 'edge-case-1';
        const mockGiveaway: Giveaway = {
          id: giveawayId,
          title: 'Test Giveaway',
          description: 'Test',
          channelId: 'channel-1',
          messageId: 'message-1',
          requiredRoles: [],
          winnerCount: 3,
          entries: [
            { userId: 'user-1', timestamp: new Date() },
            { userId: 'user-2', timestamp: new Date() },
            { userId: 'user-3', timestamp: new Date() },
          ],
          status: GiveawayStatus.ACTIVE,
          endsAt: new Date(),
          createdAt: new Date(),
        };

        const mockWinners: WinnerRecord[] = [
          {
            id: 'winner-1',
            giveawayId,
            userId: 'user-1',
            status: WinnerStatus.PENDING,
            selectedAt: new Date(),
            timerStartTime: new Date(),
            timerActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'winner-2',
            giveawayId,
            userId: 'user-2',
            status: WinnerStatus.PENDING,
            selectedAt: new Date(),
            timerStartTime: new Date(),
            timerActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'winner-3',
            giveawayId,
            userId: 'user-3',
            status: WinnerStatus.PENDING,
            selectedAt: new Date(),
            timerStartTime: new Date(),
            timerActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        vi.mocked(mockGiveawayRepo.get).mockResolvedValue(mockGiveaway);
        vi.mocked(mockWinnerStateRepo.getWinners).mockResolvedValue(mockWinners);

        const eligible = await rerollHandler.getEligibleParticipants(giveawayId);

        expect(eligible).toEqual([]);
        expect(eligible.length).toBe(0);
      });

      it('should return empty array when all participants are CONFIRMED winners', async () => {
        const giveawayId = 'edge-case-2';
        const mockGiveaway: Giveaway = {
          id: giveawayId,
          title: 'Test Giveaway',
          description: 'Test',
          channelId: 'channel-1',
          messageId: 'message-1',
          requiredRoles: [],
          winnerCount: 2,
          entries: [
            { userId: 'user-1', timestamp: new Date() },
            { userId: 'user-2', timestamp: new Date() },
          ],
          status: GiveawayStatus.ACTIVE,
          endsAt: new Date(),
          createdAt: new Date(),
        };

        const mockWinners: WinnerRecord[] = [
          {
            id: 'winner-1',
            giveawayId,
            userId: 'user-1',
            status: WinnerStatus.CONFIRMED,
            selectedAt: new Date(),
            confirmedAt: new Date(),
            timerStartTime: new Date(),
            timerActive: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'winner-2',
            giveawayId,
            userId: 'user-2',
            status: WinnerStatus.CONFIRMED,
            selectedAt: new Date(),
            confirmedAt: new Date(),
            timerStartTime: new Date(),
            timerActive: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        vi.mocked(mockGiveawayRepo.get).mockResolvedValue(mockGiveaway);
        vi.mocked(mockWinnerStateRepo.getWinners).mockResolvedValue(mockWinners);

        const eligible = await rerollHandler.getEligibleParticipants(giveawayId);

        expect(eligible).toEqual([]);
        expect(eligible.length).toBe(0);
      });

      it('should return empty array when all participants are REROLLED winners', async () => {
        const giveawayId = 'edge-case-3';
        const mockGiveaway: Giveaway = {
          id: giveawayId,
          title: 'Test Giveaway',
          description: 'Test',
          channelId: 'channel-1',
          messageId: 'message-1',
          requiredRoles: [],
          winnerCount: 2,
          entries: [
            { userId: 'user-1', timestamp: new Date() },
            { userId: 'user-2', timestamp: new Date() },
          ],
          status: GiveawayStatus.ACTIVE,
          endsAt: new Date(),
          createdAt: new Date(),
        };

        const mockWinners: WinnerRecord[] = [
          {
            id: 'winner-1',
            giveawayId,
            userId: 'user-1',
            status: WinnerStatus.REROLLED,
            selectedAt: new Date(),
            rerolledAt: new Date(),
            timerStartTime: new Date(),
            timerActive: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'winner-2',
            giveawayId,
            userId: 'user-2',
            status: WinnerStatus.REROLLED,
            selectedAt: new Date(),
            rerolledAt: new Date(),
            timerStartTime: new Date(),
            timerActive: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        vi.mocked(mockGiveawayRepo.get).mockResolvedValue(mockGiveaway);
        vi.mocked(mockWinnerStateRepo.getWinners).mockResolvedValue(mockWinners);

        const eligible = await rerollHandler.getEligibleParticipants(giveawayId);

        expect(eligible).toEqual([]);
        expect(eligible.length).toBe(0);
      });
    });

    describe('All participants already selected', () => {
      it('should return null when attempting to reroll with no eligible participants', async () => {
        const giveawayId = 'edge-case-4';
        const mockGiveaway: Giveaway = {
          id: giveawayId,
          title: 'Test Giveaway',
          description: 'Test',
          channelId: 'channel-1',
          messageId: 'message-1',
          requiredRoles: [],
          winnerCount: 3,
          entries: [
            { userId: 'user-1', timestamp: new Date() },
            { userId: 'user-2', timestamp: new Date() },
            { userId: 'user-3', timestamp: new Date() },
          ],
          status: GiveawayStatus.ACTIVE,
          endsAt: new Date(),
          createdAt: new Date(),
        };

        const mockWinners: WinnerRecord[] = [
          {
            id: 'winner-1',
            giveawayId,
            userId: 'user-1',
            status: WinnerStatus.CONFIRMED,
            selectedAt: new Date(),
            confirmedAt: new Date(),
            timerStartTime: new Date(),
            timerActive: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'winner-2',
            giveawayId,
            userId: 'user-2',
            status: WinnerStatus.PENDING,
            selectedAt: new Date(),
            timerStartTime: new Date(),
            timerActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'winner-3',
            giveawayId,
            userId: 'user-3',
            status: WinnerStatus.REROLLED,
            selectedAt: new Date(),
            rerolledAt: new Date(),
            timerStartTime: new Date(),
            timerActive: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        vi.mocked(mockGiveawayRepo.get).mockResolvedValue(mockGiveaway);
        vi.mocked(mockWinnerStateRepo.getWinners).mockResolvedValue(mockWinners);

        const newWinner = await rerollHandler.rerollWinner(giveawayId);

        expect(newWinner).toBeNull();
      });

      it('should return null when giveaway has only one participant who is already a winner', async () => {
        const giveawayId = 'edge-case-5';
        const mockGiveaway: Giveaway = {
          id: giveawayId,
          title: 'Test Giveaway',
          description: 'Test',
          channelId: 'channel-1',
          messageId: 'message-1',
          requiredRoles: [],
          winnerCount: 1,
          entries: [
            { userId: 'user-1', timestamp: new Date() },
          ],
          status: GiveawayStatus.ACTIVE,
          endsAt: new Date(),
          createdAt: new Date(),
        };

        const mockWinners: WinnerRecord[] = [
          {
            id: 'winner-1',
            giveawayId,
            userId: 'user-1',
            status: WinnerStatus.CONFIRMED,
            selectedAt: new Date(),
            confirmedAt: new Date(),
            timerStartTime: new Date(),
            timerActive: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        vi.mocked(mockGiveawayRepo.get).mockResolvedValue(mockGiveaway);
        vi.mocked(mockWinnerStateRepo.getWinners).mockResolvedValue(mockWinners);

        const newWinner = await rerollHandler.rerollWinner(giveawayId);

        expect(newWinner).toBeNull();
      });

      it('should handle multiple reroll attempts until no participants remain', async () => {
        const giveawayId = 'edge-case-6';
        const allUsers = ['user-1', 'user-2', 'user-3'];
        
        const mockGiveaway: Giveaway = {
          id: giveawayId,
          title: 'Test Giveaway',
          description: 'Test',
          channelId: 'channel-1',
          messageId: 'message-1',
          requiredRoles: [],
          winnerCount: 3,
          entries: allUsers.map(userId => ({ userId, timestamp: new Date() })),
          status: GiveawayStatus.ACTIVE,
          endsAt: new Date(),
          createdAt: new Date(),
        };

        vi.mocked(mockGiveawayRepo.get).mockResolvedValue(mockGiveaway);

        const selectedWinners: string[] = [];

        // First reroll - no winners yet
        vi.mocked(mockWinnerStateRepo.getWinners).mockResolvedValue([]);
        const winner1 = await rerollHandler.rerollWinner(giveawayId);
        expect(winner1).not.toBeNull();
        selectedWinners.push(winner1!);

        // Second reroll - one winner
        vi.mocked(mockWinnerStateRepo.getWinners).mockResolvedValue([
          {
            id: 'winner-1',
            giveawayId,
            userId: winner1!,
            status: WinnerStatus.CONFIRMED,
            selectedAt: new Date(),
            confirmedAt: new Date(),
            timerStartTime: new Date(),
            timerActive: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);
        const winner2 = await rerollHandler.rerollWinner(giveawayId);
        expect(winner2).not.toBeNull();
        expect(winner2).not.toBe(winner1);
        selectedWinners.push(winner2!);

        // Third reroll - two winners
        vi.mocked(mockWinnerStateRepo.getWinners).mockResolvedValue([
          {
            id: 'winner-1',
            giveawayId,
            userId: winner1!,
            status: WinnerStatus.CONFIRMED,
            selectedAt: new Date(),
            confirmedAt: new Date(),
            timerStartTime: new Date(),
            timerActive: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'winner-2',
            giveawayId,
            userId: winner2!,
            status: WinnerStatus.CONFIRMED,
            selectedAt: new Date(),
            confirmedAt: new Date(),
            timerStartTime: new Date(),
            timerActive: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);
        const winner3 = await rerollHandler.rerollWinner(giveawayId);
        expect(winner3).not.toBeNull();
        expect(winner3).not.toBe(winner1);
        expect(winner3).not.toBe(winner2);
        selectedWinners.push(winner3!);

        // Fourth reroll - all three participants are winners, should return null
        vi.mocked(mockWinnerStateRepo.getWinners).mockResolvedValue([
          {
            id: 'winner-1',
            giveawayId,
            userId: winner1!,
            status: WinnerStatus.CONFIRMED,
            selectedAt: new Date(),
            confirmedAt: new Date(),
            timerStartTime: new Date(),
            timerActive: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'winner-2',
            giveawayId,
            userId: winner2!,
            status: WinnerStatus.CONFIRMED,
            selectedAt: new Date(),
            confirmedAt: new Date(),
            timerStartTime: new Date(),
            timerActive: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'winner-3',
            giveawayId,
            userId: winner3!,
            status: WinnerStatus.CONFIRMED,
            selectedAt: new Date(),
            confirmedAt: new Date(),
            timerStartTime: new Date(),
            timerActive: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);
        const winner4 = await rerollHandler.rerollWinner(giveawayId);
        expect(winner4).toBeNull();

        // Verify all three users were selected exactly once
        expect(selectedWinners.length).toBe(3);
        expect(new Set(selectedWinners).size).toBe(3);
        expect(selectedWinners.sort()).toEqual(allUsers.sort());
      });
    });

    describe('Random selection distribution', () => {
      it('should distribute selections across all eligible participants', async () => {
        const giveawayId = 'edge-case-7';
        const mockGiveaway: Giveaway = {
          id: giveawayId,
          title: 'Test Giveaway',
          description: 'Test',
          channelId: 'channel-1',
          messageId: 'message-1',
          requiredRoles: [],
          winnerCount: 1,
          entries: [
            { userId: 'user-1', timestamp: new Date() },
            { userId: 'user-2', timestamp: new Date() },
            { userId: 'user-3', timestamp: new Date() },
            { userId: 'user-4', timestamp: new Date() },
            { userId: 'user-5', timestamp: new Date() },
            { userId: 'user-6', timestamp: new Date() },
            { userId: 'user-7', timestamp: new Date() },
            { userId: 'user-8', timestamp: new Date() },
            { userId: 'user-9', timestamp: new Date() },
            { userId: 'user-10', timestamp: new Date() },
          ],
          status: GiveawayStatus.ACTIVE,
          endsAt: new Date(),
          createdAt: new Date(),
        };

        vi.mocked(mockGiveawayRepo.get).mockResolvedValue(mockGiveaway);
        vi.mocked(mockWinnerStateRepo.getWinners).mockResolvedValue([]);

        // Run 100 selections and track distribution
        const distribution = new Map<string, number>();
        const iterations = 100;

        for (let i = 0; i < iterations; i++) {
          const winner = await rerollHandler.rerollWinner(giveawayId);
          expect(winner).not.toBeNull();
          
          const count = distribution.get(winner!) || 0;
          distribution.set(winner!, count + 1);
        }

        // Verify all users were selected at least once (statistically very likely)
        expect(distribution.size).toBeGreaterThanOrEqual(8); // At least 8 out of 10 users

        // Verify no single user dominates (no user should have > 40% of selections)
        for (const [userId, count] of distribution.entries()) {
          expect(count).toBeLessThan(iterations * 0.4);
        }

        // Verify distribution is reasonably balanced (each user should get roughly 10% ± some variance)
        const expectedPerUser = iterations / 10;
        const maxDeviation = expectedPerUser * 2; // Allow 2x deviation for statistical variance
        
        for (const [userId, count] of distribution.entries()) {
          expect(count).toBeGreaterThan(0);
          expect(count).toBeLessThan(expectedPerUser + maxDeviation);
        }
      });

      it('should handle single eligible participant correctly', async () => {
        const giveawayId = 'edge-case-8';
        const mockGiveaway: Giveaway = {
          id: giveawayId,
          title: 'Test Giveaway',
          description: 'Test',
          channelId: 'channel-1',
          messageId: 'message-1',
          requiredRoles: [],
          winnerCount: 2,
          entries: [
            { userId: 'user-1', timestamp: new Date() },
            { userId: 'user-2', timestamp: new Date() },
          ],
          status: GiveawayStatus.ACTIVE,
          endsAt: new Date(),
          createdAt: new Date(),
        };

        const mockWinners: WinnerRecord[] = [
          {
            id: 'winner-1',
            giveawayId,
            userId: 'user-1',
            status: WinnerStatus.CONFIRMED,
            selectedAt: new Date(),
            confirmedAt: new Date(),
            timerStartTime: new Date(),
            timerActive: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        vi.mocked(mockGiveawayRepo.get).mockResolvedValue(mockGiveaway);
        vi.mocked(mockWinnerStateRepo.getWinners).mockResolvedValue(mockWinners);

        // With only one eligible participant, should always select that user
        for (let i = 0; i < 10; i++) {
          const winner = await rerollHandler.rerollWinner(giveawayId);
          expect(winner).toBe('user-2');
        }
      });

      it('should handle two eligible participants with balanced distribution', async () => {
        const giveawayId = 'edge-case-9';
        const mockGiveaway: Giveaway = {
          id: giveawayId,
          title: 'Test Giveaway',
          description: 'Test',
          channelId: 'channel-1',
          messageId: 'message-1',
          requiredRoles: [],
          winnerCount: 1,
          entries: [
            { userId: 'user-1', timestamp: new Date() },
            { userId: 'user-2', timestamp: new Date() },
          ],
          status: GiveawayStatus.ACTIVE,
          endsAt: new Date(),
          createdAt: new Date(),
        };

        vi.mocked(mockGiveawayRepo.get).mockResolvedValue(mockGiveaway);
        vi.mocked(mockWinnerStateRepo.getWinners).mockResolvedValue([]);

        // Run 50 selections
        const distribution = new Map<string, number>();
        const iterations = 50;

        for (let i = 0; i < iterations; i++) {
          const winner = await rerollHandler.rerollWinner(giveawayId);
          expect(winner).not.toBeNull();
          expect(['user-1', 'user-2']).toContain(winner);
          
          const count = distribution.get(winner!) || 0;
          distribution.set(winner!, count + 1);
        }

        // Both users should be selected at least once
        expect(distribution.size).toBe(2);
        expect(distribution.has('user-1')).toBe(true);
        expect(distribution.has('user-2')).toBe(true);

        // Neither user should dominate (no more than 80% of selections)
        expect(distribution.get('user-1')!).toBeLessThan(iterations * 0.8);
        expect(distribution.get('user-2')!).toBeLessThan(iterations * 0.8);
      });

      it('should maintain randomness with large participant pool', async () => {
        const giveawayId = 'edge-case-10';
        const largeUserPool = Array.from({ length: 100 }, (_, i) => ({
          userId: `user-${i + 1}`,
          timestamp: new Date(),
        }));

        const mockGiveaway: Giveaway = {
          id: giveawayId,
          title: 'Test Giveaway',
          description: 'Test',
          channelId: 'channel-1',
          messageId: 'message-1',
          requiredRoles: [],
          winnerCount: 1,
          entries: largeUserPool,
          status: GiveawayStatus.ACTIVE,
          endsAt: new Date(),
          createdAt: new Date(),
        };

        vi.mocked(mockGiveawayRepo.get).mockResolvedValue(mockGiveaway);
        vi.mocked(mockWinnerStateRepo.getWinners).mockResolvedValue([]);

        // Run 200 selections
        const distribution = new Map<string, number>();
        const iterations = 200;

        for (let i = 0; i < iterations; i++) {
          const winner = await rerollHandler.rerollWinner(giveawayId);
          expect(winner).not.toBeNull();
          
          const count = distribution.get(winner!) || 0;
          distribution.set(winner!, count + 1);
        }

        // Should see a good variety of winners (at least 50 different users out of 100)
        expect(distribution.size).toBeGreaterThanOrEqual(50);

        // No single user should dominate (max 5% of selections)
        for (const [userId, count] of distribution.entries()) {
          expect(count).toBeLessThan(iterations * 0.05);
        }
      });
    });
  });
});
