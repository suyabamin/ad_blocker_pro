// src/background/stats.ts
// Per-tab counters, daily stats aggregation, and 90-day retention (05_Schema §2.5, §2.6)

import { browser } from '../shared/browser.js';
import { STATS_RETENTION_DAYS, MAX_STATS_INCR_PER_SECOND } from '../shared/constants.js';
import {
  getStatsDaily,
  setStatsDaily,
  getTabCounters,
  setTabCounters,
  removeTabCounters,
} from '../shared/storage.js';

export { removeTabCounters };
import type { StatsDailyRow, TabCountersRow } from '../shared/types.js';

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// In-memory rate limiting map: tabId -> { count: number, timestamp: number }
const rateLimitMap = new Map<number, { count: number; timestamp: number }>();

export function checkRateLimit(tabId: number): boolean {
  const now = Date.now();
  const current = rateLimitMap.get(tabId);
  if (!current || now - current.timestamp >= 1000) {
    rateLimitMap.set(tabId, { count: 1, timestamp: now });
    return true;
  }
  if (current.count >= MAX_STATS_INCR_PER_SECOND) {
    return false;
  }
  current.count++;
  return true;
}

export async function incrementTabCounter(
  tabId: number,
  category: 'network' | 'cosmetic' | 'youtube',
  amount = 1
): Promise<TabCountersRow> {
  const existing = (await getTabCounters(tabId)) || {
    tabId,
    network: 0,
    cosmetic: 0,
    youtube: 0,
    updatedAt: Date.now(),
  };

  existing[category] = (existing[category] || 0) + amount;
  existing.updatedAt = Date.now();
  await setTabCounters(tabId, existing);
  return existing;
}

export async function resetTabCounter(tabId: number): Promise<void> {
  await setTabCounters(tabId, {
    tabId,
    network: 0,
    cosmetic: 0,
    youtube: 0,
    updatedAt: Date.now(),
  });
}

export async function getTabBlockedCount(tabId: number): Promise<number> {
  // 1. Try Chromium getMatchedRules if available (04_TRD §7)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dnr = browser.declarativeNetRequest as any;
    if (dnr?.getMatchedRules) {
      const result = await dnr.getMatchedRules({ tabId });
      if (result && Array.isArray(result.rulesMatchedInfo)) {
        const networkCount = result.rulesMatchedInfo.length;
        const tabData = await getTabCounters(tabId);
        const cosmetic = tabData?.cosmetic || 0;
        const youtube = tabData?.youtube || 0;
        return networkCount + cosmetic + youtube;
      }
    }
  } catch {
    // fallback
  }

  // 2. Fallback to session counter
  const counters = await getTabCounters(tabId);
  if (!counters) return 0;
  return counters.network + counters.cosmetic + counters.youtube;
}

export async function getTodayStats(): Promise<StatsDailyRow> {
  const todayStr = getTodayDateString();
  const daily = await getStatsDaily();
  const found = daily.find((r) => r.date === todayStr);
  return (
    found || {
      date: todayStr,
      networkBlocked: 0,
      cosmeticHidden: 0,
      youtubeAdsSkipped: 0,
    }
  );
}

/**
 * Merges pending increments into storage.local daily stats and trims to 90 days (05_Schema §2.5)
 */
export async function flushStats(): Promise<void> {
  const todayStr = getTodayDateString();
  const daily = await getStatsDaily();

  let todayRow = daily.find((r) => r.date === todayStr);
  if (!todayRow) {
    todayRow = {
      date: todayStr,
      networkBlocked: 0,
      cosmeticHidden: 0,
      youtubeAdsSkipped: 0,
    };
    daily.unshift(todayRow);
  }

  // Sort daily descending by date
  daily.sort((a, b) => b.date.localeCompare(a.date));

  // Retain only last STATS_RETENTION_DAYS (90 days)
  const trimmed = daily.slice(0, STATS_RETENTION_DAYS);
  await setStatsDaily(trimmed);
}

export async function recordStatDirect(
  category: 'network' | 'cosmetic' | 'youtube',
  amount = 1,
  tabId?: number
): Promise<void> {
  if (tabId !== undefined) {
    if (!checkRateLimit(tabId)) {
      return; // Rate limit exceeded (05_Schema §7.3)
    }
    await incrementTabCounter(tabId, category, amount);
  }

  const todayStr = getTodayDateString();
  const daily = await getStatsDaily();
  let todayRow = daily.find((r) => r.date === todayStr);

  if (!todayRow) {
    todayRow = {
      date: todayStr,
      networkBlocked: 0,
      cosmeticHidden: 0,
      youtubeAdsSkipped: 0,
    };
    daily.unshift(todayRow);
  }

  if (category === 'network') todayRow.networkBlocked += amount;
  else if (category === 'cosmetic') todayRow.cosmeticHidden += amount;
  else if (category === 'youtube') todayRow.youtubeAdsSkipped += amount;

  await setStatsDaily(daily.slice(0, STATS_RETENTION_DAYS));
}

export async function resetAllStats(): Promise<void> {
  await setStatsDaily([]);
}
