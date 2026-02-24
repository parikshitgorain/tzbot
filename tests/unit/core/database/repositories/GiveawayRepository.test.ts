import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GiveawayRepository } from '../../../../../src/core/database/repositories/GiveawayRepository.js';
import type { Pool } from 'pg';

function makeGiveaway() {
  return {
    id: 'g1',
    guildId: 'guild1',
    title: 'Test Giveaway',
    description: 'Win a prize',
    channelId: 'ch1',
    messageId: 'msg1',
    requiredRoles: [],
    winnerCount: 1,
    status: 'active' as any,
    endsAt: new Date(),
    createdAt: new Date(),
    entries: [],
    winners: [],
  };
}

describe('GiveawayRepository', () => {
  let mockPool: Pool;
  let repo: GiveawayRepository;

  beforeEach(() => {
    mockPool = { query: vi.fn() } as unknown as Pool;
    repo = new GiveawayRepository(mockPool);
  });

  describe('save()', () => {
    it('executes upsert query', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.save(makeGiveaway());
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO giveaways'),
        expect.any(Array),
      );
    });

    it('saves giveaway with optional fields', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      const giveaway = {
        ...makeGiveaway(),
        condition: 'Follow on Twitter',
        hostedBy: 'host123',
      };
      await repo.save(giveaway);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['Follow on Twitter', 'host123']),
      );
    });

    it('saves giveaway without optional fields (null)', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      const giveaway = makeGiveaway();
      await repo.save(giveaway);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([null, null]), // condition and hostedBy
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.save(makeGiveaway())).rejects.toThrow('Failed to save giveaway');
    });

    it('wraps non-Error throws with Unknown error', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue('connection lost');
      await expect(repo.save(makeGiveaway())).rejects.toThrow('Unknown error');
    });
  });

  describe('get()', () => {
    it('returns null when not found', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.get('g1')).toBeNull();
    });

    it('returns giveaway with entries', async () => {
      const now = new Date();
      (mockPool.query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          rows: [{
            id: 'g1', guild_id: 'guild1', title: 'Test', description: 'desc',
            channel_id: 'ch1', message_id: 'msg1', required_roles: [],
            winner_count: 1, status: 'active', ends_at: now, created_at: now,
            condition: null, winners: [], hosted_by: null,
          }],
        })
        .mockResolvedValueOnce({ rows: [] }); // getEntries
      const g = await repo.get('g1');
      expect(g?.id).toBe('g1');
      expect(g?.entries).toEqual([]);
    });

    it('returns giveaway with optional fields populated', async () => {
      const now = new Date();
      (mockPool.query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          rows: [{
            id: 'g1', guild_id: 'guild1', title: 'Test', description: 'desc',
            channel_id: 'ch1', message_id: 'msg1', required_roles: ['role1'],
            winner_count: 2, status: 'ended', ends_at: now, created_at: now,
            condition: 'Follow us', winners: ['u1'], hosted_by: 'host1',
          }],
        })
        .mockResolvedValueOnce({ rows: [{ user_id: 'u1', timestamp: now }] }); // getEntries
      const g = await repo.get('g1');
      expect(g?.condition).toBe('Follow us');
      expect(g?.winners).toEqual(['u1']);
      expect(g?.hostedBy).toBe('host1');
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.get('g1')).rejects.toThrow('Failed to get giveaway');
    });

    it('wraps non-Error throws with Unknown error', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(123);
      await expect(repo.get('g1')).rejects.toThrow('Unknown error');
    });
  });

  describe('getActive()', () => {
    it('returns empty array when no active giveaways', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.getActive()).toEqual([]);
    });

    it('returns active giveaways with entries', async () => {
      const now = new Date();
      (mockPool.query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'g1', guild_id: 'guild1', title: 'Test1', description: 'desc1',
              channel_id: 'ch1', message_id: 'msg1', required_roles: [],
              winner_count: 1, status: 'active', ends_at: now, created_at: now,
              condition: 'Follow on Twitter', winners: ['u1'], hosted_by: 'host1',
            },
            {
              id: 'g2', guild_id: 'guild1', title: 'Test2', description: 'desc2',
              channel_id: 'ch2', message_id: 'msg2', required_roles: ['role1'],
              winner_count: 2, status: 'active', ends_at: now, created_at: now,
              condition: null, winners: [], hosted_by: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ user_id: 'u1', timestamp: now }] }) // entries for g1
        .mockResolvedValueOnce({ rows: [] }); // entries for g2
      
      const giveaways = await repo.getActive();
      expect(giveaways).toHaveLength(2);
      expect(giveaways[0].id).toBe('g1');
      expect(giveaways[0].condition).toBe('Follow on Twitter');
      expect(giveaways[0].winners).toEqual(['u1']);
      expect(giveaways[0].hostedBy).toBe('host1');
      expect(giveaways[0].entries).toHaveLength(1);
      expect(giveaways[1].id).toBe('g2');
      expect(giveaways[1].condition).toBeUndefined();
      expect(giveaways[1].hostedBy).toBeUndefined();
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getActive()).rejects.toThrow('Failed to get active giveaways');
    });

    it('wraps non-Error throws with Unknown error', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue('string error');
      await expect(repo.getActive()).rejects.toThrow('Unknown error');
    });
  });

  describe('getByMessageId()', () => {
    it('returns null when not found', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.getByMessageId('msg1')).toBeNull();
    });

    it('returns giveaway with all fields including optional ones', async () => {
      const now = new Date();
      (mockPool.query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          rows: [{
            id: 'g1', guild_id: 'guild1', title: 'Test', description: 'desc',
            channel_id: 'ch1', message_id: 'msg1', required_roles: ['role1', 'role2'],
            winner_count: 3, status: 'ended', ends_at: now, created_at: now,
            condition: 'DM me', winners: ['u1', 'u2'], hosted_by: 'host1',
          }],
        })
        .mockResolvedValueOnce({ 
          rows: [
            { user_id: 'u1', timestamp: now },
            { user_id: 'u2', timestamp: now },
          ] 
        }); // getEntries
      
      const g = await repo.getByMessageId('msg1');
      expect(g?.id).toBe('g1');
      expect(g?.messageId).toBe('msg1');
      expect(g?.condition).toBe('DM me');
      expect(g?.winners).toEqual(['u1', 'u2']);
      expect(g?.hostedBy).toBe('host1');
      expect(g?.requiredRoles).toEqual(['role1', 'role2']);
      expect(g?.entries).toHaveLength(2);
    });

    it('returns giveaway without optional fields', async () => {
      const now = new Date();
      (mockPool.query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          rows: [{
            id: 'g1', guild_id: 'guild1', title: 'Test', description: 'desc',
            channel_id: 'ch1', message_id: 'msg1', required_roles: [],
            winner_count: 1, status: 'active', ends_at: now, created_at: now,
            condition: null, winners: [], hosted_by: null,
          }],
        })
        .mockResolvedValueOnce({ rows: [] }); // getEntries
      
      const g = await repo.getByMessageId('msg1');
      expect(g?.condition).toBeUndefined();
      expect(g?.hostedBy).toBeUndefined();
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getByMessageId('msg1')).rejects.toThrow('Failed to get giveaway by message ID');
    });

    it('wraps non-Error throws with Unknown error', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue({ code: 'ECONNREFUSED' });
      await expect(repo.getByMessageId('msg1')).rejects.toThrow('Unknown error');
    });
  });

  describe('addEntry()', () => {
    it('executes INSERT INTO giveaway_entries', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.addEntry('g1', 'u1');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO giveaway_entries'),
        ['g1', 'u1'],
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.addEntry('g1', 'u1')).rejects.toThrow('Failed to add giveaway entry');
    });

    it('wraps non-Error throws with Unknown error', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue('oops');
      await expect(repo.addEntry('g1', 'u1')).rejects.toThrow('Unknown error');
    });
  });

  describe('getEntries()', () => {
    it('returns empty array when no entries', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.getEntries('g1')).toEqual([]);
    });

    it('maps rows to GiveawayEntry', async () => {
      const now = new Date();
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ user_id: 'u1', timestamp: now }],
      });
      const entries = await repo.getEntries('g1');
      expect(entries[0].userId).toBe('u1');
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getEntries('g1')).rejects.toThrow('Failed to get giveaway entries');
    });

    it('wraps non-Error throws with Unknown error', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(undefined);
      await expect(repo.getEntries('g1')).rejects.toThrow('Unknown error');
    });
  });

  describe('hasEntry()', () => {
    it('returns false when no rows', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.hasEntry('g1', 'u1')).toBe(false);
    });

    it('returns true when row exists', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [{ '1': 1 }] });
      expect(await repo.hasEntry('g1', 'u1')).toBe(true);
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.hasEntry('g1', 'u1')).rejects.toThrow('Failed to check giveaway entry');
    });

    it('wraps non-Error throws with Unknown error', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(false);
      await expect(repo.hasEntry('g1', 'u1')).rejects.toThrow('Unknown error');
    });
  });

  describe('updateStatus()', () => {
    it('executes UPDATE giveaways', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.updateStatus('g1', 'ended' as any);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE giveaways'),
        ['ended', 'g1'],
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.updateStatus('g1', 'ended' as any)).rejects.toThrow('Failed to update giveaway status');
    });

    it('wraps non-Error throws with Unknown error', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue([]);
      await expect(repo.updateStatus('g1', 'ended' as any)).rejects.toThrow('Unknown error');
    });
  });

  describe('getByChannel()', () => {
    it('returns empty array when none found', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      expect(await repo.getByChannel('ch1')).toEqual([]);
    });

    it('returns giveaways without status filter', async () => {
      const now = new Date();
      (mockPool.query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          rows: [{
            id: 'g1', guild_id: 'guild1', title: 'Test', description: 'desc',
            channel_id: 'ch1', message_id: 'msg1', required_roles: [],
            winner_count: 1, status: 'active', ends_at: now, created_at: now,
            condition: null, winners: [], hosted_by: null,
          }],
        })
        .mockResolvedValueOnce({ rows: [] }); // getEntries
      
      const giveaways = await repo.getByChannel('ch1');
      expect(giveaways).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.not.stringContaining('status = $2'),
        ['ch1'],
      );
    });

    it('appends status filter when provided', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.getByChannel('ch1', 'active' as any);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $2'),
        ['ch1', 'active'],
      );
    });

    it('returns multiple giveaways with entries', async () => {
      const now = new Date();
      (mockPool.query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'g1', guild_id: 'guild1', title: 'Test1', description: 'desc1',
              channel_id: 'ch1', message_id: 'msg1', required_roles: [],
              winner_count: 1, status: 'active', ends_at: now, created_at: now,
              condition: 'Condition 1', winners: [], hosted_by: 'host1',
            },
            {
              id: 'g2', guild_id: 'guild1', title: 'Test2', description: 'desc2',
              channel_id: 'ch1', message_id: 'msg2', required_roles: ['role1'],
              winner_count: 2, status: 'ended', ends_at: now, created_at: now,
              condition: null, winners: ['u1'], hosted_by: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ user_id: 'u1', timestamp: now }] }) // entries for g1
        .mockResolvedValueOnce({ rows: [] }); // entries for g2
      
      const giveaways = await repo.getByChannel('ch1');
      expect(giveaways).toHaveLength(2);
      expect(giveaways[0].condition).toBe('Condition 1');
      expect(giveaways[0].hostedBy).toBe('host1');
      expect(giveaways[1].condition).toBeUndefined();
      expect(giveaways[1].hostedBy).toBeUndefined();
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.getByChannel('ch1')).rejects.toThrow('Failed to get giveaways by channel');
    });

    it('wraps non-Error throws with Unknown error', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(null);
      await expect(repo.getByChannel('ch1')).rejects.toThrow('Unknown error');
    });
  });

  describe('updateWinners()', () => {
    it('executes UPDATE with JSON winners', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
      await repo.updateWinners('g1', ['u1', 'u2']);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE giveaways'),
        [JSON.stringify(['u1', 'u2']), 'g1'],
      );
    });

    it('throws wrapped error on DB failure', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await expect(repo.updateWinners('g1', ['u1'])).rejects.toThrow('Failed to update giveaway winners');
    });

    it('wraps non-Error throws with Unknown error', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue({ message: 'not an Error instance' });
      await expect(repo.updateWinners('g1', ['u1'])).rejects.toThrow('Unknown error');
    });
  });
});
