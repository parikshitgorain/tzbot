import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChannelAccessEnforcer } from '../../../src/moderation/channel-access.js';

// ---------------------------------------------------------------------------
// Minimal inline mocks (no discord.js import required)
// ---------------------------------------------------------------------------

function makeGuildMember(hasRole: boolean) {
  return {
    roles: {
      cache: {
        has: vi.fn().mockReturnValue(hasRole),
      },
    },
  };
}

function makeMessage(overrides: {
  channelId?: string;
  authorId?: string;
  guildId?: string | null;
  content?: string;
  channelName?: string;
} = {}) {
  const {
    channelId = 'channel1',
    authorId = 'user1',
    guildId = 'guild1',
    content = 'hello',
    channelName = 'general',
  } = overrides;

  return {
    channelId,
    author: {
      id: authorId,
      send: vi.fn().mockResolvedValue(undefined),
    },
    guildId,
    id: 'msg1',
    content,
    channel: { name: channelName },
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChannelAccessEnforcer', () => {
  const MODERATOR_ROLE_ID = 'mod-role';
  const WHITELIST_ROLE_ID = 'whitelist-role';
  const READ_ONLY_CHANNEL = 'readonly-channel';

  let mockDiscordClient: { getMember: ReturnType<typeof vi.fn>; deleteMessage: ReturnType<typeof vi.fn> };
  let mockViolationRepo: { save: ReturnType<typeof vi.fn> };
  let enforcer: ChannelAccessEnforcer;

  beforeEach(() => {
    mockDiscordClient = {
      getMember: vi.fn(),
      deleteMessage: vi.fn().mockResolvedValue(undefined),
    };

    mockViolationRepo = {
      save: vi.fn().mockResolvedValue(undefined),
    };

    enforcer = new ChannelAccessEnforcer(
      mockDiscordClient as any,
      mockViolationRepo as any,
      MODERATOR_ROLE_ID,
      [{ channelId: READ_ONLY_CHANNEL, whitelistRoleIds: [WHITELIST_ROLE_ID] }],
    );
  });

  // -------------------------------------------------------------------------
  // isReadOnlyChannel()
  // -------------------------------------------------------------------------

  describe('isReadOnlyChannel()', () => {
    it('returns true for a configured read-only channel', () => {
      expect(enforcer.isReadOnlyChannel(READ_ONLY_CHANNEL)).toBe(true);
    });

    it('returns false for a channel not in the config', () => {
      expect(enforcer.isReadOnlyChannel('some-other-channel')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // addReadOnlyChannel() / removeReadOnlyChannel()
  // -------------------------------------------------------------------------

  describe('addReadOnlyChannel()', () => {
    it('makes the channel detectable as read-only', () => {
      enforcer.addReadOnlyChannel({ channelId: 'new-readonly', whitelistRoleIds: [] });
      expect(enforcer.isReadOnlyChannel('new-readonly')).toBe(true);
    });
  });

  describe('removeReadOnlyChannel()', () => {
    it('removes the channel from the read-only set', () => {
      enforcer.removeReadOnlyChannel(READ_ONLY_CHANNEL);
      expect(enforcer.isReadOnlyChannel(READ_ONLY_CHANNEL)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // updateWhitelistRoles()
  // -------------------------------------------------------------------------

  describe('updateWhitelistRoles()', () => {
    it('replaces whitelist roles for an existing channel', () => {
      enforcer.updateWhitelistRoles(READ_ONLY_CHANNEL, ['new-role-1', 'new-role-2']);
      expect(enforcer.getWhitelistRoles(READ_ONLY_CHANNEL)).toEqual(['new-role-1', 'new-role-2']);
    });

    it('does nothing silently for a non-existent channel', () => {
      // Should not throw
      expect(() =>
        enforcer.updateWhitelistRoles('ghost-channel', ['role1']),
      ).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // getReadOnlyChannels()
  // -------------------------------------------------------------------------

  describe('getReadOnlyChannels()', () => {
    it('returns all configured read-only channel configs', () => {
      const channels = enforcer.getReadOnlyChannels();
      expect(channels.length).toBe(1);
      expect(channels[0].channelId).toBe(READ_ONLY_CHANNEL);
    });

    it('returns updated list after adding a channel', () => {
      enforcer.addReadOnlyChannel({ channelId: 'extra-channel', whitelistRoleIds: [] });
      expect(enforcer.getReadOnlyChannels().length).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // getWhitelistRoles()
  // -------------------------------------------------------------------------

  describe('getWhitelistRoles()', () => {
    it('returns whitelist roles for an existing channel', () => {
      expect(enforcer.getWhitelistRoles(READ_ONLY_CHANNEL)).toEqual([WHITELIST_ROLE_ID]);
    });

    it('returns empty array for a non-read-only channel', () => {
      expect(enforcer.getWhitelistRoles('normal-channel')).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // checkAccess()
  // -------------------------------------------------------------------------

  describe('checkAccess()', () => {
    it('authorizes messages in a non-read-only channel', async () => {
      const message = makeMessage({ channelId: 'normal-channel' });
      const result = await enforcer.checkAccess(message);
      expect(result.isAuthorized).toBe(true);
    });

    it('denies access when guildId is null (DM context)', async () => {
      const message = makeMessage({ channelId: READ_ONLY_CHANNEL, guildId: null });
      const result = await enforcer.checkAccess(message);
      expect(result.isAuthorized).toBe(false);
    });

    it('authorizes a moderator in a read-only channel', async () => {
      const member = makeGuildMember(true); // has role
      mockDiscordClient.getMember.mockResolvedValue(member);

      const message = makeMessage({ channelId: READ_ONLY_CHANNEL });
      const result = await enforcer.checkAccess(message);
      expect(result.isAuthorized).toBe(true);
    });

    it('authorizes a user with a whitelisted role', async () => {
      // First call (isModerator check) returns false, second (hasWhitelistRole check) returns true
      const member = {
        roles: {
          cache: {
            has: vi.fn()
              .mockReturnValueOnce(false) // not moderator
              .mockReturnValueOnce(true),  // has whitelist role
          },
        },
      };
      mockDiscordClient.getMember.mockResolvedValue(member);

      const message = makeMessage({ channelId: READ_ONLY_CHANNEL });
      const result = await enforcer.checkAccess(message);
      expect(result.isAuthorized).toBe(true);
    });

    it('denies a regular user with no whitelisted role', async () => {
      const member = makeGuildMember(false); // no role
      mockDiscordClient.getMember.mockResolvedValue(member);

      const message = makeMessage({ channelId: READ_ONLY_CHANNEL });
      const result = await enforcer.checkAccess(message);
      expect(result.isAuthorized).toBe(false);
    });

    it('denies when member is not found in guild', async () => {
      mockDiscordClient.getMember.mockResolvedValue(null);

      const message = makeMessage({ channelId: READ_ONLY_CHANNEL });
      const result = await enforcer.checkAccess(message);
      expect(result.isAuthorized).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // enforceAccess()
  // -------------------------------------------------------------------------

  describe('enforceAccess()', () => {
    it('returns false (message not deleted) when user is authorized', async () => {
      const message = makeMessage({ channelId: 'normal-channel' });
      const deleted = await enforcer.enforceAccess(message);
      expect(deleted).toBe(false);
      expect(mockDiscordClient.deleteMessage).not.toHaveBeenCalled();
    });

    it('deletes message and returns true when user is unauthorized', async () => {
      const member = makeGuildMember(false);
      mockDiscordClient.getMember.mockResolvedValue(member);

      const message = makeMessage({ channelId: READ_ONLY_CHANNEL });
      const deleted = await enforcer.enforceAccess(message);

      expect(deleted).toBe(true);
      expect(mockDiscordClient.deleteMessage).toHaveBeenCalledWith(READ_ONLY_CHANNEL, 'msg1');
    });

    it('saves a violation record when deleting an unauthorized message', async () => {
      const member = makeGuildMember(false);
      mockDiscordClient.getMember.mockResolvedValue(member);

      const message = makeMessage({ channelId: READ_ONLY_CHANNEL });
      await enforcer.enforceAccess(message);

      expect(mockViolationRepo.save).toHaveBeenCalled();
    });

    it('sends a DM notification to the user after deletion', async () => {
      const member = makeGuildMember(false);
      mockDiscordClient.getMember.mockResolvedValue(member);

      const message = makeMessage({ channelId: READ_ONLY_CHANNEL });
      await enforcer.enforceAccess(message);

      expect(message.author.send).toHaveBeenCalled();
    });
  });
});
