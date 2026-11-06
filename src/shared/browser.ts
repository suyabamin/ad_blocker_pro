// src/shared/browser.ts
// The ONLY file importing webextension-polyfill (04_TRD §1, §3)

import type {
  Browser,
  DeclarativeNetRequest,
  Runtime,
} from 'webextension-polyfill';

// Ensure a minimal mock exists if evaluated in non-extension environments (e.g., node/vitest)
const g = globalThis as Record<string, unknown>;
if (typeof g['chrome'] === 'undefined' && typeof g['browser'] === 'undefined') {
  g['chrome'] = {
    runtime: { id: 'su-adblock-pro-test-runner' },
  };
}

import browserPolyfill from 'webextension-polyfill';

export type DnrRule = DeclarativeNetRequest.Rule;
export type MessageSender = Runtime.MessageSender;

export const browser: Browser = browserPolyfill;
export default browser;
