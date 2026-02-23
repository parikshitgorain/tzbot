import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  safeReply,
  safeEditReply,
  safeDeferReply,
  safeUpdate,
} from '../../../src/utils/interaction-response.js';

function makeInteraction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'int1',
    replied: false,
    deferred: false,
    reply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    isCommand: vi.fn().mockReturnValue(true),
    commandName: 'test',
    ...overrides,
  } as any;
}

describe('safeReply()', () => {
  it('calls reply() when not yet replied or deferred', async () => {
    const i = makeInteraction();
    expect(await safeReply(i, { content: 'hello' })).toBe(true);
    expect(i.reply).toHaveBeenCalledWith({ content: 'hello' });
  });

  it('calls followUp() when already replied', async () => {
    const i = makeInteraction({ replied: true });
    expect(await safeReply(i, { content: 'hi' })).toBe(true);
    expect(i.followUp).toHaveBeenCalled();
  });

  it('calls editReply() when deferred but not replied', async () => {
    const i = makeInteraction({ deferred: true });
    expect(await safeReply(i, { content: 'hi' })).toBe(true);
    expect(i.editReply).toHaveBeenCalled();
  });

  it('returns false on expired token (code 10062)', async () => {
    const i = makeInteraction();
    i.reply.mockRejectedValue(Object.assign(new Error('Unknown interaction'), { code: 10062 }));
    expect(await safeReply(i, { content: 'hi' })).toBe(false);
  });

  it('returns false on already acknowledged (code 40060)', async () => {
    const i = makeInteraction();
    i.reply.mockRejectedValue(Object.assign(new Error('Already ack'), { code: 40060 }));
    expect(await safeReply(i, { content: 'hi' })).toBe(false);
  });

  it('returns false on generic error', async () => {
    const i = makeInteraction();
    i.reply.mockRejectedValue(new Error('unknown'));
    expect(await safeReply(i, { content: 'hi' })).toBe(false);
  });
});

describe('safeEditReply()', () => {
  it('calls editReply() when deferred', async () => {
    const i = makeInteraction({ deferred: true });
    expect(await safeEditReply(i, { content: 'edited' })).toBe(true);
    expect(i.editReply).toHaveBeenCalled();
  });

  it('calls editReply() when already replied', async () => {
    const i = makeInteraction({ replied: true });
    expect(await safeEditReply(i, { content: 'edited' })).toBe(true);
  });

  it('returns false when not deferred and not replied', async () => {
    const i = makeInteraction({ deferred: false, replied: false });
    expect(await safeEditReply(i, { content: 'edited' })).toBe(false);
  });

  it('returns false on expired token (code 10062)', async () => {
    const i = makeInteraction({ deferred: true });
    i.editReply.mockRejectedValue(Object.assign(new Error('Unknown'), { code: 10062 }));
    expect(await safeEditReply(i, { content: 'x' })).toBe(false);
  });

  it('returns false on generic error', async () => {
    const i = makeInteraction({ deferred: true });
    i.editReply.mockRejectedValue(new Error('fail'));
    expect(await safeEditReply(i, { content: 'x' })).toBe(false);
  });
});

describe('safeDeferReply()', () => {
  it('calls deferReply() when not deferred or replied', async () => {
    const i = makeInteraction();
    expect(await safeDeferReply(i, { ephemeral: true })).toBe(true);
    expect(i.deferReply).toHaveBeenCalledWith({ ephemeral: true });
  });

  it('calls deferReply() with no options', async () => {
    const i = makeInteraction();
    expect(await safeDeferReply(i)).toBe(true);
    expect(i.deferReply).toHaveBeenCalledWith(undefined);
  });

  it('returns false when already deferred', async () => {
    const i = makeInteraction({ deferred: true });
    expect(await safeDeferReply(i)).toBe(false);
  });

  it('returns false when already replied', async () => {
    const i = makeInteraction({ replied: true });
    expect(await safeDeferReply(i)).toBe(false);
  });

  it('returns false on expired token (code 10062)', async () => {
    const i = makeInteraction();
    i.deferReply.mockRejectedValue(Object.assign(new Error('Unknown'), { code: 10062 }));
    expect(await safeDeferReply(i)).toBe(false);
  });

  it('returns false on already acknowledged (code 40060)', async () => {
    const i = makeInteraction();
    i.deferReply.mockRejectedValue(Object.assign(new Error('Ack'), { code: 40060 }));
    expect(await safeDeferReply(i)).toBe(false);
  });

  it('returns false on generic error', async () => {
    const i = makeInteraction();
    i.deferReply.mockRejectedValue(new Error('generic'));
    expect(await safeDeferReply(i)).toBe(false);
  });
});

describe('safeUpdate()', () => {
  it('calls update() successfully', async () => {
    const i = makeInteraction();
    expect(await safeUpdate(i, { content: 'updated' })).toBe(true);
    expect(i.update).toHaveBeenCalledWith({ content: 'updated' });
  });

  it('returns false on expired token (code 10062)', async () => {
    const i = makeInteraction();
    i.update.mockRejectedValue(Object.assign(new Error('Unknown'), { code: 10062 }));
    expect(await safeUpdate(i, {})).toBe(false);
  });

  it('returns false on already acknowledged (code 40060)', async () => {
    const i = makeInteraction();
    i.update.mockRejectedValue(Object.assign(new Error('Ack'), { code: 40060 }));
    expect(await safeUpdate(i, {})).toBe(false);
  });

  it('returns false on generic error', async () => {
    const i = makeInteraction();
    i.update.mockRejectedValue(new Error('generic'));
    expect(await safeUpdate(i, {})).toBe(false);
  });
});
