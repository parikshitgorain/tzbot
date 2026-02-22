/**
 * @file command.manager.test.ts
 * @description Unit tests for CommandManager
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  CommandManager,
  type CommandDefinition,
  type CommandCooldown,
} from '@/managers/command.manager.js';
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { IDiscordClient } from '@/core/discord/client.js';
import type { BotConfig } from '@/config/types.js';

// Mock logger before importing CommandManager
vi.mock('@/core/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  logError: vi.fn(),
}));

// Mock Discord client
const mockClient: IDiscordClient = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  isConnected: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  sendMessage: vi.fn(),
  deleteMessage: vi.fn(),
  banUser: vi.fn(),
  kickUser: vi.fn(),
  timeoutUser: vi.fn(),
  addRole: vi.fn(),
  removeRole: vi.fn(),
  getGuild: vi.fn(),
  getMember: vi.fn(),
};

// Mock config
const mockConfig: BotConfig = {
  discordToken: 'test-token',
  guildId: '123456789',
  moderatorRoleId: 'mod-role-id',
  maxMessagesPerSecond: 100,
} as BotConfig;

// Mock command interaction
const createMockInteraction = (overrides: any = {}) => ({
  isChatInputCommand: () => true,
  commandName: 'test',
  user: {
    id: 'user-123',
    username: 'testuser',
  },
  guild: {
    id: '123456789',
  },
  guildId: '123456789',
  member: {
    permissions: {
      has: vi.fn().mockReturnValue(true),
    },
    roles: {
      cache: new Map(),
    },
  },
  reply: vi.fn().mockResolvedValue(undefined),
  followUp: vi.fn().mockResolvedValue(undefined),
  replied: false,
  deferred: false,
  ...overrides,
});

describe('CommandManager', () => {
  let commandManager: CommandManager;

  beforeEach(() => {
    vi.clearAllMocks();
    commandManager = new CommandManager(mockClient, mockConfig);
  });

  afterEach(() => {
    commandManager.destroy();
  });

  describe('registerCommand', () => {
    it('should register a command successfully', () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        builder: new SlashCommandBuilder()
          .setName('test')
          .setDescription('Test command'),
        handler: vi.fn(),
      };

      commandManager.registerCommand(command);

      const registered = commandManager.getCommand('test');
      expect(registered).toBeDefined();
      expect(registered?.name).toBe('test');
      expect(registered?.description).toBe('Test command');
    });

    it('should overwrite existing command with warning', () => {
      const command1: CommandDefinition = {
        name: 'test',
        description: 'First command',
        builder: new SlashCommandBuilder()
          .setName('test')
          .setDescription('First command'),
        handler: vi.fn(),
      };

      const command2: CommandDefinition = {
        name: 'test',
        description: 'Second command',
        builder: new SlashCommandBuilder()
          .setName('test')
          .setDescription('Second command'),
        handler: vi.fn(),
      };

      commandManager.registerCommand(command1);
      commandManager.registerCommand(command2);

      const registered = commandManager.getCommand('test');
      expect(registered?.description).toBe('Second command');
    });
  });

  describe('registerCommands', () => {
    it('should register multiple commands', () => {
      const commands: CommandDefinition[] = [
        {
          name: 'test1',
          description: 'Test command 1',
          builder: new SlashCommandBuilder()
            .setName('test1')
            .setDescription('Test command 1'),
          handler: vi.fn(),
        },
        {
          name: 'test2',
          description: 'Test command 2',
          builder: new SlashCommandBuilder()
            .setName('test2')
            .setDescription('Test command 2'),
          handler: vi.fn(),
        },
      ];

      commandManager.registerCommands(commands);

      expect(commandManager.getCommand('test1')).toBeDefined();
      expect(commandManager.getCommand('test2')).toBeDefined();
      expect(commandManager.getAllCommands()).toHaveLength(2);
    });
  });

  describe('handleInteraction', () => {
    it('should execute command handler for valid command', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        builder: new SlashCommandBuilder()
          .setName('test')
          .setDescription('Test command'),
        handler,
      };

      commandManager.registerCommand(command);

      const interaction = createMockInteraction();
      await commandManager.handleInteraction(interaction);

      expect(handler).toHaveBeenCalledWith(interaction);
    });

    it('should reply with error for unknown command', async () => {
      const interaction = createMockInteraction({
        commandName: 'unknown',
      });

      await commandManager.handleInteraction(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: 'Unknown command.',
        ephemeral: true,
      });
    });

    it('should enforce moderator-only restriction', async () => {
      const handler = vi.fn();
      const command: CommandDefinition = {
        name: 'modonly',
        description: 'Moderator only command',
        builder: new SlashCommandBuilder()
          .setName('modonly')
          .setDescription('Moderator only command'),
        handler,
        moderatorOnly: true,
      };

      commandManager.registerCommand(command);

      const interaction = createMockInteraction({
        commandName: 'modonly',
        member: {
          permissions: {
            has: vi.fn().mockReturnValue(false),
          },
          roles: {
            cache: new Map(),
          },
        },
      });

      await commandManager.handleInteraction(interaction);

      expect(handler).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith({
        content: 'This command is only available to moderators.',
        ephemeral: true,
      });
    });

    it('should allow moderators to use moderator-only commands', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const command: CommandDefinition = {
        name: 'modonly',
        description: 'Moderator only command',
        builder: new SlashCommandBuilder()
          .setName('modonly')
          .setDescription('Moderator only command'),
        handler,
        moderatorOnly: true,
      };

      commandManager.registerCommand(command);

      const interaction = createMockInteraction({
        commandName: 'modonly',
        member: {
          permissions: {
            has: vi.fn().mockReturnValue(true),
          },
          roles: {
            cache: new Map([['mod-role-id', {}]]),
          },
        },
      });

      await commandManager.handleInteraction(interaction);

      expect(handler).toHaveBeenCalledWith(interaction);
    });

    it('should handle command execution errors gracefully', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Command failed'));
      const command: CommandDefinition = {
        name: 'failing',
        description: 'Failing command',
        builder: new SlashCommandBuilder()
          .setName('failing')
          .setDescription('Failing command'),
        handler,
      };

      commandManager.registerCommand(command);

      const interaction = createMockInteraction({
        commandName: 'failing',
      });

      await commandManager.handleInteraction(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: 'An error occurred while executing this command.',
        ephemeral: true,
      });
    });
  });

  describe('validatePermissions', () => {
    it('should return true when user has all required permissions', () => {
      const interaction = createMockInteraction({
        member: {
          permissions: {
            has: vi.fn().mockReturnValue(true),
          },
        },
      });

      const result = commandManager.validatePermissions(interaction, [
        PermissionFlagsBits.ManageMessages,
      ]);

      expect(result).toBe(true);
    });

    it('should return false when user lacks required permissions', () => {
      const interaction = createMockInteraction({
        member: {
          permissions: {
            has: vi.fn().mockReturnValue(false),
          },
        },
      });

      const result = commandManager.validatePermissions(interaction, [
        PermissionFlagsBits.ManageMessages,
      ]);

      expect(result).toBe(false);
    });

    it('should return false when interaction has no guild', () => {
      const interaction = createMockInteraction({
        guild: null,
      });

      const result = commandManager.validatePermissions(interaction, [
        PermissionFlagsBits.ManageMessages,
      ]);

      expect(result).toBe(false);
    });
  });

  describe('cooldown management', () => {
    it('should enforce per-user cooldowns', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const cooldown: CommandCooldown = {
        duration: 5000, // 5 seconds
        perUser: true,
      };

      const command: CommandDefinition = {
        name: 'cooldown',
        description: 'Command with cooldown',
        builder: new SlashCommandBuilder()
          .setName('cooldown')
          .setDescription('Command with cooldown'),
        handler,
        cooldown,
      };

      commandManager.registerCommand(command);

      const interaction = createMockInteraction({
        commandName: 'cooldown',
      });

      // First execution should succeed
      await commandManager.handleInteraction(interaction);
      expect(handler).toHaveBeenCalledTimes(1);

      // Second execution should be blocked by cooldown
      await commandManager.handleInteraction(interaction);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('on cooldown'),
          ephemeral: true,
        })
      );
    });

    it('should allow different users to bypass per-user cooldowns', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const cooldown: CommandCooldown = {
        duration: 5000,
        perUser: true,
      };

      const command: CommandDefinition = {
        name: 'cooldown',
        description: 'Command with cooldown',
        builder: new SlashCommandBuilder()
          .setName('cooldown')
          .setDescription('Command with cooldown'),
        handler,
        cooldown,
      };

      commandManager.registerCommand(command);

      const interaction1 = createMockInteraction({
        commandName: 'cooldown',
        user: { id: 'user-1', username: 'user1' },
      });

      const interaction2 = createMockInteraction({
        commandName: 'cooldown',
        user: { id: 'user-2', username: 'user2' },
      });

      // Both users should be able to execute
      await commandManager.handleInteraction(interaction1);
      await commandManager.handleInteraction(interaction2);

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should check cooldown correctly', () => {
      const cooldown: CommandCooldown = {
        duration: 5000,
        perUser: true,
      };

      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        builder: new SlashCommandBuilder()
          .setName('test')
          .setDescription('Test command'),
        handler: vi.fn(),
        cooldown,
      };

      commandManager.registerCommand(command);

      // No cooldown initially
      expect(commandManager.checkCooldown('test', 'user-123')).toBe(false);

      // Set cooldown
      commandManager.setCooldown('test', 'user-123', 5000);

      // Should be on cooldown
      expect(commandManager.checkCooldown('test', 'user-123')).toBe(true);
    });

    it('should clear cooldown for specific user', () => {
      const cooldown: CommandCooldown = {
        duration: 5000,
        perUser: true,
      };

      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        builder: new SlashCommandBuilder()
          .setName('test')
          .setDescription('Test command'),
        handler: vi.fn(),
        cooldown,
      };

      commandManager.registerCommand(command);

      // Set cooldown
      commandManager.setCooldown('test', 'user-123', 5000);
      expect(commandManager.checkCooldown('test', 'user-123')).toBe(true);

      // Clear cooldown
      commandManager.clearCooldown('test', 'user-123');
      expect(commandManager.checkCooldown('test', 'user-123')).toBe(false);
    });

    it('should clear all cooldowns for a command', () => {
      const cooldown: CommandCooldown = {
        duration: 5000,
        perUser: true,
      };

      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        builder: new SlashCommandBuilder()
          .setName('test')
          .setDescription('Test command'),
        handler: vi.fn(),
        cooldown,
      };

      commandManager.registerCommand(command);

      // Set cooldowns for multiple users
      commandManager.setCooldown('test', 'user-1', 5000);
      commandManager.setCooldown('test', 'user-2', 5000);

      expect(commandManager.checkCooldown('test', 'user-1')).toBe(true);
      expect(commandManager.checkCooldown('test', 'user-2')).toBe(true);

      // Clear all cooldowns
      commandManager.clearCooldown('test');

      expect(commandManager.checkCooldown('test', 'user-1')).toBe(false);
      expect(commandManager.checkCooldown('test', 'user-2')).toBe(false);
    });
  });

  describe('getAllCommands', () => {
    it('should return all registered commands', () => {
      const commands: CommandDefinition[] = [
        {
          name: 'test1',
          description: 'Test 1',
          builder: new SlashCommandBuilder()
            .setName('test1')
            .setDescription('Test 1'),
          handler: vi.fn(),
        },
        {
          name: 'test2',
          description: 'Test 2',
          builder: new SlashCommandBuilder()
            .setName('test2')
            .setDescription('Test 2'),
          handler: vi.fn(),
        },
      ];

      commandManager.registerCommands(commands);

      const allCommands = commandManager.getAllCommands();
      expect(allCommands).toHaveLength(2);
      expect(allCommands.map((c) => c.name)).toContain('test1');
      expect(allCommands.map((c) => c.name)).toContain('test2');
    });
  });

  describe('destroy', () => {
    it('should cleanup resources', () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test',
        builder: new SlashCommandBuilder()
          .setName('test')
          .setDescription('Test'),
        handler: vi.fn(),
      };

      commandManager.registerCommand(command);
      expect(commandManager.getAllCommands()).toHaveLength(1);

      commandManager.destroy();

      expect(commandManager.getAllCommands()).toHaveLength(0);
    });
  });
});
