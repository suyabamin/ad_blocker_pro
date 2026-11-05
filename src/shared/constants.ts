// src/shared/constants.ts
// Global constants across background, content, and UI

import type { Settings, FilterListRow } from './types.js';

export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  id: 'singleton',
  enabled: true,
  theme: 'system',
  showBadge: true,
  debug: false,
  youtubePrunePlayerData: true,
  youtubeAutoSkip: true,
  youtubeSpeedUnskippable: true,
  youtubeHideBanners: true,
  updatedAt: 0,
};

export const DEFAULT_FILTER_LISTS: FilterListRow[] = [
  {
    id: 'easylist',
    name: 'EasyList',
    enabled: true,
    ruleCount: 0,
    fetchedAt: 0,
    sourceUrl: 'https://easylist.to/easylist/easylist.txt',
  },
  {
    id: 'easyprivacy',
    name: 'EasyPrivacy',
    enabled: true,
    ruleCount: 0,
    fetchedAt: 0,
    sourceUrl: 'https://easylist.to/easylist/easyprivacy.txt',
  },
  {
    id: 'ublock-filters',
    name: 'uBlock Filters',
    enabled: true,
    ruleCount: 0,
    fetchedAt: 0,
    sourceUrl:
      'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt',
  },
  {
    id: 'annoyances',
    name: 'uBlock Annoyances',
    enabled: false,
    ruleCount: 0,
    fetchedAt: 0,
    sourceUrl:
      'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/annoyances.txt',
  },
];

export const RULE_ID_RANGES = {
  ALLOWLIST_MIN: 1,
  ALLOWLIST_MAX: 9999,
  CUSTOM_MIN: 10000,
  CUSTOM_MAX: 29999,
} as const;

export const PRIORITIES = {
  ALLOWLIST: 1000,
  CUSTOM_ALLOW: 500,
  CUSTOM_BLOCK: 100,
} as const;

export const ALARMS = {
  FLUSH_STATS: 'flush-stats',
} as const;

export const MAX_IMPORT_SIZE_BYTES = 1024 * 1024; // 1 MB
export const STATS_RETENTION_DAYS = 90;
export const HOSTNAME_REGEX = /^[a-z0-9.-]{1,253}$/;
export const MAX_STATS_INCR_PER_SECOND = 50;
