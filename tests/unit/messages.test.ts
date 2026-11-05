// tests/unit/messages.test.ts
import { describe, it, expect } from 'vitest';
import { MessageRouter } from '../../src/shared/messages.js';

describe('Message Protocol & Router (04_TRD §6, 05_Schema §7)', () => {
  it('handles registered message successfully', async () => {
    const router = new MessageRouter();
    router.on('GET_STATE', () => {
      return { mockState: true };
    });

    const res = await router.handleMessage(
      { type: 'GET_STATE' },
      { id: 'su-adblock-pro-test-runner' }
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual({ mockState: true });
    }
  });

  it('rejects message from unauthorized sender', async () => {
    const router = new MessageRouter();
    router.on('GET_STATE', () => ({}));

    const res = await router.handleMessage(
      { type: 'GET_STATE' },
      { id: 'malicious-extension-id' }
    );

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('UNAUTHORIZED_SENDER');
    }
  });

  it('returns UNKNOWN_MESSAGE for unrecognized message type', async () => {
    const router = new MessageRouter();
    const res = await router.handleMessage(
      { type: 'NON_EXISTENT_MSG' },
      { id: 'su-adblock-pro-test-runner' }
    );

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('UNKNOWN_MESSAGE');
    }
  });

  it('catches handler exceptions and returns Result error without throwing', async () => {
    const router = new MessageRouter();
    router.on('GET_STATE', () => {
      throw new Error('Database disk failure');
    });

    const res = await router.handleMessage(
      { type: 'GET_STATE' },
      { id: 'su-adblock-pro-test-runner' }
    );

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('HANDLER_ERROR');
      expect(res.error.message).toBe('Database disk failure');
    }
  });
});
