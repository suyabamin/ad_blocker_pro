// src/shared/storage.ts
// Typed storage access with defaults and safety checks (04_TRD §9, 05_Schema §1, §5)

import { browser } from './browser.js';
import {
  DEFAULT_SETTINGS,
  DEFAULT_FILTER_LISTS,
  SCHEMA_VERSION,
} from './constants.js';
import type {
  Settings,
  FilterListRow,
  AllowlistRow,
  StatsDailyRow,
  TabCountersRow,
} from './types.js';

export interface StorageData {
  schemaVersion: number;
  settings: Settings;
  filterLists: FilterListRow[];
  allowlist: AllowlistRow[];
  customRules: string;
  statsDaily: StatsDailyRow[];
}

export async function getStoredSchemaVersion(): Promise<number> {
  const res = await browser.storage.local.get('schemaVersion');
  return typeof res['schemaVersion'] === 'number' ? res['schemaVersion'] : 0;
}

export async function setStoredSchemaVersion(version: number): Promise<void> {
  await browser.storage.local.set({ schemaVersion: version });
}

export async function getSettings(): Promise<Settings> {
  const res = await browser.storage.local.get('settings');
  if (res['settings'] && typeof res['settings'] === 'object') {
    return { ...DEFAULT_SETTINGS, ...(res['settings'] as Settings) };
  }
  return { ...DEFAULT_SETTINGS, updatedAt: Date.now() };
}

export async function setSettings(settings: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated: Settings = {
    ...current,
    ...settings,
    updatedAt: Date.now(),
  };
  await browser.storage.local.set({ settings: updated });
  return updated;
}

export async function getFilterLists(): Promise<FilterListRow[]> {
  const res = await browser.storage.local.get('filterLists');
  if (Array.isArray(res['filterLists']) && res['filterLists'].length > 0) {
    return res['filterLists'] as FilterListRow[];
  }
  return DEFAULT_FILTER_LISTS;
}

export async function setFilterLists(lists: FilterListRow[]): Promise<void> {
  await browser.storage.local.set({ filterLists: lists });
}

export async function getAllowlist(): Promise<AllowlistRow[]> {
  const res = await browser.storage.local.get('allowlist');
  if (Array.isArray(res['allowlist'])) {
    return res['allowlist'] as AllowlistRow[];
  }
  return [];
}

export async function setAllowlist(list: AllowlistRow[]): Promise<void> {
  await browser.storage.local.set({ allowlist: list });
}

export async function getCustomRules(): Promise<string> {
  const res = await browser.storage.local.get('customRules');
  return typeof res['customRules'] === 'string' ? res['customRules'] : '';
}

export async function setCustomRules(rules: string): Promise<void> {
  await browser.storage.local.set({ customRules: rules });
}

export async function getStatsDaily(): Promise<StatsDailyRow[]> {
  const res = await browser.storage.local.get('statsDaily');
  if (Array.isArray(res['statsDaily'])) {
    return res['statsDaily'] as StatsDailyRow[];
  }
  return [];
}

export async function setStatsDaily(stats: StatsDailyRow[]): Promise<void> {
  await browser.storage.local.set({ statsDaily: stats });
}

// In-memory fallback if storage.session is unsupported
const sessionMemoryFallback = new Map<number, TabCountersRow>();

export async function getTabCounters(
  tabId: number
): Promise<TabCountersRow | null> {
  try {
    if (browser.storage.session) {
      const key = `tab_${tabId}`;
      const res = await browser.storage.session.get(key);
      return (res[key] as TabCountersRow) || null;
    }
  } catch {
    // fallback below
  }
  return sessionMemoryFallback.get(tabId) || null;
}

export async function setTabCounters(
  tabId: number,
  counters: TabCountersRow
): Promise<void> {
  try {
    if (browser.storage.session) {
      const key = `tab_${tabId}`;
      await browser.storage.session.set({ [key]: counters });
      return;
    }
  } catch {
    // fallback below
  }
  sessionMemoryFallback.set(tabId, counters);
}

export async function removeTabCounters(tabId: number): Promise<void> {
  try {
    if (browser.storage.session) {
      await browser.storage.session.remove(`tab_${tabId}`);
      return;
    }
  } catch {
    // fallback below
  }
  sessionMemoryFallback.delete(tabId);
}

/**
 * Initializes storage with defaults idempotently (06_Plan §1.5)
 */
export async function initializeStorage(): Promise<void> {
  const version = await getStoredSchemaVersion();
  if (version === 0) {
    await browser.storage.local.set({
      schemaVersion: SCHEMA_VERSION,
      settings: { ...DEFAULT_SETTINGS, updatedAt: Date.now() },
      filterLists: DEFAULT_FILTER_LISTS,
      allowlist: [],
      customRules: '',
      statsDaily: [],
    });
  }
}
