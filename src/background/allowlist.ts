// src/background/allowlist.ts
// Dynamic allow rules management and startup reconciliation (04_TRD §5, 05_Schema §2.3)

import { browser, type DnrRule } from '../shared/browser.js';
import { RULE_ID_RANGES, PRIORITIES } from '../shared/constants.js';
import { getAllowlist, setAllowlist } from '../shared/storage.js';
import { isValidHostname } from '../shared/validation.js';
import type { AllowlistRow } from '../shared/types.js';

export function createAllowRule(
  ruleId: number,
  hostname: string
): DnrRule {
  return {
    id: ruleId,
    priority: PRIORITIES.ALLOWLIST,
    action: {
      type: 'allowAllRequests',
    },
    condition: {
      initiatorDomains: [hostname],
      resourceTypes: ['main_frame', 'sub_frame'],
    },
  };
}

export async function getExistingAllowRuleIds(): Promise<number[]> {
  try {
    if (browser.declarativeNetRequest?.getDynamicRules) {
      const dynamicRules = await browser.declarativeNetRequest.getDynamicRules();
      return dynamicRules
        .map((r) => r.id)
        .filter(
          (id) =>
            id >= RULE_ID_RANGES.ALLOWLIST_MIN &&
            id <= RULE_ID_RANGES.ALLOWLIST_MAX
        );
    }
  } catch {
    // ignore
  }
  return [];
}

export function findNextAvailableRuleId(usedIds: Set<number>): number {
  for (
    let id = RULE_ID_RANGES.ALLOWLIST_MIN;
    id <= RULE_ID_RANGES.ALLOWLIST_MAX;
    id++
  ) {
    if (!usedIds.has(id)) {
      return id;
    }
  }
  throw new Error('Allowlist capacity reached (max 9,999 entries)');
}

export async function addAllowlistEntry(
  rawHostname: string
): Promise<AllowlistRow> {
  const hostname = rawHostname.toLowerCase().trim();
  if (!isValidHostname(hostname)) {
    throw new Error(`Invalid hostname: "${hostname}"`);
  }

  const list = await getAllowlist();
  const existing = list.find((item) => item.hostname === hostname);
  if (existing) {
    return existing;
  }

  const usedIds = new Set(list.map((r) => r.ruleId));
  const newRuleId = findNextAvailableRuleId(usedIds);

  const newEntry: AllowlistRow = {
    hostname,
    ruleId: newRuleId,
    createdAt: Date.now(),
  };

  const rule = createAllowRule(newRuleId, hostname);

  if (browser.declarativeNetRequest?.updateDynamicRules) {
    await browser.declarativeNetRequest.updateDynamicRules({
      addRules: [rule],
    });
  }

  list.push(newEntry);
  await setAllowlist(list);
  return newEntry;
}

export async function removeAllowlistEntry(
  rawHostname: string
): Promise<boolean> {
  const hostname = rawHostname.toLowerCase().trim();
  const list = await getAllowlist();
  const target = list.find((item) => item.hostname === hostname);

  if (!target) {
    return false;
  }

  if (browser.declarativeNetRequest?.updateDynamicRules) {
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [target.ruleId],
    });
  }

  const updated = list.filter((item) => item.hostname !== hostname);
  await setAllowlist(updated);
  return true;
}

export async function isAllowlisted(rawHostname: string): Promise<boolean> {
  const hostname = rawHostname.toLowerCase().trim();
  const list = await getAllowlist();
  return list.some(
    (item) => hostname === item.hostname || hostname.endsWith(`.${item.hostname}`)
  );
}

/**
 * Reconciles stored allowlist rows with active dynamic DNR rules (05_Schema §2.3)
 */
export async function reconcileAllowlist(): Promise<void> {
  if (!browser.declarativeNetRequest?.updateDynamicRules) return;

  const storedList = await getAllowlist();
  const currentRuleIds = new Set(await getExistingAllowRuleIds());

  const storedRuleIds = new Set(storedList.map((item) => item.ruleId));

  // 1. Remove orphaned rules in browser that have no storage entry
  const removeRuleIds: number[] = [];
  for (const ruleId of currentRuleIds) {
    if (!storedRuleIds.has(ruleId)) {
      removeRuleIds.push(ruleId);
    }
  }

  // 2. Add missing rules in browser for stored entries
  const addRules: DnrRule[] = [];
  for (const entry of storedList) {
    if (!currentRuleIds.has(entry.ruleId)) {
      addRules.push(createAllowRule(entry.ruleId, entry.hostname));
    }
  }

  if (removeRuleIds.length > 0 || addRules.length > 0) {
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules,
    });
  }
}
