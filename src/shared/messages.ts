// src/shared/messages.ts
// Typed message sending and background router with sender check (04_TRD §6, 05_Schema §7)

import { browser, type MessageSender } from './browser.js';
import type { Msg, Result } from './types.js';

export async function sendMessage<T>(msg: Msg): Promise<Result<T>> {
  try {
    const res = await browser.runtime.sendMessage(msg);
    if (!res || typeof res !== 'object' || !('ok' in res)) {
      return {
        ok: false,
        error: { code: 'INVALID_RESPONSE', message: 'Malformed response received' },
      };
    }
    return res as Result<T>;
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'MESSAGE_FAILED',
        message: err instanceof Error ? err.message : 'Unknown communication error',
      },
    };
  }
}

export type TypedHandler<T extends Msg['type'], R> = (
  msg: Extract<Msg, { type: T }>,
  sender: MessageSender
) => Promise<R> | R;

export class MessageRouter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handlers = new Map<string, (msg: any, sender: MessageSender) => any>();

  public on<T extends Msg['type'], R>(
    type: T,
    handler: TypedHandler<T, R>
  ): this {
    this.handlers.set(type, handler);
    return this;
  }

  public async handleMessage(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawMsg: any,
    sender: MessageSender
  ): Promise<Result<unknown>> {
    // 1. Validate sender: must originate from our own extension
    const extensionId = browser.runtime.id;
    if (sender.id !== extensionId) {
      return {
        ok: false,
        error: {
          code: 'UNAUTHORIZED_SENDER',
          message: 'Messages from outside the extension are rejected',
        },
      };
    }

    // 2. Validate message format
    if (!rawMsg || typeof rawMsg !== 'object' || typeof rawMsg.type !== 'string') {
      return {
        ok: false,
        error: {
          code: 'INVALID_MESSAGE_FORMAT',
          message: 'Message must be an object with a string type',
        },
      };
    }

    const handler = this.handlers.get(rawMsg.type);
    if (!handler) {
      return {
        ok: false,
        error: {
          code: 'UNKNOWN_MESSAGE',
          message: `Unknown message type: ${String(rawMsg.type)}`,
        },
      };
    }

    try {
      const data = await handler(rawMsg, sender);
      return { ok: true, data };
    } catch (err) {
      return {
        ok: false,
        error: {
          code: 'HANDLER_ERROR',
          message: err instanceof Error ? err.message : 'Internal error handling message',
        },
      };
    }
  }

  public register(): void {
    browser.runtime.onMessage.addListener((msg, sender) => {
      return this.handleMessage(msg, sender);
    });
  }
}
