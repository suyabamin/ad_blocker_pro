// src/content/youtube/adKeys.ts
// Single source of truth for YouTube ad-related object keys (Su Ad Blocker Pro — Layer 1)
// Verified on: 2026-11-05

/**
 * Top-level and nested ad containers inside ytInitialPlayerResponse,
 * /youtubei/v1/player, and /youtubei/v1/next JSON responses.
 */
export const YOUTUBE_AD_KEYS = [
  'adPlacements',
  'playerAds',
  'adSlots',
  'adPlacementRenderer',
  'adBreakHeartbeatParams',
  'invideoAds',
  'advertisement',
] as const;

/**
 * Safe, recursive pruner:
 * Removes ONLY ad keys while strictly preserving playback essentials
 * (streamingData, videoDetails, playabilityStatus, captions, annotations).
 */
export function pruneAdData<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  try {
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        obj[i] = pruneAdData(obj[i]);
      }
      return obj;
    }

    const record = obj as Record<string, unknown>;

    for (const key of YOUTUBE_AD_KEYS) {
      if (key in record) {
        delete record[key];
      }
    }

    // Clean nested ad placements if present inside playerResponse or response
    if (record['playerResponse'] && typeof record['playerResponse'] === 'object') {
      record['playerResponse'] = pruneAdData(record['playerResponse']);
    }

    // Recursively prune next responses or engagement panels if needed
    for (const k of Object.keys(record)) {
      if (
        k !== 'streamingData' &&
        k !== 'videoDetails' &&
        k !== 'captions' &&
        typeof record[k] === 'object' &&
        record[k] !== null
      ) {
        record[k] = pruneAdData(record[k]);
      }
    }
  } catch {
    // Fail-safe: return original object untouched on any pruning error
  }

  return obj;
}
