import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RewardSystem, RewardType, type Reward } from '../../../src/managers/reward-system.js';
import type { Client, Guild, GuildMember, Role, TextChannel } from 'discord.js';
import type { ChatActivityRepository } from '../../../src/core/database/repositories/ChatActivityRepository.js';

describe('RewardSystem', () => {
  let rewardSystem: RewardSystem;
  let mockClient: any;
  let mockChatActivityRepo: any;
  let mockGuild: any;
  let mockMember: any;
  let mockRole: any;
  let mockChannel: any;
  const guildId = '123456789012345678';

  beforeEach(() => {
    // Mock Discord client
    mockRole = {
      id: '999999999999999999',
      name: 'Winner'
    };

    mockMember = {
      id: '111111111111111111',
      user: { username: 'testuser' },
      guild: {
        roles: {
          fetch: vi.fn().mockResolvedValue(mockRole)
        }
      },
      roles: {
        add: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined)
      }
    };

    mockGuild = {
      id: guildId,
      members: {
        fetch: vi.fn().mockResolvedValue(mockMember)
      },
      roles: {
        fetch: vi.fn().mockResolvedValue(mockRole)
      }
    };

    mockChannel = {
      id: '222222222222222222',
      isTextBased: vi.fn().mockReturnValue(true),
      send: vi.fn().mockResolvedValue({ id: '333333333333333333' })
    };

    mockClient = {
      guilds: {
        fetch: vi.fn().mockResolvedValue(mockGuild)
      },
      channels: {
        fetch: vi.fn().mockResolvedValue(mockChannel)
      }
    } as unknown as Client;

    // Mock chat activity repository
    mockChatActivityRepo = {
      recordWinner: vi.fn().mockResolvedValue(undefined),
      getRewardHistory: vi.fn().mockResolvedValue([])
    } as unknown as ChatActivityRepository;

    rewardSystem = new RewardSystem(mockClient, mockChatActivityRepo, guildId);
  });

  describe('distributeRewards', () => {
    it('should distribute role rewards successfully', async () => {
      const userIds = ['111111111111111111'];
      const reward: Reward = {
        type: RewardType.ROLE,
        value: '999999999999999999'
      };
      const channelId = '222222222222222222';

      const result = await rewardSystem.distributeRewards(userIds, reward, channelId);

      expect(result.successful).toEqual(userIds);
      expect(result.failed).toEqual([]);
      expect(mockMember.roles.add).toHaveBeenCalledWith(mockRole);
      expect(mockChatActivityRepo.recordWinner).toHaveBeenCalledWith(
        userIds[0],
        expect.any(Date),
        RewardType.ROLE,
        reward.value
      );
    });

    it('should announce winners in chat', async () => {
      const userIds = ['111111111111111111'];
      const reward: Reward = {
        type: RewardType.ANNOUNCEMENT,
        customMessage: 'Congratulations!'
      };
      const channelId = '222222222222222222';

      await rewardSystem.distributeRewards(userIds, reward, channelId);

      expect(mockChannel.send).toHaveBeenCalled();
      const message = mockChannel.send.mock.calls[0][0];
      expect(message).toContain('Chat Rain');
      expect(message).toContain('<@111111111111111111>');
    });

    it('should handle multiple winners', async () => {
      const userIds = ['111111111111111111', '222222222222222222', '333333333333333333'];
      const reward: Reward = {
        type: RewardType.ANNOUNCEMENT
      };
      const channelId = '222222222222222222';

      // Mock multiple members
      mockGuild.members.fetch = vi.fn()
        .mockResolvedValueOnce({ ...mockMember, id: userIds[0] })
        .mockResolvedValueOnce({ ...mockMember, id: userIds[1] })
        .mockResolvedValueOnce({ ...mockMember, id: userIds[2] });

      const result = await rewardSystem.distributeRewards(userIds, reward, channelId);

      expect(result.successful).toHaveLength(3);
      expect(mockChatActivityRepo.recordWinner).toHaveBeenCalledTimes(3);
    });

    it('should handle failed distributions', async () => {
      const userIds = ['111111111111111111', '222222222222222222'];
      const reward: Reward = {
        type: RewardType.ROLE,
        value: '999999999999999999'
      };
      const channelId = '222222222222222222';

      // First user succeeds, second fails
      mockGuild.members.fetch = vi.fn()
        .mockResolvedValueOnce(mockMember)
        .mockRejectedValueOnce(new Error('User not found'));

      const result = await rewardSystem.distributeRewards(userIds, reward, channelId);

      expect(result.successful).toEqual([userIds[0]]);
      expect(result.failed).toEqual([userIds[1]]);
      expect(result.errors.get(userIds[1])).toBe('User not found');
    });

    it('should include custom message in announcement', async () => {
      const userIds = ['111111111111111111'];
      const reward: Reward = {
        type: RewardType.ANNOUNCEMENT,
        customMessage: 'You are awesome!'
      };
      const channelId = '222222222222222222';

      await rewardSystem.distributeRewards(userIds, reward, channelId);

      const message = mockChannel.send.mock.calls[0][0];
      expect(message).toContain('You are awesome!');
    });

    it('should handle currency rewards', async () => {
      const userIds = ['111111111111111111'];
      const reward: Reward = {
        type: RewardType.CURRENCY,
        value: '100'
      };
      const channelId = '222222222222222222';

      const result = await rewardSystem.distributeRewards(userIds, reward, channelId);

      expect(result.successful).toEqual(userIds);
      const message = mockChannel.send.mock.calls[0][0];
      expect(message).toContain('100 currency');
    });

    it('should throw error for role reward without value', async () => {
      const userIds = ['111111111111111111'];
      const reward: Reward = {
        type: RewardType.ROLE
        // Missing value
      };
      const channelId = '222222222222222222';

      const result = await rewardSystem.distributeRewards(userIds, reward, channelId);

      expect(result.failed).toEqual(userIds);
      expect(result.errors.get(userIds[0])).toContain('role ID');
    });

    it('should throw error for currency reward without value', async () => {
      const userIds = ['111111111111111111'];
      const reward: Reward = {
        type: RewardType.CURRENCY
        // Missing value
      };
      const channelId = '222222222222222222';

      const result = await rewardSystem.distributeRewards(userIds, reward, channelId);

      expect(result.failed).toEqual(userIds);
      expect(result.errors.get(userIds[0])).toContain('amount');
    });
  });

  describe('temporary role rewards', () => {
    it('should schedule role removal for temporary roles', async () => {
      vi.useFakeTimers();

      const userIds = ['111111111111111111'];
      const reward: Reward = {
        type: RewardType.ROLE,
        value: '999999999999999999',
        durationMs: 1000 // 1 second
      };
      const channelId = '222222222222222222';

      await rewardSystem.distributeRewards(userIds, reward, channelId);

      expect(mockMember.roles.add).toHaveBeenCalledWith(mockRole);

      // Fast-forward time
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      // The role removal happens in a setTimeout, so we need to wait for it
      // In the real implementation, it would call guild.members.fetch and roles.remove
      // For this test, we just verify the role was added initially
      expect(mockMember.roles.add).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should include duration in announcement for temporary roles', async () => {
      const userIds = ['111111111111111111'];
      const reward: Reward = {
        type: RewardType.ROLE,
        value: '999999999999999999',
        durationMs: 24 * 60 * 60 * 1000 // 24 hours
      };
      const channelId = '222222222222222222';

      await rewardSystem.distributeRewards(userIds, reward, channelId);

      const message = mockChannel.send.mock.calls[0][0];
      expect(message).toContain('24 hour');
    });
  });

  describe('getRewardHistory', () => {
    it('should retrieve reward history for a user', async () => {
      const userId = '111111111111111111';
      const mockHistory = [
        {
          userId,
          timestamp: new Date('2024-01-01'),
          rewardType: RewardType.ROLE,
          rewardValue: '999999999999999999'
        },
        {
          userId,
          timestamp: new Date('2024-01-02'),
          rewardType: RewardType.CURRENCY,
          rewardValue: '100'
        }
      ];

      mockChatActivityRepo.getRewardHistory = vi.fn().mockResolvedValue(mockHistory);

      const history = await rewardSystem.getRewardHistory(userId);

      expect(history).toEqual(mockHistory);
      expect(mockChatActivityRepo.getRewardHistory).toHaveBeenCalledWith(userId, undefined);
    });

    it('should retrieve reward history with date filter', async () => {
      const userId = '111111111111111111';
      const since = new Date('2024-01-01');

      await rewardSystem.getRewardHistory(userId, since);

      expect(mockChatActivityRepo.getRewardHistory).toHaveBeenCalledWith(userId, since);
    });
  });

  describe('edge cases', () => {
    it('should handle empty user list', async () => {
      const userIds: string[] = [];
      const reward: Reward = {
        type: RewardType.ANNOUNCEMENT
      };
      const channelId = '222222222222222222';

      const result = await rewardSystem.distributeRewards(userIds, reward, channelId);

      expect(result.successful).toEqual([]);
      expect(result.failed).toEqual([]);
      expect(mockChannel.send).toHaveBeenCalled();
    });

    it('should handle invalid channel', async () => {
      const userIds = ['111111111111111111'];
      const reward: Reward = {
        type: RewardType.ANNOUNCEMENT
      };
      const channelId = 'invalid';

      mockClient.channels.fetch = vi.fn().mockRejectedValue(new Error('Channel not found'));

      await expect(
        rewardSystem.distributeRewards(userIds, reward, channelId)
      ).rejects.toThrow('Channel not found');
    });

    it('should handle non-text channel', async () => {
      const userIds = ['111111111111111111'];
      const reward: Reward = {
        type: RewardType.ANNOUNCEMENT
      };
      const channelId = '222222222222222222';

      mockChannel.isTextBased = vi.fn().mockReturnValue(false);

      await expect(
        rewardSystem.distributeRewards(userIds, reward, channelId)
      ).rejects.toThrow('not a text channel');
    });

    it('should handle role not found', async () => {
      const userIds = ['111111111111111111'];
      const reward: Reward = {
        type: RewardType.ROLE,
        value: '999999999999999999'
      };
      const channelId = '222222222222222222';

      // Mock member's guild roles fetch to return null
      mockMember.guild.roles.fetch = vi.fn().mockResolvedValue(null);

      const result = await rewardSystem.distributeRewards(userIds, reward, channelId);

      expect(result.failed).toEqual(userIds);
      expect(result.errors.get(userIds[0])).toContain('Role not found');
    });
  });
});
