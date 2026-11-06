// src/shared/validation.ts
// Input and schema validation (04_TRD §9, 05_Schema §7)

import { HOSTNAME_REGEX, MAX_IMPORT_SIZE_BYTES } from './constants.js';
import type { ExportFile, Settings } from './types.js';

/**
 * Validates a normalized hostname against security and syntax rules.
 */
export function isValidHostname(hostname: string): boolean {
  if (!hostname || hostname.length > 253) return false;
  if (!HOSTNAME_REGEX.test(hostname)) return false;
  if (hostname.startsWith('.') || hostname.endsWith('.')) return false;
  if (hostname.startsWith('-') || hostname.endsWith('-')) return false;
  if (hostname.includes('..')) return false;
  return true;
}

/**
 * Normalizes a URL or raw string to a clean lowercase hostname.
 */
export function normalizeHostname(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  let str = input.trim().toLowerCase();
  // Strip protocol if present
  if (str.includes('://')) {
    try {
      const url = new URL(str);
      str = url.hostname;
    } catch {
      return null;
    }
  } else {
    // Strip leading slashes, path, port, query
    str = str.split('/')[0] ?? '';
    str = str.split(':')[0] ?? '';
    str = str.split('?')[0] ?? '';
    str = str.split('#')[0] ?? '';
  }
  return isValidHostname(str) ? str : null;
}

/**
 * Validates settings object fields.
 */
export function isValidSettings(obj: unknown): obj is Settings {
  if (!obj || typeof obj !== 'object') return false;
  const s = obj as Record<string, unknown>;
  return (
    s['id'] === 'singleton' &&
    typeof s['enabled'] === 'boolean' &&
    ['system', 'light', 'dark'].includes(s['theme'] as string) &&
    typeof s['showBadge'] === 'boolean' &&
    typeof s['debug'] === 'boolean' &&
    (s['youtubePrunePlayerData'] === undefined || typeof s['youtubePrunePlayerData'] === 'boolean') &&
    typeof s['youtubeAutoSkip'] === 'boolean' &&
    typeof s['youtubeSpeedUnskippable'] === 'boolean' &&
    typeof s['youtubeHideBanners'] === 'boolean'
  );
}

/**
 * Validates imported JSON string against the ExportFile schema.
 */
export function validateImportJson(
  rawJson: string
): { valid: true; file: ExportFile } | { valid: false; errors: string[] } {
  if (typeof rawJson !== 'string' || rawJson.length > MAX_IMPORT_SIZE_BYTES) {
    return {
      valid: false,
      errors: ['File size exceeds the 1MB safety limit or is not text.'],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    return {
      valid: false,
      errors: [
        `Invalid JSON syntax: ${err instanceof Error ? err.message : 'Parse error'}`,
      ],
    };
  }

  const errors: string[] = [];
  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, errors: ['Imported file is not an object.'] };
  }

  const data = parsed as Record<string, unknown>;
  if (data['app'] !== 'su-adblock-pro' && data['app'] !== 'hush') {
    errors.push('Invalid app signature (must be "su-adblock-pro" or "hush").');
  }
  if (typeof data['schemaVersion'] !== 'number') {
    errors.push('Missing schemaVersion.');
  }
  if (!isValidSettings(data['settings'])) {
    errors.push('Invalid settings format.');
  }

  if (!Array.isArray(data['filterLists'])) {
    errors.push('filterLists must be an array.');
  } else {
    for (const [idx, item] of data['filterLists'].entries()) {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof item.id !== 'string' ||
        typeof item.enabled !== 'boolean'
      ) {
        errors.push(`filterLists[${idx}] is invalid.`);
      }
    }
  }

  if (!Array.isArray(data['allowlist'])) {
    errors.push('allowlist must be an array.');
  } else {
    for (const [idx, item] of data['allowlist'].entries()) {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof item.hostname !== 'string' ||
        !isValidHostname(item.hostname)
      ) {
        errors.push(
          `allowlist[${idx}] has an invalid hostname "${item?.hostname}".`
        );
      }
    }
  }

  if (typeof data['customRules'] !== 'string') {
    errors.push('customRules must be a string.');
  }

  if (errors.length > 0) {
    return { valid: false, errors: errors.slice(0, 5) }; // Limit to first 5 per 02_AppFlow §3
  }

  return { valid: true, file: parsed as ExportFile };
}
