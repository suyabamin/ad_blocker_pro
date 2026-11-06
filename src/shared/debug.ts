// src/shared/debug.ts
// Local-only ring buffer for diagnostic telemetry-free event logging (Phase 1)

import { browser } from './browser.js';
import type { DebugEvent } from './types.js';

export const MAX_DEBUG_EVENTS = 500;

// In-memory ring buffer (fastest path in background worker)
const inMemoryBuffer: DebugEvent[] = [];

export async function appendDebugEvent(
  event: Omit<DebugEvent, 'timestamp'>
): Promise<void> {
  const fullEvent: DebugEvent = {
    ...event,
    timestamp: Date.now(),
  };

  inMemoryBuffer.push(fullEvent);
  if (inMemoryBuffer.length > MAX_DEBUG_EVENTS) {
    inMemoryBuffer.shift();
  }

  // Persist to storage.session if supported
  try {
    if (browser.storage.session) {
      await browser.storage.session.set({ debugLog: inMemoryBuffer });
    }
  } catch {
    // ignore session storage errors
  }
}

export async function getDebugEvents(limit = 100): Promise<DebugEvent[]> {
  try {
    if (browser.storage.session) {
      const res = await browser.storage.session.get('debugLog');
      if (Array.isArray(res['debugLog'])) {
        const arr = res['debugLog'] as DebugEvent[];
        return arr.slice(-limit);
      }
    }
  } catch {
    // fallback to in-memory
  }
  return inMemoryBuffer.slice(-limit);
}

export async function clearDebugEvents(): Promise<void> {
  inMemoryBuffer.length = 0;
  try {
    if (browser.storage.session) {
      await browser.storage.session.remove('debugLog');
    }
  } catch {
    // ignore
  }
}
