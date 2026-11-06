// src/content/youtube/mainWorld.ts
// Layer 1 YouTube player-data pruner running in page MAIN world (Su Ad Blocker Pro)
// Verified on: 2026-11-05

import { pruneAdData } from './adKeys.js';

(function initYouTubePlayerPruner() {
  try {
    // Kill switch check: allow user to disable Layer 1 via options
    const isLayer1Disabled = () => {
      return document.documentElement?.getAttribute('data-su-pruning') === 'disabled';
    };

    // 1. Hook window.ytInitialPlayerResponse (initial video load)
    let storedInitialResponse: unknown = undefined;

    // If already defined on window before script ran, prune it immediately
    const win = window as unknown as Record<string, unknown>;
    if (win['ytInitialPlayerResponse']) {
      storedInitialResponse = pruneAdData(win['ytInitialPlayerResponse']);
      win['ytInitialPlayerResponse'] = storedInitialResponse;
    }

    try {
      Object.defineProperty(window, 'ytInitialPlayerResponse', {
        get() {
          return storedInitialResponse;
        },
        set(val: unknown) {
          if (isLayer1Disabled()) {
            storedInitialResponse = val;
          } else {
            storedInitialResponse = pruneAdData(val);
          }
        },
        configurable: true,
        enumerable: true,
      });
    } catch {
      // fallback if property cannot be redefined
    }

    // 2. Hook JSON.parse to prune dynamic player/next endpoint responses
    const origJsonParse = JSON.parse;
    const isPlayerPayload = (value: unknown): boolean => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
      }

      // JSON.parse is used throughout YouTube, including for search suggestions
      // and UI state. Only touch objects with fields unique to player responses.
      const record = value as Record<string, unknown>;
      return (
        'playerResponse' in record ||
        'videoDetails' in record ||
        'streamingData' in record ||
        'playabilityStatus' in record
      );
    };

    JSON.parse = function (text: string, reviver?: (this: unknown, key: string, value: unknown) => unknown) {
      const parsed = origJsonParse.call(this, text, reviver);
      if (isLayer1Disabled() || !isPlayerPayload(parsed)) {
        return parsed;
      }
      return pruneAdData(parsed);
    };

    // 3. Hook Response.prototype.json for Fetch API stream conversions.
    // SCOPE: Only prune player/next API endpoints. Never intercept search-suggest,
    // config, or other endpoints — this prevents main-thread blocking on large
    // search responses and avoids corrupting search result JSON.
    // See docs/SEARCHBAR_BUG_REPORT.md RC-SEARCH-1 / RC-SEARCH-2.
    const PLAYER_URL_PATTERNS = ['/youtubei/v1/player', '/youtubei/v1/next'];
    const isPlayerEndpoint = (url: string): boolean => {
      try {
        const path = new URL(url).pathname;
        return PLAYER_URL_PATTERNS.some((p) => path.includes(p));
      } catch {
        return false;
      }
    };

    if (typeof Response !== 'undefined' && Response.prototype && Response.prototype.json) {
      const origResponseJson = Response.prototype.json;
      Response.prototype.json = async function () {
        const data = await origResponseJson.apply(this);
        // Only prune known YouTube player/next API responses; never touch search
        if (isLayer1Disabled() || !data || typeof data !== 'object') {
          return data;
        }
        try {
          if (!isPlayerEndpoint((this as Response).url)) {
            return data; // Not a player endpoint — return untouched
          }
        } catch {
          return data;
        }
        return pruneAdData(data);
      };
    }
  } catch (err) {
    // Fail-safe: Never throw into host page environment
    console.debug('[Su AdBlock Pro] Layer 1 initialization error:', err);
  }
})();
