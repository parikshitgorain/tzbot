/**
 * @file permissions.test.ts
 * @description Unit tests for Discord bot permissions verification
 * @module tests/unit/core/discord
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  verifyBotPermissions,
  formatPermissionsError,
  generateInviteUrl,
  verifyPermissionsOnStartup,
  REQUIRED_PERMISSIONS,
} from '@/core/discord/permissions.js';
import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';

// Mock logger
vi.mock('@/core/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { logger } from '@/core/logger/logger.js';

describe('Discord Permissions Verification', () => {
  describe('verifyBotPermissions', () => {
    it('should return hasAllPermissions true when bot has all required permissions', () => {
      const mockGuild = createMockGuild(REQUIRED_PERMISSIONS);
      const result = verifyBotPermissions(mockGuild);

      expect(result.hasAllPermissions).toBe(true);
      expect(result.missingPermissions).toHaveLength(0);
      expect(result.grantedPermissions).toHaveLength(5);
      expect(result.grantedPermissions).toContain('MANAGE_ROLES');
      expect(result.grantedPermissions).toContain('MANAGE_MESSAGES');
      expect(result.grantedPermissions).toContain('BAN_MEMBERS');
      expect(result.grantedPermissions).toContain('KICK_MEMBERS');
      expect(result.grantedPermissions).toContain('MODERATE_MEMBERS');
    });

    it('should return hasAllPermissions false when bot is missing some permissions', () => {
      const mockGuild = createMockGuild([
        PermissionFlagsBits.ManageRoles,
        PermissionFlagsBits.ManageMessages,
      ]);
      const result = verifyBotPermissions(mockGuild);

      expect(result.hasAllPermissions).toBe(false);
      expect(result.missingPermissions).toHaveLength(3);
      expect(result.missingPermissions).toContain('BAN_MEMBERS');
      expect(result.missingPermissions).toContain('KICK_MEMBERS');
      expect(result.missingPermissions).toContain('MODERATE_MEMBERS');
      expect(result.grantedPermissions).toHaveLength(2);
      expect(result.grantedPermissions).toContain('MANAGE_ROLES');
      expect(result.grantedPermissions).toContain('MANAGE_MESSAGES');
    });

    it('should return all permissions as missing when bot has no permissions', () => {
      const mockGuild = createMockGuild([]);
      const result = verifyBotPermissions(mockGuild);

      expect(result.hasAllPermissions).toBe(false);
      expect(result.missingPermissions).toHaveLength(5);
      expect(result.grantedPermissions).toHaveLength(0);
    });

    it('should throw error when bot member is not found in guild', () => {
      const mockGuild = {
        id: 'test-guild-id',
        name: 'Test Guild',
        members: {
          me: null,
        },
      } as any;

      expect(() => verifyBotPermissions(mockGuild)).toThrow(
        'Bot member not found in guild'
      );
    });
  });

  describe('formatPermissionsError', () => {
    it('should return empty string when bot has all permissions', () => {
      const result = {
        hasAllPermissions: true,
        missingPermissions: [],
        grantedPermissions: ['MANAGE_ROLES', 'MANAGE_MESSAGES'],
      };
      const mockGuild = createMockGuild([]);

      const errorMessage = formatPermissionsError(result, mockGuild);

      expect(errorMessage).toBe('');
    });

    it('should return formatted error message when bot is missing permissions', () => {
      const result = {
        hasAllPermissions: false,
        missingPermissions: ['BAN_MEMBERS', 'KICK_MEMBERS'],
        grantedPermissions: ['MANAGE_ROLES'],
      };
      const mockGuild = createMockGuild([]);

      const errorMessage = formatPermissionsError(result, mockGuild);

      expect(errorMessage).toContain('TZBOT is missing required permissions');
      expect(errorMessage).toContain('Test Guild');
      expect(errorMessage).toContain('BAN_MEMBERS, KICK_MEMBERS');
      expect(errorMessage).toContain('MANAGE_ROLES');
      expect(errorMessage).toContain('MANAGE_MESSAGES');
      expect(errorMessage).toContain('BAN_MEMBERS');
      expect(errorMessage).toContain('KICK_MEMBERS');
      expect(errorMessage).toContain('MODERATE_MEMBERS');
      expect(errorMessage).toContain('Server Settings → Roles');
      expect(errorMessage).toContain('discord.com/api/oauth2/authorize');
    });

    it('should include invite URL in error message', () => {
      const result = {
        hasAllPermissions: false,
        missingPermissions: ['BAN_MEMBERS'],
        grantedPermissions: [],
      };
      const mockGuild = createMockGuild([]);

      const errorMessage = formatPermissionsError(result, mockGuild);

      expect(errorMessage).toContain('client_id=test-bot-id');
      expect(errorMessage).toContain('permissions=');
      expect(errorMessage).toContain('scope=bot%20applications.commands');
    });
  });

  describe('generateInviteUrl', () => {
    it('should generate valid invite URL with required permissions', () => {
      const clientId = 'test-client-id';
      const url = generateInviteUrl(clientId);

      expect(url).toContain(`client_id=${clientId}`);
      expect(url).toContain('permissions=');
      expect(url).toContain('scope=bot%20applications.commands');
      expect(url).toMatch(/^https:\/\/discord\.com\/api\/oauth2\/authorize/);
    });

    it('should include all required permissions in the bitfield', () => {
      const clientId = 'test-client-id';
      const url = generateInviteUrl(clientId);

      // Extract permissions value from URL
      const match = url.match(/permissions=(\d+)/);
      expect(match).not.toBeNull();

      const permissionsValue = BigInt(match![1]);
      const permissions = new PermissionsBitField(permissionsValue);

      // Verify all required permissions are included
      for (const permission of REQUIRED_PERMISSIONS) {
        expect(permissions.has(permission)).toBe(true);
      }
    });
  });

  describe('verifyPermissionsOnStartup', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      // Mock console.warn
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('should log info when bot has all permissions', () => {
      const mockGuild = createMockGuild(REQUIRED_PERMISSIONS);

      verifyPermissionsOnStartup(mockGuild);

      expect(logger.info).toHaveBeenCalledWith(
        'Verifying bot permissions on startup',
        expect.objectContaining({
          guildId: 'test-guild-id',
          guildName: 'Test Guild',
        })
      );

      expect(logger.info).toHaveBeenCalledWith(
        'Bot has all required permissions',
        expect.objectContaining({
          guildId: 'test-guild-id',
          guildName: 'Test Guild',
        })
      );

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should log warning when bot is missing permissions', () => {
      const mockGuild = createMockGuild([PermissionFlagsBits.ManageRoles]);

      verifyPermissionsOnStartup(mockGuild);

      expect(logger.warn).toHaveBeenCalledWith(
        'Bot started with missing permissions',
        expect.objectContaining({
          guildId: 'test-guild-id',
          guildName: 'Test Guild',
          missingPermissions: expect.arrayContaining([
            'MANAGE_MESSAGES',
            'BAN_MEMBERS',
            'KICK_MEMBERS',
            'MODERATE_MEMBERS',
          ]),
        })
      );
    });

    it('should log detailed error message to console when permissions are missing', () => {
      const mockGuild = createMockGuild([]);

      verifyPermissionsOnStartup(mockGuild);

      expect(logger.warn).toHaveBeenCalled();
      // Check that the formatted error message was logged
      const warnCalls = (logger.warn as any).mock.calls;
      const errorMessageCall = warnCalls.find((call: any[]) => 
        typeof call[0] === 'string' && call[0].includes('TZBOT is missing required permissions')
      );
      expect(errorMessageCall).toBeDefined();
      expect(errorMessageCall[0]).toContain('MANAGE_ROLES');
      expect(errorMessageCall[0]).toContain('MANAGE_MESSAGES');
      expect(errorMessageCall[0]).toContain('BAN_MEMBERS');
    });
  });

  describe('REQUIRED_PERMISSIONS constant', () => {
    it('should contain exactly 5 required permissions', () => {
      expect(REQUIRED_PERMISSIONS).toHaveLength(5);
    });

    it('should include all expected permissions', () => {
      expect(REQUIRED_PERMISSIONS).toContain(PermissionFlagsBits.ManageRoles);
      expect(REQUIRED_PERMISSIONS).toContain(PermissionFlagsBits.ManageMessages);
      expect(REQUIRED_PERMISSIONS).toContain(PermissionFlagsBits.BanMembers);
      expect(REQUIRED_PERMISSIONS).toContain(PermissionFlagsBits.KickMembers);
      expect(REQUIRED_PERMISSIONS).toContain(PermissionFlagsBits.ModerateMembers);
    });
  });
});

// Helper function to create mock guild with specified permissions
function createMockGuild(permissions: readonly bigint[]) {
  const permissionsBitField = new PermissionsBitField(permissions);

  return {
    id: 'test-guild-id',
    name: 'Test Guild',
    members: {
      me: {
        permissions: permissionsBitField,
      },
    },
    client: {
      user: {
        id: 'test-bot-id',
      },
    },
  } as any;
}
