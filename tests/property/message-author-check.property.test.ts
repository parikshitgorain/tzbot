/**
 * @file message-author-check.property.test.ts
 * @description Property-based tests for message author winner check
 * Feature: giveaway-winner-confirmation
 * @module tests/property
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { MessageListener } from '../../src/giveaway/message-listener.js';
import { WinnerStateRepository } from '../../src/core/database/repositories/WinnerStateRepository.js';
import { WinnerStatus } from '../../src/types/models.js';
import { Pool } from 'pg';
import { createPool, closePool } from '../../src/core/database/pool.js';
import { runMigrations } from '../../src/core/database/migrator.js';

// Skip tests if database is not available
const skipDatabaseTests = 
  process.env.SKIP_DB_TESTS === 'true' || 
  process.env.CI === 'true' ||
  (process.env.NODE_ENV === 'test' && process.env.DATABASE_URL?.includes('localhost'));

describe.skipIf(skipDatabaseTests)('Message Author Winner Check Properties', () => {
  let pool: Pool;
  let winnerStateRepo: WinnerStateRepository;
  let messageListener: MessageListener;
  let confirmationCallback: (giveawayId: string, userId: string) => Promise<void>;
  let confirmationCalls: Array<{ giveawayId: string; userId: string }>;

  beforeAll(async () => {
    // Create test database connection
    pool = createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'tzbot_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    // Run migrations
    await runMigrations();

    winnerStateRepo = new WinnerStateRepository(pool);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    // Track confirmation callback calls
    confirmationCalls = [];
    confirmationCallback = async (giveawayId: string, userId: string) => {
      confirmationCalls.push({ giveawayId, userId });
    };

    messageListener = new MessageListener(winnerStateRepo, confirmationCallback);

    // Clean up any existing test data
    await pool.query('DELETE FROM giveaway_winners');
    await pool.query('DELETE FROM giveaways');
  });

  /**
   * Property 5: Message Author Winner Check
   * For any message created in the server, the Message Listener should query whether
   * the author is a pending winner.
   * Validates: Requirements 2.1
   */
  it('Property 5: Message Author Winner Check - Pending winners detected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 10, maxLength: 20 }),
        fc.string({ minLength: 10, maxLength: 20 }),
        async (giveawayId, guildId, userId) => {
          // Create a test giveaway first (use ON CONFLICT to handle duplicates)
          await pool.query(
            `INSERT INTO giveaways (id, guild_id, title, description, channel_id, message_id, winner_count, status, ends_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE SET guild_id = $2`,
            [giveawayId, guildId, 'Test Prize', 'Test Description', 'channel-1', 'msg-1', 1, 'ended', new Date()]
          );

          // Delete any existing winner record for this combination
          await pool.query(
            'DELETE FROM giveaway_winners WHERE giveaway_id = $1 AND user_id = $2',
            [giveawayId, userId]
          );

          // Create a pending winner record
          const now = new Date();
          await winnerStateRepo.createWinner({
            giveawayId,
            userId,
            status: WinnerStatus.PENDING,
            selectedAt: now,
            timerStartTime: now,
            timerActive: true,
          });

          // Query if user is a pending winner
          const isPending = await messageListener.isPendingWinner(guildId, userId);

          // Should detect the pending winner
          expect(isPending).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 5: Message Author Winner Check - Non-winners not detected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 20 }),
        fc.string({ minLength: 10, maxLength: 20 }),
        async (guildId, userId) => {
          // Query if user is a pending winner (no winner records exist)
          const isPending = await messageListener.isPendingWinner(guildId, userId);

          // Should not detect as pending winner
          expect(isPending).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 5: Message Author Winner Check - Confirmed winners not detected as pending', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 10, maxLength: 20 }),
        fc.string({ minLength: 10, maxLength: 20 }),
        async (giveawayId, guildId, userId) => {
          // Create a test giveaway first (use ON CONFLICT to handle duplicates)
          await pool.query(
            `INSERT INTO giveaways (id, guild_id, title, description, channel_id, message_id, winner_count, status, ends_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE SET guild_id = $2`,
            [giveawayId, guildId, 'Test Prize', 'Test Description', 'channel-1', 'msg-1', 1, 'ended', new Date()]
          );

          // Delete any existing winner record for this combination
          await pool.query(
            'DELETE FROM giveaway_winners WHERE giveaway_id = $1 AND user_id = $2',
            [giveawayId, userId]
          );

          // Create a confirmed winner record
          const now = new Date();
          await winnerStateRepo.createWinner({
            giveawayId,
            userId,
            status: WinnerStatus.CONFIRMED,
            selectedAt: now,
            confirmedAt: now,
            timerStartTime: now,
            timerActive: false,
          });

          // Query if user is a pending winner
          const isPending = await messageListener.isPendingWinner(guildId, userId);

          // Should not detect confirmed winner as pending
          expect(isPending).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 5: Message Author Winner Check - Rerolled winners not detected as pending', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 10, maxLength: 20 }),
        fc.string({ minLength: 10, maxLength: 20 }),
        async (giveawayId, guildId, userId) => {
          // Create a test giveaway first (use ON CONFLICT to handle duplicates)
          await pool.query(
            `INSERT INTO giveaways (id, guild_id, title, description, channel_id, message_id, winner_count, status, ends_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE SET guild_id = $2`,
            [giveawayId, guildId, 'Test Prize', 'Test Description', 'channel-1', 'msg-1', 1, 'ended', new Date()]
          );

          // Delete any existing winner record for this combination
          await pool.query(
            'DELETE FROM giveaway_winners WHERE giveaway_id = $1 AND user_id = $2',
            [giveawayId, userId]
          );

          // Create a rerolled winner record
          const now = new Date();
          await winnerStateRepo.createWinner({
            giveawayId,
            userId,
            status: WinnerStatus.REROLLED,
            selectedAt: now,
            rerolledAt: now,
            timerStartTime: now,
            timerActive: false,
          });

          // Query if user is a pending winner
          const isPending = await messageListener.isPendingWinner(guildId, userId);

          // Should not detect rerolled winner as pending
          expect(isPending).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 5: Message Author Winner Check - Multiple pending giveaways detected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.string({ minLength: 10, maxLength: 20 }),
        fc.string({ minLength: 10, maxLength: 20 }),
        async (giveawayId1, giveawayId2, guildId, userId) => {
          // Ensure different giveaway IDs
          fc.pre(giveawayId1 !== giveawayId2);

          // Create test giveaways (use ON CONFLICT to handle duplicates)
          await pool.query(
            `INSERT INTO giveaways (id, guild_id, title, description, channel_id, message_id, winner_count, status, ends_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE SET guild_id = $2`,
            [giveawayId1, guildId, 'Test Prize 1', 'Test Description', 'channel-1', 'msg-1', 1, 'ended', new Date()]
          );
          await pool.query(
            `INSERT INTO giveaways (id, guild_id, title, description, channel_id, message_id, winner_count, status, ends_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE SET guild_id = $2`,
            [giveawayId2, guildId, 'Test Prize 2', 'Test Description', 'channel-1', 'msg-2', 1, 'ended', new Date()]
          );

          // Delete any existing winner records for this user
          await pool.query(
            'DELETE FROM giveaway_winners WHERE giveaway_id IN ($1, $2) AND user_id = $3',
            [giveawayId1, giveawayId2, userId]
          );

          // Create pending winner records for both giveaways
          const now = new Date();
          await winnerStateRepo.createWinner({
            giveawayId: giveawayId1,
            userId,
            status: WinnerStatus.PENDING,
            selectedAt: now,
            timerStartTime: now,
            timerActive: true,
          });
          await winnerStateRepo.createWinner({
            giveawayId: giveawayId2,
            userId,
            status: WinnerStatus.PENDING,
            selectedAt: now,
            timerStartTime: now,
            timerActive: true,
          });

          // Query if user is a pending winner
          const isPending = await messageListener.isPendingWinner(guildId, userId);
          const giveawayIds = await messageListener.getPendingGiveaways(guildId, userId);

          // Should detect as pending winner
          expect(isPending).toBe(true);
          // Should return both giveaway IDs
          expect(giveawayIds).toHaveLength(2);
          expect(giveawayIds).toContain(giveawayId1);
          expect(giveawayIds).toContain(giveawayId2);
        }
      ),
      { numRuns: 30 }
    );
  });
});
