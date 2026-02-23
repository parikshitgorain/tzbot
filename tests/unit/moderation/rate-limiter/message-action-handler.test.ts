import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageActionHandler } from '../../../../src/moderation/rate-limiter/message-action-handler.js';

function makeMessage(opts: { id?: string; channelId?: string } = {}) {
  return {
    id: opts.id ?? 'm1',
    channelId: opts.channelId ?? 'c1',
    author: { id: 'u1' },
    delete: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('MessageActionHandler', () => {
  let mockLogger: {
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };
  let handler: MessageActionHandler;

  beforeEach(() => {
    vi.useFakeTimers();
    mockLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
    handler = new MessageActionHandler(mockLogger as any, 100);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('deleteMessage()', () => {
    it('returns true on successful deletion', async () => {
      const msg = makeMessage();
      expect(await handler.deleteMessage(msg)).toBe(true);
      expect(msg.delete).toHaveBeenCalled();
    });

    it('returns false and logs error for Missing Permissions', async () => {
      const msg = makeMessage();
      msg.delete.mockRejectedValue(new Error('Missing Permissions'));
      expect(await handler.deleteMessage(msg)).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('returns false and logs warn for Unknown Message (already deleted)', async () => {
      const msg = makeMessage();
      msg.delete.mockRejectedValue(new Error('Unknown Message'));
      expect(await handler.deleteMessage(msg)).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('returns false and logs error for other errors', async () => {
      const msg = makeMessage();
      msg.delete.mockRejectedValue(new Error('network error'));
      expect(await handler.deleteMessage(msg)).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('returns false silently for non-Error throws', async () => {
      const msg = makeMessage();
      msg.delete.mockRejectedValue('string error');
      expect(await handler.deleteMessage(msg)).toBe(false);
    });
  });

  describe('sendWarning()', () => {
    it('sends warning message to channel and logs info', async () => {
      const sentMsg = { id: 'sm1', delete: vi.fn().mockResolvedValue(undefined) };
      const channel = { id: 'c1', send: vi.fn().mockResolvedValue(sentMsg) } as any;

      await handler.sendWarning(channel, 'u1', '#general', 'chat-ch');

      expect(channel.send).toHaveBeenCalledWith(expect.stringContaining('u1'));
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Rate limit warning sent',
        expect.objectContaining({ userId: 'u1' }),
      );
    });

    it('schedules deletion of warning message after delay', async () => {
      const sentMsg = { id: 'sm1', delete: vi.fn().mockResolvedValue(undefined) };
      const channel = { id: 'c1', send: vi.fn().mockResolvedValue(sentMsg) } as any;

      await handler.sendWarning(channel, 'u1', '#general', 'chat-ch');
      expect(sentMsg.delete).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(200);
      expect(sentMsg.delete).toHaveBeenCalled();
    });

    it('logs warn when warning message deletion fails', async () => {
      const sentMsg = { id: 'sm1', delete: vi.fn().mockRejectedValue(new Error('already gone')) };
      const channel = { id: 'c1', send: vi.fn().mockResolvedValue(sentMsg) } as any;

      await handler.sendWarning(channel, 'u1', '#general', 'chat-ch');
      await vi.advanceTimersByTimeAsync(200);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('logs error when channel.send fails', async () => {
      const channel = { id: 'c1', send: vi.fn().mockRejectedValue(new Error('send failed')) } as any;
      await handler.sendWarning(channel, 'u1', '#general', 'chat-ch');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to send warning message',
        expect.any(Object),
      );
    });
  });

  describe('deleteSilently()', () => {
    it('deletes message and logs debug on success', async () => {
      const msg = makeMessage();
      await handler.deleteSilently(msg);
      expect(msg.delete).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('does not log debug when deletion fails', async () => {
      const msg = makeMessage();
      msg.delete.mockRejectedValue(new Error('Unknown Message'));
      await handler.deleteSilently(msg);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });
});
