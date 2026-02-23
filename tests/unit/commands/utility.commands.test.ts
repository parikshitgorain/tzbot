/**
 * @file utility.commands.test.ts
 * @description Unit tests for utility commands
 * @module tests/unit/commands
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IDiscordClient } from '../../../src/core/discord/client.js';
import type { Database } from '../../../src/types/interfaces.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { BotConfig } from '../../../src/config/types.js';
import type { User } from '../../../src/types/models.js';

// Mock logger before importing the module
vi.mock('../../../src/core/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  logError: vi.fn(),
}));

// Import after mocking
const { createUtilityCommands } = await import('../../../src/commands/utility.commands.js');

describe('Utility Commands', () => {
  let mockClient: IDiscordClient;
  let mockDatabase: Database;
  let mockConfig: BotConfig;
  let mockInteraction: Partial<ChatInputCommandInteraction>;

  beforeEach(() => {
    // Mock Discord client
    mockClient = {} as IDiscordClient;

    // Mock database
    mockDatabase = {
      getUser: vi.fn().mockResolvedValue(null),
      getUserByKickUsername: vi.fn().mockResolvedValue(null),
      saveUser: vi.fn().mockResolvedValue(undefined),
      clearViolations: vi.fn().mockResolvedValue(undefined),
      deleteAllUserData: vi.fn().mockResolvedValue(undefined),
    } as unknown as Database;

    // Mock config
    mockConfig = {
      guildId: 'test-guild-id',
      clientId: 'test-client-id',
      notificationChannelId: 'notification-channel-id',
      fallbackChannelId: 'fallback-channel-id',
      subscriberRoleId: 'subscriber-role-id',
      vipRoleId: 'vip-role-id',
      moderatorRoleId: 'moderator-role-id',
      readOnlyChannels: ['readonly-channel-1', 'readonly-channel-2'],
      linkScanningEnabled: true,
      aiEnabled: false,
      chatRainEnabled: true,
      spamThreshold: {
        identicalMessages: 5,
        identicalWindow: 10,
        rapidMessages: 10,
        rapidWindow: 5,
      },
    } as BotConfig;

    // Mock interaction
    mockInteraction = {
      user: {
        id: 'user-id',
        username: 'TestUser',
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
      reply: vi.fn().mockResolvedValue(undefined),
      options: {
        getString: vi.fn(),
      },
    } as any; // Cast entire interaction to any to simplify Discord.js type complexity
  });

  describe('/config command', () => {
    it('should display bot configuration', async () => {
      const commands = createUtilityCommands(mockClient, mockDatabase, mockConfig);
      const configCommand = commands.find((cmd) => cmd.name === 'config');

      expect(configCommand).toBeDefined();
      await configCommand!.handler(mockInteraction as ChatInputCommandInteraction);

      // Verify reply was sent with embed
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: '🔧 Bot Configuration',
              }),
            }),
          ]),
          ephemeral: true,
        })
      );
    });

    it('should be moderator-only', () => {
      const commands = createUtilityCommands(mockClient, mockDatabase, mockConfig);
      const configCommand = commands.find((cmd) => cmd.name === 'config');

      expect(configCommand?.moderatorOnly).toBe(true);
    });
  });

  describe('/link command', () => {
    it('should link Discord account to Kick username', async () => {
      mockInteraction.options!.getString = vi.fn().mockReturnValue('test_kick_user');

      const commands = createUtilityCommands(mockClient, mockDatabase, mockConfig);
      const linkCommand = commands.find((cmd) => cmd.name === 'link');

      expect(linkCommand).toBeDefined();
      await linkCommand!.handler(mockInteraction as ChatInputCommandInteraction);

      // Verify user was saved with Kick username
      expect(mockDatabase.saveUser).toHaveBeenCalledWith(
        expect.objectContaining({
          discordId: 'user-id',
          kickUsername: 'test_kick_user',
        })
      );

      // Verify success message was sent
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Successfully linked'),
        })
      );
    });

    it('should prevent linking if already linked', async () => {
      const existingUser: User = {
        discordId: 'user-id',
        kickUsername: 'existing_kick_user',
        roles: [],
        violations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.getUser = vi.fn().mockResolvedValue(existingUser);
      mockInteraction.options!.getString = vi.fn().mockReturnValue('new_kick_user');

      const commands = createUtilityCommands(mockClient, mockDatabase, mockConfig);
      const linkCommand = commands.find((cmd) => cmd.name === 'link');

      await linkCommand!.handler(mockInteraction as ChatInputCommandInteraction);

      // Verify user was not saved
      expect(mockDatabase.saveUser).not.toHaveBeenCalled();

      // Verify error message was sent
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('already linked'),
        })
      );
    });

    it('should prevent linking if Kick username is already taken', async () => {
      const existingKickUser: User = {
        discordId: 'other-user-id',
        kickUsername: 'test_kick_user',
        roles: [],
        violations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.getUserByKickUsername = vi.fn().mockResolvedValue(existingKickUser);
      mockInteraction.options!.getString = vi.fn().mockReturnValue('test_kick_user');

      const commands = createUtilityCommands(mockClient, mockDatabase, mockConfig);
      const linkCommand = commands.find((cmd) => cmd.name === 'link');

      await linkCommand!.handler(mockInteraction as ChatInputCommandInteraction);

      // Verify user was not saved
      expect(mockDatabase.saveUser).not.toHaveBeenCalled();

      // Verify error message was sent
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('already linked to another Discord account'),
        })
      );
    });
  });

  describe('/unlink command', () => {
    it('should unlink Discord account from Kick username', async () => {
      const existingUser: User = {
        discordId: 'user-id',
        kickUsername: 'test_kick_user',
        roles: [],
        violations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.getUser = vi.fn().mockResolvedValue(existingUser);

      const commands = createUtilityCommands(mockClient, mockDatabase, mockConfig);
      const unlinkCommand = commands.find((cmd) => cmd.name === 'unlink');

      expect(unlinkCommand).toBeDefined();
      await unlinkCommand!.handler(mockInteraction as ChatInputCommandInteraction);

      // Verify user was saved without Kick username
      expect(mockDatabase.saveUser).toHaveBeenCalledWith(
        expect.objectContaining({
          discordId: 'user-id',
          kickUsername: undefined,
        })
      );

      // Verify success message was sent
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Successfully unlinked'),
        })
      );
    });

    it('should handle unlink when not linked', async () => {
      mockDatabase.getUser = vi.fn().mockResolvedValue(null);

      const commands = createUtilityCommands(mockClient, mockDatabase, mockConfig);
      const unlinkCommand = commands.find((cmd) => cmd.name === 'unlink');

      await unlinkCommand!.handler(mockInteraction as ChatInputCommandInteraction);

      // Verify user was not saved
      expect(mockDatabase.saveUser).not.toHaveBeenCalled();

      // Verify error message was sent
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('not linked'),
        })
      );
    });
  });

  describe('/checklink command', () => {
    it('should show linked status', async () => {
      const existingUser: User = {
        discordId: 'user-id',
        kickUsername: 'test_kick_user',
        roles: [],
        violations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.getUser = vi.fn().mockResolvedValue(existingUser);

      const commands = createUtilityCommands(mockClient, mockDatabase, mockConfig);
      const checkLinkCommand = commands.find((cmd) => cmd.name === 'checklink');

      expect(checkLinkCommand).toBeDefined();
      await checkLinkCommand!.handler(mockInteraction as ChatInputCommandInteraction);

      // Verify success message was sent
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('linked to Kick username: **test_kick_user**'),
        })
      );
    });

    it('should show not linked status', async () => {
      mockDatabase.getUser = vi.fn().mockResolvedValue(null);

      const commands = createUtilityCommands(mockClient, mockDatabase, mockConfig);
      const checkLinkCommand = commands.find((cmd) => cmd.name === 'checklink');

      await checkLinkCommand!.handler(mockInteraction as ChatInputCommandInteraction);

      // Verify error message was sent
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('not linked'),
        })
      );
    });
  });

  describe('/deletemydata command', () => {
    it('should delete all user data', async () => {
      const existingUser: User = {
        discordId: 'user-id',
        kickUsername: 'test_kick_user',
        roles: [],
        violations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.getUser = vi.fn().mockResolvedValue(existingUser);
      mockDatabase.deleteAllUserData = vi.fn().mockResolvedValue(undefined);

      const commands = createUtilityCommands(mockClient, mockDatabase, mockConfig);
      const deleteMyDataCommand = commands.find((cmd) => cmd.name === 'deletemydata');

      expect(deleteMyDataCommand).toBeDefined();
      await deleteMyDataCommand!.handler(mockInteraction as ChatInputCommandInteraction);

      // Verify deleteAllUserData was called
      expect(mockDatabase.deleteAllUserData).toHaveBeenCalledWith('user-id');

      // Verify success message was sent
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('All your data has been permanently deleted'),
        })
      );
    });

    it('should handle no data found', async () => {
      mockDatabase.getUser = vi.fn().mockResolvedValue(null);

      const commands = createUtilityCommands(mockClient, mockDatabase, mockConfig);
      const deleteMyDataCommand = commands.find((cmd) => cmd.name === 'deletemydata');

      await deleteMyDataCommand!.handler(mockInteraction as ChatInputCommandInteraction);

      // Verify no operations were performed
      expect(mockDatabase.clearViolations).not.toHaveBeenCalled();
      expect(mockDatabase.saveUser).not.toHaveBeenCalled();

      // Verify message was sent
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('No data found'),
        })
      );
    });
  });

  describe('Command properties', () => {
    it('should return all seven utility commands', () => {
      const commands = createUtilityCommands(mockClient, mockDatabase, mockConfig);

      expect(commands).toHaveLength(7);
      expect(commands.map((cmd) => cmd.name)).toEqual([
        'config',
        'setup',
        'userinfo',
        'link',
        'unlink',
        'checklink',
        'deletemydata',
      ]);
    });
  });
});
