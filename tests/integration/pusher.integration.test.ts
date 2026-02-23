/**
 * @file pusher.integration.test.ts
 * @description Integration tests for Pusher client connectivity
 * 
 * Note: These tests verify the Pusher client can connect to Kick's infrastructure.
 * They may be skipped in CI environments without network access.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PusherClient } from '../../src/services/pusher/client.js';
import type { ConnectionState } from '../../src/services/pusher/types.js';

describe('Pusher Integration Tests', () => {
  let client: PusherClient;

  beforeEach(() => {
    client = new PusherClient();
  });

  afterEach(async () => {
    await client.disconnect();
  });

  it('should connect to Pusher successfully', async () => {
    // Use a known public Kick channel for testing
    // Note: This requires actual network connectivity
    const testChannelId = '1'; // Kick's main channel

    const states: ConnectionState[] = [];
    const onConnectionChange = (state: ConnectionState) => {
      states.push(state);
    };

    await client.connect({
      channelId: testChannelId,
      onConnectionChange,
    });

    expect(client.isConnected()).toBe(true);
    expect(client.getConnectionState()).toBe('connected');
    expect(states).toContain('connecting');
    expect(states).toContain('connected');
  }, 15000); // 15 second timeout for network operations

  it('should handle disconnection gracefully', async () => {
    const testChannelId = '1';

    await client.connect({
      channelId: testChannelId,
    });

    expect(client.isConnected()).toBe(true);

    await client.disconnect();

    expect(client.isConnected()).toBe(false);
    expect(client.getConnectionState()).toBe('disconnected');
  }, 15000);

  it('should receive connection state updates', async () => {
    const testChannelId = '1';
    const states: ConnectionState[] = [];

    await client.connect({
      channelId: testChannelId,
      onConnectionChange: (state) => {
        states.push(state);
      },
    });

    // Should have received state updates
    expect(states.length).toBeGreaterThan(0);
    expect(states).toContain('connected');
  }, 15000);

  it('should maintain connection for extended period', async () => {
    const testChannelId = '1';
    let connectionLost = false;

    await client.connect({
      channelId: testChannelId,
      onConnectionChange: (state) => {
        if (state === 'disconnected' || state === 'failed') {
          connectionLost = true;
        }
      },
    });

    // Wait 5 seconds to verify connection stability
    await new Promise((resolve) => setTimeout(resolve, 5000));

    expect(client.isConnected()).toBe(true);
    expect(connectionLost).toBe(false);
  }, 10000);
});
