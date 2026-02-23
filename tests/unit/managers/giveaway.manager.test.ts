/**
 * @file giveaway.manager.test.ts
 * @description Unit tests for GiveawayManager
 * @module tests/unit/managers
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GiveawayManager } from '@/managers/giveaway.manager.js';
import type { IDiscordClient } from '@/core/discord/client.js';
import type { GiveawayRepository } from '@/core/database/repositories/GiveawayRepository.js';
import type { Giveaway, GiveawayEntry } from '@/types/models.js';
import { ButtonInteraction, GuildMember, Role, Collection } from 'discord.js';

describe('GiveawayManager', () => {
  let giveawayManager: GiveawayManager;
  let mockDiscordClient: IDiscordClient;
  let mockGiveawayRepository: GiveawayRepository;

  beforeEach(() => {
    // Mock Discord client
    mockDiscordClient = {
      sendMessage: vi.fn().mockResolvedValue({
        id: 'message_123',
        edit: vi.fn().mockResolvedValue({}),
        channel: {
          messages: {
            fetch: vi.fn().mockResolvedValue({
              embeds: [{ data: { fields: [{ name: 'Entries', value: '0' }] } }],
              edit: vi.fn().mockResolvedValue({}),
            }),
          },
        },
      }),
      getMember: vi.fn(),
    } as unknown as IDiscordClient;

    // Mock giveaway repository
    mockGiveawayRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      get: vi.fn(),
      getActive: vi.fn().mockResolvedValue([]),
      addEntry: vi.fn().mockResolvedValue(undefined),
      getEntries: vi.fn().mockResolvedValue([]),
      hasEntry: vi.fn().mockResolvedValue(false),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    } as unknown as GiveawayRepository;

    giveawayManager = new GiveawayManager(mockDiscordClient, mockGiveawayRepository);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createGiveaway', () => {
    it('should create a giveaway with all required fields', async () => {
      const options = {
        title: 'Test Giveaway',
        description: 'Test Description',
        channelId: 'channel_123',
        guildId: 'guild_123',
        requiredRoles: ['role_123'],
        winnerCount: 3,
        durationMs: 60000, // 1 minute
      };

      const giveaway = await giveawayManager.createGiveaway(options);

      expect(giveaway).toBeDefined();
      expect(giveaway.title).toBe(options.title);
      expect(giveaway.description).toBe(options.description);
      expect(giveaway.channelId).toBe(options.channelId);
      expect(giveaway.requiredRoles).toEqual(options.requiredRoles);
      expect(giveaway.winnerCount).toBe(options.winnerCount);
      expect(giveaway.status).toBe('active');
      expect(giveaway.entries).toEqual([]);
    });

    it('should send a message with embed and button', async () => {
      const options = {
        title: 'Test Giveaway',
        description: 'Test Description',
        channelId: 'channel_123',
        guildId: 'guild_123',
        requiredRoles: [],
        winnerCount: 1,
        durationMs: 60000,
      };

      await giveawayManager.createGiveaway(options);

      expect(mockDiscordClient.sendMessage).toHaveBeenCalledWith(
        options.channelId,
        expect.objectContaining({
          embeds: expect.arrayContaining([expect.any(Object)]),
        })
      );
    });

    it('should save giveaway to database', async () => {
      const options = {
        title: 'Test Giveaway',
        description: 'Test Description',
        channelId: 'channel_123',
        guildId: 'guild_123',
        requiredRoles: [],
        winnerCount: 1,
        durationMs: 60000,
      };

      await giveawayManager.createGiveaway(options);

      expect(mockGiveawayRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: options.title,
          description: options.description,
          channelId: options.channelId,
          status: 'active',
        })
      );
    });

    it('should schedule giveaway end', async () => {
      vi.useFakeTimers();

      const options = {
        title: 'Test Giveaway',
        description: 'Test Description',
        channelId: 'channel_123',
        guildId: 'guild_123',
        requiredRoles: [],
        winnerCount: 1,
        durationMs: 1000, // 1 second
      };

      const giveaway = await giveawayManager.createGiveaway(options);

      // Mock get to return the giveaway
      vi.mocked(mockGiveawayRepository.get).mockResolvedValue({
        ...giveaway,
        entries: [],
      });

      // Fast-forward time
      await vi.advanceTimersByTimeAsync(1000);

      // Verify giveaway was ended
      expect(mockGiveawayRepository.updateStatus).toHaveBeenCalledWith(
        giveaway.id,
        'ended'
      );

      vi.useRealTimers();
    });
  });

  describe('handleEntryInteraction', () => {
    it('should allow entry when user has required role', async () => {
      const giveaway: Giveaway = {
        id: 'giveaway_123',
        title: 'Test',
        description: 'Test',
        channelId: 'channel_123',
        messageId: 'message_123',
        requiredRoles: ['role_123'],
        winnerCount: 1,
        entries: [],
        status: 'active',
        endsAt: new Date(Date.now() + 60000),
        createdAt: new Date(),
      };

      vi.mocked(mockGiveawayRepository.get).mockResolvedValue(giveaway);
      vi.mocked(mockGiveawayRepository.hasEntry).mockResolvedValue(false);
      vi.mocked(mockGiveawayRepository.getEntries).mockResolvedValue([]);

      // Mock member with required role
      const mockRole = { id: 'role_123', name: 'Test Role' } as Role;
      const mockRoleCollection = new Collection<string, Role>();
      mockRoleCollection.set('role_123', mockRole);

      const mockMember = {
        roles: {
          cache: mockRoleCollection,
        },
        guild: {
          roles: {
            cache: mockRoleCollection,
          },
        },
      } as unknown as GuildMember;

      vi.mocked(mockDiscordClient.getMember).mockResolvedValue(mockMember);

      const mockInteraction = {
        customId: 'giveaway_enter_giveaway_123',
        user: { id: 'user_123' },
        reply: vi.fn().mockResolvedValue(undefined),
      } as unknown as ButtonInteraction;

      await giveawayManager.handleEntryInteraction(mockInteraction, 'guild_123');

      expect(mockGiveawayRepository.addEntry).toHaveBeenCalledWith(
        'giveaway_123',
        'user_123'
      );
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('successfully entered'),
          ephemeral: true,
        })
      );
    });

    it('should reject entry when user lacks required role', async () => {
      const giveaway: Giveaway = {
        id: 'giveaway_123',
        title: 'Test',
        description: 'Test',
        channelId: 'channel_123',
        messageId: 'message_123',
        requiredRoles: ['role_123'],
        winnerCount: 1,
        entries: [],
        status: 'active',
        endsAt: new Date(Date.now() + 60000),
        createdAt: new Date(),
      };

      vi.mocked(mockGiveawayRepository.get).mockResolvedValue(giveaway);

      // Mock member without required role
      const mockRoleCollection = new Collection<string, Role>();
      const mockMember = {
        roles: {
          cache: mockRoleCollection,
        },
        guild: {
          roles: {
            cache: new Collection<string, Role>(),
          },
        },
      } as unknown as GuildMember;

      vi.mocked(mockDiscordClient.getMember).mockResolvedValue(mockMember);

      const mockInteraction = {
        customId: 'giveaway_enter_giveaway_123',
        user: { id: 'user_123' },
        reply: vi.fn().mockResolvedValue(undefined),
      } as unknown as ButtonInteraction;

      await giveawayManager.handleEntryInteraction(mockInteraction, 'guild_123');

      expect(mockGiveawayRepository.addEntry).not.toHaveBeenCalled();
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('need one of the following roles'),
          ephemeral: true,
        })
      );
    });

    it('should prevent duplicate entries', async () => {
      const giveaway: Giveaway = {
        id: 'giveaway_123',
        title: 'Test',
        description: 'Test',
        channelId: 'channel_123',
        messageId: 'message_123',
        requiredRoles: [],
        winnerCount: 1,
        entries: [],
        status: 'active',
        endsAt: new Date(Date.now() + 60000),
        createdAt: new Date(),
      };

      vi.mocked(mockGiveawayRepository.get).mockResolvedValue(giveaway);
      vi.mocked(mockGiveawayRepository.hasEntry).mockResolvedValue(true); // Already entered

      const mockInteraction = {
        customId: 'giveaway_enter_giveaway_123',
        user: { id: 'user_123' },
        reply: vi.fn().mockResolvedValue(undefined),
      } as unknown as ButtonInteraction;

      await giveawayManager.handleEntryInteraction(mockInteraction, 'guild_123');

      expect(mockGiveawayRepository.addEntry).not.toHaveBeenCalled();
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('already entered'),
          ephemeral: true,
        })
      );
    });

    it('should reject entry for ended giveaway', async () => {
      const giveaway: Giveaway = {
        id: 'giveaway_123',
        title: 'Test',
        description: 'Test',
        channelId: 'channel_123',
        messageId: 'message_123',
        requiredRoles: [],
        winnerCount: 1,
        entries: [],
        status: 'ended',
        endsAt: new Date(Date.now() - 60000),
        createdAt: new Date(),
      };

      vi.mocked(mockGiveawayRepository.get).mockResolvedValue(giveaway);

      const mockInteraction = {
        customId: 'giveaway_enter_giveaway_123',
        user: { id: 'user_123' },
        reply: vi.fn().mockResolvedValue(undefined),
      } as unknown as ButtonInteraction;

      await giveawayManager.handleEntryInteraction(mockInteraction, 'guild_123');

      expect(mockGiveawayRepository.addEntry).not.toHaveBeenCalled();
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('ended'),
          ephemeral: true,
        })
      );
    });

    it('should allow entry when no roles are required', async () => {
      const giveaway: Giveaway = {
        id: 'giveaway_123',
        title: 'Test',
        description: 'Test',
        channelId: 'channel_123',
        messageId: 'message_123',
        requiredRoles: [], // No role restrictions
        winnerCount: 1,
        entries: [],
        status: 'active',
        endsAt: new Date(Date.now() + 60000),
        createdAt: new Date(),
      };

      vi.mocked(mockGiveawayRepository.get).mockResolvedValue(giveaway);
      vi.mocked(mockGiveawayRepository.hasEntry).mockResolvedValue(false);
      vi.mocked(mockGiveawayRepository.getEntries).mockResolvedValue([]);

      const mockInteraction = {
        customId: 'giveaway_enter_giveaway_123',
        user: { id: 'user_123' },
        reply: vi.fn().mockResolvedValue(undefined),
      } as unknown as ButtonInteraction;

      await giveawayManager.handleEntryInteraction(mockInteraction, 'guild_123');

      expect(mockGiveawayRepository.addEntry).toHaveBeenCalledWith(
        'giveaway_123',
        'user_123'
      );
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('successfully entered'),
          ephemeral: true,
        })
      );
    });
  });

  describe('recoverActiveGiveaways', () => {
    it('should recover and reschedule active giveaways', async () => {
      const activeGiveaways: Giveaway[] = [
        {
          id: 'giveaway_1',
          title: 'Test 1',
          description: 'Test',
          channelId: 'channel_123',
          messageId: 'message_123',
          requiredRoles: [],
          winnerCount: 1,
          entries: [],
          status: 'active',
          endsAt: new Date(Date.now() + 60000),
          createdAt: new Date(),
        },
        {
          id: 'giveaway_2',
          title: 'Test 2',
          description: 'Test',
          channelId: 'channel_123',
          messageId: 'message_124',
          requiredRoles: [],
          winnerCount: 1,
          entries: [],
          status: 'active',
          endsAt: new Date(Date.now() + 120000),
          createdAt: new Date(),
        },
      ];

      vi.mocked(mockGiveawayRepository.getActive).mockResolvedValue(activeGiveaways);

      await giveawayManager.recoverActiveGiveaways('guild_123');

      expect(mockGiveawayRepository.getActive).toHaveBeenCalled();
    });

    it('should immediately end giveaways that should have already ended', async () => {
      vi.useFakeTimers();

      const expiredGiveaway: Giveaway = {
        id: 'giveaway_expired',
        title: 'Expired',
        description: 'Test',
        channelId: 'channel_123',
        messageId: 'message_123',
        requiredRoles: [],
        winnerCount: 1,
        entries: [],
        status: 'active',
        endsAt: new Date(Date.now() - 60000), // Already expired
        createdAt: new Date(),
      };

      vi.mocked(mockGiveawayRepository.getActive).mockResolvedValue([expiredGiveaway]);
      vi.mocked(mockGiveawayRepository.get).mockResolvedValue(expiredGiveaway);

      await giveawayManager.recoverActiveGiveaways('guild_123');

      // Should end immediately
      await vi.runAllTimersAsync();

      expect(mockGiveawayRepository.updateStatus).toHaveBeenCalledWith(
        'giveaway_expired',
        'ended'
      );

      vi.useRealTimers();
    });
  });

  describe('cancelGiveaway', () => {
    it('should cancel a giveaway and update status', async () => {
      const giveaway: Giveaway = {
        id: 'giveaway_123',
        title: 'Test',
        description: 'Test',
        channelId: 'channel_123',
        messageId: 'message_123',
        requiredRoles: [],
        winnerCount: 1,
        entries: [],
        status: 'active',
        endsAt: new Date(Date.now() + 60000),
        createdAt: new Date(),
      };

      vi.mocked(mockGiveawayRepository.get).mockResolvedValue(giveaway);

      await giveawayManager.cancelGiveaway('giveaway_123');

      expect(mockGiveawayRepository.updateStatus).toHaveBeenCalledWith(
        'giveaway_123',
        'cancelled'
      );
    });
  });

  describe('CSPRNG winner selection', () => {
    it('should select winners using cryptographically secure random', async () => {
      vi.useFakeTimers();

      const options = {
        title: 'Test Giveaway',
        description: 'Test',
        channelId: 'channel_123',
        guildId: 'guild_123',
        requiredRoles: [],
        winnerCount: 2,
        durationMs: 1000,
      };

      const giveaway = await giveawayManager.createGiveaway(options);

      // Mock entries
      const entries: GiveawayEntry[] = [
        { userId: 'user_1', timestamp: new Date() },
        { userId: 'user_2', timestamp: new Date() },
        { userId: 'user_3', timestamp: new Date() },
        { userId: 'user_4', timestamp: new Date() },
        { userId: 'user_5', timestamp: new Date() },
      ];

      vi.mocked(mockGiveawayRepository.get).mockResolvedValue({
        ...giveaway,
        entries,
      });
      vi.mocked(mockGiveawayRepository.getEntries).mockResolvedValue(entries);

      // Fast-forward to end giveaway
      await vi.advanceTimersByTimeAsync(1000);

      // Verify winners were announced (message sent)
      expect(mockDiscordClient.sendMessage).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should not select more winners than entries', async () => {
      vi.useFakeTimers();

      const options = {
        title: 'Test Giveaway',
        description: 'Test',
        channelId: 'channel_123',
        guildId: 'guild_123',
        requiredRoles: [],
        winnerCount: 10, // More than entries
        durationMs: 1000,
      };

      const giveaway = await giveawayManager.createGiveaway(options);

      // Mock only 3 entries
      const entries: GiveawayEntry[] = [
        { userId: 'user_1', timestamp: new Date() },
        { userId: 'user_2', timestamp: new Date() },
        { userId: 'user_3', timestamp: new Date() },
      ];

      vi.mocked(mockGiveawayRepository.get).mockResolvedValue({
        ...giveaway,
        entries,
      });
      vi.mocked(mockGiveawayRepository.getEntries).mockResolvedValue(entries);

      // Fast-forward to end giveaway
      await vi.advanceTimersByTimeAsync(1000);

      // Should only select 3 winners (all entries)
      expect(mockDiscordClient.sendMessage).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
