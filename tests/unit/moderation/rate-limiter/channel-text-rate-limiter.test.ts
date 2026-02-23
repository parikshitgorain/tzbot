import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChannelTextRateLimiter } from '../../../../src/moderation/rate-limiter/channel-text-rate-limiter.js';
import { InMemoryStateStore } from '../../../../src/moderation/rate-limiter/state-store.js';

function makeMessage(opts: {
  bot?: boolean;
  channelId?: string;
  hasAttachment?: boolean;
  userId?: string;
} = {}) {
  return {
    author: { id: opts.userId ?? 'u1', bot: opts.bot ?? false },
    channelId: opts.channelId ?? 'restricted-ch',
    id: 'msg1',
    content: 'hello',
    attachments: { size: opts.hasAttachment ? 1 : 0 },
    embeds: [],
    channel: {
      name: 'general',
      send: vi.fn().mockResolvedValue({ id: 'sm1', delete: vi.fn().mockResolvedValue(undefined) }),
    },
    delete: vi.fn().mockResolvedValue(undefined),
  } as any;
}

const baseConfig = {
  restrictedChannels: new Map([['restricted-ch', 'chat-ch']]),
  rateLimitWindowMs: 500,
  violationWindowMs: 2000,
  warningDeleteDelayMs: 100,
  cleanupIntervalMs: 60_000,
};

async function makeInitialized() {
  vi.useFakeTimers();
  const stateStore = new InMemoryStateStore();
  const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };
  const limiter = new ChannelTextRateLimiter();
  await limiter.initialize(baseConfig, {
    discordClient: {} as any,
    stateStore,
    logger: mockLogger as any,
    configManager: {} as any,
  });
  return { limiter, stateStore, mockLogger };
}

describe('ChannelTextRateLimiter', () => {
  afterEach(async () => {
    vi.useRealTimers();
  });

  it('throws if handleMessage called before initialize', async () => {
    const limiter = new ChannelTextRateLimiter();
    const msg = makeMessage();
    await expect(limiter.handleMessage(msg)).rejects.toThrow('not initialized');
  });

  it('allows bot messages through', async () => {
    const { limiter } = await makeInitialized();
    const msg = makeMessage({ bot: true });
    expect(await limiter.handleMessage(msg)).toBe(true);
    await limiter.shutdown();
  });

  it('allows messages in non-restricted channels', async () => {
    const { limiter } = await makeInitialized();
    const msg = makeMessage({ channelId: 'free-channel' });
    expect(await limiter.handleMessage(msg)).toBe(true);
    await limiter.shutdown();
  });

  it('allows media messages in restricted channels', async () => {
    const { limiter } = await makeInitialized();
    const msg = makeMessage({ hasAttachment: true });
    expect(await limiter.handleMessage(msg)).toBe(true);
    await limiter.shutdown();
  });

  it('allows first text message and records timestamp', async () => {
    const { limiter } = await makeInitialized();
    const msg = makeMessage();
    expect(await limiter.handleMessage(msg)).toBe(true);
    await limiter.shutdown();
  });

  it('returns false and deletes second message within rate limit window', async () => {
    const { limiter } = await makeInitialized();
    const msg1 = makeMessage({ userId: 'u2' });
    const msg2 = makeMessage({ userId: 'u2' });
    await limiter.handleMessage(msg1); // first message - allowed
    const result = await limiter.handleMessage(msg2); // second within 500ms - blocked
    expect(result).toBe(false);
    expect(msg2.delete).toHaveBeenCalled();
    await limiter.shutdown();
  });

  it('getConfig returns current config', async () => {
    const { limiter } = await makeInitialized();
    const cfg = limiter.getConfig();
    expect(cfg.rateLimitWindowMs).toBe(500);
    await limiter.shutdown();
  });

  it('reloadConfig updates restrictedChannels', async () => {
    const { limiter } = await makeInitialized();
    const newChannels = new Map([['new-ch', 'redirect-ch']]);
    await limiter.reloadConfig(newChannels);
    expect(limiter.getConfig().restrictedChannels).toBe(newChannels);
    await limiter.shutdown();
  });

  it('reloadConfig throws when not initialized', async () => {
    const limiter = new ChannelTextRateLimiter();
    await expect(limiter.reloadConfig(new Map())).rejects.toThrow('not initialized');
  });

  it('cleanupExpiredState does nothing when not initialized', async () => {
    const limiter = new ChannelTextRateLimiter();
    await expect(limiter.cleanupExpiredState()).resolves.toBeUndefined();
  });

  it('shutdown clears timer and marks uninitialized', async () => {
    const { limiter } = await makeInitialized();
    await limiter.shutdown();
    // After shutdown, handleMessage should throw
    await expect(limiter.handleMessage(makeMessage())).rejects.toThrow('not initialized');
  });
});
