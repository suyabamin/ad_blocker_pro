// tests/setup.ts
// Global test setup for Vitest with callback-aware Chrome mocks
import { vi } from 'vitest';

const g = globalThis as Record<string, unknown>;

function createMockStorageArea() {
  const store = new Map<string, unknown>();

  return {
    _store: store,
    get: vi.fn((keys: unknown, cb?: (res: unknown) => void) => {
      const res: Record<string, unknown> = {};
      if (typeof keys === 'string') {
        res[keys] = store.get(keys);
      } else if (Array.isArray(keys)) {
        for (const k of keys) res[k] = store.get(k);
      } else if (keys === null || keys === undefined) {
        for (const [k, v] of store.entries()) res[k] = v;
      } else if (typeof keys === 'object') {
        for (const [k, defaultVal] of Object.entries(keys as Record<string, unknown>)) {
          res[k] = store.has(k) ? store.get(k) : defaultVal;
        }
      }

      if (typeof cb === 'function') {
        cb(res);
      }
      return Promise.resolve(res);
    }),

    set: vi.fn((items: Record<string, unknown>, cb?: () => void) => {
      for (const [k, v] of Object.entries(items)) {
        store.set(k, v);
      }
      if (typeof cb === 'function') {
        cb();
      }
      return Promise.resolve();
    }),

    remove: vi.fn((keys: string | string[], cb?: () => void) => {
      const arr = Array.isArray(keys) ? keys : [keys];
      for (const k of arr) store.delete(k);
      if (typeof cb === 'function') {
        cb();
      }
      return Promise.resolve();
    }),

    clear: vi.fn((cb?: () => void) => {
      store.clear();
      if (typeof cb === 'function') {
        cb();
      }
      return Promise.resolve();
    }),
  };
}

if (typeof g['chrome'] === 'undefined') {
  g['chrome'] = {
    runtime: {
      id: 'su-adblock-pro-test-runner',
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(),
      },
    },
    extension: {},
    storage: {
      local: createMockStorageArea(),
      session: createMockStorageArea(),
    },
    declarativeNetRequest: {
      getDynamicRules: vi.fn().mockResolvedValue([]),
      updateDynamicRules: vi.fn().mockResolvedValue(undefined),
      updateEnabledRulesets: vi.fn().mockResolvedValue(undefined),
      getAvailableStaticRuleCount: vi.fn().mockResolvedValue(30000),
    },
  };
}
