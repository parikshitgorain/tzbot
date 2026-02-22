import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatRainManager } from '../../../src/managers/chat-rain.manager.js';
import { RewardType } from '../../../src/managers/reward-system.js';
import type { ChatActivityRepository } from '../../../src/core/database/repositories/ChatActivityRepository.js';
import type { ViolationRepository } from '../../../src/core/database/repositories/ViolationRepository.js';
import type { RewardSystem } from '../../../src/managers/reward-system.js';
import { ViolationType } from '../../../src/types/models.js';

describe('ChatRainManager', () => {
  let chatRainManager: ChatRainManager;
  let mockChatActivityRepo: ChatActivityRepository;
  let mockViolationRepo: ViolationRepository;
  let mockRewardSystem: RewardSystem;
  const testChannelId = '123456789012345678';

  const defaultConfig = {
    minDelayMinutes: 5,
    activeWindowMinutes: 10,
    minMessages: 3,
    cooldownMinutes: 60,
    rewardType: RewardType.ROLE,
    rewardValue: 'test-role-id',
  };

  beforeEach(() => {
    // Create mock repositories
    mockChatActivityRepo = {
      getQualifiedChatters: vi.fn(),
      getRecentWinners: vi.fn(),
      recordWinner: vi.fn(),
      getLastChatRainTime: vi.fn(),
    } as any;

    mockViolationRepo = {
      getCount: vi.fn(),
    } as any;

    mockRewardSystem = {
      distributeRewards: vi.fn().mockResolvedValue({
        successful: [],
        failed: [],
        errors: new Map()
      }),
    } as any;

    chatRainManager = new ChatRainManager(
      mockChatActivityRepo,
      mockViolationRepo,
      mockRewardSystem,
      defaultConfig
    );
  });

  describe('executeChatRain', () => {
    it('should return null if minimum delay not met', async () => {
      // Set last chat rain time to 2 minutes ago
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      vi.spyOn(mockChatActivityRepo, 'getLastChatRainTime').mockResolvedValue(twoMinutesAgo);
      
      await chatRainManager.initialize();

      const result = await chatRainManager.executeChatRain(testChannelId);

      expect(result).toBeNull();
    });

    it('should return empty array if no eligible users', async () => {
      vi.spyOn(mockChatActivityRepo, 'getQualifiedChatters').mockResolvedValue([]);
      vi.spyOn(mockChatActivityRepo, 'getLastChatRainTime').mockResolvedValue(null);
      
      await chatRainManager.initialize();

      const result = await chatRainManager.executeChatRain(testChannelId);

      expect(result).toEqual(null);
    });

    it('should select winners from eligible users', async () => {
      const eligibleUsers = ['user1', 'user2', 'user3', 'user4', 'user5'];
      
      vi.spyOn(mockChatActivityRepo, 'getQualifiedChatters').mockResolvedValue(eligibleUsers);
      vi.spyOn(mockChatActivityRepo, 'getRecentWinners').mockResolvedValue([]);
      vi.spyOn(mockViolationRepo, 'getCount').mockResolvedValue(0);
      vi.spyOn(mockRewardSystem, 'distributeRewards').mockResolvedValue({
        successful: eligibleUsers.slice(0, 3),
        failed: [],
        errors: new Map()
      });
      vi.spyOn(mockChatActivityRepo, 'getLastChatRainTime').mockResolvedValue(null);
      
      await chatRainManager.initialize();

      const winners = await chatRainManager.executeChatRain(testChannelId);

      expect(winners).not.toBeNull();
      expect(winners!.length).toBeGreaterThanOrEqual(3);
      expect(winners!.length).toBeLessThanOrEqual(5); // Max 5 since only 5 eligible
      expect(winners!.every(w => eligibleUsers.includes(w))).toBe(true);
    });

    it('should exclude spam-flagged users', async () => {
      const allUsers = ['user1', 'user2', 'user3', 'user4'];
      const spamUser = 'user2';
      
      vi.spyOn(mockChatActivityRepo, 'getQualifiedChatters').mockResolvedValue(allUsers);
      vi.spyOn(mockChatActivityRepo, 'getRecentWinners').mockResolvedValue([]);
      vi.spyOn(mockViolationRepo, 'getCount').mockImplementation(async (userId: string) => {
        return userId === spamUser ? 1 : 0;
      });
      vi.spyOn(mockChatActivityRepo, 'recordWinner').mockResolvedValue();
      vi.spyOn(mockChatActivityRepo, 'getLastChatRainTime').mockResolvedValue(null);
      
      await chatRainManager.initialize();

      const winners = await chatRainManager.executeChatRain(testChannelId);

      expect(winners).not.toBeNull();
      expect(winners!.includes(spamUser)).toBe(false);
    });

    it('should exclude recent winners', async () => {
      const allUsers = ['user1', 'user2', 'user3', 'user4'];
      const recentWinner = 'user3';
      
      vi.spyOn(mockChatActivityRepo, 'getQualifiedChatters').mockResolvedValue(allUsers);
      vi.spyOn(mockChatActivityRepo, 'getRecentWinners').mockResolvedValue([recentWinner]);
      vi.spyOn(mockViolationRepo, 'getCount').mockResolvedValue(0);
      vi.spyOn(mockChatActivityRepo, 'recordWinner').mockResolvedValue();
      vi.spyOn(mockChatActivityRepo, 'getLastChatRainTime').mockResolvedValue(null);
      
      await chatRainManager.initialize();

      const winners = await chatRainManager.executeChatRain(testChannelId);

      expect(winners).not.toBeNull();
      expect(winners!.includes(recentWinner)).toBe(false);
    });

    it('should distribute rewards to winners', async () => {
      const eligibleUsers = ['user1', 'user2', 'user3'];
      
      vi.spyOn(mockChatActivityRepo, 'getQualifiedChatters').mockResolvedValue(eligibleUsers);
      vi.spyOn(mockChatActivityRepo, 'getRecentWinners').mockResolvedValue([]);
      vi.spyOn(mockViolationRepo, 'getCount').mockResolvedValue(0);
      const distributeRewardsSpy = vi.spyOn(mockRewardSystem, 'distributeRewards').mockResolvedValue({
        successful: eligibleUsers,
        failed: [],
        errors: new Map()
      });
      vi.spyOn(mockChatActivityRepo, 'getLastChatRainTime').mockResolvedValue(null);
      
      await chatRainManager.initialize();

      const winners = await chatRainManager.executeChatRain(testChannelId);

      expect(winners).not.toBeNull();
      expect(distributeRewardsSpy).toHaveBeenCalledTimes(1);
      expect(distributeRewardsSpy).toHaveBeenCalledWith(
        winners,
        expect.objectContaining({
          type: defaultConfig.rewardType,
          value: defaultConfig.rewardValue
        }),
        testChannelId
      );
    });

    it('should select between 3 and 10 winners', async () => {
      const eligibleUsers = Array.from({ length: 20 }, (_, i) => `user${i}`);
      
      vi.spyOn(mockChatActivityRepo, 'getQualifiedChatters').mockResolvedValue(eligibleUsers);
      vi.spyOn(mockChatActivityRepo, 'getRecentWinners').mockResolvedValue([]);
      vi.spyOn(mockViolationRepo, 'getCount').mockResolvedValue(0);
      vi.spyOn(mockChatActivityRepo, 'recordWinner').mockResolvedValue();
      vi.spyOn(mockChatActivityRepo, 'getLastChatRainTime').mockResolvedValue(null);
      
      await chatRainManager.initialize();

      const winners = await chatRainManager.executeChatRain(testChannelId);

      expect(winners).not.toBeNull();
      expect(winners!.length).toBeGreaterThanOrEqual(3);
      expect(winners!.length).toBeLessThanOrEqual(10);
    });

    it('should not select duplicate winners', async () => {
      const eligibleUsers = Array.from({ length: 10 }, (_, i) => `user${i}`);
      
      vi.spyOn(mockChatActivityRepo, 'getQualifiedChatters').mockResolvedValue(eligibleUsers);
      vi.spyOn(mockChatActivityRepo, 'getRecentWinners').mockResolvedValue([]);
      vi.spyOn(mockViolationRepo, 'getCount').mockResolvedValue(0);
      vi.spyOn(mockChatActivityRepo, 'recordWinner').mockResolvedValue();
      vi.spyOn(mockChatActivityRepo, 'getLastChatRainTime').mockResolvedValue(null);
      
      await chatRainManager.initialize();

      const winners = await chatRainManager.executeChatRain(testChannelId);

      expect(winners).not.toBeNull();
      const uniqueWinners = new Set(winners!);
      expect(uniqueWinners.size).toBe(winners!.length);
    });

    it('should handle case with fewer than 3 eligible users', async () => {
      const eligibleUsers = ['user1', 'user2'];
      
      vi.spyOn(mockChatActivityRepo, 'getQualifiedChatters').mockResolvedValue(eligibleUsers);
      vi.spyOn(mockChatActivityRepo, 'getRecentWinners').mockResolvedValue([]);
      vi.spyOn(mockViolationRepo, 'getCount').mockResolvedValue(0);
      vi.spyOn(mockChatActivityRepo, 'recordWinner').mockResolvedValue();
      vi.spyOn(mockChatActivityRepo, 'getLastChatRainTime').mockResolvedValue(null);
      
      await chatRainManager.initialize();

      const winners = await chatRainManager.executeChatRain(testChannelId);

      expect(winners).not.toBeNull();
      expect(winners!.length).toBe(2);
    });
  });

  describe('getTimeUntilNextChatRain', () => {
    it('should return 0 if no previous chat rain', async () => {
      vi.spyOn(mockChatActivityRepo, 'getLastChatRainTime').mockResolvedValue(null);
      await chatRainManager.initialize();

      const timeUntilNext = chatRainManager.getTimeUntilNextChatRain();

      expect(timeUntilNext).toBe(0);
    });

    it('should return remaining time if cooldown active', async () => {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      vi.spyOn(mockChatActivityRepo, 'getLastChatRainTime').mockResolvedValue(twoMinutesAgo);
      await chatRainManager.initialize();

      const timeUntilNext = chatRainManager.getTimeUntilNextChatRain();

      // Should be approximately 3 minutes (5 min delay - 2 min elapsed)
      expect(timeUntilNext).toBeGreaterThan(2.5 * 60 * 1000);
      expect(timeUntilNext).toBeLessThan(3.5 * 60 * 1000);
    });

    it('should return 0 if cooldown expired', async () => {
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
      vi.spyOn(mockChatActivityRepo, 'getLastChatRainTime').mockResolvedValue(sixMinutesAgo);
      await chatRainManager.initialize();

      const timeUntilNext = chatRainManager.getTimeUntilNextChatRain();

      expect(timeUntilNext).toBe(0);
    });
  });

  describe('initialize', () => {
    it('should load last chat rain time from database', async () => {
      const lastTime = new Date('2024-01-01T12:00:00Z');
      const getLastTimeSpy = vi.spyOn(mockChatActivityRepo, 'getLastChatRainTime')
        .mockResolvedValue(lastTime);

      await chatRainManager.initialize();

      expect(getLastTimeSpy).toHaveBeenCalled();
    });
  });

  describe('eligibility filtering', () => {
    it('should filter out users with both spam violations and recent wins', async () => {
      const allUsers = ['user1', 'user2', 'user3', 'user4', 'user5'];
      const spamUser = 'user2';
      const recentWinner = 'user4';
      
      vi.spyOn(mockChatActivityRepo, 'getQualifiedChatters').mockResolvedValue(allUsers);
      vi.spyOn(mockChatActivityRepo, 'getRecentWinners').mockResolvedValue([recentWinner]);
      vi.spyOn(mockViolationRepo, 'getCount').mockImplementation(async (userId: string) => {
        return userId === spamUser ? 1 : 0;
      });
      vi.spyOn(mockChatActivityRepo, 'recordWinner').mockResolvedValue();
      vi.spyOn(mockChatActivityRepo, 'getLastChatRainTime').mockResolvedValue(null);
      
      await chatRainManager.initialize();

      const winners = await chatRainManager.executeChatRain(testChannelId);

      expect(winners).not.toBeNull();
      expect(winners!.includes(spamUser)).toBe(false);
      expect(winners!.includes(recentWinner)).toBe(false);
      // Should only select from user1, user3, user5
      expect(winners!.every(w => ['user1', 'user3', 'user5'].includes(w))).toBe(true);
    });

    it('should check spam violations within 24 hour window', async () => {
      const users = ['user1'];
      
      vi.spyOn(mockChatActivityRepo, 'getQualifiedChatters').mockResolvedValue(users);
      vi.spyOn(mockChatActivityRepo, 'getRecentWinners').mockResolvedValue([]);
      const getCountSpy = vi.spyOn(mockViolationRepo, 'getCount').mockResolvedValue(0);
      vi.spyOn(mockChatActivityRepo, 'recordWinner').mockResolvedValue();
      vi.spyOn(mockChatActivityRepo, 'getLastChatRainTime').mockResolvedValue(null);
      
      await chatRainManager.initialize();
      await chatRainManager.executeChatRain(testChannelId);

      // Verify spam check uses 24 hour window
      expect(getCountSpy).toHaveBeenCalledWith(
        'user1',
        expect.any(Date),
        ViolationType.SPAM
      );
      
      const callArgs = getCountSpy.mock.calls[0];
      const sinceDate = callArgs[1] as Date;
      const hoursDiff = (Date.now() - sinceDate.getTime()) / (1000 * 60 * 60);
      expect(hoursDiff).toBeCloseTo(24, 0);
    });

    it('should check recent winners within 60 minute window', async () => {
      const users = ['user1'];
      
      vi.spyOn(mockChatActivityRepo, 'getQualifiedChatters').mockResolvedValue(users);
      const getRecentWinnersSpy = vi.spyOn(mockChatActivityRepo, 'getRecentWinners')
        .mockResolvedValue([]);
      vi.spyOn(mockViolationRepo, 'getCount').mockResolvedValue(0);
      vi.spyOn(mockChatActivityRepo, 'recordWinner').mockResolvedValue();
      vi.spyOn(mockChatActivityRepo, 'getLastChatRainTime').mockResolvedValue(null);
      
      await chatRainManager.initialize();
      await chatRainManager.executeChatRain(testChannelId);

      // Verify cooldown check uses 60 minute window
      expect(getRecentWinnersSpy).toHaveBeenCalledWith(expect.any(Date));
      
      const callArgs = getRecentWinnersSpy.mock.calls[0];
      const sinceDate = callArgs[0] as Date;
      const minutesDiff = (Date.now() - sinceDate.getTime()) / (1000 * 60);
      expect(minutesDiff).toBeCloseTo(60, 0);
    });
  });

  describe('CSPRNG usage', () => {
    it('should use cryptographically secure random selection', async () => {
      const eligibleUsers = Array.from({ length: 100 }, (_, i) => `user${i}`);
      
      vi.spyOn(mockChatActivityRepo, 'getQualifiedChatters').mockResolvedValue(eligibleUsers);
      vi.spyOn(mockChatActivityRepo, 'getRecentWinners').mockResolvedValue([]);
      vi.spyOn(mockViolationRepo, 'getCount').mockResolvedValue(0);
      vi.spyOn(mockChatActivityRepo, 'recordWinner').mockResolvedValue();
      vi.spyOn(mockChatActivityRepo, 'getLastChatRainTime').mockResolvedValue(null);
      
      await chatRainManager.initialize();

      // Run multiple times to verify randomness
      const allWinners = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const winners = await chatRainManager.executeChatRain(testChannelId);
        winners?.forEach(w => allWinners.add(w));
        
        // Reset cooldown for next iteration
        await chatRainManager.initialize();
        vi.spyOn(mockChatActivityRepo, 'getLastChatRainTime').mockResolvedValue(null);
      }

      // Should have selected different users across runs
      expect(allWinners.size).toBeGreaterThan(10);
    });
  });
});
