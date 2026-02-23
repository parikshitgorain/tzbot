import { describe, it, expect, vi, afterEach } from 'vitest';
import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import {
  verifyBotPermissions,
  formatPermissionsError,
  generateInviteUrl,
  verifyPermissionsOnStartup,
  REQUIRED_PERMISSIONS,
} from '../../../../src/core/discord/permissions.js';

function makeGuild(grantedPerms: bigint[] = [...REQUIRED_PERMISSIONS]) {
  const permissions = new PermissionsBitField(grantedPerms);
  return {
    id: 'guild1',
    name: 'TestGuild',
    members: { me: { permissions } },
    client: { user: { id: 'bot123' } },
  } as any;
}

describe('REQUIRED_PERMISSIONS', () => {
  it('includes ManageRoles, ManageMessages, BanMembers, KickMembers, ModerateMembers', () => {
    expect(REQUIRED_PERMISSIONS).toContain(PermissionFlagsBits.ManageRoles);
    expect(REQUIRED_PERMISSIONS).toContain(PermissionFlagsBits.ManageMessages);
    expect(REQUIRED_PERMISSIONS).toContain(PermissionFlagsBits.BanMembers);
    expect(REQUIRED_PERMISSIONS).toContain(PermissionFlagsBits.KickMembers);
    expect(REQUIRED_PERMISSIONS).toContain(PermissionFlagsBits.ModerateMembers);
  });
});

describe('verifyBotPermissions()', () => {
  it('returns hasAllPermissions=true when bot has all required permissions', () => {
    const guild = makeGuild();
    const result = verifyBotPermissions(guild);
    expect(result.hasAllPermissions).toBe(true);
    expect(result.missingPermissions).toHaveLength(0);
    expect(result.grantedPermissions.length).toBe(REQUIRED_PERMISSIONS.length);
  });

  it('reports missing permissions when bot lacks some', () => {
    const guild = makeGuild([PermissionFlagsBits.ManageRoles]);
    const result = verifyBotPermissions(guild);
    expect(result.hasAllPermissions).toBe(false);
    expect(result.missingPermissions.length).toBeGreaterThan(0);
    expect(result.grantedPermissions).toContain('MANAGE_ROLES');
  });

  it('throws when bot member is not in guild', () => {
    const guild = { id: 'g1', name: 'G', members: { me: null }, client: { user: null } } as any;
    expect(() => verifyBotPermissions(guild)).toThrow('Bot member not found in guild');
  });
});

describe('formatPermissionsError()', () => {
  it('returns empty string when all permissions granted', () => {
    const guild = makeGuild();
    const result = verifyBotPermissions(guild);
    expect(formatPermissionsError(result, guild)).toBe('');
  });

  it('returns formatted error message listing missing permissions', () => {
    const guild = makeGuild([PermissionFlagsBits.ManageRoles]);
    const result = verifyBotPermissions(guild);
    const msg = formatPermissionsError(result, guild);
    expect(msg).toContain('TestGuild');
    expect(msg).toContain('Missing permissions');
    expect(msg).toContain('discord.com/api/oauth2/authorize');
  });
});

describe('generateInviteUrl()', () => {
  it('returns a valid Discord OAuth URL with client ID and permissions', () => {
    const url = generateInviteUrl('bot123');
    expect(url).toContain('https://discord.com/api/oauth2/authorize');
    expect(url).toContain('client_id=bot123');
    expect(url).toContain('permissions=');
    expect(url).toContain('scope=bot');
  });

  it('works with empty client ID', () => {
    const url = generateInviteUrl('');
    expect(url).toContain('client_id=');
  });
});

describe('verifyPermissionsOnStartup()', () => {
  it('completes without throwing when bot has all permissions', () => {
    const guild = makeGuild();
    expect(() => verifyPermissionsOnStartup(guild)).not.toThrow();
  });

  it('completes without throwing when bot is missing permissions (logs warning)', () => {
    const guild = makeGuild([PermissionFlagsBits.ManageRoles]);
    expect(() => verifyPermissionsOnStartup(guild)).not.toThrow();
  });
});
